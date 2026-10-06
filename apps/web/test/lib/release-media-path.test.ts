import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveReleaseAssetPath } from "../../lib/release-media-path";

test("release asset paths stay inside the versioned release", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "artduo-release-media-"));
  const releaseDir = path.join(root, "release");
  mkdirSync(path.join(releaseDir, "depth-maps"), { recursive: true });
  writeFileSync(path.join(releaseDir, "depth-maps", "artwork.png"), "depth");
  writeFileSync(path.join(root, "outside.png"), "outside");
  symlinkSync(path.join(root, "outside.png"), path.join(releaseDir, "depth-maps", "outside-link.png"));

  assert.equal(
    resolveReleaseAssetPath(releaseDir, "depth-maps/artwork.png"),
    realpathSync(path.join(releaseDir, "depth-maps", "artwork.png")),
  );
  assert.equal(resolveReleaseAssetPath(releaseDir, "../outside.png"), undefined);
  assert.equal(resolveReleaseAssetPath(releaseDir, "/outside.png"), undefined);
  assert.equal(resolveReleaseAssetPath(releaseDir, "depth-maps/outside-link.png"), undefined);

  rmSync(root, { recursive: true, force: true });
});
