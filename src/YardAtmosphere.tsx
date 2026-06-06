import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "./materials";
import type { Textures } from "./materials";
import noise from "./shaders/noise.glsl?raw";
import mistVertex from "./shaders/mist.vert?raw";
import mistFragment from "./shaders/mist.frag?raw";

type V3 = THREE.Vector3Tuple;
type Add = (
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position?: V3,
  rotation?: V3,
) => void;

function placementMatrix(position: V3, rotation: V3) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1),
  );
}

// Three opaque silhouette layers
function silhouettes() {
  const root = new THREE.Group();
  const parts: THREE.BufferGeometry[] = [];
  const material = new THREE.MeshStandardMaterial({
    color: "#414a49",
    roughness: 0.86,
    metalness: 0.4,
  });

  const add = (
    geometry: THREE.BufferGeometry,
    position: V3 = [0, 0, 0],
    rotation: V3 = [0, 0, 0],
  ) => {
    geometry.applyMatrix4(placementMatrix(position, rotation));
    parts.push(geometry);
  };
  const box = (position: V3, size: V3, rotation?: V3) =>
    add(new THREE.BoxGeometry(...size), position, rotation);
  const beam = (a: V3, b: V3, width = 0.12) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const geometry = new THREE.BoxGeometry(width, direction.length(), width);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    parts.push(geometry);
  };

  // Layer one
  for (const [x, z, height] of [
    [-14, -45, 12],
    [-19, -48, 15],
  ]) {
    add(new THREE.CylinderGeometry(2.2, 2.2, height - 4, 16), [x, (height + 4) / 2, z]);
    add(new THREE.ConeGeometry(2.23, 1.0, 16), [x, height + 0.5, z]);
    add(new THREE.CylinderGeometry(2.2, 0.55, 2, 16), [x, 3, z]);
    for (const dx of [-1.6, 1.6]) {
      for (const dz of [-1.6, 1.6]) beam([x + dx, 0, z + dz], [x + dx, 5, z + dz], 0.17);
    }
    for (const y of [4, 8, height]) {
      add(new THREE.TorusGeometry(2.23, 0.045, 4, 16), [x, y, z], [Math.PI / 2, 0, 0]);
    }
    // Access ladder
    beam([x + 2.4, 0, z], [x + 2.4, height, z], 0.055);
    beam([x + 2.8, 0, z], [x + 2.8, height, z], 0.055);
    for (let y = 0.5; y < height; y += 0.5) beam([x + 2.4, y, z], [x + 2.8, y, z], 0.035);
  }

  // Layer two
  for (const z of [-65.7, -64.3]) {
    beam([-17, 6, z], [13, 10, z], 0.23);
    beam([-17, 7.8, z], [13, 11.8, z], 0.14);
    for (let i = 0; i < 10; i++) {
      const x = -17 + i * 3;
      const y = 6 + i * 0.4;
      beam([x, y, z], [x + 3, y + 2.2, z], 0.09);
      beam([x, y + 1.8, z], [x + 3, y + 0.4, z], 0.09);
    }
  }
  for (const [x, y] of [
    [-17, 6],
    [13, 10],
  ]) {
    box([x, y + 0.9, -65], [0.18, 2.05, 1.8]);
  }
  box([-2, 9.85, -65], [30.5, 0.16, 1.8], [0, 0, Math.atan2(4, 30)]);
  for (const x of [-15, 11]) {
    const height = 6 + ((x + 17) * 4) / 30;
    for (const z of [-65.7, -64.3]) beam([x, 0, z], [x, height, z], 0.22);
  }

  // Layer three
  for (const x of [-17, -11]) {
    add(new THREE.CylinderGeometry(0.55, 0.65, 12, 12), [x, 6, -100]);
    add(new THREE.CylinderGeometry(0.8, 0.8, 0.22, 12), [x, 12, -100]);
  }
  for (const z of [-100, -102]) {
    beam([-19, 8, z], [9, 8, z], 0.2);
    for (const x of [-19, 9]) beam([x, 0, z], [x, 8, z], 0.2);
    for (const y of [8.5, 9]) {
      add(new THREE.CylinderGeometry(0.18, 0.18, 28, 8), [-5, y, z], [0, 0, Math.PI / 2]);
    }
  }
  for (const x of [-19, 9]) box([x, 8.55, -101], [0.18, 1.3, 2.5]);

  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.name = "Three layered industrial silhouettes";
  root.add(mesh);
  return root;
}

