import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seeded } from "./materials";
import vertexShader from "./shaders/particles.vert?raw";
import fragmentShader from "./shaders/particles.frag?raw";

// Sparks rise from the cabinets by the track and from the lamps.
const sparkEmitters = [
  [8, 1, 6],
  [8, 1, -7],
  [4, 3.3, -10],
  [4, 3.3, -28],
  [4, 3.3, -54],
  [4, 3.3, -78],
];

function makeLayer(count: number, spark: boolean) {
  const random = seeded(spark ? 804 : 390);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seeds[i] = random();
    if (spark) {
      const [x, y, z] = sparkEmitters[i % sparkEmitters.length];
      positions.set([x + (random() - 0.5) * 0.45, y, z + (random() - 0.5) * 0.5], i * 3);
    } else {
      positions.set([(random() - 0.5) * 36, random() * 13, (random() - 0.5) * 50], i * 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      eye: { value: new THREE.Vector3() },
      pixels: { value: 800 },
      spark: { value: spark ? 1 : 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: spark ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  return { geometry, material };
}

export default function Particles({ mobile, reduced }: { mobile: boolean; reduced: boolean }) {
  const layers = useMemo(
    () => [makeLayer(mobile ? 680 : 1900, false), makeLayer(mobile ? 66 : 180, true)],
    [mobile],
  );

  useEffect(
    () => () =>
      layers.forEach((layer) => {
        layer.geometry.dispose();
        layer.material.dispose();
      }),
    [layers],
  );

  useFrame(({ camera, size, gl }, delta) => {
    for (const { material } of layers) {
      if (!reduced) material.uniforms.time.value += Math.min(delta, 0.05);
      material.uniforms.eye.value.copy(camera.position);
      material.uniforms.pixels.value = size.height * gl.getPixelRatio();
    }
  });

  return (
    <>
      {layers.map((layer, i) => (
        <points key={i} geometry={layer.geometry} material={layer.material} frustumCulled={false} />
      ))}
    </>
  );
}
