// Preparation-only dependencies are resolved from an explicitly selected local
// toolchain. They never enter the app or require a global installation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const flag = name => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--toolchain') || !process.argv.includes('--originals')) throw new Error('--toolchain and --originals are required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireTools = createRequire(path.resolve(flag('--toolchain'), 'package.json'));
const load = name => import(pathToFileURL(requireTools.resolve(name)).href);
const [{ STLLoader }, { mergeVertices }, { Document, NodeIO, getBounds }, { ALL_EXTENSIONS }, { simplify, prune, meshopt }, { MeshoptEncoder, MeshoptSimplifier, MeshoptDecoder }] = await Promise.all([
  load('three/addons/loaders/STLLoader.js'), load('three/addons/utils/BufferGeometryUtils.js'), load('@gltf-transform/core'),
  load('@gltf-transform/extensions'), load('@gltf-transform/functions'), load('meshoptimizer'),
]);
const { default: sharp } = await import(pathToFileURL(createRequire(path.join(root, 'apps/web/package.json')).resolve('sharp')).href);
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const originals = path.resolve(flag('--originals'));
const acquired = JSON.parse(await fs.readFile(process.argv.includes('--acquired') ? path.resolve(flag('--acquired')) : path.join(originals, 'acquired.json'), 'utf8'));
const destination = process.argv.includes('--destination') ? path.resolve(flag('--destination')) : path.join(root, 'apps/web/public/artduo-sculptures');
const ids = process.argv.includes('--ids') ? new Set(flag('--ids').split(',')) : undefined;
const previous = ids ? JSON.parse(await fs.readFile(path.join(destination, 'sources.json'), 'utf8')) : undefined;
if (ids && [...ids].some(id => !acquired.models.some(model => model.id === id))) throw new Error('Unknown requested sculpture');
await fs.mkdir(destination, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

function clean(geometry) {
  const indices = geometry.index.array, positions = geometry.attributes.position.array;
  const count = positions.length / 3, parent = new Uint32Array(count);
  for (let i = 0; i < count; i++) parent[i] = i;
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const valid = [];
  let invalid = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az;
    const vx = positions[c * 3] - ax, vy = positions[c * 3 + 1] - ay, vz = positions[c * 3 + 2] - az;
    const area = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (![ax, ay, az, ux, uy, uz, vx, vy, vz, area].every(Number.isFinite) || a === b || b === c || a === c || area < 1e-13) { invalid++; continue; }
    valid.push(a, b, c); join(a, b); join(a, c);
  }
  const sizes = new Map();
  for (let i = 0; i < valid.length; i += 3) { const r = find(valid[i]); sizes.set(r, (sizes.get(r) ?? 0) + 1); }
  const largest = Math.max(...sizes.values()), kept = [];
  let debris = 0;
  for (let i = 0; i < valid.length; i += 3) {
    // Only negligible isolated specks are removed. Preserve separate fingers,
    // restored limbs and historic supports even when the scan is disconnected.
    const n = sizes.get(find(valid[i]));
    if (n <= 8 && n < largest * 0.0001) { debris++; continue; }
    kept.push(valid[i], valid[i + 1], valid[i + 2]);
  }
  geometry.setIndex(kept); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return { degenerateTrianglesRemoved: invalid, debrisTrianglesRemoved: debris, connectedComponents: sizes.size, cleanedTriangles: kept.length / 3 };
}

function documentFor(geometry, model) {
  const document = new Document(), buffer = document.createBuffer();
  const material = document.createMaterial('Digital plaster').setBaseColorFactor([0.72, 0.685, 0.62, 1]).setMetallicFactor(0).setRoughnessFactor(0.86);
  const primitive = document.createPrimitive().setMaterial(material);
  for (const [attribute, semantic] of [['position', 'POSITION'], ['normal', 'NORMAL']]) primitive.setAttribute(semantic,
    document.createAccessor().setType('VEC3').setArray(new Float32Array(geometry.attributes[attribute].array)).setBuffer(buffer));
  primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(geometry.index.array)).setBuffer(buffer));
  document.createScene('Isolated sculpture').addChild(document.createNode(model.id).setMesh(document.createMesh(model.title).addPrimitive(primitive)));
  document.getRoot().setExtras({ source: model.source, sourceSha256: model.sha256, rights: model.rights, rightsUrl: model.rightsUrl,
    provider: model.provider, sourceCredit: model.sourceCredit ?? `${model.provider} · ${model.museumId}`,
    derivativeRights: model.rights, derivativeRightsUrl: model.rightsUrl,
    priorModifications: model.sourceModifications,
    modifications: 'Invalid/degenerate faces and negligible disconnected debris removed; welded vertices; upright display scale; smooth normals; error-limited simplification; digital plaster material; Meshopt compression.' });
  return document;
}

