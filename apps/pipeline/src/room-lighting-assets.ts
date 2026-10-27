import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createLocalDepthEstimator, LOCAL_DEPTH_MODEL, type DepthEstimator, type DepthPrediction } from "@artduo/corpus/src/local-depth-provider";

const SCENES = ["bg-004", "bg-012", "bg-015", "bg-022", "bg-027", "bg-034"] as const;
const fingerprint = (data: Buffer) => createHash("sha256").update(data).digest("hex");

/** Interpolate scalar depth before RG16 encoding, never its separate byte channels. */
export function resizeRoomDepth(input: DepthPrediction, maximum = 384): DepthPrediction {
  const scale = Math.min(1, maximum / Math.max(input.width, input.height));
  if (scale === 1) return input;
  const width = Math.max(3, Math.round(input.width * scale)), height = Math.max(3, Math.round(input.height * scale));
  const values = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = x * (input.width - 1) / (width - 1), sy = y * (input.height - 1) / (height - 1);
    const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(input.width - 1, x0 + 1), y1 = Math.min(input.height - 1, y0 + 1);
    const dx = sx - x0, dy = sy - y0;
    values[y * width + x] = (input.values[y0 * input.width + x0] * (1 - dx) + input.values[y0 * input.width + x1] * dx) * (1 - dy)
      + (input.values[y1 * input.width + x0] * (1 - dx) + input.values[y1 * input.width + x1] * dx) * dy;
  }
  return { width, height, values };
}

/** Derive normals before quantization; depth uses two bytes so slopes do not band. */
export function prepareRoomLightMaps({ values, width, height }: DepthPrediction) {
  if (width < 3 || height < 3 || values.length !== width * height || values.some((v) => !Number.isFinite(v))) throw new TypeError("Invalid room depth field");
  const sorted = Float32Array.from(values).sort();
  const low = sorted[Math.floor(values.length * .02)];
  const high = sorted[Math.min(values.length - 1, Math.floor(values.length * .98))];
  if (high - low < 1e-6) throw new TypeError("Room depth contains no spatial variation");
  let field = Float32Array.from(values, (v) => Math.max(0, Math.min(1, (v - low) / (high - low))));
  // Two separable passes on floats smooth quantization-independent normals.
  for (const horizontal of [true, false]) {
    const output = new Float32Array(field.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = -2; k <= 2; k++) sum += field[Math.max(0, Math.min(height - 1, y + (horizontal ? 0 : k))) * width + Math.max(0, Math.min(width - 1, x + (horizontal ? k : 0)))];
      output[y * width + x] = sum / 5;
    }
    field = output;
  }
  const depth = Buffer.alloc(width * height * 3);
  const normals = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    const d = Math.round(field[i] * 65535);
    depth[i * 3] = d >>> 8; depth[i * 3 + 1] = d & 255;
    const dx = (field[y * width + Math.min(width - 1, x + 1)] - field[y * width + Math.max(0, x - 1)]) * width * .035;
    const dy = (field[Math.min(height - 1, y + 1) * width + x] - field[Math.max(0, y - 1) * width + x]) * height * .035;
    const length = Math.hypot(dx, dy, 1);
    normals[i * 3] = Math.round((-.5 * dx / length + .5) * 255);
    normals[i * 3 + 1] = Math.round((.5 * dy / length + .5) * 255);
    normals[i * 3 + 2] = Math.round((.5 / length + .5) * 255);
  }
  return { width, height, depth, normals, low, high };
}

export async function buildRoomLightingAssets(rootDir: string, estimator?: DepthEstimator) {
  const directory = path.join(rootDir, "public/artduo-gallery/lighting/v2");
  const reportPath = path.join(directory, "report.json");
  if (existsSync(reportPath)) throw new Error("Room lighting assets already exist; use a new version instead of replacing them");
  const model = estimator ?? await createLocalDepthEstimator(rootDir);
  const records = [];
  mkdirSync(directory, { recursive: true });
  try {
    for (const sceneId of SCENES) {
      const scene = JSON.parse(readFileSync(path.join(rootDir, `public/artduo-gallery/scenes/${sceneId}.json`), "utf8"));
      const input = path.join(rootDir, "public", scene.asset.local_public_path.replace(/^\//u, ""));
      const source = readFileSync(input);
      const inputSha256 = fingerprint(source);
      const previousPath = path.join(rootDir, "public/artduo-gallery/lighting/v1/report.json");
      const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, "utf8")).records.find((record: { sceneId: string; inputSha256: string }) => record.sceneId === sceneId && record.inputSha256 === inputSha256) : undefined;
      let prediction: DepthPrediction;
      if (previous) {
        const old = previous.outputs.find((entry: { kind: string }) => entry.kind === "depth");
        const bytes = readFileSync(path.join(rootDir, "public", old.url.replace(/^\//u, "")));
        if (fingerprint(bytes) !== old.sha256) throw new Error(`Invalid existing ${sceneId} depth`);
        const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        prediction = { width: info.width, height: info.height,
          values: Float32Array.from({ length: info.width * info.height }, (_, i) => (data[i * info.channels] * 256 + data[i * info.channels + 1]) / 65535) };
      } else prediction = await model.predict(input);
      const maps = prepareRoomLightMaps(resizeRoomDepth(prediction));
      const { width, height, low, high } = maps;
      const outputs = [];
      for (const kind of ["depth", "normal"] as const) {
        const file = `${sceneId}-${kind}.png`;
        const target = path.join(directory, file);
        if (existsSync(target)) throw new Error(`Refusing to replace ${target}`);
        await sharp(kind === "depth" ? maps.depth : maps.normals, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(target);
        outputs.push({ kind, url: `/artduo-gallery/lighting/v2/${file}`, sha256: fingerprint(readFileSync(target)), bytes: readFileSync(target).byteLength });
      }
      for (const imageWidth of [960, 1600]) {
        const file = `${sceneId}-${imageWidth}.webp`;
        const image = await sharp(source).resize({ width: imageWidth, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toBuffer();
        writeFileSync(path.join(directory, file), image);
        outputs.push({ kind: `background-${imageWidth}`, url: `/artduo-gallery/lighting/v2/${file}`, sha256: fingerprint(image), bytes: image.byteLength });
      }
      records.push({ sceneId, sourceUrl: scene.asset.local_public_path, inputSha256, width, height, low, high, outputs });
      console.log(JSON.stringify({ sceneId, width, height, assets: outputs.length }));
    }
  } finally { if (!estimator) await model.dispose(); }
  const report = { version: "room-relighting-v2", model: LOCAL_DEPTH_MODEL, depthEncoding: "relative inverse depth, RG16 big endian; B=0", normalEncoding: "RGB8 tangent normal; +Y up; derived from smoothed float depth before quantization", records };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
