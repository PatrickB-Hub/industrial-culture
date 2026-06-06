varying vec2 uvMist;
varying vec3 worldMist;

void main() {
  uvMist = uv;
  worldMist = (modelMatrix * vec4(position, 1.)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldMist, 1.);
}
