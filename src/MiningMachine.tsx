import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type V3 = THREE.Vector3Tuple;

function createMachine(gl: THREE.WebGLRenderer) {
  const root = new THREE.Group();
  const parts: { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial }[] = [];

  const rust = new THREE.TextureLoader().load("/textures/rust.jpg", (t) => gl.initTexture(t));
  rust.colorSpace = THREE.SRGBColorSpace;
  rust.wrapS = rust.wrapT = THREE.RepeatWrapping;
  rust.repeat.set(1.4, 1.4);
  const paint = new THREE.MeshStandardMaterial({
    color: "#ad8144",
    map: rust,
    roughness: 0.79,
    metalness: 0.42,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: "#464a46",
    map: rust,
    roughness: 0.59,
    metalness: 0.76,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#22292a",
    roughness: 0.87,
    metalness: 0.4,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: "#8c8c7e",
    roughness: 0.44,
    metalness: 0.85,
  });
  const lamp = new THREE.MeshStandardMaterial({
    color: "#ffcd80",
    emissive: "#ed9f36",
    emissiveIntensity: 1.8,
    toneMapped: false,
  });

  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    position: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ) => {
    const placement = new THREE.Object3D();
    placement.position.set(...position);
    placement.rotation.set(...rotation);
    placement.updateMatrix();
    geometry.applyMatrix4(placement.matrix);
    parts.push({ geometry, material });
  };
  const box = (position: V3, size: V3, material = paint, rotation?: V3) =>
    add(new THREE.BoxGeometry(...size), material, position, rotation);

  const cylinder = (
    position: V3,
    radius: number,
    length: number,
    material = steel,
    rotation: V3 = [0, 0, Math.PI / 2],
  ) => add(new THREE.CylinderGeometry(radius, radius, length, 24), material, position, rotation);
  const rod = (a: V3, b: V3, radius: number, material = edge) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
    );
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    add(geometry, material);
  };
  const hose = (points: V3[], radius = 0.035) =>
    add(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
        24,
        radius,
        6,
        false,
      ),
      dark,
    );

  // Low, armoured drive and engine enclosure
  box([0, 0.92, -0.4], [2.65, 0.85, 4.5]);
  box([0, 1.46, -1.15], [2.45, 0.38, 2.3]);
  box([0, 1.72, -1.6], [1.6, 0.16, 1.15], steel);

  // Crawler tracks on both sides
  for (const x of [-1.38, 1.38]) {
    box([x, 0.46, -0.45], [0.69, 0.55, 3.8], dark);
    for (const z of [-2.1, -1.3, -0.45, 0.4, 1.2]) cylinder([x, 0.46, z], 0.34, 0.73, steel);
    // Closed belt
    for (let i = 0; i < 18; i++) {
      const z = -2.1 + (i * 3.3) / 17;
      for (const y of [0.085, 0.84]) box([x, y, z], [0.81, 0.095, 0.185], steel);
    }
    for (const z of [-2.1, 1.2]) {
      for (let i = 0; i < 9; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 8;
        const dir = z < 0 ? -1 : 1;
        box(
          [x, 0.46 + Math.sin(angle) * 0.38, z + dir * Math.cos(angle) * 0.38],
          [0.81, 0.095, 0.19],
          steel,
          [dir * angle, 0, 0],
        );
      }
    }
    box([x, 1.04, -0.45], [0.91, 0.16, 4.28]);
    for (let z = -1.8; z < 1; z += 0.23) box([x * 1.07, 1.2, z], [0.035, 0.13, 0.095], dark);
  }

  // Cutter boom and toothed drum
  box([0, 1.13, 1.5], [1.6, 0.55, 2.25], paint, [-0.11, 0, 0]);
  cylinder([0, 1.08, 0.9], 0.32, 2.0, steel);
  for (const x of [-0.74, 0.74]) {
    rod([x, 0.91, 0.2], [x, 1.4, 2.3], 0.1, steel);
    rod([x, 1.26, 1.55], [x, 1.43, 2.5], 0.052, edge);
    hose([
      [x, 1.1, -1],
      [x, 1.8, -0.2],
      [x, 1.68, 1.3],
      [x, 1.45, 2.4],
    ]);
  }
  cylinder([0, 1.34, 2.66], 0.6, 3.7, steel);
  for (const x of [-1.88, 1.88]) cylinder([x, 1.34, 2.66], 0.64, 0.12, paint);
  // 15 rows with 9 spikes each
  for (let row = 0; row < 15; row++) {
    for (let k = 0; k < 9; k++) {
      const x = -1.7 + row * 0.243;
      const angle = (k * Math.PI * 2) / 9 + row * 0.45;
      const y = 1.34 + Math.cos(angle) * 0.59;
      const z = 2.66 + Math.sin(angle) * 0.59;
      box([x, y, z], [0.17, 0.14, 0.18], paint, [angle, 0, 0]);
      const pick = new THREE.ConeGeometry(0.072, 0.22, 5);
      pick.rotateX(angle);
      add(pick, edge, [x, 1.34 + Math.cos(angle) * 0.72, 2.66 + Math.sin(angle) * 0.72]);
    }
  }

  // Gathering apron and central conveyor
  box([0, 0.34, 1.85], [3.5, 0.15, 1.8], steel, [-0.13, 0, 0]);
  box([0, 0.47, -0.6], [0.9, 0.16, 5.9], dark);
  for (let z = -3.2; z < 2; z += 0.28) box([0, 0.59, z], [0.92, 0.06, 0.07], edge);
  for (const x of [-0.53, 0.53]) box([x, 0.61, -1.7], [0.1, 0.26, 3.8], steel);
  // Gathering arms
  for (const x of [-0.85, 0.85]) {
    cylinder([x, 0.48, 1.8], 0.35, 0.08, steel, [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 3; k++) {
      box([x, 0.55, 1.8], [0.65, 0.1, 0.14], paint, [0, (k * Math.PI * 2) / 3, 0]);
    }
  }

  // Access hatches, fasteners, vent grille, cable reels, lamps and guardrails
  for (const x of [-0.75, 0.75]) {
    box([x, 1.675, -1.3], [0.64, 0.045, 0.8], steel);
    for (const dx of [-0.26, 0.26]) {
      for (const z of [-1.62, -0.98]) cylinder([x + dx, 1.71, z], 0.028, 0.022, edge, [0, 0, 0]);
    }
  }
  for (let i = 0; i < 12; i++) box([-0.9 + i * 0.16, 1.25, -2.68], [0.055, 0.38, 0.025], dark);
  cylinder([0.91, 1.63, -1.98], 0.22, 0.48, dark);
  hose([
    [0.92, 1.6, -2],
    [1.17, 1.6, -1],
    [1.12, 1.13, 0.8],
  ]);
  for (const x of [-1.04, 1.04]) {
    box([x, 1.28, 0.55], [0.34, 0.26, 0.19], dark);
    cylinder([x, 1.28, 0.66], 0.1, 0.035, lamp, [Math.PI / 2, 0, 0]);
    rod([x, 1.64, -2.2], [x, 2.05, -2.2], 0.028, steel);
    rod([x, 2.05, -2.2], [x, 2.05, -0.55], 0.028, steel);
    rod([x, 2.05, -0.55], [x, 1.66, -0.55], 0.028, steel);
  }

  // One merged draw group per material
  const batches = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
  for (const { geometry, material } of parts) {
    const list = batches.get(material) || [];
    list.push(geometry);
    batches.set(material, list);
  }
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = "Mining machine " + material.color.getHexString();
    root.add(mesh);
  }
  return root;
}

export default function MiningMachine() {
  const { gl, camera, scene } = useThree();
  const model = useMemo(() => createMachine(gl), []);
  // Compile the shaders now instead of on the frame the camera first sees the machine
  useEffect(() => void gl.compileAsync(model, camera, scene), []);

  // The headlamp lights sit in Scene.tsx
  return <primitive object={model} position={[-0.6, 0, -85.7]} rotation={[0, -0.15, 0]} />;
}
