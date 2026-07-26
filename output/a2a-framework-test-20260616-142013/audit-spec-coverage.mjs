import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const specPath = "docs/specs/artduo-v2-a2a-framework-test-examples.md";
const outDir = "output/a2a-framework-test-20260616-142013";
const spec = readFileSync(join(root, specPath), "utf8");

function stripMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<br\s*\/?>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function backtickValues(value) {
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter(Boolean);
}

function extractPaths(layer) {
  return backtickValues(layer)
    .filter((value) => /^(packages|apps|scripts)\//.test(value))
    .filter((value) => /\.[a-z0-9]+$/i.test(value));
}

function normalizeForSearch(value) {
  return stripMarkdown(value)
    .replace(/[，。；：！？、]/g, " ")
    .replace(/[.,;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const rows = [];
for (const line of spec.split(/\r?\n/)) {
  if (!/^\|\s*A\d+-\d+/.test(line)) continue;
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length < 5) continue;
  const [id, layer, input, assertions, risk] = cells;
  const paths = extractPaths(layer);
  const pathChecks = paths.map((path) => ({
    path,
    exists: existsSync(join(root, path)),
  }));
  const sourceText = pathChecks
    .filter((check) => check.exists)
    .map((check) => readFileSync(join(root, check.path), "utf8"))
    .join("\n");
  const idMentioned = sourceText.includes(id);
  const inputCandidates = backtickValues(input)
    .map(normalizeForSearch)
    .filter((value) => value.length >= 8 && !/^(ArtworkRecord|results|backgroundScenes|\[|\{)/.test(value));
  const inputMentioned = inputCandidates.some((candidate) => sourceText.includes(candidate));
  const allPathsExist = pathChecks.length > 0 && pathChecks.every((check) => check.exists);
  const hasRunnableLayer = allPathsExist || /scripts\/evaluate-intent-immersion\.ts/.test(layer);
  let status = "not_automated";
  if (idMentioned || inputMentioned) status = "one_to_one_source_evidence";
  else if (hasRunnableLayer) status = "layer_covered_only";
  else if (/E2E\/replay case|人工评审|checklist/i.test(layer)) status = "manual_or_e2e_only";

  rows.push({
    id,
    layer: stripMarkdown(layer),
    paths: pathChecks,
    input: stripMarkdown(input),
    assertions: stripMarkdown(assertions),
    risk: stripMarkdown(risk),
    idMentioned,
    inputMentioned,
    status,
  });
}

const counts = rows.reduce((acc, row) => {
  acc[row.status] = (acc[row.status] ?? 0) + 1;
  return acc;
}, {});

const byAgent = rows.reduce((acc, row) => {
  const agent = row.id.split("-")[0];
  acc[agent] ??= { total: 0 };
  acc[agent].total += 1;
  acc[agent][row.status] = (acc[agent][row.status] ?? 0) + 1;
  return acc;
}, {});

const result = {
  specPath,
  totalRows: rows.length,
  counts,
  byAgent,
  rows,
};

mkdirSync(join(root, outDir), { recursive: true });
writeFileSync(join(root, outDir, "spec-coverage-audit.json"), `${JSON.stringify(result, null, 2)}\n`);

const lines = [];
lines.push("# A2A Spec Coverage Audit");
lines.push("");
lines.push(`- Spec: \`${specPath}\``);
lines.push(`- Rows parsed: ${rows.length}`);
lines.push(`- One-to-one source evidence: ${counts.one_to_one_source_evidence ?? 0}`);
lines.push(`- Layer covered only: ${counts.layer_covered_only ?? 0}`);
lines.push(`- Manual/E2E only: ${counts.manual_or_e2e_only ?? 0}`);
lines.push(`- Not automated: ${counts.not_automated ?? 0}`);
lines.push("");
lines.push("## By Agent");
lines.push("");
lines.push("| Agent | Total | One-to-one | Layer-only | Manual/E2E | Not automated |");
lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
for (const agent of Object.keys(byAgent).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))) {
  const entry = byAgent[agent];
  lines.push(`| ${agent} | ${entry.total} | ${entry.one_to_one_source_evidence ?? 0} | ${entry.layer_covered_only ?? 0} | ${entry.manual_or_e2e_only ?? 0} | ${entry.not_automated ?? 0} |`);
}
lines.push("");
lines.push("## Row Status");
lines.push("");
lines.push("| ID | Status | Layer | Existing paths |");
lines.push("| --- | --- | --- | --- |");
for (const row of rows) {
  const existing = row.paths.length
    ? row.paths.map((check) => `${check.exists ? "yes" : "no"}:${check.path}`).join("<br>")
    : "-";
  lines.push(`| ${row.id} | ${row.status} | ${row.layer.replace(/\|/g, "\\|")} | ${existing} |`);
}
lines.push("");
lines.push("## Status Meaning");
lines.push("");
lines.push("- `one_to_one_source_evidence`: the referenced test source contains the case ID or the literal input from the spec row.");
lines.push("- `layer_covered_only`: the referenced automated test layer exists and was runnable, but this exact matrix row is not visibly asserted one-to-one.");
lines.push("- `manual_or_e2e_only`: the row is expressed as an E2E/replay/manual journey rather than a current unit test file.");
lines.push("- `not_automated`: no current runnable file path was found from the row.");
writeFileSync(join(root, outDir, "spec-coverage-audit.md"), `${lines.join("\n")}\n`);

console.log(JSON.stringify({
  totalRows: rows.length,
  counts,
  outputJson: join(root, outDir, "spec-coverage-audit.json"),
  outputMd: join(root, outDir, "spec-coverage-audit.md"),
}, null, 2));
