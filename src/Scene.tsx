import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { makeTextures, seeded, rimShader } from "./materials";
import type { Textures } from "./materials";
import { journeyTime, stationIndex, ENDING_START } from "./journey";
import { pipe } from "./pipeGeometry";
import noise from "./shaders/noise.glsl?raw";
import skyVertex from "./shaders/sky.vert?raw";
import skyFragment from "./shaders/sky.frag?raw";

type V3 = THREE.Vector3Tuple;
type InstanceItem = { position: V3; rotation?: V3; scale?: V3; color?: string };
type SceneProps = {
  progress: React.RefObject<number>;
  reduced: boolean;
  mobile: boolean;
  onReady: () => void;
};

// Shared materials
const steel = new THREE.MeshStandardMaterial({
  color: "#303b3b",
  metalness: 0.78,
  roughness: 0.46,
});
steel.onBeforeCompile = rimShader;
const rust = new THREE.MeshStandardMaterial({ color: "#684735", metalness: 0.65, roughness: 0.72 });
const concrete = new THREE.MeshStandardMaterial({ color: "#515956", roughness: 0.9 });
const dark = new THREE.MeshStandardMaterial({ color: "#192425", metalness: 0.5, roughness: 0.64 });
const amber = new THREE.MeshStandardMaterial({
  color: "#d79543",
  emissive: "#e69838",
  emissiveIntensity: 1.8,
  toneMapped: false,
});

const unitBox = new THREE.BoxGeometry(1, 1, 1);

type BoxProps = { at?: V3; size?: V3; material?: THREE.Material } & ThreeElements["mesh"];

function Box({ at = [0, 0, 0], size = [1, 1, 1], material = steel, ...props }: BoxProps) {
  return (
    <mesh position={at} material={material} {...props}>
      <boxGeometry args={size} />
    </mesh>
  );
}

// A square beam from point a to point b
function Beam({
  a,
  b,
  width = 0.16,
  material = steel,
}: {
  a: V3;
  b: V3;
  width?: number;
  material?: THREE.Material;
}) {
  const { center, rotation, length } = useMemo(() => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    return {
      center: start.add(end).multiplyScalar(0.5),
      rotation: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
      length: direction.length(),
    };
  }, [a.join(), b.join()]);

  return (
    <mesh position={center} quaternion={rotation} material={material}>
      <boxGeometry args={[width, length, width]} />
    </mesh>
  );
}

