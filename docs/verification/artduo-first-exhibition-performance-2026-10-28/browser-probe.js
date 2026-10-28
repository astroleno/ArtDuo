(() => {
  if (window.__artduoFirstPaintProbe) return;
  const key = 'artduo.first-paint.qa';
  const now = () => performance.timeOrigin + performance.now();
  let submitted;
  try { submitted = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  const record = { version: 1, submitted, documentOrigin: performance.timeOrigin, events: [], errors: [], visibilityChanges: [] };
  window.__artduoFirstPaintProbe = record;
  document.addEventListener('submit', event => {
    const input = event.target.querySelector('input[name="query"]');
    if (!input?.value.trim()) return;
    submitted = { at: now(), query: input.value.trim() };
    record.submitted = submitted;
    sessionStorage.setItem(key, JSON.stringify(submitted));
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest('button[aria-label="跳过前言，开始观展"]')) record.prefaceClickedAt = now();
  }, true);
  for (const name of ['artduo:artwork-ready', 'artduo:experience-degraded']) {
    window.addEventListener(name, event => record.events.push({ name, at: now(), detail: event.detail }));
  }
  window.addEventListener('error', event => record.errors.push({ message: event.message, source: event.filename }));
  window.addEventListener('unhandledrejection', event => record.errors.push({ message: String(event.reason) }));
  document.addEventListener('visibilitychange', () => record.visibilityChanges.push({ at: now(), state: document.visibilityState }));
  let stopped = false;
  const inspect = () => {
    if (stopped || performance.now() > 120000) return;
    const preface = document.querySelector('.experience-preface');
    const enter = preface?.querySelector('button[aria-label="跳过前言，开始观展"]');
    if (preface && enter && !enter.disabled) record.prefaceReadyAt ??= now();
    const figure = document.querySelector('figure.immersive-lightbox[data-image-state="ready"]');
    const image = figure?.querySelector('img.immersive-preview-image');
    const rect = image?.getBoundingClientRect();
    if (image?.complete && image.naturalWidth > 0 && rect?.width > 0 && rect.height > 0) {
      let settled = true;
      for (let node = image; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (Number(style.opacity) < .99 || style.visibility === 'hidden') settled = false;
        if (node.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)) settled = false;
      }
      if (settled) record.visibleAt ??= now();
      const next = document.querySelector('button[aria-label="下一件作品"]');
      const bounds = next?.getBoundingClientRect();
      const hit = bounds ? document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) : null;
      if (settled && next && !next.disabled && next.contains(hit) && !document.querySelector('.experience-walk.is-transitioning')) {
        record.actionableAt = now();
        record.firstArtwork = image.alt;
        record.imageSource = image.currentSrc;
        record.viewport = { width: innerWidth, height: innerHeight };
        stopped = true;
        return;
      }
    }
    requestAnimationFrame(inspect);
  };
  requestAnimationFrame(inspect);
})();
