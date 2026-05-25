import * as THREE from "three";

export function pipe(points: THREE.Vector3Tuple[], radius: number, sides = 10) {
  const corners = points.map((point) => new THREE.Vector3(...point));
  const directions = corners
    .slice(1)
    .map((corner, i) => corner.clone().sub(corners[i]).normalize());

  // Normal of the plane the pipe bends in
  const binormal = new THREE.Vector3();
  for (let i = 1; i < directions.length; i++) {
    binormal.crossVectors(directions[i - 1], directions[i]);
    if (binormal.lengthSq() > 0.001) break;
  }
  if (binormal.lengthSq() < 0.001) {
    const up =
      Math.abs(directions[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    binormal.crossVectors(directions[0], up);
  }
  binormal.normalize();

  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];

  corners.forEach((center, i) => {
    const before = directions[Math.max(0, i - 1)];
    const after = directions[Math.min(i, directions.length - 1)];
    const tangent = before.clone().add(after).normalize();
    const radial = new THREE.Vector3().crossVectors(binormal, tangent).normalize();
    const segmentRadial = new THREE.Vector3().crossVectors(binormal, before).normalize();
    // Widen the ring at corners so the pipe keeps its full diameter
    const stretch = 1 / Math.max(0.1, Math.abs(radial.dot(segmentRadial)));
    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const vertex = center
        .clone()
        .addScaledVector(radial, Math.cos(angle) * radius * stretch)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(...vertex.toArray());
      uv.push(j / sides, i);
    }
  });

  // Two triangles per quad between neighbouring rings
  for (let i = 0; i < corners.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j;
      const b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
