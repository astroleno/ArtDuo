import * as THREE from "three";
import type { LinearRgb, SculpturePhotoLighting } from "./sculpture-photo-lighting";

/** Approximate diffuse room bounce; no panorama is invented from the perspective image. */
export function createSculptureEnvironment(renderer: THREE.WebGLRenderer, lighting: SculpturePhotoLighting): THREE.WebGLRenderTarget {
  const multiply = (rgb: LinearRgb, amount: number): LinearRgb => rgb.map(value => value * amount) as LinearRgb;
  const color = (rgb: LinearRgb) => new THREE.Color().setRGB(...rgb, THREE.LinearSRGBColorSpace);
  const face = (middle: LinearRgb, gain = 1) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Room environment sampling unavailable");
    const gradient = context.createLinearGradient(0, 0, 0, 32);
    gradient.addColorStop(0, color(multiply(lighting.ceiling, gain)).getStyle());
    gradient.addColorStop(.45, color(multiply(middle, gain)).getStyle());
    gradient.addColorStop(1, color(multiply(lighting.floor, gain)).getStyle());
    context.fillStyle = gradient; context.fillRect(0, 0, 32, 32);
    return canvas;
  };
  const flat = (rgb: LinearRgb) => {
    const canvas = face(rgb);
    const context = canvas.getContext("2d")!;
    context.fillStyle = color(rgb).getStyle(); context.fillRect(0, 0, 32, 32);
    return canvas;
  };
  const cube = new THREE.CubeTexture([
    face(lighting.right), face(lighting.left), flat(lighting.ceiling), flat(lighting.floor),
    face(lighting.wall, .6), face(lighting.wall),
  ]);
  cube.colorSpace = THREE.SRGBColorSpace; cube.needsUpdate = true;
  const filter = new THREE.PMREMGenerator(renderer);
  try { return filter.fromCubemap(cube); }
  finally { cube.dispose(); filter.dispose(); }
}
