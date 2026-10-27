// Node-only entry point. Import directly; never export this through the browser barrel.
import path from "node:path";
import { existsSync } from "node:fs";
import { LOCAL_SEMANTIC_MODEL, normalizeSemanticVector } from "./semantic-index";
import type { SemanticModelIdentity } from "@artduo/contracts";

export interface SemanticEncoder {
  model: SemanticModelIdentity;
  embedQueries(texts: string[]): Promise<number[][]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  warmup?(): Promise<void>;
  dispose(): Promise<void>;
}

type Extractor = {
  (texts: string[], options: { pooling: "mean"; normalize: boolean }): Promise<{ tolist(): number[][] }>;
  dispose(): Promise<unknown>;
};

export function createLocalSemanticEncoder(options: { rootDir: string; allowDownload?: boolean; onProgress?: (file: string) => void }): SemanticEncoder {
  let loading: Promise<Extractor> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const queryCache = new Map<string, number[]>();
  async function extractor(): Promise<Extractor> {
    loading ??= (async () => {
      const { env, pipeline, AutoTokenizer, AutoConfig, BertModel, FeatureExtractionPipeline } = await import("@xenova/transformers");
      env.cacheDir = path.join(options.rootDir, ".cache", "artduo-models");
      const loadOptions = {
        revision: LOCAL_SEMANTIC_MODEL.revision,
        quantized: LOCAL_SEMANTIC_MODEL.quantized,
        local_files_only: !options.allowDownload,
        progress_callback: (event: { status: string; file?: string }) => {
          if (event.status === "done" && event.file) options.onProgress?.(event.file);
        },
      };
      const modelFile = path.join(env.cacheDir, LOCAL_SEMANTIC_MODEL.id, LOCAL_SEMANTIC_MODEL.revision, "onnx", "model_quantized.onnx");
      if (!existsSync(modelFile)) {
        if (!options.allowDownload) throw new Error("Local semantic model has not been prepared");
        const downloaded = await pipeline("feature-extraction", LOCAL_SEMANTIC_MODEL.id, loadOptions);
        await downloaded.dispose();
      }
      const [{ InferenceSession }, tokenizer, config] = await Promise.all([
        import("onnxruntime-node"), AutoTokenizer.from_pretrained(LOCAL_SEMANTIC_MODEL.id, loadOptions), AutoConfig.from_pretrained(LOCAL_SEMANTIC_MODEL.id, loadOptions),
      ]);
      // ONNX's default machine-wide thread pool competes with web requests on
      // large CPUs. Bound the session while retaining Transformers' exact
      // tokenizer, attention mask pooling, model forward path and normalization.
      const session = await InferenceSession.create(modelFile, { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1,
        enableMemPattern: false, enableCpuMemArena: false });
      const model = new BertModel(config, session);
      return new FeatureExtractionPipeline({ task: "feature-extraction", model, tokenizer }) as unknown as Extractor;
    })().catch((error) => { loading = undefined; throw error; });
    return loading;
  }
  async function encode(texts: string[], kind: "query" | "document"): Promise<number[][]> {
    if (!texts.length) return [];
    if (texts.some((text) => !text.trim() || text.length > 8192) || texts.length > 32) throw new TypeError("Semantic inputs must be nonempty and bounded");
    const normalized = texts.map((text) => text.normalize("NFKC").replace(/\s+/gu, " ").trim());
    const run = async () => {
      const prefix = kind === "query" ? LOCAL_SEMANTIC_MODEL.queryPrefix : LOCAL_SEMANTIC_MODEL.documentPrefix;
      const pending = [...new Set(normalized.filter((text) => kind !== "query" || !queryCache.has(text)))];
      const encoded = new Map<string, number[]>();
      if (pending.length) {
        const result = await (await extractor())(pending.map((text) => `${prefix}${text}`), { pooling: "mean", normalize: true });
        const rows = result.tolist();
        if (rows.length !== pending.length) throw new TypeError("Semantic encoder returned the wrong batch size");
        rows.forEach((row, index) => {
          const vector = normalizeSemanticVector(row, LOCAL_SEMANTIC_MODEL.dimensions);
          encoded.set(pending[index], vector);
          if (kind === "query") queryCache.set(pending[index], vector);
        });
      }
      const result = normalized.map((text) => [...(encoded.get(text) ?? queryCache.get(text))!]);
      while (queryCache.size > 256) queryCache.delete(queryCache.keys().next().value!);
      return result;
    };
    // A single native session is shared, with bounded concurrent inference.
    const job = queue.then(run, run);
    queue = job.catch(() => undefined);
    return job;
  }
  return {
    model: { ...LOCAL_SEMANTIC_MODEL },
    embedQueries: (texts) => encode(texts, "query"),
    embedDocuments: (texts) => encode(texts, "document"),
    async warmup() { await encode(["a quiet painting"], "query"); },
    async dispose() { await queue; if (loading) await (await loading).dispose(); loading = undefined; queryCache.clear(); },
  };
}
