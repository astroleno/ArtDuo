// Loaded by experience-wait-probe.mjs into an isolated Ego Browser session.
const fs = await import("node:fs/promises");
const spaceName = job.spaceName ?? "ArtDuo synthetic wait " + job.session;
const existing = job.spaceName && (await listTaskSpaces()).find(space => space.name === spaceName);
const task = await taskSpace(existing?.id ?? spaceName);
const page = (await task.pages())[0] ?? await task.newPage();
console.log("ARTDUO_WAIT_SPACE=" + task.spaceId);
const entry = ".experience-intent-form textarea, .experience-intent-form input[name=query]";
const enter = ".experience-preface-actions > button";
const key = "artduo.local-wait." + job.session;
const origin = new URL(job.url).origin;
const cases = [
  { id: "vonnoh", query: "只想看《Spring in France》一幅画。", artworkId: "artic-97292" },
  { id: "holi", query: "请只展出一幅《Krishna celebrates Holi》。", artworkId: "cma-314236" },
  { id: "ancher", query: "这次只看《A Young Girl Plaiting her Hair》一幅画。", artworkId: "smk-KMS3827" },
];
const hook = await page.cdp("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  if (location.origin !== ${JSON.stringify(origin)}) return;
  const key = ${JSON.stringify(key)};
  const now = () => performance.timeOrigin + performance.now();
  const read = () => JSON.parse(sessionStorage.getItem(key) ?? "{}");
  const save = sample => sessionStorage.setItem(key, JSON.stringify(sample));
  const visible = element => element && element.getBoundingClientRect().height > 0;
  const maybePreface = () => {
    const sample = read();
    if (sample.preface || (!sample.submit && !sample.direct)) return;
    const button = document.querySelector(${JSON.stringify(enter)});
    const headline = document.querySelector("h1.experience-preface-text");
    if (visible(headline) && headline.textContent.trim() && visible(button) && !button.disabled) {
      save({ ...sample, preface: now() });
    }
  };
  window.addEventListener("submit", event => {
    if (event.target.matches(".experience-intent-form")) save({ submit: now() });
  }, true);
  window.addEventListener("click", event => {
    if (!event.target.closest(${JSON.stringify(enter)})) return;
    const sample = read();
    if (!sample.enter) save({ ...sample, enter: now() });
  }, true);
  window.addEventListener("artduo:artwork-ready", event => {
    const sample = read();
    if (sample.enter && !sample.ready) save({ ...sample, ready: now(), artworkId: event.detail.artworkId });
  });
  new MutationObserver(maybePreface).observe(document, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ["disabled", "class", "style", "hidden"] });
})()` });

const results = [];
const interval = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round(b - a) : null;
async function open(target) {
  if (new URL(target).origin !== origin) throw new Error("The probe only visits its configured local origin");
  try { await page.goto(target, { timeout: 16000 }); }
  catch (error) { if (!String(error).includes("navigation committed")) throw error; }
}

async function measure(item, mode, saved) {
  const row = { id: item.id, mode, status: "not-run", submitToPrefaceMs: null,
    enterToFirstPaintingMs: null, submitToFirstPaintingMs: null };
  results.push(row);
  const direct = mode === "saved";
  if (direct && !saved) {
    row.reason = "No verified synthetic curation from the fresh run";
    return;
  }
  let failureStage = "opening";
  let savedUrl;
  try {
    if (direct) {
      await open(job.url + "/?view=experience");
      await page.evaluate(key => sessionStorage.setItem(key, JSON.stringify({ direct: true })), key);
      await open(saved);
    } else {
      await open(job.url + "/?view=experience");
      await page.waitForSelector(entry, { state: "visible", timeout: 12000 });
      await page.fill(entry, item.query);
      await page.press('.experience-intent-form button[type="submit"]', "Enter");
    }
    failureStage = "preface";
    await page.waitForFunction(key => {
      const sample = JSON.parse(sessionStorage.getItem(key) ?? "{}");
      return sample.preface && document.querySelector("h1.experience-preface-text")
        && document.querySelector(".experience-preface-actions > button:not([disabled])");
    }, key, { timeout: 24000 });
    failureStage = "record";
    const preface = new URL(await page.url());
    const curationId = preface.searchParams.get("curationId");
    if (preface.origin !== origin || !/^[a-f0-9]{64}$/u.test(curationId ?? "")) throw new Error("Missing local curation ID");
    const record = JSON.parse(await fs.readFile(job.stateDir + "/curations/" + curationId + ".json", "utf8"));
    if (record.query !== item.query || !record.degraded?.includes("intent-unavailable")) {
      throw new Error("Saved curation does not match the expected synthetic request and rules path");
    }
    preface.searchParams.set("phase", "preface");
    savedUrl = preface.toString();
    row.selectionVersion = record.selectionVersion;
    row[direct ? "originalDegraded" : "degraded"] = record.degraded;
    failureStage = "first-paint";
    await page.press(enter, "Enter");
    await page.waitForFunction(key => JSON.parse(sessionStorage.getItem(key) ?? "{}").ready, key, { timeout: 24000 });
    const sample = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), key);
    if (sample.artworkId !== item.artworkId) throw new Error("Unexpected first artwork");
    row.artworkId = sample.artworkId;
    row.submitToPrefaceMs = direct ? null : interval(sample.submit, sample.preface);
    row.enterToFirstPaintingMs = interval(sample.enter, sample.ready);
    row.submitToFirstPaintingMs = direct ? null : interval(sample.submit, sample.ready);
    if (row.enterToFirstPaintingMs === null || (!direct && (row.submitToPrefaceMs === null || row.submitToFirstPaintingMs === null))) {
      throw new Error("Missing or out-of-order browser timing marks");
    }
    row.status = "ok";
  } catch (error) {
    row.status = "failed";
    row.failureStage = failureStage;
    row.reason = error instanceof Error ? error.message : String(error);
  }
  return savedUrl;
}

try {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, mobile: true, deviceScaleFactor: 1 });
  await page.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await page.cdp("Network.enable");
  await page.cdp("Network.setCacheDisabled", { cacheDisabled: false });
  await page.cdp("Network.setBlockedURLs", { urls: ["https://*"] });
  const saved = new Map();
  for (const item of cases) saved.set(item.id, await measure(item, "fresh-rules"));
  for (const item of cases) await measure(item, "saved", saved.get(item.id));
  const report = {
    source: "Local browser emulation with synthetic named requests",
    viewport: { width: 390, height: 844, devicePixelRatio: 1, reducedMotion: true },
    cacheState: { preparedResources: job.cacheState, browserCache: "enabled, isolated task space, no clearing between samples" },
    timing: { submit: "form submit capture", preface: "visible heading and enabled enter button", enter: "button click capture", firstPainting: "artduo:artwork-ready for expected work" },
    results,
    summary: summarizeWaitSamples(results),
  };
  await fs.writeFile(job.output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(report.summary));
} finally {
  await page.cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: hook.identifier });
}
