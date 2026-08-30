export interface DepthParallaxController {
  destroy: () => void;
  reset: () => void;
  setPointer: (x: number, y: number) => void;
}

interface CreateDepthParallaxRendererOptions {
  canvas: HTMLCanvasElement;
  depthMapUrl?: string;
  imageUrl: string;
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec2 v_uv;
  uniform sampler2D u_color;
  uniform sampler2D u_depth;
  uniform float u_canvas_aspect;
  uniform float u_has_depth;
  uniform float u_image_aspect;
  uniform vec2 u_pointer;

  vec2 containUv(vec2 canvasUv) {
    vec2 imageUv = canvasUv;

    if (u_canvas_aspect > u_image_aspect) {
      imageUv.x = (canvasUv.x - 0.5) * (u_canvas_aspect / u_image_aspect) + 0.5;
    } else {
      imageUv.y = (canvasUv.y - 0.5) * (u_image_aspect / u_canvas_aspect) + 0.5;
    }

    return imageUv;
  }

  float simulatedDepth(vec2 uv, vec3 color) {
    float centerBias = 1.0 - smoothstep(0.12, 0.72, distance(uv, vec2(0.5)) * 1.18);
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return clamp(centerBias * 0.76 + smoothstep(0.18, 0.82, luminance) * 0.24, 0.0, 1.0);
  }

  void main() {
    vec2 imageUv = containUv(v_uv);

    if (imageUv.x < 0.0 || imageUv.x > 1.0 || imageUv.y < 0.0 || imageUv.y > 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    vec2 overscannedUv = (imageUv - 0.5) * 0.91 + 0.5;
    vec3 firstSample = texture2D(u_color, overscannedUv).rgb;
    float depth = u_has_depth > 0.5
      ? texture2D(u_depth, overscannedUv).r
      : simulatedDepth(overscannedUv, firstSample);
    float depthOffset = depth - 0.46;
    vec2 displacedUv = clamp(overscannedUv - u_pointer * depthOffset * 0.052, 0.002, 0.998);
    vec4 artwork = texture2D(u_color, displacedUv);
    float vignette = smoothstep(0.9, 0.18, distance(imageUv, vec2(0.5)));

    artwork.rgb *= mix(0.93, 1.025, vignette);
    gl_FragColor = artwork;
  }
`;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create depth shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Depth shader compilation failed";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error("Unable to create depth program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Depth program link failed";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";

    try {
      const url = new URL(src, window.location.href);
      if (url.origin !== window.location.origin) {
        image.crossOrigin = "anonymous";
      }
    } catch {
      // Relative and data URLs can load without CORS configuration.
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load depth-stage image: ${src}`));
    image.src = src;
  });
}

function uploadTexture(
  gl: WebGLRenderingContext,
  image: TexImageSource,
  textureUnit: number,
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Unable to create depth texture");
  }

  gl.activeTexture(textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  return texture;
}

export async function createDepthParallaxRenderer({
  canvas,
  depthMapUrl,
  imageUrl,
}: CreateDepthParallaxRendererOptions): Promise<DepthParallaxController> {
  const context = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
    premultipliedAlpha: true,
  });

  if (!context) {
    throw new Error("WebGL is unavailable");
  }
  const gl: WebGLRenderingContext = context;

  const [image, depthImage] = await Promise.all([
    loadImage(imageUrl),
    depthMapUrl ? loadImage(depthMapUrl).catch(() => undefined) : Promise.resolve(undefined),
  ]);
  const program = createProgram(gl);
  const positionBuffer = gl.createBuffer();

  if (!positionBuffer) {
    gl.deleteProgram(program);
    throw new Error("Unable to create depth geometry");
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.useProgram(program);

  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const colorTexture = uploadTexture(gl, image, gl.TEXTURE0);
  const depthTexture = depthImage ? uploadTexture(gl, depthImage, gl.TEXTURE1) : undefined;
  const colorLocation = gl.getUniformLocation(program, "u_color");
  const depthLocation = gl.getUniformLocation(program, "u_depth");
  const hasDepthLocation = gl.getUniformLocation(program, "u_has_depth");
  const imageAspectLocation = gl.getUniformLocation(program, "u_image_aspect");
  const canvasAspectLocation = gl.getUniformLocation(program, "u_canvas_aspect");
  const pointerLocation = gl.getUniformLocation(program, "u_pointer");

  gl.uniform1i(colorLocation, 0);
  gl.uniform1i(depthLocation, 1);
  gl.uniform1f(hasDepthLocation, depthTexture ? 1 : 0);
  gl.uniform1f(imageAspectLocation, image.naturalWidth / Math.max(1, image.naturalHeight));

  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  let animationFrame: number | undefined;
  let destroyed = false;

  function resize() {
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * density));
    const height = Math.max(1, Math.round(canvas.clientHeight * density));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.uniform1f(canvasAspectLocation, width / Math.max(1, height));
  }

  function draw() {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(pointerLocation, currentX, -currentY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function animate() {
    animationFrame = undefined;
    if (destroyed) {
      return;
    }

    currentX += (targetX - currentX) * 0.14;
    currentY += (targetY - currentY) * 0.14;
    draw();

    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      animationFrame = window.requestAnimationFrame(animate);
    }
  }

  function scheduleDraw() {
    if (animationFrame === undefined && !destroyed) {
      animationFrame = window.requestAnimationFrame(animate);
    }
  }

  const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => {
    draw();
  });
  resizeObserver?.observe(canvas);
  window.addEventListener("resize", draw);
  draw();

  return {
    destroy() {
      destroyed = true;
      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", draw);
      gl.deleteTexture(colorTexture);
      if (depthTexture) {
        gl.deleteTexture(depthTexture);
      }
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
    },
    reset() {
      targetX = 0;
      targetY = 0;
      scheduleDraw();
    },
    setPointer(x, y) {
      targetX = clamp(x, -1, 1);
      targetY = clamp(y, -1, 1);
      scheduleDraw();
    },
  };
}
