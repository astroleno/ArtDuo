// End-to-end diagnostic probe: collects timings and key outputs per stage
// Usage: node test/diagnostic-probe.js [baseUrl] [emotion] [userInput]
// Outputs: docs_archive/curation-diagnostic.md and curation-diagnostic.json

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;
      const data = JSON.stringify(body || {});
      const req = lib.request({
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => buf += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(buf || '{}');
            resolve({ status: res.statusCode, json });
          } catch (e) {
            resolve({ status: res.statusCode, json: { _raw: buf } });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

(async () => {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const emotion = process.argv[3] || 'joy';
  const userInput = process.argv[4] || 'bright colors, family, celebration';
  const api = (p) => `${baseUrl.replace(/\/$/, '')}${p}`;

  const results = { meta: { baseUrl, emotion, userInput, timestamp: new Date().toISOString() }, stages: [] };

  async function stage(name, url, body) {
    const t0 = Date.now();
    const { status, json } = await postJson(url, body);
    const t = Date.now() - t0;
    results.stages.push({ name, url, status, durationMs: t, body, outputSummary: summarize(name, json), raw: json });
    return json;
  }

  function summarize(name, json) {
    try {
      if (!json || typeof json !== 'object') return { note: 'no-json' };
      if (name === 'search-plan') return { keywords: json.searchPlan?.keywords, sources: json.searchPlan?.sources };
      if (name === 'search') return { success: json.success, totalFound: json.totalFound, count: Array.isArray(json.artworks) ? json.artworks.length : 0 };
      if (name === 'scoring') return { successCount: json.successCount, failureCount: json.failureCount, totalProcessed: json.totalProcessed };
      if (name === 'selection') return { selectedCount: json.selectedArtworks?.length || 0 };
      if (name === 'emotion-curve') return { points: Array.isArray(json.curve?.points) ? json.curve.points.length : (Array.isArray(json.curve) ? json.curve.length : 0) };
      if (name === 'explanation') return { durationMs: json.durationMs, successCount: json.result?.successCount, failureCount: json.result?.failureCount };
      if (name === 'summary') return { durationMs: json.durationMs, length: json.length };
      if (name === 'curate') return { success: json.success, scoredCount: json.diagnostics?.scoredCount, summaryTime: json.diagnostics?.summaryTime };
      return { note: 'ok' };
    } catch {
      return { note: 'summarize-error' };
    }
  }

  try {
    // 1) plan
    const plan = await stage('search-plan', api('/api/curate/test-search-plan'), { emotion, userInput });
    // 2) search (coarse)
    const search = await stage('search', api('/api/curate/test-search'), { emotion, userInput });
    const artworks = Array.isArray(search.artworks) ? search.artworks.slice(0, 30) : [];
    // 3) scoring
    const scoring = await stage('scoring', api('/api/curate/test-batch-scoring'), { artworks, emotion, userInput });
    // 4) selection
    const selection = await stage('selection', api('/api/curate/test-selection'), { artworks, scores: scoring?.scores || [], emotion, count: 9 });
    const selected = selection?.selectedArtworks || [];
    // 5) explanation
    const explanation = await stage('explanation', api('/api/curate/test-explanation'), { artworks: selected, emotion, userInput, curationStrategy: plan?.llmAnalysis?.curation_strategy });
    // 6) summary
    const summary = await stage('summary', api('/api/curate/test-summary'), { artworks: selected, emotion, explanations: explanation?.result?.explanations || [], userInput });
    // 7) full curate (non-stream)
    const curate = await stage('curate', api('/api/curate'), { emotion, userInput });

    // write markdown and json
    const outDir = path.resolve(process.cwd(), 'docs_archive');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const jsonFile = path.join(outDir, 'curation-diagnostic.json');
    fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2), 'utf8');

    const lines = [];
    lines.push(`# 策展阶段诊断报告`);
    lines.push('');
    lines.push(`- 基础URL: ${baseUrl}`);
    lines.push(`- Emotion: ${emotion}`);
    lines.push(`- UserInput: ${userInput}`);
    lines.push(`- 生成时间: ${results.meta.timestamp}`);
    lines.push('');
    lines.push(`## 阶段耗时与输出概览`);
    lines.push('');
    lines.push(`| 阶段 | 耗时(ms) | 状态 | 摘要 |`);
    lines.push(`| --- | ---: | ---: | --- |`);
    for (const s of results.stages) {
      const summary = JSON.stringify(s.outputSummary || {});
      lines.push(`| ${s.name} | ${s.durationMs} | ${s.status} | ${summary} |`);
    }
    lines.push('');
    lines.push(`> 完整原始数据见 ${path.basename(jsonFile)}`);

    const mdFile = path.join(outDir, 'curation-diagnostic.md');
    fs.writeFileSync(mdFile, lines.join('\n'), 'utf8');
    console.log('✔ Diagnostic written to', mdFile, 'and', jsonFile);
    process.exit(0);
  } catch (e) {
    console.error('✖ Diagnostic probe failed:', e.message);
    process.exit(1);
  }
})();


