// Needs noise.glsl prepended.
varying vec3 vP;

float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.02 + 3.7;
    a *= .5;
  }
  return v;
}

void main() {
  vec3 d = normalize(vP);
  // Project the view direction onto a flat cloud layer above the yard.
  vec2 uv = d.xz / (.3 + abs(d.y)) * .95;
  float f = fbm(uv * 2.5);
  vec3 cloud = mix(vec3(.28, .30, .33), vec3(.70, .72, .74), smoothstep(.2, .8, f));
  // A faint bright patch where the sun sits behind the overcast.
  float sun = pow(max(dot(d, normalize(vec3(-.15, .35, -1.))), 0.), 15.);
  cloud += vec3(.14, .14, .13) * sun * (.5 + f);
  // Fade into a flat haze colour towards the horizon.
  cloud = mix(vec3(.52, .545, .555), cloud, smoothstep(-.05, .5, d.y));
  gl_FragColor = vec4(cloud, 1.);
}
