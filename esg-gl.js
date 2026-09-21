// Shaders copied verbatim from ccus.heidelbergmaterials.com (_nuxt/DWvC7eXz.js)
const PARTICLE_VERT = `#define GLSLIFY 1
#include <common>
#include <packing>

attribute vec3 random;

uniform sampler2D uPositions;
uniform sampler2D uNormals;
uniform sampler2D uColors;
uniform vec2 uPointSize;
uniform float uPointScale;
uniform float uTime;
uniform float uScale;
uniform float uFocusDistance;
uniform float uFocusRange;
uniform float uHoleRadius;
uniform float uPixelRatio;
uniform float uDispersionProgress;
uniform float uDispersionAmplitude;
uniform float uRandomAmplitude;
uniform vec2 uAmplitude;
uniform float uForegroundPointSize;
uniform float uBackgroundPointSize;

uniform float uDepthCameraNear;
uniform float uDepthCameraFar;
uniform float uDepthCutOff;

uniform float uUseSimulation;
uniform sampler2D uSimulation;

varying vec3 vRandom;
varying vec3 vNormal;
varying vec3 vDepth;
varying float vViewZ;
varying vec2 vUv;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

#define PI 3.141592653589793

// float viewZToOrthographicDepth(float viewZ, float near, float far) {
// 	return clamp((viewZ + near) / (near - far), 0.0, 1.0);
// }

vec3 objectToViewPos(in vec3 pos) {
    return (viewMatrix * modelMatrix * vec4(pos, 1.0)).xyz;
}

vec4 objectToClipPos(in vec3 pos) {
    return (projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0));
}

#define COMPUTE_DEPTH_01(pos,far) -(objectToViewPos(pos).z / far)
#define COMPUTE_EYEDEPTH(o) -objectToViewPos( pos ).z

void main(void) {
    vec2 texcoord = position.xy;
    vRandom = random;

    vec3 pos = texture2D(uPositions, texcoord.xy).xyz;
    vec3 col = texture2D(uColors, texcoord.xy).rgb;
    vec3 nor = texture2D(uNormals, texcoord.xy).xyz;
    vNormal = nor;

    // // pos.z += position.z * 0.001;
    // #ifndef USE_SINGLE
    // pos.x += cos(PI + uTime * random.x) * (random.z * uAmplitude.x);
    // pos.y += sin(PI + uTime * random.x) * (random.y * uAmplitude.y);
    // // pos.z += sin(PI * random.x + uTime) * 0.002;
    // #endif

    // pos.x += cos(time + PI * random.x) * uAmplitude.x * random.y;
    // pos.y += sin(time + PI * random.x) * uAmplitude.y * random.y;
    // pos.z += sin(time + PI * random.x) * cos(time + PI * random.x) * uAmplitude.x * random.z;

    float time = uTime * uAmplitude.y * random.z;
    pos += nor * uAmplitude.x * cos(time + PI * random.z) * random.x; // * uAmplitude.x * random.x;

    pos = mix(pos, pos + (random * 2.0 - 1.0) * uDispersionAmplitude, uDispersionProgress);
    pos += (random * 2.0 - 1.0) * uRandomAmplitude;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);

    // worldPos.y += sin(PI * random.x + uTime) * 1.25;

    vec4 mvPos = viewMatrix * worldPos;
    vec4 mvpPos = projectionMatrix * mvPos;

    if (uUseSimulation == 1.0) {
        mvpPos.xy += texture2D(uSimulation, vec2(texcoord.x, texcoord.y)).xy;
    }

    // // https://codepen.io/soulwire/pen/DdGRYG?editors=0010

    vWorldPosition = worldPos.rgb;
    vWorldNormal = (modelMatrix * vec4(vNormal, 0.0)).rgb;
    vUv = uv;

    float near = uDepthCameraNear;
    float far = uDepthCameraFar;
    float depth = -mvpPos.z;
    depth = clamp(0.0, 1.0, (depth + near) / (near - far));

    float signedDistance = depth - uFocusDistance;
    float magnitude = smoothstep(0.0, uFocusRange, abs(signedDistance));
    vDepth.xy = magnitude * vec2(
                step(signedDistance, 0.0),
                step(0.0, signedDistance)
            );
    vDepth.z = magnitude;

    float pointSize = distance(worldPos.xyz, cameraPosition);
    pointSize = 1.0 - (pointSize / uPointSize.y);
    // pointSize = (pointSize / uPointSize.y);
    pointSize = clamp(0.1, 0.7, pointSize);

    gl_Position = mvpPos;
    gl_PointSize = uPointSize.x * 2.;
    gl_PointSize += vDepth.x * uForegroundPointSize * (0.75 + random.z * 0.25);
    gl_PointSize += vDepth.y * uBackgroundPointSize * random.x;
    gl_PointSize *= uPixelRatio;
    // gl_PointSize *= 0.5 + 0.5 * random.z;
}
`;
const PARTICLE_FRAG = `precision highp float;
#define GLSLIFY 1

/* Misc */
uniform float uTime;
uniform float uGlobalOpacity;
uniform sampler2D uMatCap;
uniform sampler2D uNoiseTexture;
uniform float uUseLighting;
uniform float uDepthCutOff;

/* Hole */
uniform float uHoleGlow;
uniform float uHoleRadius;
uniform float uHoleThickness;
uniform vec3 uHoleColor;

/* Light Position */
uniform vec3 uLightPosition;

/* Dispersion */
uniform float uDispersionProgress;
uniform float uDispersionAmplitude;
uniform float uDispersionAlpha;

/* Depth */
uniform float uDepthCameraNear;
uniform float uDepthCameraFar;

/* Bokeh */
uniform float uBokehEnabled;
uniform float uBokehIndex;
uniform sampler2D uBokehColors;
uniform vec3 uBokehColor1;
uniform vec3 uBokehColor2;
uniform vec3 uBokehColor3;
uniform float uBokehEdge;
uniform float uBokehOpacity;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vDepth;

const float COUNT = 3.0;
const float OFFSET = 1.0 / COUNT;
const float STEP = 1.0 / (COUNT - 1.0);

uniform vec3 uMatCapColor;
uniform float uMatCapCircle;
uniform float uFocusDistance;
uniform float uFocusRange;

varying vec3 vRandom;
varying float vViewZ;
varying vec3 vNormal;

#include <common>
#include <packing>

vec2 rotateUV(in vec2 uv, in float r, in vec2 origin) {
	float c = cos(r);
	float s = sin(r);
	mat2 m = mat2(c, -s, s, c);
	vec2 st = uv - origin;
	st = m * st;
	return st + origin;
}

vec2 rotateUV(in vec2 uv, in float r) {
	return rotateUV(uv, r, vec2(0.5));
}

float circle(in vec2 uv, in vec2 position) {
    return length(uv - position);
}

float circle(in vec2 uv) {
    return circle(uv, vec2(0.5));
}

float ring(in vec2 uv, in float radius, in float thickness) {
    float ring = length(uv - 0.5);
    ring = abs(ring - radius);
    ring = ring * 100.0 / thickness;
    ring = -ring + 0.5;
    return clamp(ring, 0.0, 1.0);
}

float randomNoise(in vec2 uv) {
    return texture(uNoiseTexture, uv).r;
}

float map(in float value, in float min0, in float max0, in float min1, in float max1) {
    return min1 + ((value - min0) / (max0 - min0)) * (max1 - min1);
}

float map01(in float value, in float min1, in float max1) {
    return min1 + value * (max1 - min1);
}

void main(void) {
    float shouldDiscard = vDepth.y > uDepthCutOff ? 1.0 : 0.0;
    if (shouldDiscard == 1.0) discard;
    if (uGlobalOpacity < 0.1) discard;

    vec2 uv = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);

    vec3 depth = vDepth.xyz;

    // Cumulate depth
    float backward_depth = 0.0;
    // backward_depth += facing_camera;
    backward_depth += depth.x;
    backward_depth += depth.y;
    backward_depth = saturate(backward_depth);

    // Cumulate forward depth
    float forward_depth = 0.0;
    forward_depth += depth.x;

    // Compute blurred matcap
    vec2 matcap_uv = vec2(uv.x, uv.y * OFFSET);
    vec4 matcap0 = texture(uMatCap, matcap_uv.xy);
    matcap_uv.y += OFFSET;
    vec4 matcap1 = texture(uMatCap, matcap_uv.xy);
    matcap_uv.y += OFFSET;
    vec4 matcap2 = texture(uMatCap, matcap_uv.xy);

    // Split depth to corresponding matcap
    float depth_split0 = clamp(backward_depth / STEP, 0.0, 1.0);
    float depth_split1 = clamp((backward_depth - STEP) / STEP, 0.0, 1.0);

    // Combine states
    vec4 matcap = mix(matcap0, matcap1, depth_split0);
    matcap = mix(matcap, matcap2, depth_split1);

    // Compute edge
    float edgeThickness = 0.28 - 0.5 * vRandom.z; //
    float edge = smoothstep(
            0.5,
            1.0 - edgeThickness * (1.0 - backward_depth),
            1.0 - circle(uv)
        );

    matcap.a *= edge;

    // Reduce visibility at distance
    matcap.a -= backward_depth * (0.7 + vRandom.x * 0.2);

    // BOKEH
    float bokehRust = 0.2 + vRandom.x * 0.3;
    float bokehRust1 = 2.0 + vRandom.x * 5.0;
    float bokehNoise = randomNoise(mod(uv * 0.5 + 100.0 * vRandom.z, vec2(1.0)));
    bokehNoise = pow(bokehNoise, bokehRust1);
    // bokehNoise += 0.2;
    // vec4 bokeh = vec4(matcap.rgb, 1.0);
    // bokeh.rgb = mix(bokeh.rgb, uBokehColor1.rgb, step(1.0, uBokehIndex));
    // bokeh.rgb = mix(bokeh.rgb, uBokehColor2.rgb, step(2.0, uBokehIndex));
    // bokeh.rgb = mix(bokeh.rgb, uBokehColor3.rgb, step(0.8, vRandom.z));
    const float bokehColorSlice = 1.0 / 5.0;
    vec4 bokeh = texture(uBokehColors, vec2(bokehColorSlice * 0.5 + bokehColorSlice * uBokehIndex, 0.5));
    bokeh.a = 1.0;
    bokeh.a *= smoothstep(0.5, min(0.4999, uBokehEdge * 0.5 * bokehNoise), circle(uv));
    bokeh.a *= uBokehOpacity;
    bokeh.a *= map01(bokehNoise, 0.5, 1.0);
    bokeh.a -= depth.y * map01(vRandom.x, 0.7, 0.9);

    // Mix glow and matcap
    vec4 color = mix(matcap, bokeh, smoothstep(0.0, 0.5, depth.z) * uBokehEnabled);

    // color.rgba = vec4(depth.y, depth.x, 0.0, 1.0);
    // color.rgba = vec4(smoothstep(0.0, 0.5, depth.z), 0.0, 0.0, 1.0);
    // color.rgb = vec3(depth.y, depth.x, 0.0);

    // const float bokehColorSlice = 1.0 / 5.0;
    // color.rgb = texture(uBokehColors, vec2(bokehColorSlice * 0.5 + bokehColorSlice * uBokehIndex, 0.5)).rgb;
    // color.a = 1.0;

    // Fadeout on dispersion
    color.a *= 1.0 - uDispersionProgress * (1.0 - uDispersionAlpha);

    // Global opacity
    color.a *= uGlobalOpacity;

    if (color.a < 0.1) discard;

    gl_FragColor = color;

    #include <colorspace_fragment>
}
`;
const SIM_VERT = `#define GLSLIFY 1
varying vec2 vUv;

void main(void) {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`;
const SIM_FRAG = `#define GLSLIFY 1
// Reference: https://codepen.io/soulwire/pen/DdGRYG
varying vec2 vUv;

uniform sampler2D uData;
uniform sampler2D uInitialPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uInvViewMatrix;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uInvProjectionMatrix;

uniform vec3 uMouse;
uniform float uStrength;
uniform float uScreenRatio;
uniform float uSize;
uniform float uEase;

#define PI 3.141592653589793

//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//

vec3 mod289_0(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289_0(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute_0(vec4 x) {
     return mod289_0(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt_0(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289_0(i);
  vec4 p = permute_0( permute_0( permute_0(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt_0(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
  }

vec3 snoiseVec3( vec3 x ){

  float s  = snoise(vec3( x ));
  float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
  float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
  vec3 c = vec3( s , s1 , s2 );
  return c;

}

vec3 curlNoise( vec3 p ){
  
  const float e = .1;
  vec3 dx = vec3( e   , 0.0 , 0.0 );
  vec3 dy = vec3( 0.0 , e   , 0.0 );
  vec3 dz = vec3( 0.0 , 0.0 , e   );

  vec3 p_x0 = snoiseVec3( p - dx );
  vec3 p_x1 = snoiseVec3( p + dx );
  vec3 p_y0 = snoiseVec3( p - dy );
  vec3 p_y1 = snoiseVec3( p + dy );
  vec3 p_z0 = snoiseVec3( p - dz );
  vec3 p_z1 = snoiseVec3( p + dz );

  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;

  const float divisor = 1.0 / ( 2.0 * e );
  return normalize( vec3( x , y , z ) * divisor );

}

//
// GLSL textureless classic 3D noise "cnoise",
// with an RSL-style periodic variant "pnoise".
// Author:  Stefan Gustavson (stefan.gustavson@liu.se)
// Version: 2011-10-11
//
// Many thanks to Ian McEwan of Ashima Arts for the
// ideas for permutation and gradient selection.
//
// Copyright (c) 2011 Stefan Gustavson. All rights reserved.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/ashima/webgl-noise
//

vec3 mod289_1(vec3 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289_1(vec4 x)
{
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute_1(vec4 x)
{
  return mod289_1(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt_1(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
  return t*t*t*(t*(t*6.0-15.0)+10.0);
}

// Classic Perlin noise
float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289_1(Pi0);
  Pi1 = mod289_1(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute_1(permute_1(ix) + iy);
  vec4 ixy0 = permute_1(ixy + iz0);
  vec4 ixy1 = permute_1(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt_1(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt_1(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

const float DRAG = 0.80;
const float EASE_MIN = 0.0001;
const float EASE_MAX = 0.25;
// const float THICKNESS = 0.15;
const float THICKNESS = 0.5;

#define _INITIAL_POSITION texture(uInitialPosition, vUv)
#define _DATA texture(uData, vUv)

vec4 getVertexPosition() {
    vec4 mvPosition = vec4(_INITIAL_POSITION.xyz, 1.0);
    return uProjectionMatrix * uModelViewMatrix * mvPosition;
}

#if defined(DEBUG)
void main(void) {
    gl_FragColor = vec4(_POSITION.xyz, 1.0);
}
#elif defined(RESET)
void main(void) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
}
#else
void main(void) {
    vec2 pos = _DATA.xy;
    vec2 vel = _DATA.zw;
    vec2 mouse = uMouse.xy;

    vec4 wpos = getVertexPosition();
    vec2 spos = (wpos.xy + pos.xy) / wpos.w;

    vec2 direction = spos.xy - mouse.xy;
    direction.x *= uScreenRatio;
    float distance = length(direction);

    float thickness = clamp(uSize, 0.0, 1.0) * THICKNESS;
    float ease = mix(EASE_MIN, EASE_MAX, clamp(uEase, 0.0, 1.0));
    float f = thickness / distance;

    if (distance < thickness) {
        float t = atan(direction.y, direction.x);
        vel.x += f * cos(t);
        vel.y += f * sin(t);
    }

    vel.xy *= uStrength;

    vel.xy *= DRAG;
    pos.xy += vel.xy + (vec2(0.0) - pos.xy) * ease;

    gl_FragColor.xy = pos;
    gl_FragColor.zw = vel;
}
#endif
`;
const BG_FRAG = `#define GLSLIFY 1
uniform float uAspectRatio;
uniform float uTime;

uniform vec3 uGradientStop0;
uniform vec3 uGradientStop1;
uniform vec3 uGradientStop2;
uniform float uGradientOffset;
uniform float uGradientRotation;

uniform vec3 uNoiseColor;
uniform float uNoiseBlend;

uniform vec3 uCircleColor;
uniform vec2 uCirclePosition;
uniform float uCircleRadius;
uniform float uCircleBlend;

varying vec2 vUv;

const float EDGE = 1.2;

vec2 rotateUV(in vec2 uv, in float r, in vec2 origin) {
	float c = cos(r);
	float s = sin(r);
	mat2 m = mat2(c, -s, s, c);
	vec2 st = uv - origin;
	st = m * st;
	return st + origin;
}

vec2 rotateUV(in vec2 uv, in float r) {
	return rotateUV(uv, r, vec2(0.5));
}

float colorRamp(in float color0, in float color1, in float step0, in float step1, in float t) {
    return mix(
        color0,
        color1,
        clamp((t - step0) / (step1 - step0), 0.0, 1.0)
    );
}

vec3 colorRamp(in vec3 color0, in vec3 color1, in float step0, in float step1, in float t) {
    return mix(
        color0,
        color1,
        clamp((t - step0) / (step1 - step0), 0.0, 1.0)
    );
}

/* Gradient noise from Jorge Jimenez's presentation: */
/* http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare */
float gradientNoise(in vec2 uv) {
	return fract(52.9829189 * fract(dot(uv, vec2(0.06711056, 0.00583715))));
}

float colorBandingFix(in vec2 uv) {
    return (1.0 / 255.0) * gradientNoise(uv) - (0.5 / 255.0);
}

//
// Description : Array and textureless GLSL 2D/3D/4D simplex
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : ijm
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
  }

struct GradientStep {
    vec3 color;
    float position;
};

void main(void) {
    vec2 uv = vUv;
    uv = vec2(uv.x * uAspectRatio, uv.y);

    // Gradient
    vec2 gradientUV = rotateUV(uv, uGradientRotation);
    GradientStep[3] steps = GradientStep[3](
        GradientStep(uGradientStop0, 0.0),
        GradientStep(uGradientStop1, uGradientOffset),
        GradientStep(uGradientStop2, 1.0)
    );
    
    vec3 gradient   = steps[0].color;
    #pragma unroll_loop_start 
    for (int i = 0; i < 2; i ++) {
        gradient = colorRamp(
            gradient,
            steps[UNROLLED_LOOP_INDEX + 1].color,
            steps[UNROLLED_LOOP_INDEX].position,
            steps[UNROLLED_LOOP_INDEX + 1].position,
            gradientUV.y
        );
     }
    #pragma unroll_loop_end

    // Circle
    vec2 center = vec2(0.5 + uAspectRatio * 0.125, 0.5);
    float circle = 1.0 - length(uv - center - vec2(uCirclePosition.x, -uCirclePosition.y));
    float circleRadius = 1.0 - uCircleRadius;
    circle = smoothstep(circleRadius, circleRadius+EDGE, circle);
    circle = 1.0-pow(1.0-circle, 5.0);

    // Noise
    float noise = snoise(vec3(uv, uTime * 0.1));
    noise = clamp(noise, 0.0, 1.0);

    // Apply gradient + noise + circle
    vec3 color = mix(gradient, uNoiseColor, uNoiseBlend * noise);
    color = mix(color, uCircleColor, uCircleBlend * circle);

    color.rgb += colorBandingFix(gl_FragCoord.xy);

    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
    #include <colorspace_fragment>
}
`;
const BG_VERT = `#define GLSLIFY 1
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;
const RAYS_VERT = `#define GLSLIFY 1
uniform float uRadius;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vUv = vec2(uv.x, uv.y);

  vec4 pos = vec4(position, 1.0);
  pos.xyz += normal * uRadius;
  
  vec4 worldPosition = modelMatrix * pos;
  vViewDir = normalize(cameraPosition - worldPosition.xyz);
  vNormal = normalize((mat3(modelMatrix) * normal).xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
const RAYS_FRAG = `#define GLSLIFY 1
uniform sampler2D uNoiseMap;
uniform float uTime;
uniform float uLayerWeightBlend;
uniform float uColorRampOffset;
uniform float uAlphaBlend;
uniform float uOpacity;
uniform vec3 uColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewDir;

const float PI = acos(-1.0);

float fresnel(in float offset, in float amount, in vec3 normal, in vec3 viewDir) {
    return offset + (1.0 - offset) * pow(1.0 - dot(normal, viewDir), amount);
}

float blender_fresnel_dielectric_cos(float cosi, float eta) {
    /* compute fresnel reflectance without explicitly computing
    * the refracted direction */
    float c = abs(cosi);
    float g = eta * eta - 1.0 + c * c;
    float result;

    if (g > 0.0) {
        g = sqrt(g);
        float A = (g - c) / (g + c);
        float B = (c * (g + c) - 1.0) / (c * (g - c) + 1.0);
        result = 0.5 * A * A * (1.0 + B * B);
    } else {
        result = 1.0; /* TIR (no refracted component) */
    }

    return result;
}

float blender_fresnel_dielectric(vec3 Incoming, vec3 Normal, float eta) {
    /* compute fresnel reflectance without explicitly computing
    * the refracted direction */
    return blender_fresnel_dielectric_cos(dot(Incoming, Normal), eta);
}

// Based on https://github.com/blender/blender/blob/main/source/blender/gpu/shaders/material/gpu_shader_material_layer_weight.glsl
void blender_layer_weight(float blend, vec3 view_dir, vec3 normal, out float fresnel, out float facing) {
    normal = normalize(normal);

    /* fresnel */
    float eta = max(1.0 - blend, 0.00001);
    const bool FrontFacing = true;
    fresnel = blender_fresnel_dielectric(view_dir, normal, (FrontFacing) ? 1.0 / eta : eta);

    /* facing */
    facing = abs(dot(view_dir, normal));
    if (blend != 0.5) {
        blend = clamp(blend, 0.0, 0.99999);
        blend = (blend < 0.5) ? 2.0 * blend : 0.5 / (1.0 - blend);
        facing = pow(facing, blend);
    }
    facing = 1.0 - facing;
}

float color_ramp(in float color0, in float color1, in float step0, in float step1, in float t) {
    return mix(
        color0,
        color1,
        clamp((t - step0) / (step1 - step0), 0.0, 1.0)
    );
}

vec3 color_ramp(in vec3 color0, in vec3 color1, in float step0, in float step1, in float t) {
    return mix(
        color0,
        color1,
        clamp((t - step0) / (step1 - step0), 0.0, 1.0)
    );
}

void main(void) {
    vec4 color = vec4(uColor, 1.0);

    // Noise Node
    vec2 noiseUv = vUv;
    noiseUv.x *= 0.1;
    noiseUv.y *= 0.01;
    noiseUv += uTime * 0.002;
    noiseUv = mod(noiseUv, vec2(1.0));
    float noise = texture(uNoiseMap, noiseUv).r;

    // ColorRamp Node
    float steps[3] = float[3](0.0, uColorRampOffset, 1.0);
    float alpha[3] = float[3](0.0,              1.0, 0.0);
    float gradient = alpha[0];
    #pragma unroll_loop_start 
    for (int i = 0; i < 2; i ++) {
        gradient = color_ramp(
            gradient,
            alpha[UNROLLED_LOOP_INDEX + 1],
            steps[UNROLLED_LOOP_INDEX],
            steps[UNROLLED_LOOP_INDEX + 1],
            vUv.y
        );
     }
    #pragma unroll_loop_end

    // LayerWeight Node
    float _fresnel;
    float facing;
    blender_layer_weight(uLayerWeightBlend, vViewDir, vNormal, _fresnel, facing);

    // // Noise node
    // float noise2 = texture(uNoiseMap, noiseUv + vUv * 5.0 + uTime * 70.).r;

    color.a *= noise;
    color.a = uAlphaBlend + color.a * (1.0 - uAlphaBlend);
    color.a *= gradient;
    color.a *= 1.0 - facing;
    // color.a *= noise2;
    color.a *= uOpacity;

    gl_FragColor = color;
    #include <colorspace_fragment>
}
`;

/* ESG hero globe. A port of the CCUS globe scene (three.js r169, same as the source).
   Shaders above are verbatim; the values below come from their level1_data.json.
   Changed on purpose: Berkeley colours, pointer is read relative to the hero canvas rather than the window,
   and the 50k surface samples are precomputed with their sampler (assets/globe-points.bin) instead of shipping their 4.2 MB icons.glb. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SMALL = matchMedia('(max-width: 1024px)').matches;   // source: 8k particles, globe scale 80, no cursor simulation
const ASSETS = new URL('assets/', import.meta.url).href;   // served next to this file (jsDelivr)
const PI = Math.PI, TAU = PI * 2;

// Their level1_data.json. The colours live in the palettes below, one per scene.
const DATA = {
  background: { gradientOffset: 1, gradientRotation: -2.45863772889636,
    noiseBlend: 1, circlePosition: { x: 0.078125, y: 0.0078125 }, circleBlend: 1, circleRadius: 0.7608695652173914 },
  globe: { pointSize: 2, focusDistance: 0.2,   // 0.28 in the data; their globe screen (Febin's reference) tweens it to 0.2
    focusRange: 0.45, dispersionProgress: 0,   // data says 0.0924, but at runtime their updateDispersion() drives it to 0 once the globe is settled
     dispersionAlpha: 0, dispersionAmplitude: 0.5,
    amplitude: { x: 0.01, y: 9.96 }, backgroundPointSize: 2, foregroundPointSize: 70, depthCameraNear: 10.5, depthCameraFar: 760, depthCutOff: 1, randomAmplitude: 0 },
  waves: { pointSize: 3, focusDistance: 0.359, focusRange: 0.5980000000000001, dispersionProgress: 0, dispersionAlpha: 1, dispersionAmplitude: 0,
    amplitude: { x: 10, y: 0.9999999999999998 }, backgroundPointSize: 1, foregroundPointSize: 20, depthCameraNear: 0.3, depthCameraFar: 600,
    depthCutOff: 0.9021739130434783, randomAmplitude: 100, bokehEnabled: 1, bokehEdge: 1, bokehOpacity: 1 },   // Level1Random
  godrays: { layerWeightBlend: 0.8913043478260869, colorRampOffset: 0.29347826086956524, opacity: 0.8913043478260869,
    alphaBlend: 0.6847826086956522, radius: 17.391304347826086, position: { x: -70.3125, y: 171.875 } },
  simulation: { ease: 0.934, size: 0.3 },
};
// GREEN (hero, CTA): theirs recoloured to Berkeley green #00683a and forest #04291a; bokeh colour 1 moved to a Berkeley green tint.
// BLUE (section 03, Febin 21 Sep): the /about-us hero navy #1b1b3a under #232346, aqua #5682c3 rays. Its dark and pale bokeh tints are derived, as the green set's are.
const GREEN = { stops: ['#00683a', '#04291a', '#04291a'], noise: '#00683a', circle: '#04291a', rays: '#4d9a74',
  bokeh: ['#40916b', '#388238', '#0f3611', '#a3c8b2', '#ffffff'] };
const BLUE = { stops: ['#232346', '#1b1b3a', '#1b1b3a'], noise: '#232346', circle: '#1b1b3a', rays: '#5682c3',
  bokeh: ['#5682c3', '#2f3192', '#12122b', '#aebfe0', '#ffffff'], swapGB: true };
const UAE = { lat: 24.5, lon: 54.5 };   // globe mesh is equirectangular with a -80° longitude offset (measured from its vertices)

// Assets are fetched once and shared by both scenes (three.js keeps GPU copies per renderer)
const loader = new THREE.TextureLoader(), loaded = {};
const bin = n => loaded[n] ??= fetch(ASSETS + n).then(r => { if (!r.ok) throw new Error(n); return r.arrayBuffer(); });
const tex = n => loaded[n] ??= loader.loadAsync(ASSETS + n);
// Navy scene: the dark-green matcap with its green and blue channels swapped, so no extra asset ships (ctx.filter hue-rotate is missing in Safari)
const texGB = n => loaded[n + ':gb'] ??= tex(n).then(t => {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  c.width = t.image.width; c.height = t.image.height;
  ctx.drawImage(t.image, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const g = p[i + 1]; p[i + 1] = p[i + 2]; p[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
  return new THREE.CanvasTexture(c);
});

// One scene per section: the hero with the globe; section 03 (navy) and the CTA (green) without it (background, god rays and wave particles only)
async function initScene(root, withGlobe, palette) {
  const canvas = root.querySelector('canvas');
  const marker = withGlobe ? root.querySelector('.esg-hero-marker') : null;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');
  const dpr = Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);

  const [globeBin, waveBin, matcapLight, matcapWhite, matcapGreenDark, noise] = await Promise.all([
    withGlobe ? bin('globe-points.bin') : null, bin('wave-points.bin'),
    tex('matcap-white-light.webp'), tex('matcap-white.webp'), (palette.swapGB ? texGB : tex)('matcap-green-dark.webp'), tex('noise-r.png'),
  ]);
  for (const t of [matcapLight, matcapWhite, matcapGreenDark]) t.colorSpace = THREE.SRGBColorSpace;
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 3000);
  camera.userData.target = new THREE.Vector3();
  scene.add(camera);

  // ---- Background (their gradient + noise + circle shader) ----
  const fullTri = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, -1, 3, -1, -1, -1, 3, -1]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    return g;
  };
  const bgU = {
    uAspectRatio: { value: 1 }, uTime: { value: 0 },
    uGradientStop0: { value: new THREE.Color(palette.stops[0]) },
    uGradientStop1: { value: new THREE.Color(palette.stops[1]) },
    uGradientStop2: { value: new THREE.Color(palette.stops[2]) },
    uGradientOffset: { value: DATA.background.gradientOffset }, uGradientRotation: { value: DATA.background.gradientRotation },
    uNoiseColor: { value: new THREE.Color(palette.noise) }, uNoiseBlend: { value: DATA.background.noiseBlend },
    uCircleRadius: { value: DATA.background.circleRadius }, uCircleColor: { value: new THREE.Color(palette.circle) },
    uCircleBlend: { value: DATA.background.circleBlend },
    uCirclePosition: { value: new THREE.Vector2(DATA.background.circlePosition.x, DATA.background.circlePosition.y) },
  };
  const bg = new THREE.Mesh(fullTri(), new THREE.ShaderMaterial({ vertexShader: BG_VERT, fragmentShader: BG_FRAG, uniforms: bgU, depthWrite: false, depthTest: false }));
  bg.frustumCulled = false; bg.renderOrder = -10;
  scene.add(bg);

  // ---- Particle system (their class Zt + material os) ----
  const bokehTex = list => {
    const cols = list.map(c => new THREE.Color(c));
    const d = new Uint8Array(20);
    cols.forEach((c, i) => { d.set([Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255), 255], i * 4); });
    const t = new THREE.DataTexture(d, 5, 1); t.needsUpdate = true; return t;
  };
  function makeParticles(positions, normals, side, matcap, data) {
    const toTex = arr => { const t = new THREE.DataTexture(arr, side, side, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; };
    const count = side * side, pos = new Float32Array(count * 3), rnd = new Float32Array(count * 3);
    for (let h = 0; h < count; h++) {
      const u = h * 3;
      pos[u] = (h % side) / side; pos[u + 1] = h / side / side;   // verbatim from the source (not floored)
      rnd[u] = Math.random(); rnd[u + 1] = Math.random(); rnd[u + 2] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('random', new THREE.BufferAttribute(rnd, 3));
    const U = {
      uPositions: { value: toTex(positions) }, uNormals: { value: toTex(normals) }, uMatCap: { value: matcap },
      uMatCapColor: { value: new THREE.Color('#70d55d') }, uMatCapCircle: { value: 0 },
      uPointSize: { value: new THREE.Vector2(data.pointSize, 1000) }, uPointScale: { value: 4 }, uGlobalOpacity: { value: 1 },
      uScale: { value: 0.0075 }, uTime: { value: 0 }, uFocusDistance: { value: data.focusDistance }, uFocusRange: { value: data.focusRange },
      uLightPosition: { value: new THREE.Vector3(2, 5, 3) }, uHoleGlow: { value: 0 }, uHoleRadius: { value: 0 }, uHoleThickness: { value: 0 },
      uHoleColor: { value: new THREE.Color(0x00ff00) }, uBokehIndex: { value: 0 }, uBokehColors: { value: bokehTex(data.bokehColors || ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff']) },
      uBokehEdge: { value: data.bokehEdge ?? 0.5 }, uBokehOpacity: { value: data.bokehOpacity ?? 0.5 }, uBokehEnabled: { value: data.bokehEnabled ?? 0 }, uUseLighting: { value: 0 }, uNoiseTexture: { value: noise },
      uPixelRatio: { value: dpr }, uDispersionProgress: { value: data.dispersionProgress }, uDispersionAmplitude: { value: data.dispersionAmplitude },
      uDispersionAlpha: { value: data.dispersionAlpha }, uRandomAmplitude: { value: data.randomAmplitude },
      uAmplitude: { value: new THREE.Vector2(data.amplitude.x, data.amplitude.y) },
      uBackgroundPointSize: { value: data.backgroundPointSize }, uForegroundPointSize: { value: data.foregroundPointSize },
      uDepthCameraNear: { value: data.depthCameraNear }, uDepthCameraFar: { value: data.depthCameraFar }, uDepthCutOff: { value: data.depthCutOff },
      uUseSimulation: { value: 0 }, uSimulation: { value: null },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG, uniforms: U,
      transparent: true, alphaToCoverage: true, depthTest: false, precision: 'highp' });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, uniforms: U, side };
  }

  // Globe: precomputed samples, int16 xyz + int16 normal per point
  const NS = 1 / 32767;
  let globe = null, spin = null;
  if (withGlobe) {
    const raw = new Int16Array(globeBin);
    const side = SMALL ? Math.ceil(Math.sqrt(8000)) : Math.ceil(Math.sqrt(50000));
    const gPos = new Float32Array(side * side * 4), gNor = new Float32Array(side * side * 4);
    const PS = 0.76 / 32767;
    for (let i = 0; i < side * side; i++) {
      const r = i * 6, o = i * 4;
      gPos[o] = raw[r] * PS; gPos[o + 1] = raw[r + 1] * PS; gPos[o + 2] = raw[r + 2] * PS; gPos[o + 3] = 1;
      gNor[o] = raw[r + 3] * NS; gNor[o + 1] = raw[r + 4] * NS; gNor[o + 2] = raw[r + 5] * NS; gNor[o + 3] = 1;
    }
    globe = makeParticles(gPos, gNor, side, matcapLight, DATA.globe);
    globe.uniforms.uUseLighting.value = 1;
    globe.points.scale.setScalar(SMALL ? 80 : 100);
    globe.points.renderOrder = 2;
    spin = new THREE.Group();                // their M.object: the part that auto-rotates
    spin.add(globe.points);
    const tiltRoot = new THREE.Group();      // framing only: lean the north toward the camera so Europe, Africa and Asia read
    tiltRoot.rotation.x = 0.35;
    tiltRoot.add(spin);
    scene.add(tiltRoot);
  }

  // Floating particles: their two WAVE_RAND meshes from level1.glb (10k white + 5k dark green, 5k each on small screens),
  // sampled offline with their sampler (assets/wave-points.bin). Node rotations are theirs; the offset is theirs relative to the scene centre.
  const waveRaw = new Int16Array(waveBin), WS = 1100 / 32767;
  const waves = [];
  let cursor = 0;
  for (const [full, matcap, q] of [[100, matcapWhite, [0.7071068286895752, 0, 0, 0.7071068286895752]],
                                   [71, matcapGreenDark, [0.6813550591468811, -0.047010090202093124, 0.02920328453183174, 0.7298579216003418]]]) {
    const s = SMALL ? 71 : full, P = new Float32Array(s * s * 4), N = new Float32Array(s * s * 4);
    for (let i = 0; i < s * s; i++) {
      const r = (cursor + i) * 6, o = i * 4;
      P.set([waveRaw[r] * WS, waveRaw[r + 1] * WS, waveRaw[r + 2] * WS, 1], o);
      N.set([waveRaw[r + 3] * NS, waveRaw[r + 4] * NS, waveRaw[r + 5] * NS, 1], o);
    }
    cursor += full * full;
    const w = makeParticles(P, N, s, matcap, { ...DATA.waves, bokehColors: palette.bokeh });
    w.points.quaternion.fromArray(q);
    w.points.position.set(141.27, 3.39, 117.26);   // WAVE node (619.4, 239.8, -51.5) minus their Center node (478.1, 236.4, -168.7)
    w.points.renderOrder = 1;
    scene.add(w.points);
    waves.push(w);
  }

  // ---- God rays (their class hr + material cr) ----
  const raysU = {
    uTime: { value: 0 }, uNoiseMap: { value: noise }, uColor: { value: new THREE.Color(palette.rays) },
    uAlphaBlend: { value: DATA.godrays.alphaBlend }, uOpacity: { value: DATA.godrays.opacity },
    uLayerWeightBlend: { value: DATA.godrays.layerWeightBlend }, uColorRampOffset: { value: DATA.godrays.colorRampOffset },
    uRadius: { value: DATA.godrays.radius },
  };
  const raysMat = new THREE.ShaderMaterial({ vertexShader: RAYS_VERT, fragmentShader: RAYS_FRAG, uniforms: raysU, depthWrite: false, transparent: true });
  const rays = new THREE.Group(), raysNode = new THREE.Group();
  const cyl = new THREE.CylinderGeometry(1, 2, 20, 30, 10, true);
  cyl.scale(10, 10, 10); cyl.rotateY(PI);
  for (const x of [0, -150]) {
    const m = new THREE.Mesh(cyl, raysMat);
    m.scale.set(1, 3, 1); m.position.set(x, 100, 0); m.rotateY(TAU * 0.5); m.rotateZ(TAU * -0.15);
    m.renderOrder = 3; m.frustumCulled = false;
    raysNode.add(m);
  }
  raysNode.position.set(DATA.godrays.position.x, 0, DATA.godrays.position.y);
  rays.add(raysNode);
  scene.add(rays);

  // ---- Cursor simulation (their class yn + shader fn), desktop + mouse only ----
  let sim = null;
  if (globe && !SMALL && !REDUCED) {
    const rt = () => new THREE.WebGLRenderTarget(globe.side, globe.side, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.FloatType });
    const mk = defines => new THREE.ShaderMaterial({ vertexShader: SIM_VERT, fragmentShader: SIM_FRAG, defines, uniforms: {
      uData: { value: null }, uInitialPosition: { value: globe.uniforms.uPositions.value },
      uModelMatrix: { value: new THREE.Matrix4() }, uViewMatrix: { value: new THREE.Matrix4() }, uInvViewMatrix: { value: new THREE.Matrix4() },
      uModelViewMatrix: { value: new THREE.Matrix4() }, uProjectionMatrix: { value: new THREE.Matrix4() }, uInvProjectionMatrix: { value: new THREE.Matrix4() },
      uMouse: { value: new THREE.Vector3() }, uStrength: { value: 0 }, uScreenRatio: { value: 1 }, uSize: { value: DATA.simulation.size },
      uEase: { value: DATA.simulation.ease } } });
    const quad = new THREE.Mesh(fullTri(), mk({}));
    quad.frustumCulled = false;
    sim = { read: rt(), write: rt(), quad, scene: new THREE.Scene().add(quad), cam: new THREE.Camera(),
      position: quad.material, reset: mk({ RESET: true }), mouse: new THREE.Vector2(), strength: 0, active: true };
    for (const target of [sim.read, sim.write]) { quad.material = sim.reset; renderer.setRenderTarget(target); renderer.render(sim.scene, sim.cam); }
    quad.material = sim.position;
    renderer.setRenderTarget(null);
    globe.uniforms.uUseSimulation.value = 1;
    globe.uniforms.uSimulation.value = sim.read.texture;
  }
  function stepSim() {
    if (!sim || !sim.active) return;
    sim.strength *= 0.95;
    const U = sim.position.uniforms, p = globe.points;
    U.uData.value = sim.read.texture;
    U.uModelMatrix.value.copy(p.matrixWorld); U.uModelViewMatrix.value.copy(p.modelViewMatrix);
    U.uViewMatrix.value.copy(camera.matrixWorldInverse); U.uInvViewMatrix.value.copy(camera.matrixWorld);
    U.uProjectionMatrix.value.copy(camera.projectionMatrix); U.uInvProjectionMatrix.value.copy(camera.projectionMatrixInverse);
    U.uMouse.value.set(sim.mouse.x, sim.mouse.y, 0); U.uStrength.value = sim.strength; U.uScreenRatio.value = size.w / size.h;
    renderer.setRenderTarget(sim.write); renderer.render(sim.scene, sim.cam); renderer.setRenderTarget(null);
    [sim.read, sim.write] = [sim.write, sim.read];
    globe.uniforms.uSimulation.value = sim.read.texture;
  }

  // ---- Camera: their globe framing (distance 288 × zoom 0.8, polar 0.45π) + cursor tilt (their component, range 0.0125π, damping 1) ----
  const DIST = 288 * 0.8, POLAR = PI * 0.45;
  const base = new THREE.Spherical(DIST, POLAR, 0);
  const tilt = { target: new THREE.Vector2(), value: new THREE.Vector2() };
  const spherical = new THREE.Spherical();
  function placeCamera(dt) {
    tilt.value.x = THREE.MathUtils.damp(tilt.value.x, tilt.target.x, 1, dt);
    tilt.value.y = THREE.MathUtils.damp(tilt.value.y, tilt.target.y, 1, dt);
    spherical.copy(base); spherical.theta += tilt.value.x; spherical.phi += tilt.value.y; spherical.makeSafe();
    camera.position.setFromSpherical(spherical);
    camera.lookAt(camera.userData.target);
    // their environment component: god rays ride with the camera, turned to face the view direction
    const dir = new THREE.Vector3().subVectors(camera.userData.target, camera.position).normalize();
    rays.position.copy(camera.position);
    rays.rotation.y = -Math.atan2(dir.z, dir.x) - TAU * 0.75;
  }

  // ---- UAE hotspot (their css3d-hotspot visibility rule: shown while facing the camera) ----
  const lat = UAE.lat * PI / 180, lon = (UAE.lon - 80) * PI / 180;   // marker is null without the globe
  const uaeLocal = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(0.75);
  const uaeWorld = new THREE.Vector3(), toCenter = new THREE.Vector3(), camDir = new THREE.Vector3(), center = new THREE.Vector3();
  function placeMarker() {
    if (!marker) return;
    uaeWorld.copy(uaeLocal).applyMatrix4(globe.points.matrixWorld);
    globe.points.getWorldPosition(center);
    toCenter.subVectors(center, uaeWorld).normalize();
    camera.getWorldDirection(camDir);
    const visible = camDir.dot(toCenter) > 0.5;
    const ndc = uaeWorld.clone().project(camera);
    marker.style.transform = `translate(${(ndc.x * 0.5 + 0.5) * size.w}px, ${(-ndc.y * 0.5 + 0.5) * size.h}px)`;
    marker.classList.toggle('is-visible', visible);
  }

  // ---- Layout: globe right of centre on desktop, above the copy on small screens ----
  const size = { w: 1, h: 1 };
  function resize() {
    size.w = root.clientWidth; size.h = root.clientHeight;
    renderer.setSize(size.w, size.h, false);
    const aspect = size.w / size.h;
    camera.aspect = aspect;
    // Framing only changes the lens (fov + view offset), never the camera distance, so their depth-of-field values still hold.
    // desktop: centred · tablet: top-right corner · phone: above the copy (hero is taller there)
    const phone = size.w < 768, tablet = !phone && size.w < 992;
    const fitFov = k => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(25 * PI / 180) * k));
    // without the globe there is nothing to place, so no view offset and the desktop lens except on phones
    camera.fov = phone ? fitFov(1 / Math.min(1, aspect * 1.25)) : tablet && globe ? fitFov(1.5) : 54;
    const shiftX = globe && tablet ? size.w * 0.26 : 0;
    const shiftY = !globe ? 0 : phone ? size.h * 0.2 : tablet ? size.h * 0.3 : 0;
    camera.setViewOffset(size.w, size.h, -shiftX, shiftY, size.w, size.h);
    camera.updateProjectionMatrix();
    bgU.uAspectRatio.value = aspect;
  }
  resize();
  new ResizeObserver(resize).observe(root);

  // ---- Pointer (source listens on the document) ----
  if (!REDUCED) {
    const root = document.documentElement;
    root.addEventListener('pointermove', e => {
      tilt.target.set((e.clientX / innerWidth * 2 - 1) * 0.0125 * PI, (e.clientY / innerHeight * 2 - 1) * 0.0125 * PI);
      if (!sim) return;
      if (e.pointerType !== 'mouse') { sim.active = false; return; }   // source: any touch/pen input switches the effect off
      const b = canvas.getBoundingClientRect();
      sim.mouse.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      sim.strength = 1;
    });
    root.addEventListener('pointerleave', () => tilt.target.set(0, 0));
  }

  // Start with the UAE a little right of centre so the spin carries it across the front
  if (spin) spin.rotation.y = -lon + 0.45;

  const clock = new THREE.Clock();
  let elapsed = 0, running = false, raf = 0, onScreen = true;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    if (spin) spin.rotation.y = (spin.rotation.y + dt * -0.1) % TAU;   // their updateFloating(): rotation.y += dt * -0.1
    for (const w of globe ? [globe, ...waves] : waves) w.uniforms.uTime.value = elapsed;
    bgU.uTime.value = elapsed; raysU.uTime.value = elapsed;
    placeCamera(dt);
    scene.updateMatrixWorld();
    stepSim();
    renderer.render(scene, camera);
    placeMarker();
  }
  function loop() { frame(); raf = running ? requestAnimationFrame(loop) : 0; }
  function setRunning() {
    const should = onScreen && !document.hidden && !REDUCED;
    if (should && !running) { running = true; clock.getDelta(); raf = requestAnimationFrame(loop); }
    if (!should) { running = false; cancelAnimationFrame(raf); }
  }
  frame();                              // first frame (and the only one under reduced motion)
  root.classList.add('is-gl');
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(); }).observe(root);
  document.addEventListener('visibilitychange', setRunning);
}

initScene(document.querySelector('.esg-hero'), true, GREEN).catch(err => console.warn('ESG hero globe disabled:', err));
// Section 03, the numbers panel and the CTA each get their own renderer, created one screen before they arrive so their shader compile stays out of page load
const lazyScene = (root, palette) => root && new IntersectionObserver(([e], io) => {
  if (!e.isIntersecting) return;
  io.disconnect();
  initScene(root, false, palette).catch(err => console.warn('ESG background disabled:', err));
}, { rootMargin: '100% 0px' }).observe(root);
lazyScene(document.querySelector('.esg-mx-sticky'), BLUE);
lazyScene(document.querySelector('.esg-num'), BLUE);
lazyScene(document.querySelector('.esg-cta'), GREEN);