function Instances({
  items,
  material,
  geometry,
}: {
  items: InstanceItem[];
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current!;
    const dummy = new THREE.Object3D();
    items.forEach(({ position, rotation = [0, 0, 0], scale = [1, 1, 1], color }, i) => {
      dummy.position.set(...position);
      dummy.rotation.set(...rotation);
      dummy.scale.set(...scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (color) mesh.setColorAt(i, new THREE.Color(color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled />;
}

// Round-arched window opening
function makeArchGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.92, 0);
  shape.lineTo(0.92, 0);
  shape.lineTo(0.92, 4.65);
  shape.absarc(0, 4.65, 0.92, 0, Math.PI, false);
  shape.lineTo(-0.92, 0);
  const geometry = new THREE.ShapeGeometry(shape, 16);
  // Stretched the UVs over the whole opening
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + 0.92) / 1.84, position.getY(i) / 5.57);
  }
  return geometry;
}

// Brick hall
function Hall({
  position = [0, 0, 0],
  length = 27,
  height = 10,
  width = 10,
  brick,
  window,
}: {
  position?: V3;
  length?: number;
  height?: number;
  width?: number;
  brick: THREE.Texture;
  window: THREE.Texture;
}) {
  const bricks = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: brick,
        roughness: 0.93,
        bumpMap: brick,
        bumpScale: 0.055,
        color: "#a9a7a5",
      }),
    [brick],
  );
  const windowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: window,
        emissiveMap: window,
        color: "#686b6b",
        emissive: "#ffad4c",
        emissiveIntensity: 2.1,
        roughness: 0.44,
      }),
    [window],
  );
  const arch = useMemo(makeArchGeometry, []);

  const wall = -width / 2;
  // One window bay every 3.3 m
  const bays = Array.from(
    { length: Math.floor((length - 2) / 3.3) },
    (_, i) => -length / 2 + 2 + i * 3.3,
  );

  const bars: InstanceItem[] = [];
  const masonry: InstanceItem[] = [];
  for (const z of bays) {
    // Window glazing
    for (const dz of [-0.6, -0.3, 0, 0.3, 0.6]) {
      bars.push({ position: [wall - 0.16, 4.17, z + dz], scale: [0.06, 4.65, 0.04] });
    }
    for (let y = 2.2; y < 6.5; y += 0.55) {
      bars.push({ position: [wall - 0.17, y, z], scale: [0.07, 0.045, 1.83] });
    }
    // Brick arches over the windows
    for (let i = 0; i < 13; i++) {
      const angle = (i * Math.PI) / 12;
      masonry.push({
        position: [wall - 0.16, 6.5 + Math.sin(angle) * 1.075, z + Math.cos(angle) * 1.075],
        scale: [0.27, 0.22, 0.26],
        rotation: [angle, 0, 0],
      });
    }
    for (const dz of [-1.065, 1.065]) {
      masonry.push({ position: [wall - 0.16, 4.17, z + dz], scale: [0.28, 4.67, 0.26] });
    }
    masonry.push({ position: [wall - 0.2, height / 2, z - 1.55], scale: [0.42, height, 0.47] });
  }

  return (
    <group position={position}>
      <Box at={[0, height / 2, 0]} size={[width, height, length]} material={bricks} />
      <Box at={[0, 0.32, 0]} size={[width + 0.2, 0.64, length + 0.1]} material={concrete} />
      <Box at={[0, height + 0.15, 0]} size={[width + 0.4, 0.3, length + 0.4]} />
      <Box at={[wall - 0.19, 1.75, 0]} size={[0.45, 0.2, length + 0.2]} material={concrete} />
      <Box
        at={[wall - 0.19, height - 0.6, 0]}
        size={[0.38, 0.25, length + 0.2]}
        material={bricks}
      />
      <Instances items={masonry} material={bricks} geometry={unitBox} />
      <Instances items={bars} material={steel} geometry={unitBox} />
      {bays.map((z, i) => (
        <group key={z}>
          <mesh
            position={[wall - 0.13, 1.85, z]}
            rotation={[0, -Math.PI / 2, 0]}
            geometry={arch}
            material={windowMaterial}
          />
          <mesh position={[wall - 0.2, 6.5, z]} rotation={[0, Math.PI / 2, 0]} material={steel}>
            <torusGeometry args={[0.92, 0.036, 5, 24, Math.PI]} />
          </mesh>
          <Box at={[wall - 0.27, 1.78, z]} size={[0.55, 0.17, 2.38]} material={concrete} />
          {/* Every third bay gets a downpipe and a small wall lamp */}
          {i % 3 === 0 && (
            <>
              <Pipe
                points={[
                  [wall - 0.45, 0.25, z - 1.35],
                  [wall - 0.45, height - 0.2, z - 1.35],
                  [wall + 0.3, height + 0.4, z - 1.35],
                ]}
                radius={0.07}
              />
              <Box at={[wall - 0.48, 2.8, z + 1.3]} size={[0.4, 0.15, 0.3]} />
              <mesh position={[wall - 0.51, 2.65, z + 1.3]} material={amber}>
                <sphereGeometry args={[0.09, 10, 6]} />
              </mesh>
            </>
          )}
        </group>
      ))}
      {[-length / 2 + 2, length / 2 - 2].map((z) => (
        <pointLight
          key={z}
          position={[wall - 1, 3, z]}
          color="#ffad4d"
          intensity={38}
          distance={11}
          decay={2}
        />
      ))}
      {/* Door */}
      <Box at={[wall - 0.26, 1.1, -length / 2 + 1]} size={[0.12, 2.2, 1.35]} material={dark} />
      <Pipe
        points={[
          [wall - 0.4, 8, -length / 2],
          [wall - 0.4, 8, length / 2],
        ]}
        radius={0.12}
      />
      {/* Roof vents */}
      {[-length / 2 + 3, length / 2 - 3].map((z) => (
        <group key={z}>
          <Box at={[0, height + 0.6, z]} size={[3, 1.2, 2.6]} material={bricks} />
          <Box at={[0, height + 1.25, z]} size={[3.3, 0.15, 2.9]} />
        </group>
      ))}
    </group>
  );
}

