import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Textures } from "./materials";

type V3 = THREE.Vector3Tuple;
type Bins = Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>;

function buildHeadframe(textures: Textures) {
  const root = new THREE.Group();
  const wheels: THREE.Group[] = [];
  // Geometry is collected per material and merged into one mesh at the end
  const structure: Bins = new Map();
  let bins = structure;

  const red = new THREE.MeshStandardMaterial({
    color: "#a65e49",
    bumpMap: textures.rust,
    bumpScale: 0.025,
    roughness: 0.72,
    metalness: 0.57,
  });
  const edge = new THREE.MeshStandardMaterial({
    color: "#713e31",
    roughness: 0.7,
    metalness: 0.65,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: "#343e3e",
    roughness: 0.55,
    metalness: 0.8,
  });
  const brick = new THREE.MeshStandardMaterial({
    color: "#91867c",
    map: textures.brick,
    roughness: 0.94,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#536467",
    roughness: 0.32,
    metalness: 0.32,
    emissive: "#a98150",
    emissiveIntensity: 0.12,
  });
  const concrete = new THREE.MeshStandardMaterial({ color: "#686a64", roughness: 0.98 });

  function add(
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    position: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ) {
    geometry.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    const list = bins.get(material) || [];
    list.push(geometry);
    bins.set(material, list);
  }

  const box = (position: V3, size: V3, material = red) =>
    add(new THREE.BoxGeometry(...size), material, position);

  // A beam with a rectangular cross-section from point a to point b
  function beam(a: V3, b: V3, width = 0.15, depth = width, material = steel) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.BoxGeometry(width, direction.length(), depth);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
    );
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    add(geometry, material);
  }

  // Riveted box girder for the main legs: a core with a flange on each face
  // and cover plates at regular intervals
  function platedLeg(a: V3, b: V3) {
    beam(a, b, 1.15, 0.63, red);
    for (const dz of [-0.39, 0.39]) {
      beam([a[0], a[1], a[2] + dz], [b[0], b[1], b[2] + dz], 1.4, 0.13, red);
    }
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    for (let t = 0.06; t < 0.97; t += 0.1) {
      const p = start.clone().addScaledVector(direction, t);
      box([p.x, p.y, p.z + 0.485], [1.4, 0.13, 0.05], edge);
      for (const dx of [-0.43, 0.43]) {
        for (const dy of [-0.13, 0.13]) {
          add(new THREE.SphereGeometry(0.046, 5, 4), edge, [p.x + dx, p.y + dy, p.z + 0.52]);
        }
      }
    }
  }

  // The two main trestles
  for (const z of [-2.4, 2.4]) {
    for (const side of [-1, 1]) {
      platedLeg([side * 9.6, 0.35, z], [side * 2.65, 24.5, z]);
      platedLeg([side * 2.65, 24.5, z], [side * 2.65, 32.0, z]);
      box([side * 9.6, 0.25, z], [2.25, 0.5, 2], concrete);
    }
    box([0, 24.8, z], [6.55, 1.45, 0.95]);
    box([0, 32.1, z], [13.68, 0.95, 1.25]);
    box([0, 32.68, z], [13.93, 0.14, 1.75], edge);
    for (const side of [-1, 1]) beam([side * 2.8, 30.7, z], [side * 6.48, 31.9, z], 0.28, 0.5, red);
    // Railing along the crown
    for (let i = 0; i <= 18; i++) {
      const x = -6.74 + (i * 13.48) / 18;
      beam([x, 32.7, z + 0.65], [x, 33.32, z + 0.65], 0.045);
    }
    beam([-6.74, 33.32, z + 0.65], [6.74, 33.32, z + 0.65], 0.055);
  }

  // Closeing steel members at both outer ends
  for (const side of [-1, 1]) {
    box([side * 6.215, 32.1, 0], [1.25, 0.95, 4.8]);
    box([side * 6.09, 32.68, 0], [1.75, 0.14, 4.8], edge);
    beam([side * 6.74, 33.32, -1.75], [side * 6.74, 33.32, 3.05], 0.055);
    for (let z = -0.95; z < 3.05; z += 0.8)
      beam([side * 6.74, 32.7, z], [side * 6.74, 33.32, z], 0.045);
  }

  const sheaves = [
    [-2.15, 28.25, 2.13],
    [2.15, 28.25, 2.13],
    [-2.15, 21.3, 2.05],
    [2.15, 21.3, 2.05],
  ];
  for (const z of [-2.4, 2.4]) {
    for (const [x, y, radius] of sheaves) {
      bins = new Map();
      for (const dz of [-0.18, 0.18])
        add(new THREE.TorusGeometry(radius, 0.09, 6, 48), steel, [0, 0, dz]);
      add(new THREE.CylinderGeometry(0.24, 0.24, 0.72, 12), edge, [0, 0, 0], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8;
        beam(
          [0, 0, 0],
          [Math.cos(angle) * radius, Math.sin(angle) * radius, 0],
          0.065,
          0.085,
          steel,
        );
      }
      const wheel = new THREE.Group();
      wheel.name = "Rotating sheave";
      wheel.position.set(x, y, z);
      for (const [material, parts] of bins) {
        wheel.add(new THREE.Mesh(mergeGeometries(parts), material));
        for (const part of parts) part.dispose();
      }
      root.add(wheel);
      wheels.push(wheel);
    }
  }
  bins = structure;

  // Platforms with railings at three levels.
  for (const y of [19.0, 24.0, 32.7]) {
    box([0, y, 0], [6.8, 0.22, 6.4], edge);
    for (const x of [-3.3, 3.3]) {
      beam([x, y, -3], [x, y, 3], 0.12);
      beam([x, y + 0.85, -3], [x, y + 0.85, 3], 0.055);
      for (let z = -3; z <= 3; z++) beam([x, y, z], [x, y + 0.85, z], 0.04);
    }
  }

  // Service tower behind the brick front
  for (const x of [-1.5, 1.5]) {
    for (const z of [-1.6, 1.6]) beam([x, 0, z], [x, 23.6, z], 0.17, 0.17, edge);
  }
  for (let y = 3; y < 24; y += 3) {
    for (const z of [-1.6, 1.6]) {
      beam([-1.5, y, z], [1.5, y, z], 0.12);
      beam([-1.5, y - 3, z], [1.5, y, z], 0.09);
    }
    beam([-1.5, y, 1.6], [1.5, y + 1.5, -1.6], 0.1);
  }

  // Shaft house and adjoining part with steel framing and rectangular windows
  function brickBuilding(
    cx: number,
    cy: number,
    cz: number,
    width: number,
    height: number,
    depth: number,
  ) {
    box([cx, cy + height / 2, cz], [width, height, depth], brick);
    box([cx, cy + height + 0.12, cz], [width + 0.2, 0.24, depth + 0.2], edge);
    for (let x = cx - width / 2; x <= cx + width / 2 + 0.01; x += 2.2) {
      box([x, cy + height / 2, cz + depth / 2 + 0.025], [0.075, height, 0.06], red);
    }
    for (let y = cy + 0.2; y < cy + height; y += 2) {
      box([cx, y, cz + depth / 2 + 0.04], [width, 0.065, 0.07], red);
    }
  }
  function glazing(cx: number, cy: number, z: number, width: number, height: number) {
    box([cx, cy, z], [width, height, 0.055], glass);
    for (let x = cx - width / 2; x <= cx + width / 2 + 0.01; x += 0.47) {
      box([x, cy, z + 0.04], [0.045, height, 0.045], red);
    }
    for (let y = cy - height / 2; y <= cy + height / 2 + 0.01; y += 0.63) {
      box([cx, y, z + 0.04], [width, 0.045, 0.045], red);
    }
  }
  brickBuilding(0, 0, 4.3, 6.4, 14.4, 5.6);
  brickBuilding(0, 14.4, 4.0, 5.3, 4.3, 4.7);
  glazing(0, 7.5, 7.14, 2.8, 12.0);
  glazing(0, 16.5, 6.4, 3.0, 3.1);
  brickBuilding(7.0, 0, 3.5, 7.6, 11.4, 7.2);
  for (const y of [2.5, 5.2, 7.9, 10.1]) glazing(7.0, y, 7.15, 6.4, 1.1);

  // Hoisting ropes
  for (const x of [-2.15, 2.15]) beam([x, 28.2, -2.55], [x, 4, -2.55], 0.035, 0.035, steel);

  for (const [material, geometries] of bins) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = "Double trestle " + material.color.getHexString();
    root.add(mesh);
  }
  return { root, wheels };
}

export default function Headframe({
  textures,
  reduced = false,
}: {
  textures: Textures;
  reduced?: boolean;
}) {
  const { root, wheels } = useMemo(() => buildHeadframe(textures), [textures]);

  useFrame((_, delta) => {
    if (reduced) return;
    for (const wheel of wheels) {
      wheel.rotation.z = (wheel.rotation.z + Math.min(delta, 0.05) * 0.12) % (Math.PI * 2);
    }
  });

  return <primitive object={root} position={[30, 0, -39]} rotation={[0, -Math.PI / 2, 0]} />;
}
