import { boundedRoomLightInput, boundedRoomLightMood, NEUTRAL_ROOM_MOOD, type RoomLightInput, type RoomLightMood, type RoomLightProfile } from "./room-lighting";
import { SCULPTURE_INTERACTION, sculptureInputBlend, sculpturePointerLight } from "./sculpture-interaction";

export interface RoomLightingController {
  setInput(value: RoomLightInput): void;
  setMood(value: RoomLightMood): void;
  resize(): void;
  destroy(): void;
}

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }
`;

const FRAGMENT = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform sampler2D u_depth;
uniform sampler2D u_normal;
uniform float u_image_aspect;
uniform float u_view_aspect;
uniform float u_image_y;
uniform float u_shape;
uniform float u_count;
uniform vec4 u_lights[3];
uniform vec3 u_color;
uniform float u_strength;
uniform vec2 u_input;
uniform vec4 u_mood;
uniform float u_sculpture;
uniform vec3 u_pointer_position;

vec2 tex(vec2 p) { return vec2(p.x, 1. - p.y); }
float depthAt(vec2 p) {
  vec2 rg = texture2D(u_depth, tex(clamp(p, 0., 1.))).rg;
  return dot(rg, vec2(65280., 255.)) / 65535.;
}
float distribution(vec2 p, vec4 lamp, vec2 move) {
  vec2 q = (p - lamp.xy - move) / (lamp.zw * u_mood.z);
  if (u_shape < .5) return 1. - smoothstep(.25, 1.3, max(abs(q.x), abs(q.y)));
  if (u_shape < 1.5) return (1. - smoothstep(.65, 1.25, abs(q.x))) * exp(-q.y * q.y * 1.8);
  return exp(-dot(q, q) * 2.2);
}
float shadow(vec2 p, float z, vec2 lightMove) {
  vec2 toward = (u_lights[0].xy + lightMove - p) * .05;
  float blocked = 0.;
  for (int i = 1; i <= 4; i++) {
    float t = float(i) / 4.;
    float obstacle = depthAt(p + toward * t);
    blocked = max(blocked, smoothstep(.012, .075, obstacle - z - t * .12));
  }
  return blocked;
}
float pointerOcclusion(vec2 p, float z, vec3 toward, vec2 cover) {
  float remaining = 1. - z;
  vec2 sweep = toward.xy / max(toward.z, .1) * ${SCULPTURE_INTERACTION.depthScale} * remaining;
  sweep = vec2(sweep.x / u_view_aspect, -sweep.y) * cover;
  float blocked = 0.;
  for (int i = 1; i <= 8; i++) {
    float t = float(i) / 8.;
    float rayDepth = z + remaining * t;
    float obstacle = depthAt(p + sweep * t);
    blocked = max(blocked, smoothstep(.014, .065 + t * .08, obstacle - rayDepth));
  }
  return 1. - blocked * .8;
}
void main() {
  vec2 screen = vec2(v_uv.x, 1. - v_uv.y);
  vec2 p = screen;
  vec2 cover = vec2(1.);
  // Exactly the same cover projection as the original photographed wall.
  if (u_view_aspect > u_image_aspect) { cover.y = u_image_aspect / u_view_aspect; p.y = (p.y - u_image_y) * cover.y + u_image_y; }
  else { cover.x = u_view_aspect / u_image_aspect; p.x = (p.x - .5) * cover.x + .5; }
  // The room photograph is stationary. Depth is used only for light and occlusion.
  vec3 color = texture2D(u_image, tex(p)).rgb;
  vec3 normal = normalize(texture2D(u_normal, tex(p)).rgb * 2. - 1.);
  float z = depthAt(p);
  if (u_sculpture > .5) {
    vec2 surface = vec2((screen.x - .5) * u_view_aspect, .5 - screen.y);
    vec2 delta = u_pointer_position.xy - surface;
    vec3 toward = vec3(delta, u_pointer_position.z - (z - ${SCULPTURE_INTERACTION.depthPivot}) * ${SCULPTURE_INTERACTION.depthScale});
    // The stored normals are +Y-up. Convert image slopes into viewport-height units.
    normal = normalize(vec3(normal.xy * cover * vec2(1. / u_view_aspect, 1.) * (${SCULPTURE_INTERACTION.depthScale} / .07), normal.z));
    float diffuse = max(0., dot(normal, normalize(toward)));
    float pool = exp(-dot(delta, delta) * 2. / (${SCULPTURE_INTERACTION.lightRadius} * ${SCULPTURE_INTERACTION.lightRadius}));
    float attenuation = min(1., ${SCULPTURE_INTERACTION.lightHeight ** 2} / dot(toward, toward));
    float light = diffuse * pool * attenuation * pointerOcclusion(p, z, toward, cover) * ${SCULPTURE_INTERACTION.lightPower * SCULPTURE_INTERACTION.backgroundLightRatio};
    vec3 linearColor = pow(max(color, vec3(0.)), vec3(2.2));
    linearColor *= vec3(1.) + light * vec3(${SCULPTURE_INTERACTION.lightColor.map(c => c.toFixed(3)).join(",")});
    color = pow(linearColor, vec3(1. / 2.2));
    gl_FragColor = vec4(clamp(color * u_mood.x * vec3(1. + u_mood.y * .06, 1., 1. - u_mood.y * .06), 0., 1.), 1.);
    return;
  }
  vec2 shift = u_input * vec2(.044, .033) * u_mood.w;
  float basePool = 0.;
  float delta = 0.;
  for (int i = 0; i < 3; i++) {
    if (float(i) >= u_count) break;
    vec4 lamp = u_lights[i];
    float base = distribution(p, lamp, vec2(0.));
    float moved = distribution(p, lamp, shift);
    vec3 direction = vec3((lamp.x - p.x) * u_image_aspect, p.y - lamp.y, .85 - z * .14);
    float originalDiffuse = max(0., dot(normal, normalize(direction)));
    float dynamicDiffuse = max(0., dot(normal, normalize(direction + vec3(u_input * vec2(.34, -.24) * u_mood.w, 0.))));
    basePool += base;
    delta += (moved - base) * 1.8 + (dynamicDiffuse - originalDiffuse) * (.4 + moved);
  }
  basePool = min(basePool, 1.4);
  float shadowDelta = shadow(p, z, shift) - shadow(p, z, vec2(0.));
  float gain = clamp(u_mood.x * (1. + basePool * .018 + delta * u_strength - shadowDelta * .055), .76, 1.25);
  vec3 illumination = mix(vec3(gain), vec3(1.) + (gain - 1.) * u_color, .55);
  gl_FragColor = vec4(clamp(color * illumination * vec3(1. + u_mood.y * .06, 1., 1. - u_mood.y * .06), 0., 1.), 1.);
}
`;

