export const landingBackgroundVertexShader = `#version 300 es
precision highp float;

in vec3 position;
in vec2 particleData;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float elapsedSeconds;
uniform float movementSpeed;
uniform float spread;
uniform float baseSize;
uniform float effectiveDpr;
uniform float hoverFactor;
uniform vec2 pointer;

out float particleLuminosity;

void main() {
  float phase = particleData.y * 6.28318530718;
  float time = elapsedSeconds * movementSpeed;
  vec3 drift = vec3(
    sin(time * 0.71 + phase),
    cos(time * 0.53 + phase * 1.17),
    sin(time * 0.37 + phase * 0.83)
  ) * spread * 0.018;
  vec3 pointerOffset = vec3(pointer * hoverFactor * 0.16, 0.0);
  vec4 viewPosition = modelViewMatrix * vec4(position + drift + pointerOffset, 1.0);
  float perspectiveScale = 1.0 / max(1.0, -viewPosition.z);
  gl_PointSize = baseSize * mix(0.55, 1.35, particleData.x) * effectiveDpr * perspectiveScale;
  gl_Position = projectionMatrix * viewPosition;
  particleLuminosity = mix(0.68, 1.0, particleData.x);
}
`

export const landingBackgroundFragmentShader = `#version 300 es
precision highp float;

uniform float opacity;
uniform float glowStrength;

in float particleLuminosity;
out vec4 fragmentColor;

void main() {
  float radius = length(gl_PointCoord - vec2(0.5));
  if (radius >= 0.5) discard;
  float core = 1.0 - smoothstep(0.05, 0.24, radius);
  float halo = pow(1.0 - smoothstep(0.08, 0.5, radius), 2.0);
  float alpha = clamp((core + halo * glowStrength) * opacity * particleLuminosity, 0.0, 1.0);
  vec3 coolWhite = vec3(0.96, 0.95, 1.0);
  vec3 luminousPink = vec3(1.0, 0.48, 0.91);
  vec3 color = mix(luminousPink, coolWhite, core * 0.72 + particleLuminosity * 0.18);
  fragmentColor = vec4(color, alpha);
}
`
