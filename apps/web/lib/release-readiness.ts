import { accessSync, constants, existsSync, statSync } from "node:fs";
import path from "node:path";
import { LOCAL_SEMANTIC_MODEL } from "@artduo/corpus/src/semantic-index";
import { readCurationChatConfig } from "../../api/src/services/curation/chat-provider";
import { runtimePolicy } from "../../api/src/runtime/request-policy";
import { loadWebReleaseCatalog } from "./release-catalog";

export function inspectReleaseReadiness(rootDir: string) {
  const policy = runtimePolicy(rootDir);
  const catalog = loadWebReleaseCatalog({ rootDir });
  const modelRoot = path.join(rootDir, ".cache/artduo-models", LOCAL_SEMANTIC_MODEL.id, LOCAL_SEMANTIC_MODEL.revision);
  const files = ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"];
  const modelReady = files.every(file => existsSync(path.join(modelRoot, file)) && statSync(path.join(modelRoot, file)).size > 0);
  let stateReady = false;
  try { accessSync(policy.state, constants.R_OK | constants.W_OK); stateReady = statSync(policy.state).isDirectory(); } catch { /* Readiness remains false. */ }
  const checks = { corpus: catalog.artworks.length > 0 && Boolean(catalog.manifest.shards.semanticEmbeddings?.length),
    localModel: modelReady, persistentState: stateReady, modelConfiguration: Boolean(readCurationChatConfig(rootDir)) };
  return { ok: Object.values(checks).every(Boolean), releaseVersion: catalog.releaseVersion, checks };
}