// Box textured like the main hall
function BrickBox({ at, size, material }: { at: V3; size: V3; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(...size);
    const uv = box.attributes.uv;
    const [x, y, z] = size;
    const faces = [
      [z, y],
      [z, y],
      [x, z],
      [x, z],
      [x, y],
      [x, y],
    ];
    for (let i = 0; i < 24; i++) {
      const [faceWidth, faceHeight] = faces[Math.floor(i / 4)];
      uv.setXY(i, (uv.getX(i) * faceWidth) / 35, (uv.getY(i) * faceHeight) / 10);
    }
    return box;
  }, [size.join()]);

  return <mesh position={at} geometry={geometry} material={material} />;
}

function Pipe({
  points,
  radius = 0.12,
  material = rust,
  rightAngles = false,
}: {
  points: V3[];
  radius?: number;
  material?: THREE.Material;
  rightAngles?: boolean;
}) {
  const geometry = useMemo(() => {
    if (rightAngles) return pipe(points, radius);
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    return new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radius, 8, false);
  }, [points.flat().join(), radius, rightAngles]);

  return <mesh geometry={geometry} material={material} />;
}

const GROUND_SIZE: [number, number] = [180, 230];

function makePuddleMask() {
  const SIZE = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const random = seeded(33);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // random small puddles plus hand placed ones where the camera stops
  const puddles = Array.from({ length: 160 }, () => [
    (random() - 0.5) * 110,
    random() * 170 - 110,
    1 + random() * 4,
    0.4 + random() * 1.8,
  ]);
  puddles.push(
    [8, 9, 3.2, 7],
    [8, -4, 3.8, 5],
    [7, -15, 3, 4],
    [-7, 22, 4, 1.8],
    [-3, 13, 4.6, 1.1],
    [7, 4, 2.8, 1.4],
    [4, -6, 3.3, 1.2],
    [-8, -56, 3, 1.1],
    [2, -77, 3, 1.4],
  );

  for (const [x, z, radiusX, radiusZ] of puddles) {
    const centerX = ((x + 90) / 180) * SIZE;
    const centerY = ((75 - z) / 230) * SIZE;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const wobble = 0.85 + random() * 0.3;
      const edgeX = centerX + ((Math.cos(angle) * radiusX) / 180) * SIZE * wobble;
      const edgeY = centerY + ((Math.sin(angle) * radiusZ) / 230) * SIZE * wobble;
      if (i) ctx.lineTo(edgeX, edgeY);
      else ctx.moveTo(edgeX, edgeY);
    }
    ctx.closePath();
    ctx.fillStyle = "#e9e9e9";
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

// Cobbled yard with a reflective layer on top
function Ground({ textures, mobile }: { textures: Textures; mobile: boolean }) {
  const puddleMask = useMemo(makePuddleMask, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, -40]}>
        <planeGeometry args={GROUND_SIZE} />
        <meshStandardMaterial
          map={textures.paving}
          bumpMap={textures.paving}
          bumpScale={0.095}
          roughnessMap={textures.rough}
          roughness={0.85}
          metalness={0.05}
          color="#94918b"
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -40]}>
        <planeGeometry args={GROUND_SIZE} />
        <MeshReflectorMaterial
          resolution={mobile ? 256 : 512}
          mirror={1}
          mixStrength={1.3}
          mixBlur={0.3}
          blur={mobile ? [0, 0] : [30, 10]}
          depthScale={0}
          transparent
          opacity={0.82}
          alphaMap={puddleMask}
          roughness={0.12}
          metalness={0.08}
          color="#d1ccc1"
        />
      </mesh>
    </>
  );
}

