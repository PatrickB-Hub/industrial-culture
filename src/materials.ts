import * as THREE from "three";

// Small deterministic random generator (LCG), so procedural details look the
// same on every visit.
export function seeded(seed = 17) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export type Textures = ReturnType<typeof makeTextures>;

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

function canvasTexture(draw: Draw, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d")!, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function loadTexture(url: string, repeat: [number, number]) {
  const texture = new THREE.TextureLoader().load(url);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(...repeat);
  texture.anisotropy = 8;
  return texture;
}

export function makeTextures() {
  const random = seeded(25);

  // Dark puddles where the wet ground is glossy
  const rough = canvasTexture((ctx, size) => {
    ctx.fillStyle = "#bbbbbb";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 240; i++) {
      const x = random() * size;
      const y = random() * size;
      const radius = random() * 44 + 6;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "#101010");
      gradient.addColorStop(1, "#aaaaaa00");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
  });
  rough.colorSpace = THREE.NoColorSpace;
  rough.repeat.set(5, 12);

  // Warm lamplight behind glass
  const window = canvasTexture((ctx, size) => {
    ctx.fillStyle = "#151b1a";
    ctx.fillRect(0, 0, size, size);
    const glow = ctx.createRadialGradient(
      size * 0.5,
      size * 0.78,
      5,
      size * 0.5,
      size * 0.65,
      size * 0.65,
    );
    glow.addColorStop(0, "#eebf77");
    glow.addColorStop(0.3, "#9e6d33");
    glow.addColorStop(0.7, "#493d27");
    glow.addColorStop(1, "#141d1d");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 25000; i++) {
      ctx.fillStyle = "rgba(0,9,9," + random() * 0.3 + ")";
      ctx.fillRect(random() * size, random() * size, 1 + random() * 4, 1 + random() * 5);
    }
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = "#10201d22";
      ctx.fillRect(random() * size, 0, 1 + random() * 2, size);
    }
  });

  return {
    rust: loadTexture("/textures/rust.jpg", [1.8, 1.8]),
    brick: loadTexture("/textures/brick.jpg", [5, 3]),
    paving: loadTexture("/textures/paving.jpg", [55, 75]),
    rough,
    window,
  };
}

// Adds a rim light at grazing angles so dark steel keeps its outline in the fog
export function rimShader(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <dithering_fragment>",
    `float rim=pow(1.0-max(dot(normalize(vViewPosition),normal),0.0),3.0); gl_FragColor.rgb += vec3(0.12,0.145,0.14)*rim;\n#include <dithering_fragment>`,
  );
}
