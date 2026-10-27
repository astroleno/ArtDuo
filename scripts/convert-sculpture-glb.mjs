// Convert an officially acquired GLB into a fingerprinted preparation STL.
// The existing Three.js decoder is reused; no dependency is installed globally.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const flag = name => process.argv[process.argv.indexOf(name) + 1];
for (const name of ['--input', '--output', '--toolchain']) if (!process.argv.includes(name)) throw new Error(name + ' is required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireTools = createRequire(path.resolve(flag('--toolchain'), 'package.json'));
const load = name => import(pathToFileURL(requireTools.resolve(name)).href);
const [{ NodeIO, getBounds }, { ALL_EXTENSIONS }, { Matrix4 }, { Vector3 }, { MeshoptDecoder }] = await Promise.all([
  load('@gltf-transform/core'), load('@gltf-transform/extensions'), load('three/src/math/Matrix4.js'), load('three/src/math/Vector3.js'), load('meshoptimizer'),
]);
const dracoDirectory = path.join(root, 'packages/ui/node_modules/three/examples/jsm/libs/draco/gltf');
const wrapperPath = path.join(dracoDirectory, 'draco_wasm_wrapper.js');
const wrapper = await fs.readFile(wrapperPath, 'utf8'), decoderModule = { exports: {} };
// This is the app's installed, trusted UMD dependency, not model-supplied code.
vm.runInThisContext(`(function(module,exports,require,__filename,__dirname){${wrapper}\n})`, { filename: wrapperPath })(
  decoderModule, decoderModule.exports, createRequire(import.meta.url), wrapperPath, dracoDirectory,
);
const decoder = await decoderModule.exports({ wasmBinary: await fs.readFile(path.join(dracoDirectory, 'draco_decoder.wasm')) });
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': decoder, 'meshopt.decoder': MeshoptDecoder });
const inputPath = path.resolve(flag('--input')), outputPath = path.resolve(flag('--output'));
const input = await fs.readFile(inputPath), document = await io.readBinary(input);
const nodes = document.getRoot().listNodes().filter(node => node.getMesh());
let triangles = 0;
for (const node of nodes) for (const primitive of node.getMesh().listPrimitives()) {
  if (primitive.getMode() !== 4) throw new Error('Review non-triangular source geometry');
  const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount();
  if (count % 3) throw new Error('Invalid source triangle indices');
  triangles += count / 3;
}
if (!triangles || triangles > 5_000_000) throw new Error('Review source geometry size');
const output = Buffer.alloc(84 + triangles * 50);
output.write('ArtDuo preparation source; Y-up; GLB world transforms baked.', 0, 80, 'ascii');
output.writeUInt32LE(triangles, 80);
let offset = 84;
const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3(), normal = new Vector3();
const element = [];
for (const node of nodes) {
  const matrix = new Matrix4().fromArray(node.getWorldMatrix()), reverse = matrix.determinant() < 0;
  for (const primitive of node.getMesh().listPrimitives()) {
    const positions = primitive.getAttribute('POSITION'), indices = primitive.getIndices()?.getArray();
    const count = indices?.length ?? positions.getCount();
    const vertex = (target, index) => { positions.getElement(index, element); return target.fromArray(element).applyMatrix4(matrix); };
    for (let i = 0; i < count; i += 3) {
      vertex(a, indices ? indices[i] : i);
      vertex(b, indices ? indices[i + (reverse ? 2 : 1)] : i + (reverse ? 2 : 1));
      vertex(c, indices ? indices[i + (reverse ? 1 : 2)] : i + (reverse ? 1 : 2));
      normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
      for (const vector of [normal, a, b, c]) for (const value of vector.toArray()) {
        if (!Number.isFinite(value)) throw new Error('Invalid decoded source coordinate');
        output.writeFloatLE(value, offset); offset += 4;
      }
      output.writeUInt16LE(0, offset); offset += 2;
    }
  }
}
if (offset !== output.byteLength) throw new Error('Incomplete source conversion');
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = { recipe: 'glb-world-to-stl-v1', originalFile: path.basename(inputPath), originalBytes: input.length,
  originalSha256: hash(input), outputFile: path.basename(outputPath), bytes: output.length, sha256: hash(output),
  triangles, sourceMeshNodes: nodes.length, sourceBounds: getBounds(document.getRoot().listScenes()[0]),
  decoder: 'Existing Three.js bundled Draco decoder', decoderWrapperSha256: hash(Buffer.from(wrapper)),
  modifications: 'Baked scene transforms; retained source Y-up coordinates; unified mesh parts; omitted display materials; recalculated face normals.' };
await fs.writeFile(outputPath + '.conversion.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