// Raised pipe gallery right of the track, rust cabinets and the pipework behind the halls
function IndustrialLayers() {
  const rivets: InstanceItem[] = [];
  for (let z = -10; z < 17; z += 1.2) {
    for (const y of [4.2, 5.2]) rivets.push({ position: [8.95, y, z], scale: [0.035, 0.05, 0.05] });
  }
  const galleryPosts = Array.from({ length: 15 }, (_, i) => -10 + i * 1.85);

  return (
    <>
      <group position={[9.1, 0, 0]}>
        <Box at={[0, 4.1, 3]} size={[2, 0.16, 27]} />
        <Box at={[-1, 4.65, 3]} size={[0.06, 0.07, 27]} />
        <Box at={[-1, 5.18, 3]} size={[0.06, 0.07, 27]} />
        {galleryPosts.map((z) => (
          <group key={z}>
            <Beam a={[-1, 4.1, z]} b={[-1, 5.2, z]} width={0.055} />
            <Beam a={[0.6, 0, z]} b={[0.6, 4.1, z]} width={0.11} />
            <Beam a={[-0.9, 4.1, z]} b={[0.6, 2.6, z]} width={0.075} />
          </group>
        ))}
        <Pipe
          points={[
            [0.2, 3.7, -10],
            [0.2, 3.7, 18],
          ]}
          radius={0.22}
        />
        <Pipe
          points={[
            [0.2, 3.15, -10],
            [0.2, 3.15, 18],
          ]}
          radius={0.12}
        />
      </group>
      <Instances items={rivets} material={rust} geometry={unitBox} />
      {[-7, 6, 15].map((z) => (
        <group key={z} position={[8, 0, z]}>
          <Box at={[0, 0.55, 0]} size={[1.3, 1.1, 1.7]} material={rust} />
          <Box at={[-0.66, 0.62, 0]} size={[0.03, 0.62, 1.1]} material={dark} />
          <Box at={[-0.69, 0.65, 0.22]} size={[0.03, 0.42, 0.04]} material={amber} />
          <Box at={[0, 1.14, 0]} size={[1.4, 0.13, 1.8]} />
          <Pipe
            points={[
              [0.4, 1.2, 0],
              [0.4, 2, 0],
              [1.8, 2, 0],
            ]}
            radius={0.14}
          />
        </group>
      ))}
      <group position={[-14, 0, -17]}>
        <Pipe
          rightAngles
          points={[
            [0, 0, 0],
            [0, 6, 0],
            [27, 6, 0],
          ]}
          radius={0.32}
        />
        <Pipe
          rightAngles
          points={[
            [0.7, 0, 0],
            [0.7, 5.2, 0],
            [27, 5.2, 0],
          ]}
          radius={0.19}
        />
      </group>
      {[-18, -25].map((z) => (
        <group key={z} position={[-17, 0, z]}>
          <Box at={[0, 1, 0]} size={[4, 2, 2]} material={rust} />
          <Pipe
            points={[
              [-2, 2, 0],
              [2, 2, 0],
            ]}
            radius={0.45}
          />
        </group>
      ))}
    </>
  );
}

// Concrete service huts on the left side further down the yard
function DistantServices() {
  return (
    <>
      {[-32, -48, -67].map((z, i) => (
        <group key={z} position={[-16 - i * 2, 0, z]}>
          <Box at={[0, 2.2, 0]} size={[5, 4.4, 7]} material={concrete} />
          <Box at={[0, 4.5, 0]} size={[5.3, 0.25, 7.3]} />
          <Pipe
            rightAngles
            points={[
              [2, 1, 0],
              [2, 6, 0],
              [8, 6, 0],
              [8, 1, 0],
            ]}
            radius={0.24}
          />
          {[-2, 0, 2].map((x) => (
            <Box key={x} at={[x, 5.3, 0]} size={[0.5, 1.3, 2]} material={rust} />
          ))}
          <Box at={[2.53, 2.8, 1]} size={[0.03, 0.18, 1.2]} material={amber} />
        </group>
      ))}
    </>
  );
}

// Low brick annexes that link the halls on the right side, with a glazed corridor
function HallConnections({ textures }: { textures: Textures }) {
  const wall = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: textures.brick,
        bumpMap: textures.brick,
        bumpScale: 0.055,
        color: "#a9a7a5",
        roughness: 0.93,
      }),
    [textures],
  );
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#46575a",
        roughness: 0.4,
        metalness: 0.3,
        emissive: "#a78249",
        emissiveIntensity: 0.2,
      }),
    [],
  );

  return (
    <>
      <BrickBox at={[22.5, 2.5, -19]} size={[12, 5, 9]} material={wall} />
      <BrickBox at={[29, 2.5, -27]} size={[8, 5, 7]} material={wall} />
      <BrickBox at={[17, 1.9, -48.5]} size={[9, 3.8, 41]} material={wall} />
      <BrickBox at={[25, 1.9, -35]} size={[17, 3.8, 7]} material={wall} />
      {[-35, -46, -57].map((z) => (
        <group key={z}>
          <Box at={[12.46, 2.1, z]} size={[0.05, 1.8, 6]} material={glass} />
          {[-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7].map((dz) => (
            <Box key={dz} at={[12.42, 2.1, z + dz]} size={[0.08, 1.9, 0.05]} />
          ))}
        </group>
      ))}
      {/* Roof slabs */}
      <Box at={[17, 3.86, -48.5]} size={[9.3, 0.15, 41.3]} />
      <Box at={[22.5, 5.07, -19]} size={[12.3, 0.15, 9.3]} />
      <Box at={[29, 5.07, -27]} size={[8.3, 0.15, 7.3]} />
      <Box at={[25, 3.87, -35]} size={[17.3, 0.15, 7.3]} />
    </>
  );
}

