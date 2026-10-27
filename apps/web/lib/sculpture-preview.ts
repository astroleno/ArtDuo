import { getSculptureCollection } from "./sculpture-catalog";

// Asset-integrity checks remain independent of CDN activation.
const collection = getSculptureCollection({ mode: "local" });
export const SCULPTURE_PREVIEW_WORKS = collection.works;
export const SCULPTURE_PREVIEW_SCENES = collection.scenes;
