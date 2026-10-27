import * as THREE from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

/** AO resolution is independent of the sharp foreground and bounded on phones. */
export function sculptureAoSize(width: number, height: number, pixelRatio: number) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const density = Number.isFinite(pixelRatio) ? Math.max(.5, Math.min(1.6, pixelRatio)) : 1;
  const scale = Math.min(density * .65, Math.sqrt(320_000 / (w * h)));
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) };
}

/** Apply geometry AO only to the transparent sculpture scene, never its photograph. */
export function createSculptureOcclusion({ renderer, scene, camera, materials, floorMaterial, bounds, height }: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  materials: THREE.MeshStandardMaterial[];
  floorMaterial: THREE.ShadowMaterial;
  bounds: THREE.Box3;
  height: number;
}) {
  const canvas = renderer.domElement;
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  const uniforms = { map: { value: white as THREE.Texture }, viewport: { value: new THREE.Vector2(1, 1) } };
  const declaration = `
    uniform sampler2D u_sculpture_ao;
    uniform vec2 u_ao_viewport;
    float sculptureOcclusion() {
      return clamp(texture2D(u_sculpture_ao, gl_FragCoord.xy / u_ao_viewport).r, .12, 1.);
    }
  `;
  const attach = (shader: Parameters<THREE.Material["onBeforeCompile"]>[0]) => {
    shader.uniforms.u_sculpture_ao = uniforms.map;
    shader.uniforms.u_ao_viewport = uniforms.viewport;
    shader.fragmentShader = declaration + shader.fragmentShader;
  };
  for (const material of materials) {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, webgl) => {
      previous.call(material, shader, webgl); attach(shader);
      shader.fragmentShader = shader.fragmentShader.replace("#include <aomap_fragment>", `
        #include <aomap_fragment>
        float sculptureVisibility = sculptureOcclusion();
        reflectedLight.indirectDiffuse *= sculptureVisibility;
        reflectedLight.indirectSpecular *= sculptureVisibility;
      `);
    };
    material.customProgramCacheKey = () => "artduo-sculpture-geometry-ao-v1";
    material.needsUpdate = true;
  }
  const previousFloor = floorMaterial.onBeforeCompile;
  floorMaterial.onBeforeCompile = (shader, webgl) => {
    previousFloor.call(floorMaterial, shader, webgl); attach(shader);
    // Union light shadows with geometry contact AO, preserving transparent pixels
    // and the photographed-floor / local-contact masks from the existing receiver.
    shader.fragmentShader = shader.fragmentShader.replace("opacity * ( 1.0 - getShadowMask() )",
      "1.0 - (1.0 - opacity * (1.0 - getShadowMask())) * (1.0 - (1.0 - sculptureOcclusion()) * .34)");
  };
  floorMaterial.customProgramCacheKey = () => "artduo-sculpture-ground-ao-v1";
  floorMaterial.needsUpdate = true;

  let pass: GTAOPass | undefined;
  let destroyed = false;
  const disposePass = () => {
    if (!pass) return;
    // The bundled pass releases its targets but omits these two materials.
    pass.gtaoMaterial.dispose(); pass.blendMaterial.dispose(); pass.dispose(); pass = undefined;
  };
  const fallback = (error: unknown) => {
    uniforms.map.value = white;
    disposePass();
    canvas.dataset.aoState = "fallback";
    canvas.dataset.aoError = error instanceof Error ? error.message : String(error);
  };
  const radius = Math.min(.18, Math.max(.1, height * .085));
  const originalClearColor = new THREE.Color();
  try {
    if (!renderer.extensions.has("EXT_color_buffer_float")) throw new Error("Geometry AO float targets unavailable");
    pass = new GTAOPass(scene, camera, 1, 1);
    pass.output = GTAOPass.OUTPUT.Off;
    pass.updateGtaoMaterial({ radius, thickness: radius * 1.7, scale: 1.25, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    pass.updatePdMaterial({ radius: 4, samples: 8, rings: 2, depthPhi: 4, normalPhi: 4 });
    pass.setSceneClipBox(bounds.clone().expandByScalar(radius * 2));
    uniforms.map.value = pass.gtaoMap;
    canvas.dataset.aoState = "loading";
    canvas.dataset.aoRadius = radius.toFixed(3);
  } catch (error) { fallback(error); }

  return {
    resize(width: number, viewHeight: number) {
      renderer.getDrawingBufferSize(uniforms.viewport.value);
      const size = sculptureAoSize(width, viewHeight, renderer.getPixelRatio());
      pass?.setSize(size.width, size.height);
      canvas.dataset.aoResolution = `${size.width},${size.height}`;
    },
    render() {
      if (destroyed || !pass) return;
      const target = renderer.getRenderTarget(), override = scene.overrideMaterial;
      renderer.getClearColor(originalClearColor);
      const clearAlpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
      const shadows = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.needsUpdate = false;
      try {
        // OUTPUT.Off computes and denoises the field without an opaque color pass.
        pass.render(renderer, pass.gtaoRenderTarget, pass.gtaoRenderTarget, 0, false);
        canvas.dataset.aoState = "ready";
      } catch (error) { fallback(error); }
      finally {
        scene.overrideMaterial = override;
        renderer.setRenderTarget(target);
        renderer.setClearColor(originalClearColor, clearAlpha);
        renderer.autoClear = autoClear;
        renderer.shadowMap.needsUpdate = shadows;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; disposePass(); white.dispose();
    },
  };
}
