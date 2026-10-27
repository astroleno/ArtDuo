import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createSculptureEnvironment } from "./sculpture-environment";
import { createSculptureOcclusion } from "./sculpture-occlusion";
import { loadSculpturePhotoLighting, type SculpturePhotoLighting } from "./sculpture-photo-lighting";
import { boundedRoomLightInput, type RoomLightInput } from "./room-lighting";
import { roomParallaxInput } from "./room-parallax";
import { SCULPTURE_INTERACTION, sculptureFloorLine, sculptureInputBlend, sculpturePointerLight } from "./sculpture-interaction";
import { sculptureRoomLayout } from "./sculpture-layout";
import type { SculptureRoomScene, SculptureWork } from "./sculpture-types";

export interface SculptureRenderer {
  update(input: RoomLightInput, paused: boolean): void;
  setRoom(room: SculptureRoomScene, imageUrl?: string): void;
  destroy(): void;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse(part => {
    if (!(part instanceof THREE.Mesh)) return;
    part.geometry.dispose();
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) material.dispose();
  });
}

export async function createSculptureRenderer({ canvas, work, url, room, backgroundSource, signal, onPoster }: {
  canvas: HTMLCanvasElement;
  work: SculptureWork;
  url: string;
  room: SculptureRoomScene;
  backgroundSource?: string;
  signal: AbortSignal;
  onPoster: (url: string) => void;
}): Promise<SculptureRenderer> {
  // Download before allocating a WebGL context; pending work can be aborted.
  const response = await fetch(url, { signal, referrerPolicy: "no-referrer" });
  if (!response.ok) throw new Error(`Sculpture unavailable (${response.status})`);
  const data = await response.arrayBuffer();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const loaded = await loader.parseAsync(data, "");
  if (signal.aborted) { disposeObject(loaded.scene); throw new DOMException("Aborted", "AbortError"); }
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch (error) { disposeObject(loaded.scene); throw error; }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 80);
  const subject = loaded.scene;
  const stoneMaterials: THREE.MeshStandardMaterial[] = [];
  subject.position.y = work.pedestalHeight;
  subject.rotation.y = work.initialRotation;
  subject.traverse(part => {
    if (!(part instanceof THREE.Mesh)) return;
    part.castShadow = true;
    part.receiveShadow = true;
    const old = Array.isArray(part.material) ? part.material : [part.material];
    part.material = new THREE.MeshStandardMaterial({ color: "#ddd9d0", roughness: .88, metalness: 0 });
    stoneMaterials.push(part.material);
    for (const material of old) material.dispose();
  });
  scene.add(subject);
  const pedestal = new THREE.Mesh(
    new RoundedBoxGeometry(work.pedestalWidth, work.pedestalHeight, work.pedestalDepth, 2, .008),
    new THREE.MeshStandardMaterial({ color: "#aaa18f", roughness: .94 }),
  );
  pedestal.position.y = work.pedestalHeight / 2;
  pedestal.castShadow = pedestal.receiveShadow = true;
  scene.add(pedestal);
  stoneMaterials.push(pedestal.material);
  // Only the shadow is drawn. The photographed ArtDuo floor remains visible.
  const floorMask = { floorStart: { value: .76 }, viewHeight: { value: 1 },
    radius: { value: new THREE.Vector2(Math.max(1.3, work.pedestalWidth * 1.7), Math.max(1.1, work.pedestalDepth * 1.6)) } };
  const floorMaterial = new THREE.ShadowMaterial({ color: "#28231d", opacity: .3, depthWrite: false });
  floorMaterial.onBeforeCompile = shader => {
    shader.uniforms.u_floor_start = floorMask.floorStart;
    shader.uniforms.u_view_height = floorMask.viewHeight;
    shader.uniforms.u_contact_radius = floorMask.radius;
    shader.vertexShader = `varying vec2 v_contact;\n${shader.vertexShader}`.replace("#include <begin_vertex>", "#include <begin_vertex>\nv_contact = position.xy;");
    shader.fragmentShader = `varying vec2 v_contact;\nuniform vec2 u_contact_radius;\nuniform float u_floor_start;\nuniform float u_view_height;\n${shader.fragmentShader}`
      .replace("#include <tonemapping_fragment>", `
        float contact = 1. - smoothstep(.3, 1., length(v_contact / u_contact_radius));
        float photoFloor = smoothstep(u_floor_start, u_floor_start + .035, 1. - gl_FragCoord.y / u_view_height);
        gl_FragColor.a *= contact * photoFloor;
        #include <tonemapping_fragment>`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.004;
  floor.receiveShadow = true;
  scene.add(floor);
  const ambient = new THREE.HemisphereLight("#e6e0d3", "#93846e", 2.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight("#fff1d9", 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 4, bottom: -3, near: .5, far: 22 });
  key.shadow.normalBias = .007;
  key.shadow.bias = -.0001;
  key.shadow.radius = 8;
  key.shadow.blurSamples = 10;
  key.shadow.autoUpdate = false;
  key.target.position.set(0, 1.2, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight("#d5dce0", .7);
  fill.position.set(-4, 3, 4);
  scene.add(fill);
  const pointerLight = new THREE.SpotLight(new THREE.Color().setRGB(...SCULPTURE_INTERACTION.lightColor, THREE.LinearSRGBColorSpace), 0);
  pointerLight.angle = Math.atan(SCULPTURE_INTERACTION.lightRadius / SCULPTURE_INTERACTION.lightHeight);
  pointerLight.penumbra = 1;
  pointerLight.decay = 2;
  pointerLight.castShadow = true;
  pointerLight.shadow.mapSize.set(1024, 1024);
  pointerLight.shadow.normalBias = .015;
  pointerLight.shadow.bias = -.0002;
  pointerLight.shadow.radius = 7;
  pointerLight.shadow.blurSamples = 8;
  scene.add(pointerLight, pointerLight.target);
  const occlusion = createSculptureOcclusion({ renderer, scene, camera, materials: stoneMaterials,
    floorMaterial, height: work.height, bounds: new THREE.Box3().setFromObject(subject).expandByObject(pedestal) });
  const smooth = new THREE.Vector2();
  let desired = { x: 0, y: 0 };
  let paused = false;
  let destroyed = false;
  let frame = 0;
  let lastTime = 0;
  let width = 1, height = 1;
  let posterPending = true;
  let environment: THREE.WebGLRenderTarget | undefined;
  let lightingAbort: AbortController | undefined;
  let lightingKey = "";
  let photoLighting: SculpturePhotoLighting | undefined;
  let currentRoom = room;
  const footprint = new THREE.Vector3();
  const viewCenter = new THREE.Vector3();
  const towardViewer = new THREE.Vector3();
  const beamTarget = new THREE.Vector3();
  const eyeRay = new THREE.Vector3();
  let anchorX = 0, anchorY = 0, viewHeight = 1;

  const positionCamera = () => {
    const layout = sculptureRoomLayout(width, height, work);
    const distance = layout.totalHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * height / layout.displayHeight;
    const viewInput = roomParallaxInput(smooth);
    // Photographic floor edges, projected through the same cover crop. Never
    // allow a virtual horizontal receiver to paint a shadow over the back wall.
    floorMask.floorStart.value = sculptureFloorLine(currentRoom.id === "bg-034" ? .77 : .76, width / height, photoLighting?.imageAspect ?? 16 / 9);
    floorMask.viewHeight.value = canvas.height;
    anchorX = layout.centerX;
    anchorY = layout.floorY;
    camera.aspect = width / height;
    camera.position.set(viewInput.x * distance * SCULPTURE_INTERACTION.cameraX, layout.totalHeight * .6 + viewInput.y * distance * SCULPTURE_INTERACTION.cameraY, distance);
    camera.lookAt(0, layout.totalHeight * .5, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    footprint.set(0, 0, 0).project(camera);
    camera.projectionMatrix.elements[8] += footprint.x - (anchorX / width * 2 - 1);
    camera.projectionMatrix.elements[9] += footprint.y - (1 - anchorY / height * 2);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // Map the pointer's ray to the sculpture's viewing plane. The beam points at
    // the same viewport position as the depth shader, including off-axis framing.
    viewCenter.set(0, layout.totalHeight * .5, 0).applyMatrix4(camera.matrixWorldInverse);
    const planeDistance = -viewCenter.z;
    viewHeight = planeDistance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const pointer = sculpturePointerLight(smooth, camera.aspect);
    beamTarget.set(pointer.x / camera.aspect * 2, pointer.y * 2, .5).unproject(camera);
    eyeRay.copy(beamTarget).sub(camera.position).normalize();
    towardViewer.set(0, 0, 1).applyQuaternion(camera.quaternion);
    beamTarget.copy(camera.position).addScaledVector(eyeRay, planeDistance / Math.max(.01, -eyeRay.dot(towardViewer)));
    pointerLight.target.position.copy(beamTarget);
    pointerLight.position.copy(beamTarget).addScaledVector(towardViewer, viewHeight * pointer.z);
    pointerLight.intensity = paused ? 0 : viewHeight * viewHeight * SCULPTURE_INTERACTION.lightPower;
    pointerLight.distance = viewHeight * 3;
    pointerLight.shadow.camera.near = Math.max(.05, viewHeight * .015);
    pointerLight.shadow.camera.far = viewHeight * 3;
  };
  const capturePoster = () => {
    // A generated reference for the shared reader; no source photograph is used.
    const box = new THREE.Box3().setFromObject(subject).expandByObject(pedestal);
    let minX = 1, minY = 1, maxX = -1, maxY = -1;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const ratio = canvas.width / width;
    const x = Math.max(0, (minX + 1) * width / 2 - 20) * ratio;
    const y = Math.max(0, (1 - maxY) * height / 2 - 20) * ratio;
    const w = Math.min(canvas.width - x, ((maxX - minX) * width / 2 + 40) * ratio);
    const h = Math.min(canvas.height - y, ((maxY - minY) * height / 2 + 40) * ratio);
    const poster = document.createElement("canvas");
    poster.height = 900; poster.width = Math.max(1, Math.round(900 * w / h));
    poster.getContext("2d")?.drawImage(canvas, x, y, w, h, 0, 0, poster.width, poster.height);
    onPoster(poster.toDataURL("image/png"));
  };
  const render = (now: number) => {
    frame = 0;
    if (destroyed || document.visibilityState === "hidden") return;
    const dt = Math.min(.05, Math.max(.016, (now - lastTime) / 1000)); lastTime = now;
    const target = paused ? { x: 0, y: 0 } : desired;
    smooth.lerp(new THREE.Vector2(target.x, target.y), sculptureInputBlend(dt));
    const moving = smooth.distanceToSquared(new THREE.Vector2(target.x, target.y)) > .000002;
    if (!moving) smooth.set(target.x, target.y);
    positionCamera();
    renderer.shadowMap.needsUpdate = true;
    occlusion.render();
    renderer.render(scene, camera);
    canvas.dataset.rotation = subject.rotation.y.toFixed(4);
    const viewInput = roomParallaxInput(smooth);
    canvas.dataset.viewpoint = `${viewInput.x.toFixed(4)},${viewInput.y.toFixed(4)}`;
    canvas.dataset.pointerLight = paused ? "off" : `${smooth.x.toFixed(4)},${smooth.y.toFixed(4)}`;
    canvas.dataset.floor = `${anchorX.toFixed(1)},${anchorY.toFixed(1)}`;
    if (posterPending) { posterPending = false; capturePoster(); }
    if (moving) frame = requestAnimationFrame(render);
  };
  const invalidate = () => { if (!destroyed && !frame && document.visibilityState !== "hidden") frame = requestAnimationFrame(render); };
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false); occlusion.resize(width, height); invalidate();
  };
  const fallbackLighting = (next: SculptureRoomScene) => {
    key.position.set(next.light === "right" ? 6 : next.light === "left" ? -6 : -.5, next.light === "top" ? 8 : 5.5, 4);
    key.color.set(next.tone === "warm" ? "#fff0d6" : "#fffaf0");
    key.intensity = next.light === "top" ? 2 : 2.5;
    ambient.intensity = 1.1; fill.intensity = .35;
    ambient.groundColor.set(next.tone === "warm" ? "#93846e" : "#93928b");
    pedestal.material.color.set(next.tone === "warm" ? "#aaa18f" : "#aaa9a2");
    floor.material.opacity = .24;
    key.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  };
  const setRoom = (next: SculptureRoomScene, imageUrl = next.imageUrl) => {
    const nextKey = `${next.id}|${imageUrl}`;
    if (nextKey === lightingKey) return;
    lightingKey = nextKey;
    currentRoom = next;
    lightingAbort?.abort();
    const request = new AbortController(); lightingAbort = request;
    canvas.dataset.environmentState = "loading";
    delete canvas.dataset.environmentError;
    canvas.dataset.environmentSource = imageUrl;
    if (!environment) fallbackLighting(next);
    void loadSculpturePhotoLighting(imageUrl, next, request.signal).then(photo => {
      if (destroyed || request.signal.aborted || lightingKey !== nextKey) return;
      const replacement = createSculptureEnvironment(renderer, photo);
      const previous = environment;
      environment = replacement; scene.environment = replacement.texture;
      scene.environmentIntensity = photo.environmentIntensity;
      previous?.dispose();
      photoLighting = photo;
      key.target.position.set(0, (work.height + work.pedestalHeight) * .55, 0);
      key.position.copy(key.target.position).addScaledVector(new THREE.Vector3(...photo.keyDirection), 8);
      key.color.setRGB(...photo.key, THREE.LinearSRGBColorSpace);
      key.intensity = photo.keyIntensity;
      key.shadow.radius = next.light === "top" ? 10 : 14;
      key.shadow.blurSamples = 12;
      ambient.color.setRGB(...photo.ceiling, THREE.LinearSRGBColorSpace);
      ambient.groundColor.setRGB(...photo.floor, THREE.LinearSRGBColorSpace);
      ambient.intensity = .16;
      fill.color.setRGB(...photo.wall, THREE.LinearSRGBColorSpace);
      fill.intensity = .18;
      pedestal.material.color.setRGB(...photo.wall, THREE.LinearSRGBColorSpace).multiplyScalar(.65);
      floor.material.opacity = photo.shadowOpacity;
      key.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      canvas.dataset.environmentState = "ready";
      canvas.dataset.environmentKeyColor = `#${key.color.getHexString()}`;
      canvas.dataset.environmentFloorColor = `#${ambient.groundColor.getHexString()}`;
      canvas.dataset.environmentStrength = scene.environmentIntensity.toFixed(3);
      canvas.dataset.environmentSourceUv = photo.sourceUv.map(value => value.toFixed(4)).join(",");
      canvas.dataset.environmentDirection = photo.keyDirection.map(value => value.toFixed(4)).join(",");
      canvas.dataset.environmentConfidence = photo.sourceConfidence.toFixed(3);
      posterPending = true; invalidate();
    }).catch(error => {
      if (destroyed || request.signal.aborted || lightingKey !== nextKey) return;
      canvas.dataset.environmentError = error instanceof Error ? error.message : String(error);
      scene.environment = null; environment?.dispose(); environment = undefined;
      photoLighting = undefined;
      fallbackLighting(next); canvas.dataset.environmentState = "fallback";
      posterPending = true; invalidate();
    });
    posterPending = true;
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener("visibilitychange", invalidate);
  setRoom(room, backgroundSource); resize();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true; cancelAnimationFrame(frame);
    lightingAbort?.abort(); environment?.dispose();
    occlusion.destroy();
    observer.disconnect();
    document.removeEventListener("visibilitychange", invalidate);
    signal.removeEventListener("abort", destroy);
    disposeObject(scene);
    key.shadow.map?.dispose(); key.shadow.mapPass?.dispose();
    pointerLight.shadow.map?.dispose(); pointerLight.shadow.mapPass?.dispose();
    renderer.dispose();
  };
  signal.addEventListener("abort", destroy, { once: true });
  return {
    update(input, nextPaused) { desired = boundedRoomLightInput(input); paused = nextPaused; if (paused) smooth.set(0, 0); invalidate(); },
    setRoom,
    destroy,
  };
}
