import assert from "node:assert/strict";
import { test } from "node:test";

import { createTransformersImageEmbeddingProvider, IMAGE_EMBEDDING_DIMENSIONS } from "./image-embedding-provider";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8JwAAAABJRU5ErkJggg==",
  "base64",
);
const ONE_PIXEL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=",
  "base64",
);

test("real image provider smoke embeds one PNG and one JPEG", {
  skip: process.env.ARTDUO_RUN_REAL_IMAGE_EMBEDDING_SMOKE !== "true",
}, async () => {
  const provider = createTransformersImageEmbeddingProvider();
  const embedded = await provider.embedImages([
    { entityType: "artwork", entityId: "png", bytes: ONE_PIXEL_PNG, mediaType: "image/png" },
    { entityType: "background-scene", entityId: "jpeg", bytes: ONE_PIXEL_JPEG, mediaType: "image/jpeg" },
  ]);

  assert.equal(embedded.length, 2);
  assert.equal(embedded.every((entry) => entry.dimensions === IMAGE_EMBEDDING_DIMENSIONS), true);
  assert.equal(embedded.every((entry) => Math.abs(Math.hypot(...entry.vector) - 1) < 1e-4), true);
});
