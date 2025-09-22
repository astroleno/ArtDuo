// Test explanation caching reflected in diagnostics.explanationResult.explainFromCache
// Usage: node test/explanation-cache-test.js [baseUrl]

const http = require('http');
const https = require('https');
const { URL } = require('url');

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const isHttps = u.protocol === 'https:';
      const lib = isHttps ? https : http;

      const data = JSON.stringify(body);
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
            const json = JSON.parse(buf);
            resolve({ status: res.statusCode, json });
          } catch (e) {
            reject(new Error('Invalid JSON response'));
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

function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const curateUrl = `${baseUrl.replace(/\/$/, '')}/api/curate`;
  const body = { emotion: 'joy', userInput: 'colorful festival parade' };

  try {
    const first = await postJson(curateUrl, body);
    assert(first.status === 200, `First request HTTP ${first.status}`);
    const flag1 = first.json?.diagnostics?.explanationResult?.explainFromCache;
    console.log('First explainFromCache:', flag1);

    const second = await postJson(curateUrl, body);
    assert(second.status === 200, `Second request HTTP ${second.status}`);
    const flag2 = second.json?.diagnostics?.explanationResult?.explainFromCache;
    console.log('Second explainFromCache:', flag2);

    assert(flag2 === true || flag2 === 1, 'Expected explainFromCache to be true on second run');
    console.log('✔ Explanation cache test passed');
    process.exit(0);
  } catch (e) {
    console.error('✖ Explanation cache test failed:', e.message);
    process.exit(1);
  }
})();
