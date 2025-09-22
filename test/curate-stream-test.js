// Minimal SSE test for /api/curate/stream
// Usage: node test/curate-stream-test.js [baseUrl]
// baseUrl default: http://localhost:3000
// The script prints received events and asserts required sequence and fields.

const http = require('http');
const https = require('https');
const { URL } = require('url');

function fetchSSE(url, body) {
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
            if (line.startsWith('data: ')) {
              const json = line.slice(6);
              try {
                const evt = JSON.parse(json);
                onEvent(evt);
              } catch (e) {
                console.error('Parse event failed:', e);
              }
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

const baseUrl = process.argv[2] || 'http://localhost:3000';
const streamUrl = `${baseUrl.replace(/\/$/, '')}/api/curate/stream`;

const requiredOrder = ['start','plan','coarse','score','select','summary','explanation','complete'];
let seen = [];
let gotError = false;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function onEvent(evt) {
  const { type, payload } = evt || {};
  console.log('EVENT:', type, payload && Object.keys(payload));
  if (type === 'error') {
    gotError = true;
    console.error('SSE error:', payload);
    return;
  }
  seen.push(type);
  // quick shape checks
  switch (type) {
    case 'plan':
      assert(payload && payload.searchPlan && Array.isArray(payload.searchPlan.keywords), 'plan: keywords missing');
      break;
    case 'coarse':
      assert(typeof payload.total === 'number', 'coarse: total missing');
      break;
    case 'score':
      assert(typeof payload.totalProcessed === 'number', 'score: totalProcessed missing');
      break;
    case 'select':
      assert(typeof payload.selectedCount === 'number', 'select: selectedCount missing');
      break;
    case 'summary':
      assert(typeof payload.summary === 'string', 'summary: missing');
      break;
    case 'explanation':
      assert(typeof payload.totalProcessed === 'number', 'explanation: totalProcessed missing');
      break;
    default:
      break;
  }
}

(async () => {
  try {
    const body = { emotion: 'joy', userInput: 'bright colors, family, celebration' };
    await fetchSSE(streamUrl, body);

    // verify order subsequence
    const orderIndex = requiredOrder.map(t => seen.indexOf(t));
    assert(orderIndex.every((idx, i) => idx === -1 || (i === 0 || orderIndex[i-1] === -1 || idx > orderIndex[i-1])), 'Events out of order');
    // must include core stages
    ['plan','coarse','score','select','summary','explanation','complete'].forEach(t => assert(seen.includes(t), `Missing event ${t}`));

    if (gotError) {
      console.error('Stream terminated with error');
      process.exit(2);
    }
    console.log('✔ SSE stream test passed');
    process.exit(0);
  } catch (e) {
    console.error('✖ SSE stream test failed:', e.message);
    process.exit(1);
  }
})();