function Chimney({ brick }: { brick: THREE.Texture }) {
  const chimneyMap = useMemo(() => {
    const texture = brick.clone();
    texture.repeat.set(3, 13);
    texture.needsUpdate = true;
    return texture;
  }, [brick]);

  return (
    <group position={[8, 0, -12]} scale={[1, 0.85, 1]}>
      <mesh position={[0, 16, 0]}>
        <cylinderGeometry args={[0.78, 1.35, 32, 32]} />
        <meshStandardMaterial
          map={chimneyMap}
          color="#9a9898"
          bumpMap={chimneyMap}
          bumpScale={0.15}
          roughness={0.9}
        />
      </mesh>
      {/* Steel bands */}
      {[2, 9, 18, 27, 31].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
          <torusGeometry args={[1.35 - y * 0.017, 0.045, 6, 32]} />
        </mesh>
      ))}
      <mesh position={[0, 32.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={dark}>
        <circleGeometry args={[0.77, 32]} />
      </mesh>
    </group>
  );
}

// The narrow gauge track the camera follows
function Tracks() {
  const start = 41;
  const end = -81;
  const length = start - end;
  const center = (start + end) / 2;
  const sleepers: InstanceItem[] = [];
  for (let z = 40; z > end + 0.3; z -= 0.85) {
    sleepers.push({ position: [0.2, 0.065, z], scale: [2.1, 0.14, 0.22] });
  }

  return (
    <group>
      <Instances items={sleepers} material={dark} geometry={unitBox} />
      {[-0.56, 0.96].map((x) => (
        <group key={x}>
          <Box at={[x, 0.18, center]} size={[0.085, 0.13, length]} material={rust} />
          <Box at={[x, 0.26, center]} size={[0.14, 0.04, length]} material={steel} />
        </group>
      ))}
    </group>
  );
}

// Weed tufts, loose coal and the lamp posts along the track
function YardDetails() {
  const bladeGeometry = useMemo(() => new THREE.ConeGeometry(0.6, 1, 3), []);
  const lumpGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);

  const random = seeded(45);
  const grass: InstanceItem[] = [];
  const coal: InstanceItem[] = [];
  for (let i = 0; i < 130; i++) {
    const x = (random() - 0.5) * 48;
    const z = random() * 165 - 110;
    // Keep the camera path and the track clear.
    if (Math.abs(x + 6) < 2 || Math.abs(x) < 1.4) continue;
    for (let j = 0; j < 7; j++) {
      const height = 0.1 + random() * 0.28;
      grass.push({
        position: [x + (random() - 0.5) * 0.34, height * 0.4, z + (random() - 0.5) * 0.34],
        scale: [0.028 + random() * 0.025, height, 0.012],
        rotation: [(random() - 0.5) * 0.8, random() * Math.PI, (random() - 0.5) * 1.4],
        color: random() > 0.6 ? "#72705a" : "#535b48",
      });
    }
  }
  for (let i = 0; i < 45; i++) {
    coal.push({
      position: [-26 + random() * 7, 0.1 + random() * 0.3, -4 + random() * 15],
      scale: [0.4 + random() * 0.7, 0.2 + random() * 0.4, 0.4 + random() * 0.8],
      rotation: [random(), random(), random()],
    });
  }

  return (
    <>
      <Instances items={grass} material={concrete} geometry={bladeGeometry} />
      <Instances items={coal} material={dark} geometry={lumpGeometry} />
      {[-10, -28, -54, -78, -99].map((z) => (
        <group key={z} position={[4, 0, z]}>
          <Beam a={[0, 0, 0]} b={[0, 3.5, 0]} width={0.075} />
          <Box at={[0, 3.5, 0]} size={[0.28, 0.13, 0.3]} material={dark} />
          <mesh position={[0, 3.4, 0]} material={amber}>
            <sphereGeometry args={[0.09, 8, 6]} />
          </mesh>
          <pointLight position={[0, 3.3, 0]} color="#eeac55" intensity={15} distance={6} />
        </group>
      ))}
    </>
  );
}

