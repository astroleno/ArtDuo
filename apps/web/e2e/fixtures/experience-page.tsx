// Mounted only by the E2E server; this module is outside the production app routes.
import { cookies } from "next/headers";
import { cloneElement, type ReactElement } from "react";
import type { ExhibitionSnapshot } from "@artduo/ui";
import ImmersivePage from "../../app/gallery/[id]/immersive/page";
import { LifecycleHarness } from "./lifecycle-harness";
import { loadWebReleaseCatalog, searchReleaseCatalog } from "../../lib/release-catalog";
import { buildCurationNarrative } from "../../lib/curation-narrative";
import { orderSearchForGrowth } from "../../lib/affective-negotiation";

export default async function ExperienceFixture({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Resolve the real first work so retrieval changes do not redirect away from
  // the fixture before its lifecycle/depth controls can be attached.
  if (typeof params.query === "string" && typeof params.releaseVersion === "string") {
    const catalog = loadWebReleaseCatalog({ releaseVersion: params.releaseVersion });
    const search = searchReleaseCatalog(catalog, params.query);
    params.artworkId = orderSearchForGrowth(search, buildCurationNarrative(search).growthForm).results[0]?.artwork.id;
  }
  const controls = await cookies();
  if (controls.get("experience-test-fail")?.value === "1") throw new Error("Injected experience preparation failure");
  const delay = Number(controls.get("experience-test-delay")?.value ?? 0);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 30_000)));
  const page = await ImmersivePage({ params: Promise.resolve({ id: "local" }), searchParams: Promise.resolve({ ...params, view: "experience" }) });
  if (params.depth !== "valid" && params.depth !== "invalid") return params.lifecycle === "1" ? <LifecycleHarness>{page}</LifecycleHarness> : page;
  const exhibition = page as ReactElement<{ snapshot: ExhibitionSnapshot }>;
  // A synthetic grayscale PNG tests the renderer, not artwork depth accuracy or release readiness.
  const syntheticDepth = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFklEQVR4nGOQkJBISEhgWLBgwYcPHwAcjgYZo5X6UAAAAABJRU5ErkJggg==";
  const enhanced = cloneElement(exhibition, { snapshot: {
    ...exhibition.props.snapshot,
    units: exhibition.props.snapshot.units.map((unit) => ({ ...unit, media: { ...unit.media,
      depthMapUrl: params.depth === "valid" ? syntheticDepth : "/e2e-experience-missing-depth.png",
    } })),
  } });
  return params.lifecycle === "1" ? <LifecycleHarness>{enhanced}</LifecycleHarness> : enhanced;
}
