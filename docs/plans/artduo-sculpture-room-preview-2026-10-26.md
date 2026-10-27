# ArtDuo sculpture room preview

User-authorized trial: place the two isolated Scan the World / SMK sculptures in ArtDuo's existing immersive environment.

## Boundaries and modules

- Add `/experience/sculptures` inside the web app. The preview uses the existing room photographs, light maps, exhibition typography, plaque reader and navigation. Keep the catalog and published exhibition snapshot contract unchanged for this trial.
- `SculptureRoom` owns the two-work trial, background selection, reader, settings and navigation. Reuse `useRoomMotion`, `useInteractionPreferences` and `useIdleChrome`; desktop follow defaults on while respecting saved opt-out and reduced motion. Phone sensing requires an explicit button gesture.
- `SculptureCanvas` lazily loads a disposable Three renderer. Its input is an isolated GLB URL, physical display proportions, room light direction and the shared bounded motion input. Its transparent output contains only the sculpture, a digital plinth and contact shadow. Per the user's correction, the pose and viewing distance stay fixed. Mouse and device input use the same bounded gain as painting depth parallax; dragging never accumulates rotation and wheel / pinch / keyboard do not manipulate the model.
- Extract the existing decoded `RoomBackdrop` unchanged for both painting rooms and the sculpture preview. Extend the existing plaque with an optional sculpture noun and optional detail action; retain all painting defaults.
- Align the sculpture background to the photograph's bottom edge so wide screens retain the floor. The lighting renderer accepts the same optional alignment; painting rooms keep their existing center crop.
- Derive the sculpture's environment light from the exact decoded background photograph. Sample wall, ceiling, floor and visible light regions in linear color; generate a small, roughness-filtered environment cube for diffuse bounce. The unseen camera-side wall is an explicitly estimated continuation of the visible wall, not a recovered panorama or HDR measurement. Reuse the existing room light profile for source direction and limited light follow. Apply the room shade above both the photograph and the sculpture, below UI.
- The photo-lighting loader is abortable and keyed by scene plus image URL. Switching rooms must never apply a stale probe. Release old GPU probes on replacement and disposal. Image sampling or filtering failure preserves a usable sculpture with conservative room-profile lighting.
- Keep compact and reference GLBs in the app's static assets with source provenance and checksums. No CDN upload, production publication or catalog enrollment is included.

## Mouse parallax and relighting correction

- The user reports that follow is not visible and the light direction is wrong. The current input reaches both canvases, but a tiny camera translation plus a fixed foot projection removes most visible motion; the model light also remains static while the background light moves.
- Keep the fixed sculpture pose and bounded, non-accumulating view, with at most about two degrees of camera offset. The latest user correction keeps the background and floor contact point stationary; only the sculpture's view changes.
- Extend `RoomLightingLayer` / `RoomLightingRenderer` with an opt-in sculpture mode. Preserve painting defaults. Reuse the existing Depth Anything Small inverse-depth RG16 and smoothed float-derived +Y-up normal maps only for soft pointer lighting and depth occlusion. These room maps are distinct from the DA3 artwork release. Do not derive geometry from image brightness or displace the background UV.
- Put viewport coordinates, light elevation, color, falloff and parallax constants in one sculpture interaction module. The Three renderer maps the same light to its camera plane, uses a soft spotlight with geometry shadows, and retains the photo-derived ambient environment. Respect saved motion opt-out, reduced motion, modal pause and explicit phone sensor permission.
- Estimate the fixed source from luminance-weighted source centroids constrained to the visible window / ceiling region. Report confidence and use conservative fallback on flat images. This is a photographic heuristic with a source prior, not an inverse-rendered or measured physical light solution.
- Verify actual left/right screenshots, shared light direction, unchanged pose, sensible movement bounds, both rooms/models, phone framing, opt-out, reduced motion, modal pause, cleanup, type checking and production build. Do not use DOM input changes alone as proof of visual parallax.

## Acceptance

### Latest user correction: stationary background and sculpture AO

- The photographed room stays completely stationary. Depth and normals are used only for its lighting, with pointer-light power reduced to 16% of the sculpture light. The sculpture retains its bounded camera parallax and a fixed contact point on the photographed floor.
- Add geometry-based GTAO through the existing Three add-on. A small occlusion module owns its depth/normal prepass, denoising, a capped-resolution buffer and disposal. Sample the result in the sculpture and pedestal's indirect lighting; apply the ground result to the existing transparent shadow receiver. Retain the photograph and alpha transparency throughout, without postprocessing the background.
- No new dependencies, model asset changes, production publication or UI controls are needed. AO runs only when the existing renderer redraws. A missing float render-target capability retains the existing shadows and records the fallback.
- Acceptance: stationary window frames / wall edges during mouse movement; a substantially weaker background highlight than the sculpture; visible recess and contact occlusion at sculpture/plinth and plinth/floor joins; no gray background rectangle or opaque floor; desktop and phone rendering, motion preferences, model switching, type checks, relevant tests and the production build pass.

- Athena and David appear grounded in an actual ArtDuo room, without the source scan's lawn, building or surrounding context.
- Warm window light and neutral gallery light affect the model in the same direction as the photographed room. A transparent shadow receiver preserves the room floor.
- Changing the background updates image-derived environment colors, direct light and floor bounce together. The decoded photograph remains the background's base color; depth relighting modifies its illumination. The sculpture pose stays fixed and the parallax stays bounded.
- Desktop and phone framing retain the whole sculpture and usable plaque/navigation. Only a slight, smoothed viewpoint offset follows the current mouse / device input. Leaving the room returns the offset to neutral; repeated drags cannot change the sculpture's fixed pose or distance. No orbit / zoom / reset controls appear.
- Reader and settings retain focus and pause follow. Source / PDM 1.0 information remains accessible. An unavailable renderer has a static image fallback and retry.
- Type checking, relevant existing plaque / motion tests and actual desktop / mobile rendered checks pass. Report physical phone sensor testing separately when unavailable.

Relighting reference: [Codrops, Relighting Images with Depth Maps and Three.js](https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/), including its linked DGFX source. Reuse the project's WebGL renderers and existing room assets; the reference's WebGPU migration is not required for the requested light behavior.
