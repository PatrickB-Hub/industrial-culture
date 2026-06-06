uniform float time;
uniform vec3 eye;
uniform float pixels;
uniform float spark; // 1 for the spark layer, 0 for dust
attribute float seed;
varying float life;
varying float distanceFade;

void main() {
  vec3 p = position;
  float t = time * (.25 + seed * .35);

  if (spark > .5) {
    // Sparks rise, wobble and fade out over their lifetime, then respawn.
    float age = fract(seed + t * .16);
    p.y += age * 3.;
    p.x += sin(seed * 90. + age * 5.) * .22;
    p.z += cos(seed * 40. + age * 4.) * .18;
    life = sin(age * 3.14159);
  } else {
    // Dust drifts down and wraps around the camera, so it never runs out.
    p.x += sin(t * .6 + seed * 120.) * .6;
    p.z += cos(t * .4 + seed * 33.) * .4;
    p.y = mod(p.y - t * .24, 13.);
    p.x = mod(p.x - eye.x + 18., 36.) + eye.x - 18.;
    p.z = mod(p.z - eye.z + 25., 50.) + eye.z - 25.;
    life = .45 + seed * .55;
  }

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.);
  distanceFade = 1. - smoothstep(10., 42., -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(
    pixels * (spark > .5 ? .07 : .065 + seed * .075) / max(1., -mvPosition.z),
    1.,
    spark > .5 ? 5. : 9.
  );
}
