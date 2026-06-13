import { useMemo } from "react";
import * as THREE from "three";
import { seeded } from "./materials";

type V3 = THREE.Vector3Tuple;

function outerProfile() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.72, 1.25);
  shape.lineTo(-0.7, 0.87);
  shape.quadraticCurveTo(-0.69, 0.5, -0.36, 0.48);
  shape.lineTo(0.36, 0.48);
  shape.quadraticCurveTo(0.69, 0.5, 0.7, 0.87);
  shape.lineTo(0.72, 1.25);
  return shape;
}

// "Glückauf" and crossed hammers, painted on and worn away in places.
function makeMarkingTexture(random: () => number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c3beb0";
  ctx.font = "bold 45px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("GLÜCKAUF", 256, 215);
  // Hammer handles
  ctx.strokeStyle = "#c3beb0";
  ctx.lineWidth = 11;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(213, 147);
  ctx.lineTo(303, 55);
  ctx.moveTo(298, 149);
  ctx.lineTo(211, 58);
  ctx.stroke();
  // Hammer heads
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(191, 73);
  ctx.lineTo(224, 43);
  ctx.moveTo(284, 39);
  ctx.lineTo(319, 67);
  ctx.stroke();
  // Scratch paint away
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 650; i++)
    ctx.fillRect(random() * 512, random() * 256, 1 + random() * 4, 1 + random() * 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLore() {
  const group = new THREE.Group();
  group.name = "Coal tub";

  const rustTexture = new THREE.TextureLoader().load("/textures/rust.jpg");
  rustTexture.colorSpace = THREE.SRGBColorSpace;
  rustTexture.wrapS = rustTexture.wrapT = THREE.RepeatWrapping;
  rustTexture.repeat.set(0.8, 0.8);
  const body = new THREE.MeshStandardMaterial({
    color: "#827360",
    map: rustTexture,
    roughness: 0.87,
    metalness: 0.28,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#444846",
    roughness: 0.56,
    metalness: 0.7,
  });
  const worn = new THREE.MeshStandardMaterial({
    color: "#76756c",
    roughness: 0.48,
    metalness: 0.8,
  });
  const coal = new THREE.MeshStandardMaterial({
    color: "#151a1b",
    roughness: 0.62,
    metalness: 0.12,
    flatShading: true,
  });

  const mesh = (
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: V3 = [0, 0, 0],
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.name = name;
    object.position.set(...position);
    group.add(object);
    return object;
  };
  const box = (name: string, position: V3, size: V3, material: THREE.Material = metal) =>
    mesh(name, new THREE.BoxGeometry(...size), material, position);
  const tube = (name: string, points: V3[], radius = 0.019, material: THREE.Material = worn) =>
    mesh(
      name,
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))),
        48,
        radius,
        6,
        false,
      ),
      material,
    );

  // The shell is the outer profile plus a slightly smaller inner one, giving the walls thickness
  const shell = outerProfile();
  shell.lineTo(0.682, 1.25);
  shell.lineTo(0.665, 0.87);
  shell.quadraticCurveTo(0.65, 0.54, 0.35, 0.52);
  shell.lineTo(-0.35, 0.52);
  shell.quadraticCurveTo(-0.65, 0.54, -0.665, 0.87);
  shell.lineTo(-0.682, 1.25);
  shell.closePath();
  const shellGeometry = new THREE.ExtrudeGeometry(shell, {
    depth: 2.02,
    bevelEnabled: false,
    curveSegments: 18,
  });
  shellGeometry.translate(0, 0, -1.01);
  mesh("Curved steel tub", shellGeometry, body);

  for (const z of [-1.025, 1.025]) {
    const cap = outerProfile();
    cap.closePath();
    const capGeometry = new THREE.ExtrudeGeometry(cap, {
      depth: 0.035,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.005,
      curveSegments: 18,
    });
    mesh("Rounded end plate", capGeometry, body, [0, 0, z - 0.0175]);
    tube(
      "End rim",
      [
        [-0.72, 1.25, z],
        [0, 1.25, z],
        [0.72, 1.25, z],
      ],
      0.025,
    );
  }
  for (const x of [-0.715, 0.715]) {
    tube(
      "Rolled lip",
      [
        [x, 1.255, -1.055],
        [x, 1.255, 1.055],
      ],
      0.028,
    );
    box("Chassis longitudinal channel", [x * 0.75, 0.4, 0], [0.095, 0.14, 2.2]);
  }

  // Two axles with flanged wheels and bearings
  for (const z of [-0.65, 0.65]) {
    box("Axle crossmember", [0, 0.39, z], [1.43, 0.1, 0.1]);
    const axle = mesh("Axle", new THREE.CylinderGeometry(0.045, 0.045, 1.68, 12), metal, [
      0,
      0.23,
      z,
    ]);
    axle.rotation.z = Math.PI / 2;
    for (const x of [-0.76, 0.76]) {
      // Wheel, flange and hub as three stacked cylinders
      const wheelParts = [
        [0.23, 0.12, 0, metal],
        [0.251, 0.025, -Math.sign(x) * 0.06, worn],
        [0.082, 0.04, Math.sign(x) * 0.075, worn],
      ] as const;
      for (const [radius, width, offset, material] of wheelParts) {
        const wheel = mesh(
          "Flanged wheel and hub",
          new THREE.CylinderGeometry(radius, radius, width, 32),
          material,
          [x + offset, 0.23, z],
        );
        wheel.rotation.z = Math.PI / 2;
      }
      box("Axle bearing", [x * 0.73, 0.31, z], [0.16, 0.16, 0.2]);
    }
  }

  // Buffers and couplings at both ends
  for (const z of [-1.13, 1.13]) {
    box("Buffer plate", [0, 0.43, z], [1.08, 0.16, 0.09]);
    box("Coupling shank", [0, 0.3, z], [0.08, 0.08, 0.25]);
    const ring = mesh("Coupling eye", new THREE.TorusGeometry(0.073, 0.018, 6, 16), metal, [
      0,
      0.25,
      z + Math.sign(z) * 0.1,
    ]);
    ring.rotation.x = Math.PI / 2;
  }

  const rivetGeometry = new THREE.SphereGeometry(0.016, 6, 4);
  for (const x of [-0.712, 0.712]) {
    for (const z of [-0.95, 0.95]) {
      for (const y of [0.87, 1.04, 1.19]) mesh("Seam rivet", rivetGeometry, worn, [x, y, z]);
    }
  }

  // Coal crown on top
  box("Coal bed", [0, 1.1, 0], [1.28, 0.17, 1.91], coal);
  const random = seeded(94);
  const chunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), coal, 95);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 95; i++) {
    const x = (random() - 0.5) * 1.24;
    const z = (random() - 0.5) * 1.86;
    // Heaped higher in the middle than at the walls
    dummy.position.set(x, 1.17 + 0.1 * (1 - Math.abs(x) / 0.65) + random() * 0.035, z);
    dummy.scale.set(0.075 + random() * 0.1, 0.06 + random() * 0.12, 0.075 + random() * 0.13);
    dummy.rotation.set(random() * 3, random() * 3, random() * 3);
    dummy.updateMatrix();
    chunks.setMatrixAt(i, dummy.matrix);
    chunks.setColorAt(i, new THREE.Color().setScalar(0.65 + random() * 0.55));
  }
  chunks.name = "Broken coal load";
  group.add(chunks);

  // A weathered mark
  const sign = mesh(
    "Faded Glückauf marking",
    new THREE.PlaneGeometry(1.25, 0.55),
    new THREE.MeshStandardMaterial({
      map: makeMarkingTexture(random),
      transparent: true,
      opacity: 0.57,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    [-0.718, 0.99, 0],
  );
  sign.rotation.y = -Math.PI / 2;

  return group;
}

export default function Lore() {
  const model = useMemo(createLore, []);
  return <primitive object={model} position={[0.2, 0.28, -62]} />;
}