function inspect(document) {
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const positions = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < positions.length; i++) {
      if (!Number.isFinite(positions[i])) throw new Error('Nonfinite output');
      bounds.min[i % 3] = Math.min(bounds.min[i % 3], positions[i]); bounds.max[i % 3] = Math.max(bounds.max[i % 3], positions[i]);
    }
    const indices = p.getIndices().getArray();
    if (indices.length % 3 || indices.some(i => i >= positions.length / 3)) throw new Error('Invalid output indices');
    triangles += indices.length / 3;
  }
  return { bounds, triangles };
}

// A real mesh raster, not a museum photograph or generated replacement. It is
// available before WebGL/AI load and contains no room or scan context.
async function poster(document, model) {
  const p = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = p.getAttribute('POSITION').getArray(), normals = p.getAttribute('NORMAL').getArray(), indices = p.getIndices().getArray();
  const w = 560, h = 780, output = new Uint8Array(w * h * 4), depth = new Float32Array(w * h).fill(-Infinity);
  const bounds = inspect(document).bounds, totalHeight = model.height + model.pedestalHeight;
  const scale = Math.min((w - 50) / Math.max(bounds.max[0] - bounds.min[0], model.pedestalWidth), (h - 40) / totalHeight);
  const c = Math.cos(model.rotation), s = Math.sin(model.rotation), vertices = new Float32Array(positions.length), shade = new Float32Array(positions.length / 3);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] * c + positions[i + 2] * s, z = -positions[i] * s + positions[i + 2] * c;
    vertices[i] = w / 2 + x * scale; vertices[i + 1] = h - 20 - (positions[i + 1] + model.pedestalHeight) * scale; vertices[i + 2] = z;
    const nx = normals[i] * c + normals[i + 2] * s, nz = -normals[i] * s + normals[i + 2] * c;
    shade[i / 3] = Math.min(1, .52 + .48 * Math.max(0, nx * .35 + normals[i + 1] * .65 + nz * .65));
  }
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c0 = indices[i + 2] * 3;
    const ax = vertices[a], ay = vertices[a + 1], bx = vertices[b], by = vertices[b + 1], cx = vertices[c0], cy = vertices[c0 + 1];
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-7) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const u = ((by - cy) * (x + .5 - cx) + (cx - bx) * (y + .5 - cy)) / den;
      const v = ((cy - ay) * (x + .5 - cx) + (ax - cx) * (y + .5 - cy)) / den, q = 1 - u - v;
      if (u < 0 || v < 0 || q < 0) continue;
      const z = u * vertices[a + 2] + v * vertices[b + 2] + q * vertices[c0 + 2], pixel = y * w + x;
      if (z <= depth[pixel]) continue;
      depth[pixel] = z;
      const light = u * shade[a / 3] + v * shade[b / 3] + q * shade[c0 / 3];
      output[pixel * 4] = 230 * light; output[pixel * 4 + 1] = 222 * light; output[pixel * 4 + 2] = 207 * light; output[pixel * 4 + 3] = 255;
    }
  }
  await sharp(output, { raw: { width: w, height: h, channels: 4 } }).png().toFile(path.join(destination, model.id + '-poster.png'));
}

