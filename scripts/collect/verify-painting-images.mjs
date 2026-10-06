import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json', { paths: [path.join(root, 'apps/web')] }));
const sharp = nextRequire('sharp');
const directory = path.join(root, 'data/curation/painting-refresh/2026-10-06-paintings');
const records = JSON.parse(readFileSync(path.join(directory, 'corpus.json')));
const sources = JSON.parse(readFileSync(path.join(directory, 'commons-images.json')));
const input = process.argv[2] ?? '/tmp/artduo-painting-review';
const reportDirectory = path.join(root, 'docs/assets/painting-curation-2026-10-06');
mkdirSync(reportDirectory, { recursive: true });
const checks = [];
const layers = [];
const candidates = ['met-45434', ...sources.filter((source) => source.imageCheck?.status === 'downloaded').map((source) => source.id)];
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const [index, id] of candidates.entries()) {
  const bytes = readFileSync(path.join(input, id + '.jpg'));
  const metadata = await sharp(bytes).metadata();
  const thumbnail = await sharp(bytes).resize(280, 198, { fit: 'contain', background: '#ece8de' }).jpeg().toBuffer();
  if (!metadata.width || !metadata.height) throw new Error(`${id}: undecodable image`);
  checks.push({ id, width: metadata.width, height: metadata.height, format: metadata.format, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), status: 'decoded' });
  const left = index % 4 * 300 + 10;
  const top = Math.floor(index / 4) * 250 + 10;
  layers.push({ input: thumbnail, left, top });
  const title = records.find((record) => record.id === id)?.metadata.title ?? id;
  layers.push({ input: Buffer.from(`<svg width="280" height="42"><text x="4" y="16" font-family="Arial" font-size="12" fill="#24221d">${id}</text><text x="4" y="34" font-family="Arial" font-size="11" fill="#24221d">${escape(title.slice(0, 43))}</text></svg>`), left, top: top + 200 });
}
await sharp({ create: { width: 1200, height: Math.ceil(candidates.length / 4) * 250, channels: 3, background: '#ece8de' } }).composite(layers).jpeg({ quality: 86 }).toFile(path.join(reportDirectory, 'new-paintings-contact-sheet.jpg'));
writeFileSync(path.join(directory, 'decoded-images.json'), JSON.stringify(checks, null, 2) + '\n');
console.log(`${checks.length} images decoded; contact sheet: ${reportDirectory}`);