// Additional objects (barrels, pallets, drums)
function details(textures: Textures) {
  const root = new THREE.Group();
  const random = seeded(645);

  const rust = new THREE.MeshStandardMaterial({
    color: "#8a715b",
    map: textures.rust,
    roughness: 0.86,
    metalness: 0.35,
  });
  const iron = new THREE.MeshStandardMaterial({
    color: "#333b3b",
    roughness: 0.66,
    metalness: 0.65,
  });
  const wood = new THREE.MeshStandardMaterial({ color: "#615b4b", roughness: 0.98 });
  const cable = new THREE.MeshStandardMaterial({ color: "#1c2525", roughness: 0.96 });
  const leaf = new THREE.MeshStandardMaterial({
    color: "#5a6050",
    roughness: 1,
    side: THREE.DoubleSide,
  });

  const sites = [
    [8, 9],
    [8, -20],
    [-12, -39],
    [8.7, -64],
    [10.5, -96],
  ];

  function prototype(name: string, build: (add: Add) => void, placements: number[][]) {
    const bins = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const add: Add = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) => {
      geometry.applyMatrix4(placementMatrix(position, rotation));
      const list = bins.get(material) || [];
      list.push(geometry);
      bins.set(material, list);
    };
    build(add);

    for (const [material, geometries] of bins) {
      const mesh = new THREE.InstancedMesh(
        mergeGeometries(geometries),
        material,
        placements.length,
      );
      const dummy = new THREE.Object3D();
      placements.forEach(([x, y, z, angle = 0, scale = 1], i) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Slight brightness variation so copies don't look cloned.
        mesh.setColorAt(i, new THREE.Color().setScalar(0.78 + random() * 0.35));
      });
      mesh.computeBoundingSphere();
      mesh.name = name;
      root.add(mesh);
    }
  }

  prototype(
    "Rusted barrels",
    (add) => {
      add(new THREE.CylinderGeometry(0.31, 0.3, 0.92, 12), rust, [0, 0.46, 0]);
      for (const y of [0.04, 0.25, 0.68, 0.9]) {
        add(new THREE.TorusGeometry(0.311, 0.018, 4, 12), iron, [0, y, 0], [Math.PI / 2, 0, 0]);
      }
      add(new THREE.CylinderGeometry(0.041, 0.041, 0.02, 8), iron, [0.14, 0.927, 0]);
    },
    sites.flatMap(([x, z], i) => [
      [x, 0, z, i * 0.7, 1],
      [x + 0.7, 0, z + 0.25, i, 0.86],
    ]),
  );

  prototype(
    "Weathered pallets",
    (add) => {
      for (const x of [-0.46, 0, 0.46]) {
        for (const z of [-0.4, 0.4]) add(new THREE.BoxGeometry(0.18, 0.17, 0.2), wood, [x, 0.1, z]);
      }
      for (let i = 0; i < 7; i++) {
        add(new THREE.BoxGeometry(0.135, 0.065, 1.1), wood, [-0.47 + i * 0.156, 0.215, 0]);
      }
      for (const z of [-0.4, 0.4])
        add(new THREE.BoxGeometry(1.12, 0.055, 0.17), wood, [0, 0.035, z]);
    },
    sites.flatMap(([x, z], i) => [
      [x + 1.0, 0, z - 1.4, i * 0.32, 1],
      [x + 1.03, 0.25, z - 1.42, i * 0.32 + 0.06, 1],
    ]),
  );

  prototype(
    "Cable drums",
    (add) => {
      for (const z of [-0.25, 0.25]) {
        add(
          new THREE.CylinderGeometry(0.51, 0.51, 0.075, 16),
          wood,
          [0, 0.53, z],
          [Math.PI / 2, 0, 0],
        );
        add(
          new THREE.CylinderGeometry(0.09, 0.09, 0.081, 8),
          iron,
          [0, 0.53, z],
          [Math.PI / 2, 0, 0],
        );
      }
      add(
        new THREE.CylinderGeometry(0.39, 0.39, 0.46, 16),
        cable,
        [0, 0.53, 0],
        [Math.PI / 2, 0, 0],
      );
      for (let z = -0.2; z < 0.22; z += 0.055) {
        add(new THREE.TorusGeometry(0.392, 0.025, 4, 16), cable, [0, 0.53, z]);
      }
    },
    sites.filter((_, i) => i !== 1).map(([x, z], i) => [x - 1.1, 0, z - 0.9, i * 0.65, 1]),
  );

  prototype(
    "Clustered weeds",
    (add) => {
      for (let i = 0; i < 13; i++) {
        const angle = random() * Math.PI * 2;
        const height = 0.18 + random() * 0.34;
        const x = (random() - 0.5) * 0.35;
        const z = (random() - 0.5) * 0.35;
        const blade = new THREE.BufferGeometry();
        blade.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            [
              x - 0.025,
              0,
              z,
              x + 0.025,
              0,
              z,
              x + Math.cos(angle) * 0.14,
              height,
              z + Math.sin(angle) * 0.14,
            ],
            3,
          ),
        );
        blade.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
        blade.computeVertexNormals();
        add(blade, leaf);
      }
    },
    sites.flatMap(([x, z]) =>
      Array.from({ length: 6 }, () => [
        x + (random() - 0.5) * 4,
        0,
        z + (random() - 0.5) * 4,
        random() * 6,
        0.6 + random() * 0.7,
      ]),
    ),
  );

  return root;
}

const mistBands = [
  [0, 0.5, -14, 26, 1.5],
  [-2, 0.5, -42, 22, 1.5],
  [0, 0.55, -68, 24, 1.6],
  [0.2, 0.55, -101, 18, 1.7],
];

function GroundMist({ reduced }: { reduced: boolean }) {
  const { material, geometry } = useMemo(
    () => ({
      material: new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, eye: { value: new THREE.Vector3() } },
        vertexShader: mistVertex,
        fragmentShader: noise + mistFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      }),
      geometry: new THREE.PlaneGeometry(1, 1),
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    material.uniforms.eye.value.copy(camera.position);
    if (!reduced) material.uniforms.time.value += Math.min(delta, 0.05);
  });

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  return (
    <>
      {mistBands.map(([x, y, z, width, height]) => (
        <mesh
          key={z}
          position={[x, y, z]}
          scale={[width, height, 1]}
          geometry={geometry}
          material={material}
        />
      ))}
    </>
  );
}

export default function YardAtmosphere({
  textures,
  reduced,
}: {
  textures: Textures;
  reduced: boolean;
}) {
  const skyline = useMemo(silhouettes, []);
  const props = useMemo(() => details(textures), [textures]);

  return (
    <>
      <primitive object={skyline} />
      <primitive object={props} />
      <GroundMist reduced={reduced} />
    </>
  );
}
