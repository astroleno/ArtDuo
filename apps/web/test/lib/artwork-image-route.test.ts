import assert from "node:assert/strict";
import { test } from "node:test";

import { metImageVariantUrl } from "../../lib/met-image-url";

test("artwork image route keeps desktop preview quality and uses original for full view", () => {
  const metUrl = "https://images.metmuseum.org/CRDImages/dp/web-large/DP853022.jpg";

  assert.equal(
    metImageVariantUrl(metUrl, "preview"),
    "https://images.metmuseum.org/CRDImages/dp/web-large/DP853022.jpg",
  );
  assert.equal(
    metImageVariantUrl(metUrl, "full"),
    "https://images.metmuseum.org/CRDImages/dp/original/DP853022.jpg",
  );
});

test("artwork image route upgrades older mobile preview URLs", () => {
  const metUrl = "https://images.metmuseum.org/CRDImages/dp/mobile-large/DP853022.jpg";

  assert.equal(
    metImageVariantUrl(metUrl, "preview"),
    "https://images.metmuseum.org/CRDImages/dp/web-large/DP853022.jpg",
  );
  assert.equal(
    metImageVariantUrl(metUrl, "full"),
    "https://images.metmuseum.org/CRDImages/dp/original/DP853022.jpg",
  );
});
