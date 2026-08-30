import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";

import {
  MULTITEXT_CASES,
  gradeMultitextOutput,
  summarizeMultitextRuns,
} from "./deepseek-multitext-prompt.mjs";

const inputPath = process.argv[2];
if (!inputPath) throw new Error("Usage: node deepseek-multitext-regrade.mjs <eval.json>");

const report = JSON.parse(readFileSync(inputPath, "utf8"));
const caseById = new Map(MULTITEXT_CASES.map((item) => [item.id, item]));

for (const row of report.runs ?? []) {
  const item = caseById.get(row.id);
  if (!item) throw new Error(`Unknown case id: ${row.id}`);
  row.grade = row.parsed ? gradeMultitextOutput(item, row.parsed) : null;
}

report.summary = summarizeMultitextRuns(report.runs ?? []);
report.regradedAt = new Date().toISOString();
report.graderVersion = "negation-aware-v2";

const extension = extname(inputPath);
const stem = basename(inputPath, extension);
const outputPath = join(dirname(inputPath), `${stem}-regraded${extension}`);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

const markdownPath = join(dirname(inputPath), `${stem}-regraded.md`);
const lines = [
  "# DeepSeek V4 Flash 多文本类型流式 Eval（negation-aware-v2）",
  "",
  "| Variant | Samples | Usable | Hard pass | Emotion | Artwork | Framing | TTFT median | Total median | Input tokens | Output tokens |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
];
for (const item of report.summary) {
  const category = (name) => {
    const value = item.categories?.[name];
    return value ? `${value.hardPasses}/${value.samples}` : "—";
  };
  lines.push(`| ${item.variant} | ${item.samples} | ${item.usable} | ${item.hardPasses}/${item.samples} (${(item.hardPassRate * 100).toFixed(1)}%) | ${category("emotion")} | ${category("artwork_intro")} | ${category("framing_text")} | ${Math.round(item.firstTextMedianMs)} ms | ${Math.round(item.totalMedianMs)} ms | ${item.inputTokensAverage.toFixed(0)} | ${item.outputTokensAverage.toFixed(0)} |`);
}
writeFileSync(markdownPath, `${lines.join("\n")}\n`);

console.log(`REGRADed_JSON=${outputPath}`);
console.log(`REGRADed_MD=${markdownPath}`);
