uniform float spark;
varying float life;
varying float distanceFade;

void main() {
  float d = length(gl_PointCoord - .5) * 2.;
  float alpha = (1. - smoothstep(.15, 1., d)) * life * distanceFade * (spark > .5 ? .88 : .82);
  if (alpha < .01) discard;
  vec3 color = spark > .5
    ? mix(vec3(1., .16, .025), vec3(1., .65, .16), life)
    : vec3(.96, .97, .96);
  gl_FragColor = vec4(color, alpha);
}
