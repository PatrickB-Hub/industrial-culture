varying vec2 vUv;

void main() {
  float alpha = pow(sin(vUv.x * 3.14159), 3.) * sin(vUv.y * 3.14159) * .055;
  gl_FragColor = vec4(.87, .86, .75, alpha);
}
