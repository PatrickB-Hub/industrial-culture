// Needs noise.glsl prepended.
uniform float time;
uniform vec3 eye;
varying vec2 uvMist;
varying vec3 worldMist;

void main() {
  vec2 uv = uvMist;
  float edges = smoothstep(0., .18, uv.x) * smoothstep(1., .82, uv.x)
              * smoothstep(0., .22, uv.y) * smoothstep(1., .48, uv.y);
  vec2 flow = vec2(worldMist.x * .27 - time * .035, uv.y * 2.2 + worldMist.z * .13);
  float wisps = noise(flow) * .65 + noise(flow * 2.7 + time * .013) * .35;
  // Hide mist right at the camera (no fog wall in the lens) and far away.
  float distanceFade = smoothstep(1.2, 5., abs(eye.z - worldMist.z))
                     * (1. - smoothstep(26., 40., distance(eye, worldMist)));
  float alpha = edges * smoothstep(.2, .76, wisps) * .44 * distanceFade;
  if (alpha < .004) discard;
  gl_FragColor = vec4(.62, .66, .67, alpha);
}