function loadImage(url: string, signal?: AbortSignal, noReferrer = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    if (noReferrer) image.referrerPolicy = "no-referrer";
    if (new URL(url, location.href).origin !== location.origin) image.crossOrigin = "anonymous";
    const cleanup = () => { image.onload = null; image.onerror = null; signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); image.src = ""; reject(new DOMException("Room lighting cancelled", "AbortError")); };
    if (signal?.aborted) { abort(); return; }
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error("Room lighting image unavailable")); };
    signal?.addEventListener("abort", abort, { once: true });
    image.src = url;
  });
}

export async function createRoomLightingRenderer({ canvas, imageUrl, profile, signal, imageAlignment = "center", sculptureInteraction = false }: {
  canvas: HTMLCanvasElement;
  imageUrl: string;
  profile: RoomLightProfile;
  signal?: AbortSignal;
  imageAlignment?: "center" | "bottom";
  sculptureInteraction?: boolean;
}): Promise<RoomLightingController> {
  const images = await Promise.all([imageUrl, profile.depthUrl, profile.normalUrl].map((url) => loadImage(url, signal, sculptureInteraction)));
  if (signal?.aborted) throw new DOMException("Room lighting cancelled", "AbortError");
  const context = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, powerPreference: "low-power" });
  if (!context) throw new Error("Room lighting WebGL unavailable");
  const gl: WebGLRenderingContext = context;
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let frame = 0;
  let lastPaint = -Infinity;
  let lastStep = 0;
  let destroyed = false;
  let current: RoomLightInput = { x: 0, y: 0 };
  let target: RoomLightInput = current;
  let mood = { ...NEUTRAL_ROOM_MOOD };
  let targetMood = mood;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", visibility);
    for (const texture of textures) gl.deleteTexture(texture);
    for (const shader of shaders) gl.deleteShader(shader);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  };
  function visibility() {
    cancelAnimationFrame(frame); frame = 0;
    // Input resets belong to the motion owner; resuming must retain its latest target.
    if (document.visibilityState === "visible" && !destroyed) requestPaint();
  }
  let inputLocation: WebGLUniformLocation | null = null;
  let viewLocation: WebGLUniformLocation | null = null;
  let moodLocation: WebGLUniformLocation | null = null;
  let pointerLocation: WebGLUniformLocation | null = null;
  function draw() {
    if (destroyed || gl.isContextLost()) return;
    const density = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(1_000_000 / Math.max(1, canvas.clientWidth * canvas.clientHeight)));
    const width = Math.max(1, Math.round(canvas.clientWidth * density));
    const height = Math.max(1, Math.round(canvas.clientHeight * density));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.uniform1f(viewLocation, width / height);
    gl.uniform2f(inputLocation, current.x, current.y);
    const pointer = sculpturePointerLight(current, width / height);
    gl.uniform3f(pointerLocation, pointer.x, pointer.y, pointer.z);
    gl.uniform4f(moodLocation, mood.exposure, mood.warmth, mood.softness, mood.motionScale);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas.dataset.lightX = current.x.toFixed(3);
    canvas.dataset.lightY = current.y.toFixed(3);
    canvas.dataset.lightExposure = mood.exposure.toFixed(4);
    canvas.dataset.lightWarmth = mood.warmth.toFixed(4);
    canvas.dataset.lightSoftness = mood.softness.toFixed(4);
    if (sculptureInteraction) {
      canvas.dataset.pointerLight = `${current.x.toFixed(4)},${current.y.toFixed(4)}`;
      canvas.dataset.backgroundParallax = "off";
      canvas.dataset.pointerLightRatio = String(SCULPTURE_INTERACTION.backgroundLightRatio);
    }
  }
  function paint(now: number) {
    frame = 0;
    if (destroyed || document.visibilityState !== "visible") return;
    if (now - lastPaint < 32) { requestPaint(); return; }
    lastPaint = now;
    const blend = sculptureInteraction ? sculptureInputBlend(lastStep ? (now - lastStep) / 1000 : 1 / 30) : .22;
    lastStep = now;
    current = { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend };
    let moodDelta = 0;
    for (const key of Object.keys(mood) as Array<keyof RoomLightMood>) { mood[key] += (targetMood[key] - mood[key]) * .09; moodDelta += Math.abs(targetMood[key] - mood[key]); }
    draw();
    if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) + moodDelta > .001) requestPaint();
  }
  function requestPaint() {
    if (!frame && !destroyed && document.visibilityState === "visible") frame = requestAnimationFrame(paint);
  }
  try {
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("Room lighting shader unavailable");
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Room lighting shader failed");
    }
    program = gl.createProgram(); buffer = gl.createBuffer();
    if (!program || !buffer) throw new Error("Room lighting resources unavailable");
    shaders.forEach((shader) => gl.attachShader(program!, shader)); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Room lighting program failed");
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (let i = 0; i < images.length; i++) {
      const texture = gl.createTexture();
      if (!texture) throw new Error("Room lighting texture unavailable");
      textures.push(texture); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, images[i]);
    }
    for (const [name, value] of [["u_image",0],["u_depth",1],["u_normal",2]] as const) gl.uniform1i(gl.getUniformLocation(program, name), value);
    gl.uniform1f(gl.getUniformLocation(program, "u_image_aspect"), images[0].naturalWidth / images[0].naturalHeight);
    gl.uniform1f(gl.getUniformLocation(program, "u_image_y"), imageAlignment === "bottom" ? 1 : .5);
    gl.uniform1f(gl.getUniformLocation(program, "u_sculpture"), sculptureInteraction ? 1 : 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_shape"), ["window-wash","linear-wash","oval-spots"].indexOf(profile.shape));
    gl.uniform1f(gl.getUniformLocation(program, "u_count"), profile.lights.length);
    gl.uniform1f(gl.getUniformLocation(program, "u_strength"), profile.strength);
    gl.uniform3fv(gl.getUniformLocation(program, "u_color"), profile.color);
    const lamps = new Float32Array(12);
    profile.lights.forEach((lamp, index) => lamps.set(lamp, index * 4));
    gl.uniform4fv(gl.getUniformLocation(program, "u_lights[0]"), lamps);
    inputLocation = gl.getUniformLocation(program, "u_input"); viewLocation = gl.getUniformLocation(program, "u_view_aspect");
    moodLocation = gl.getUniformLocation(program, "u_mood");
    pointerLocation = gl.getUniformLocation(program, "u_pointer_position");
    draw(); document.addEventListener("visibilitychange", visibility);
  } catch (error) { destroy(); throw error; }
  return { setInput(value) { target = boundedRoomLightInput(value); requestPaint(); }, setMood(value) { targetMood = boundedRoomLightMood(value); requestPaint(); }, resize() { draw(); }, destroy };
}
