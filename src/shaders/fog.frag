// Needs noise.glsl prepended.
varying vec2 vUv;
uniform float time;
uniform float opacity;

void main() {
  vec2 u = vUv;
  float n = noise(u * vec2(6., 3.) + time * .012) * .65 + noise(u * vec2(15., 6.) - time * .018) * .35;
  // Soft edges on all four sides, so the fog plane never shows its outline.
  float edge = smoothstep(0., .18, u.y) * smoothstep(1., .45, u.y)
             * smoothstep(0., .12, u.x) * smoothstep(1., .85, u.x);
  gl_FragColor = vec4(vec3(.60, .64, .66), n * edge * opacity);
}