const coalShades = ["#252a2b", "#303434", "#1e2425", "#3b3e3c"];

// Two heaps of coal next to the mining machine
function CoalHeaps() {
  const rocks = useMemo(() => {
    const random = seeded(128);
    const items: InstanceItem[] = [];
    const heaps = [
      [8, -83, 2.9, 3.3, 1.7, 1100],
      [8.4, -90, 1.7, 1.9, 0.92, 420],
    ];
    for (const [centerX, centerZ, radiusX, radiusZ, height, count] of heaps) {
      for (let i = 0; i < count; i++) {
        const angle = random() * Math.PI * 2;
        // sqrt spreads the rocks evenly over the area instead of bunching them in the middle
        const distance = Math.sqrt(random());
        const x = Math.cos(angle) * distance * radiusX;
        const z = Math.sin(angle) * distance * radiusZ;
        const y = height * Math.pow(1 - distance, 0.8);
        const size = 0.1 + random() * 0.15;
        items.push({
          position: [centerX + x, 0.08 + y, centerZ + z],
          scale: [
            size * (0.8 + random() * 0.7),
            size * (0.55 + random() * 0.5),
            size * (0.8 + random() * 0.7),
          ],
          rotation: [random() * 3, random() * 3, random() * 3],
          color: coalShades[Math.floor(random() * 4)],
        });
      }
    }
    return items;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#999999",
        roughness: 0.69,
        metalness: 0.13,
        flatShading: true,
      }),
    [],
  );
  const rockGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);

  return <Instances items={rocks} material={material} geometry={rockGeometry} />;
}

// Trussed conveyor bridge across the yard
function Catwalk() {
  const left = -19;
  const right = 13;
  const braces: React.JSX.Element[] = [];
  for (let x = left; x < right; x += 2) {
    braces.push(<Beam key={x} a={[x, 7, -17]} b={[x + 2, 9, -17]} width={0.12} />);
    braces.push(<Beam key={`${x}b`} a={[x, 9, -17]} b={[x + 2, 7, -17]} width={0.12} />);
  }

  return (
    <group>
      <Box at={[(left + right) / 2, 7, -17]} size={[right - left, 0.25, 2]} />
      <Beam a={[left, 9, -17]} b={[right, 9, -17]} width={0.16} />
      {braces}
      {[left, right].map((x) => (
        <Box key={`end-${x}`} at={[x, 8, -17]} size={[0.18, 2.25, 2.1]} />
      ))}
      {[-17, -4, 7].map((x) => (
        <Beam key={x} a={[x, 0, -17]} b={[x, 7, -17]} width={0.22} />
      ))}
      <Box at={[-18.2, 7.65, -17]} size={[0.45, 1.6, 2.3]} material={concrete} />
    </group>
  );
}

// Camera position and look-at target per station
const cameraPath = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-9.2, 2.6, 24), // Zechenanlage
    new THREE.Vector3(-6, 2.15, -24), // Förderturm
    new THREE.Vector3(-5.5, 1.7, -55), // Lore
    new THREE.Vector3(-4.6, 1.7, -77.5), // Bergbaumaschine
    new THREE.Vector3(-7.4, 2.2, -78), // Ende
  ],
  false,
  "catmullrom",
  0.2,
);
const lookAtPath = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(2, 8, -10),
    new THREE.Vector3(30, 20, -39),
    new THREE.Vector3(0, 1.5, -63),
    new THREE.Vector3(0.2, 1.45, -85.7),
    new THREE.Vector3(0.2, 1.5, -85.7),
  ],
  false,
  "catmullrom",
  0.1,
);

