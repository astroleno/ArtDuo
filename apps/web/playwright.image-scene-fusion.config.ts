import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const suiteId = "image-embedding-fusion-e2e.v1";
const configPath = "apps/web/playwright.image-scene-fusion.config.ts";
const projectName = "image-scene-fusion";
const specPath = "apps/web/e2e/image-scene-fusion.spec.ts";
const basePort = Number(process.env.ARTDUO_FUSION_E2E_BASE_PORT ?? "43221");

function requiredEnvironmentPath(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !path.isAbsolute(value)) {
    throw new TypeError(`${name} must be an absolute path produced by the Task 6 fusion fixture builder.`);
  }
  return value;
}

const manifests = {
  valid: requiredEnvironmentPath("ARTDUO_FUSION_E2E_VALID_MANIFEST"),
  checksum: requiredEnvironmentPath("ARTDUO_FUSION_E2E_CHECKSUM_MANIFEST"),
  missingEntity: requiredEnvironmentPath("ARTDUO_FUSION_E2E_MISSING_ENTITY_MANIFEST"),
  timeout: requiredEnvironmentPath("ARTDUO_FUSION_E2E_TIMEOUT_MANIFEST"),
};

const servers = [
  { mode: "disabled", port: basePort, enabled: "false", manifest: manifests.valid },
  { mode: "valid", port: basePort + 1, enabled: "true", manifest: manifests.valid },
  { mode: "missing", port: basePort + 2, enabled: "true", manifest: path.join(path.dirname(manifests.valid), "missing-manifest.json") },
  { mode: "checksum", port: basePort + 3, enabled: "true", manifest: manifests.checksum },
  { mode: "missing-entity", port: basePort + 4, enabled: "true", manifest: manifests.missingEntity },
  { mode: "timeout", port: basePort + 5, enabled: "true", manifest: manifests.timeout },
] as const;

function webServer(server: (typeof servers)[number]) {
  const url = `http://127.0.0.1:${server.port}/gallery?query=I+want+a+quiet+moonlit+room`;
  return {
    command: "node scripts/playwright-web-server.mjs",
    url,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ARTDUO_WEB_E2E_PORT: String(server.port),
      ARTDUO_IMAGE_SCENE_FUSION: server.enabled,
      ARTDUO_IMAGE_EMBEDDING_MANIFEST: server.manifest,
      ARTDUO_FUSION_E2E_MODE: server.mode,
    },
  };
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "image-scene-fusion.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: [["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ?? "test-results/image-scene-fusion.json" }]],
  metadata: {
    imageEmbeddingEvidenceSuiteId: suiteId,
    imageEmbeddingEvidenceConfigPath: configPath,
    imageEmbeddingEvidenceProjectName: projectName,
    imageEmbeddingEvidenceSpecPath: specPath,
  },
  use: {
    trace: "on-first-retry",
  },
  projects: [{
    name: projectName,
    use: { ...devices["Desktop Chrome"] },
  }],
  webServer: servers.map(webServer),
});
