import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json', { paths: [path.join(root, 'apps/web')] }))('sharp');
const version = '2026-10-06-paintings';
const directory = path.join(root, 'data/curation/painting-refresh', version);
const read = (file) => JSON.parse(readFileSync(path.join(directory, file)));
const write = (file, value) => writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2) + '\n');
const records = read('corpus.json');
const provenance = read('provenance.json');
const images = new Map(read('decoded-images.json').map((image) => [image.id, image]));
const commons = new Map(read('commons-images.json').map((image) => [image.id, image]));
const curation = read('curator-notes.json').works;
const newIds = new Set(provenance.sources.filter((source) => source.new).map((source) => source.id));
const accepted = [];
const omitted = [];
const mediaDirectory = path.join(directory, 'images');
mkdirSync(mediaDirectory, { recursive: true });
for (const record of records) {
  if (!newIds.has(record.id)) { accepted.push(record); continue; }
  const checked = images.get(record.id);
  const notes = curation[record.id];
  if (!checked || !notes) { omitted.push({ id: record.id, reason: 'No decoded, visually reviewed image or curation notes' }); continue; }
  const source = provenance.sources.find((source) => source.id === record.id);
  if (source?.isPublicDomain !== true) throw new Error(`${record.id}: missing public-domain evidence`);
  const input = readFileSync(path.join(process.argv[2] ?? '/tmp/artduo-painting-review', record.id + '.jpg'));
  if (createHash('sha256').update(input).digest('hex') !== checked.sha256) throw new Error(`${record.id}: image changed after review`);
  const previewName = `images/${record.id}-preview.jpg`;
  const fullName = `images/${record.id}-full.jpg`;
  await sharp(input).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(path.join(directory, previewName));
  await sharp(input).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 93 }).toFile(path.join(directory, fullName));
  const preview = readFileSync(path.join(directory, previewName));
  record.metadata.creditLine = `${source.institution}${source.creditLine ? ' — ' + source.creditLine : ''}`;
  record.metadata.subjectTags = [...new Set([...notes.subjects, ...record.metadata.subjectTags])];
  record.metadata.moodTags = notes.moods;
  record.metadata.colorTags = notes.palette;
  record.metadata.descriptionClean = notes.note;
  record.metadata.storySnippet = notes.note;
  record.retrieval = {
    searchText: [record.metadata.title, record.metadata.artistDisplayName, ...notes.aliases, ...record.metadata.subjectTags, ...notes.moods, notes.note].join(' '),
    searchTextShort: [record.metadata.title, record.metadata.artistDisplayName, ...notes.aliases].join(' '),
    emotionLabels: notes.moods, energyLevel: notes.energy, valence: notes.moods.some((mood) => ['joy', 'hope', 'bright'].includes(mood)) ? 'bright' : 'mixed',
    pace: notes.energy === 'high' ? 'active' : 'gentle', spaceSense: notes.subjects.includes('portrait') || notes.subjects.includes('still life') || notes.subjects.includes('bedroom') ? 'close' : 'open',
    keywordBoosts: [...notes.aliases, ...notes.subjects],
  };
  record.media = { baseImageUrl: previewName, imageUrlPreview: previewName, imageUrlFull: fullName,
    sourceAssetFingerprint: 'sha256:' + createHash('sha256').update(preview).digest('hex'),
    mediaVersion: version, hasMotionAsset: false,
    aspectRatioHint: checked.width / checked.height > 1.12 ? 'landscape' : checked.width / checked.height < 0.88 ? 'portrait' : 'square',
  };
  record.presentation = { grade: 'A', gradeLabel: 'director-focus', motionProfile: 'static', narrationMode: 'caption', sceneAffinity: { sceneTypes: ['gallery_interior', 'museum_hall'], paletteModes: notes.palette, spatialModes: ['flat-wall'], transitionTags: ['fade', 'dissolve', 'match-cut'] } };
  source.imageDelivery = { museumUrl: source.sourceUrl, publicCopy: commons.get(record.id) ?? null, sourceSha256: checked.sha256, previewSha256: record.media.sourceAssetFingerprint, fullSha256: createHash('sha256').update(readFileSync(path.join(directory, fullName))).digest('hex'), noCrop: true };
  source.curation = { owner: 'ArtDuo', notesFile: 'curator-notes.json', visuallyReviewed: true };
  accepted.push(record);
}
write('verified-corpus.json', accepted);
write('verified-provenance.json', { ...provenance, excluded: [...provenance.excluded, ...omitted] });
console.log(`${accepted.length} verified records; ${accepted.filter((record) => newIds.has(record.id)).length} additions; ${omitted.length} candidates held out`);