// Moves the camera along the path as the page scrolls
function Director({ progress, reduced, mobile }: Omit<SceneProps, "onReady">) {
  const { camera: defaultCamera, invalidate } = useThree();
  const camera = defaultCamera as THREE.PerspectiveCamera;
  const smoothed = useRef(0);

  // With reduced motion the canvas only renders on demand
  useEffect(() => {
    const redraw = () => requestAnimationFrame(invalidate);
    window.addEventListener("scroll", redraw, { passive: true });
    invalidate();
    return () => window.removeEventListener("scroll", redraw);
  }, [invalidate]);

  useFrame((state, delta) => {
    const scroll = progress.current;
    // Reduced motion jumps straight from station to station instead of travelling
    const target = reduced
      ? scroll > ENDING_START
        ? 1
        : stationIndex(scroll) / 4
      : journeyTime(scroll);
    smoothed.current = reduced
      ? target
      : THREE.MathUtils.damp(smoothed.current, target, 5, Math.min(delta, 0.25));
    const t = smoothed.current;

    const position = cameraPath.getPoint(t);
    const lookAt = lookAtPath.getPoint(t);
    camera.position.copy(position);

    // The fog thickens towards the lore and again towards the mining machine
    const depth = -position.z;
    const cartFog = THREE.MathUtils.smoothstep(depth, 40, 56);
    const finalFog = THREE.MathUtils.smoothstep(depth, 67, 78);
    (state.scene.fog as THREE.FogExp2).density = 0.026 + 0.025 * cartFog + 0.049 * finalFog;

    if (mobile) {
      // For narrow screens the camera is pulled left and back so the objects stay in frame
      const framing = THREE.MathUtils.smoothstep(t, 0.57, 0.75);
      camera.position.x -= 1.6 + framing * 2.6;
      camera.position.z += framing * 2.0;
      lookAt.y -= t > 0.45 ? 1.7 : -1.6;
    }
    camera.lookAt(lookAt);
    camera.fov = mobile ? 63 : 57;
    camera.updateProjectionMatrix();
  });

  return null;
}

function CloudSky() {
  return (
    <mesh position={[0, 0, -30]} renderOrder={-1}>
      <sphereGeometry args={[195, 32, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        vertexShader={skyVertex}
        fragmentShader={noise + skyFragment}
      />
    </mesh>
  );
}

function World({ progress, reduced, mobile, onReady }: SceneProps) {
  const textures = useMemo(makeTextures, []);

  useEffect(() => {
    rust.map = textures.rust;
    rust.bumpMap = textures.rust;
    rust.bumpScale = 0.025;
    rust.color.set("#aaa29c");
    rust.needsUpdate = true;
    steel.map = textures.rust;
    steel.bumpMap = textures.rust;
    steel.bumpScale = 0.007;
    steel.color.set("#696b70");
    steel.needsUpdate = true;
    onReady();
    return () => Object.values(textures).forEach((texture) => texture.dispose());
  }, []);

  return (
    <>
      <color attach="background" args={["#858b8d"]} />
      <fogExp2 attach="fog" args={["#858b8d", 0.026]} />
      <hemisphereLight args={["#ced6df", "#383935", 2.05]} />
      <directionalLight position={[-12, 35, -25]} color="#e1e7ec" intensity={1.9} />
      <ambientLight intensity={0.22} />
      <Director progress={progress} reduced={reduced} mobile={mobile} />
      <Ground textures={textures} mobile={mobile} />
      <IndustrialLayers />
      <DistantServices />
      <Hall
        position={[17, 0, 1]}
        length={35}
        width={12}
        height={10}
        brick={textures.brick}
        window={textures.window}
      />
      <Hall
        position={[-24, 0, -24]}
        length={20}
        width={12}
        height={8}
        brick={textures.brick}
        window={textures.window}
      />
      <Hall
        position={[17, 0, -82]}
        length={27}
        width={10}
        height={8}
        brick={textures.brick}
        window={textures.window}
      />
      <Chimney brick={textures.brick} />
      <HallConnections textures={textures} />
      <Catwalk />
      <Tracks />
      <YardDetails />
      <CoalHeaps />
      <CloudSky />
    </>
  );
}

function Scene(props: SceneProps) {
  return (
    <Canvas
      frameloop={props.reduced ? "demand" : "always"}
      dpr={props.mobile ? [1, 1.25] : [1, 1.6]}
      camera={{ position: [-9.2, 2.6, 24], fov: 57, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <World {...props} />
    </Canvas>
  );
}

export default React.memo(Scene);
