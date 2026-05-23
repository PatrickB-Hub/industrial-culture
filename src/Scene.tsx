import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeElements } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { makeTextures, seeded, rimShader } from "./materials";
import type { Textures } from "./materials";
import { journeyTime, stationIndex, ENDING_START } from "./journey";
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
const dark = new THREE.MeshStandardMaterial({ color: "#192425", metalness: 0.5, roughness: 0.64 });

const unitBox = new THREE.BoxGeometry(1, 1, 1);

type BoxProps = { at?: V3; size?: V3; material?: THREE.Material } & ThreeElements["mesh"];

function Box({ at = [0, 0, 0], size = [1, 1, 1], material = steel, ...props }: BoxProps) {
  return (
    <mesh position={at} material={material} {...props}>
      <boxGeometry args={size} />
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
      <Tracks />
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
