// Generate a Markdown report for /api/curate/stream timings and outputs
// Usage: node test/curate-stream-report.js [baseUrl] [emotion] [userInput]
// Example: node test/curate-stream-report.js http://localhost:3000 joy "bright colors, family, celebration"

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

function fetchSSE(url, body, onEvent) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request({
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.setEncoding('utf8');
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk;
          const parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6);
            try {
              const evt = JSON.parse(json);
              onEvent(evt);
            } catch (_) {
              // ignore parse errors
            }
          }
        });
        res.on('end', () => resolve());
      });
      req.on('error', reject);
      req.write(JSON.stringify(body || {}));
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
  const streamUrl = `${baseUrl.replace(/\/$/, '')}/api/curate/stream`;

  const timeline = []; // { type, t, relMs, payload }
  const startTs = Date.now();

  function record(evt) {
    const { type, payload } = evt || {};
    const t = Date.now();
    const relMs = t - startTs;
    timeline.push({ type, t, relMs, payload });
  }

  try {
    await fetchSSE(streamUrl, { emotion, userInput }, record);

    const rows = [];
    const seq = ['start','plan','coarse','score','select','summary','explanation','complete'];
    for (let i = 0; i < seq.length; i++) {
      const type = seq[i];
      const e = timeline.find(x => x.type === type);
      const prev = i > 0 ? timeline.find(x => x.type === seq[i-1]) : null;
      if (!e) continue;
      const duration = e.payload && typeof e.payload.durationMs === 'number' ? e.payload.durationMs : (prev ? (e.relMs - prev.relMs) : e.relMs);
      rows.push({ step: type, relMs: e.relMs, deltaMs: duration, payload: e.payload });
    }

    const lines = [];
    lines.push(`# 策展流式流程报告`);
    lines.push('');
    lines.push(`- 基础URL: ${baseUrl}`);
    lines.push(`- Emotion: ${emotion}`);
    lines.push(`- UserInput: ${userInput}`);
    lines.push(`- 生成时间: ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`## 阶段耗时（ms）与关键信息`);
    lines.push('');
    lines.push(`| 步骤 | 相对时间(ms) | 阶段耗时(ms) | 关键信息 |`);
    lines.push(`| --- | ---: | ---: | --- |`);
    for (const r of rows) {
      const infoStr = '```json ' + JSON.stringify(r.payload || {}, null, 0) + ' ```';
      lines.push(`| ${r.step} | ${r.relMs} | ${r.deltaMs} | ${infoStr} |`);
    }
    lines.push('');
    lines.push(`## 原始事件顺序（时间戳ms）`);
    lines.push('');
    for (const e of timeline) {
      lines.push(`- ${e.relMs}ms: ${e.type}`);
    }
    lines.push('');

    const outDir = path.resolve(process.cwd(), 'docs_archive');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'curation-sse-report.md');
    fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
    console.log('✔ Report written to', outFile);
    process.exit(0);
  } catch (e) {
    console.error('✖ Report generation failed:', e.message);
    process.exit(1);
  }
})();