const results = [];
for (const model of acquired.models) {
  if (ids && !ids.has(model.id)) {
    const preserved = previous.models.find(item => item.id === model.id);
    if (!preserved) throw new Error('Missing preserved sculpture: ' + model.id);
    if (['height', 'pedestalHeight', 'pedestalWidth', 'pedestalDepth', 'rotation', 'sourceRotation', 'sourceModifications', 'sha256', 'source', 'provider', 'rights', 'rightsUrl', 'sourceCredit']
      .some(key => JSON.stringify(preserved[key]) !== JSON.stringify(model[key]))) throw new Error('Changed sculpture requires regeneration: ' + model.id);
    results.push({ ...preserved, ...model, description: model.summary, period: model.yearLabel });
    continue;
  }
  const bytes = await fs.readFile(path.join(originals, model.id + '.stl'));
  if (sha(bytes) !== model.sha256 || bytes.length !== 84 + bytes.readUInt32LE(80) * 50) throw new Error('Source fingerprint mismatch: ' + model.id);
  const raw = new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sourceRotation = model.sourceRotation ?? [-Math.PI / 2, 0, 0];
  raw.rotateX(sourceRotation[0]); raw.rotateY(sourceRotation[1]); raw.rotateZ(sourceRotation[2]); raw.computeBoundingBox();
  const box = raw.boundingBox, center = box.getCenter(box.min.clone()), rawBounds = { min: box.min.toArray(), max: box.max.toArray() };
  const scale = model.height / (box.max.y - box.min.y);
  raw.translate(-center.x, -box.min.y, -center.z); raw.scale(scale, scale, scale); raw.deleteAttribute('normal');
  const geometry = mergeVertices(raw, .000005); raw.dispose();
  const cleanup = clean(geometry);
  const variants = {};
  for (const quality of ['reference', 'compact']) {
    const document = documentFor(geometry, model);
    if (quality === 'compact') await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, model.targetTriangles / cleanup.cleanedTriangles), error: .0004 }), prune());
    const info = inspect(document);
    if (quality === 'compact') await poster(document, model);
    await document.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
    const filename = `${model.id}-${quality}.glb`, data = await io.writeBinary(document);
    await fs.writeFile(path.join(destination, filename), data);
    const decoded = await io.readBinary(data), check = { ...inspect(decoded), bounds: getBounds(decoded.getRoot().listScenes()[0]) };
    if (!check.triangles || check.bounds.min[1] < -.002 || Math.abs(check.bounds.max[1] - model.height) > .003) throw new Error('Invalid normalized GLB: ' + model.id);
    variants[quality] = { filename, bytes: data.length, sha256: sha(data), triangles: info.triangles, bounds: check.bounds };
  }
  const posterBytes = await fs.readFile(path.join(destination, model.id + '-poster.png'));
  const objectMetadata = model.objectMetadata ?? model.museum ?? {};
  results.push({ ...model, displayHeight: model.height, description: model.summary, period: model.yearLabel,
    provenance: model.provenance ?? (objectMetadata.materials?.includes('plaster') ? 'SMK 石膏翻模收藏；数字扫描。原作信息与翻模材质分开标注，展示比例经过调整。' : 'SMK 馆藏雕塑；数字扫描。馆藏材质与数字展示材质分开标注，展示比例经过调整。'), archive: model.archive ?? 'SMK Open / Scan the World',
    referencePath: variants.reference.filename, compactPath: variants.compact.filename, referenceBytes: variants.reference.bytes, compactBytes: variants.compact.bytes,
    compactTriangles: variants.compact.triangles, referenceBounds: variants.reference.bounds, compactBounds: variants.compact.bounds,
    variants, poster: { filename: model.id + '-poster.png', bytes: posterBytes.length, sha256: sha(posterBytes), rights: model.rights, rightsUrl: model.rightsUrl }, rawBounds, cleanup,
    recipe: 'sculpture-clean-meshopt-v1; 5µm display weld; tiny speck removal; 0.04% relative simplification error cap; Meshopt high; digital plaster.' });
  geometry.dispose();
  console.log(JSON.stringify({ id: model.id, input: model.originalTriangles, cleanup, compact: variants.compact.triangles, bytes: variants.compact.bytes, bounds: variants.compact.bounds }));
}
await fs.writeFile(path.join(destination, 'sources.json'), JSON.stringify({ checkedAt: acquired.checkedAt, version: acquired.version, models: results }, null, 2) + '\n');
