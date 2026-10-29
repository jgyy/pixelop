/**
 * GLSL for the 3D view. Everything is shaded the way the pixel art is: a
 * fixed sun, light quantised into four tones with shadows leaning purple,
 * then the hour's tint and darkness laid over it and a haze toward the
 * horizon, so the 3D jianghu keeps the palette of the painted one.
 */

/** Light, tone, the hour's tint and the haze, shared by every surface. */
const COMMON = /* glsl */ `
uniform vec3 sunDir;
uniform vec4 tintA;
uniform vec4 tintB;
uniform vec4 golden;
uniform vec3 fogColor;
uniform vec2 fogRange;
uniform vec3 eye;

vec3 toon(vec3 c, vec3 n) {
  float lum = 0.28 + 0.72 * max(0.0, dot(normalize(n), sunDir));
  float v = lum * 3.2;
  if (v > 2.55) return min(vec3(1.0), c * 1.14 + 0.03);
  if (v > 1.55) return c;
  if (v > 0.85) return c * vec3(0.74, 0.72, 0.86);
  return c * vec3(0.52, 0.48, 0.70);
}

vec3 hour(vec3 c, vec3 world) {
  c = mix(c, tintA.rgb, tintA.a);
  c = mix(c, tintB.rgb, tintB.a);
  c = mix(c, golden.rgb, golden.a);
  float d = distance(world, eye);
  float f = clamp((d - fogRange.x) / max(1.0, fogRange.y - fogRange.x), 0.0, 1.0);
  return mix(c, fogColor, f * f);
}
`;

const VARY = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
`;

/** Props: vertex colours, swaying with the wind (alpha holds how much). */
export const PROP_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec4 color;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform float time;
${VARY}
varying vec3 vColor;
void main(void) {
  #include<instancesVertex>
  vec4 w = finalWorld * vec4(position, 1.0);
  float sway = color.a;
  w.x += sin(time * 1.7 + w.x * 0.6 + w.z * 0.4) * 0.09 * sway;
  w.z += cos(time * 1.3 + w.x * 0.5) * 0.06 * sway;
  vWorld = w.xyz;
  vNormal = mat3(finalWorld) * normal;
  vColor = color.rgb;
  gl_Position = viewProjection * w;
}
`;

export const PROP_FRAGMENT = /* glsl */ `
precision highp float;
${COMMON}
${VARY}
varying vec3 vColor;
void main(void) {
  gl_FragColor = vec4(hour(toon(vColor, vNormal), vWorld), 1.0);
}
`;

/** Ground tops: the chunk's painted texture. */
export const GROUND_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
${VARY}
varying vec2 vUV;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normal;
  vUV = uv;
  gl_Position = viewProjection * w;
}
`;

export const GROUND_FRAGMENT = /* glsl */ `
precision highp float;
${COMMON}
${VARY}
varying vec2 vUV;
uniform sampler2D ground;
void main(void) {
  vec3 c = texture2D(ground, vUV).rgb;
  gl_FragColor = vec4(hour(toon(c, vNormal), vWorld), 1.0);
}
`;

/** Cliff walls: a swatch per tile kind from an atlas, repeated down the face. */
export const WALL_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float cell;
uniform mat4 world;
uniform mat4 viewProjection;
${VARY}
varying vec2 vUV;
varying float vCell;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = normal;
  vUV = uv;
  vCell = cell;
  gl_Position = viewProjection * w;
}
`;

export const WALL_FRAGMENT = /* glsl */ `
precision highp float;
${COMMON}
${VARY}
varying vec2 vUV;
varying float vCell;
uniform sampler2D atlas;
uniform float cells;
void main(void) {
  vec2 f = fract(vUV);
  vec2 st = vec2((floor(vCell + 0.5) + f.x) / cells, f.y);
  vec3 c = texture2D(atlas, st).rgb;
  // deep down the cliff, the rock darkens away into shadow
  c *= mix(1.0, 0.55, clamp((vUV.y - 1.0) / 3.0, 0.0, 1.0));
  gl_FragColor = vec4(hour(toon(c, vNormal), vWorld), 1.0);
}
`;

