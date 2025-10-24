#!/usr/bin/env node

const http = require('http');

const BASE = 'http://localhost:3011';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE + path, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(data || {}));
    const url = new URL(path, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const results = {};

  // 1) health
  results.health = await get('/api/curate/health');

  // 2) search (mock)
  results.search = await post('/api/curate/test-search', {
    emotion: 'joy',
    userInput: '今天感觉不错,逛了一天街',
    testMode: 'mock',
  });

  let artworks = [];
  try {
    artworks = JSON.parse(results.search.body).artworks || [];
  } catch {}

  // fallback local artworks if search failed
  if (!Array.isArray(artworks) || artworks.length === 0) {
    artworks = [
      { id: 'a1', title: 'Mona Lisa', artist: 'Leonardo da Vinci', year: '1503', medium: 'Oil on poplar' },
      { id: 'a2', title: 'Starry Night', artist: 'Vincent van Gogh', year: '1889', medium: 'Oil on canvas' },
      { id: 'a3', title: 'The Persistence of Memory', artist: 'Salvador Dalí', year: '1931', medium: 'Oil on canvas' },
    ];
  }

  // 3) scoring (mock)
  results.scoring = await post('/api/curate/test-scoring', {
    emotion: 'joy',
    userInput: '',
    testMode: 'mock',
    artworks,
  });

  let scoredArtworks = [];
  try {
    const parsed = JSON.parse(results.scoring.body);
    scoredArtworks = parsed.scoredArtworks || artworks.map((a) => ({
      ...a,
      llmScore: { emotionalFit: 7, artisticValue: 7, visualExpression: 7, overallRecommendation: 7, confidence: 0.8 },
    }));
  } catch {
    scoredArtworks = artworks.map((a) => ({
      ...a,
      llmScore: { emotionalFit: 7, artisticValue: 7, visualExpression: 7, overallRecommendation: 7, confidence: 0.8 },
    }));
  }

  // 4) selection
  results.selection = await post('/api/curate/test-selection', {
    emotion: 'joy',
    artworks: scoredArtworks,
    scores: scoredArtworks.map((a) => a.llmScore),
    count: 3,
  });

  // 5) explanation (2 items to be fast)
  results.explanation = await post('/api/curate/test-explanation', {
    emotion: 'joy',
    artworks: scoredArtworks.slice(0, 2),
  });

  // 6) summary
  let explanations = [];
  try {
    const expRes = JSON.parse(results.explanation.body);
    explanations = (expRes.result && expRes.result.explanations) || [];
  } catch {}
  results.summary = await post('/api/curate/test-summary', {
    emotion: 'joy',
    artworks: scoredArtworks,
    explanations,
  });

  const brief = (s) => (s || '').toString().slice(0, 160).replace(/\n/g, ' ');
  const out = {
    health: results.health.status,
    search: results.search.status,
    scoring: results.scoring.status,
    selection: results.selection.status,
    explanation: results.explanation.status,
    summary: results.summary.status,
    explanationPreview: brief(results.explanation.body),
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error('probe failed:', e.message);
  process.exit(1);
});