/** Water, deep water, lava and paddies: the iso tiles' waves, recomputed per texel. */
export const LIQUID_VERTEX = WALL_VERTEX;

export const LIQUID_FRAGMENT = /* glsl */ `
precision highp float;
${COMMON}
${VARY}
varying vec2 vUV;
varying float vCell;
uniform float time;
uniform vec3 tones[16];
vec3 tone(int k, float v) {
  int i = int(clamp(floor(v * 4.0), 0.0, 3.0));
  for (int j = 0; j < 16; j++) if (j == k * 4 + i) return tones[j];
  return tones[0];
}
void main(void) {
  // snap to the art's 16 texels a tile
  vec2 p = floor(vUV * 16.0) / 16.0 + 1.0 / 32.0;
  vec2 q = fract(p);
  float a = q.x;
  float c2 = q.y;
  float T = 6.2831853;
  float ph = floor(time * 6.0) / 8.0 * T;
  int k = int(floor(vCell + 0.5));
  float v;
  vec3 col;
  if (k == 2) {
    v = 0.5 + 0.28 * sin(T * (a + c2) + ph) + 0.22 * sin(T * (2.0 * a - c2) - ph) * sin(T * c2 + ph * 0.5);
    col = tone(k, v * 0.95);
    if (v > 0.9) col = vec3(1.0, 0.878, 0.5);
  } else {
    v = 0.5 + 0.25 * sin(T * (2.0 * a + c2) + ph) + 0.2 * sin(T * (a - 2.0 * c2) - ph);
    col = tone(k, v * 0.95);
    if (sin(T * (3.0 * a + 2.0 * c2) + ph * 2.0) > 0.985) col = vec3(0.847, 0.941, 1.0);
  }
  // lava glows of itself; water takes the light
  vec3 lit = k == 2 ? col : toon(col, vNormal);
  gl_FragColor = vec4(hour(lit, vWorld), k == 2 ? 1.0 : 0.9);
}
`;

/** Sprites: the pixel art itself, cut out, facing the camera, under the hour's light. */
export const SPRITE_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 viewProjection;
${VARY}
varying vec2 vUV;
void main(void) {
  vec4 w = world * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUV = uv;
  gl_Position = viewProjection * w;
}
`;

export const SPRITE_FRAGMENT = /* glsl */ `
precision highp float;
${COMMON}
${VARY}
varying vec2 vUV;
uniform sampler2D sprite;
uniform float opacity;
void main(void) {
  vec4 c = texture2D(sprite, vUV);
  if (c.a < 0.5) discard;
  // a shade or a fading beast is only half there: a screen-door of its pixels
  if (opacity < 0.95 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0 && opacity < 0.75) discard;
  if (opacity < 0.3) discard;
  gl_FragColor = vec4(hour(c.rgb, vWorld), 1.0);
}
`;

/**
 * Glows of lamps and lanterns after dark (camera-facing, added on), and the
 * soft shadows under the folk (laid flat on the ground): one quad drawn many
 * times over, each with its own colour.
 */
export const GLOW_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 glowColor;
#include<instancesDeclaration>
uniform mat4 viewProjection;
uniform vec3 camRight;
uniform vec3 camUp;
uniform float flatMode;
varying vec2 vUV;
varying vec4 vGlow;
void main(void) {
  #include<instancesVertex>
  vec3 centre = finalWorld[3].xyz;
  float size = length(finalWorld[0].xyz);
  vec3 w = flatMode > 0.5 ? centre + vec3(position.x * size, 0.0, position.y * length(finalWorld[2].xyz)) : centre + (position.x * camRight + position.y * camUp) * size;
  vUV = uv;
  vGlow = glowColor;
  gl_Position = viewProjection * vec4(w, 1.0);
}
`;

export const GLOW_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec4 vGlow;
void main(void) {
  float d = length(vUV - 0.5) * 2.0;
  // stepped, like the painted glows
  float k = floor((1.0 - clamp(d, 0.0, 1.0)) * 4.0) / 4.0;
  gl_FragColor = vec4(vGlow.rgb, vGlow.a * k * k);
}
`;
