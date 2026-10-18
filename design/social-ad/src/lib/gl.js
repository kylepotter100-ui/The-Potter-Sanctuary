// Final composite on the GPU: scene A, scene B (during transitions) and the
// type/line overlay, plus the effects that need per-pixel work — smoke
// dissolve, oil-drop ripple, zoom blur, heat shimmer, vignette and grain.

const VS = `#version 300 es
in vec2 aP;
out vec2 vUv;
void main() { vUv = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 frag;
uniform sampler2D uA, uB, uO;
uniform vec2 uRes;
uniform float uTime, uFrame;
uniform int uMode;          // 0 A only · 1 smoke dissolve A→B · 2 ripple A→B
uniform float uProg;
uniform vec2 uC;            // ripple centre (px, top-left origin)
uniform float uRT;          // seconds since the drop landed
uniform float uZoom;        // radial zoom blur on A, 0..1
uniform vec2 uZC;
uniform vec4 uHeat;         // shimmer rect x0 y0 x1 y1 (px)
uniform float uHeatAmt;
uniform float uSeedX;       // smoke dissolve starts in this column
uniform float uGrain, uVig, uFade;
uniform vec2 uDir;          // directional motion blur on A (px), for pushes

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = m * p; a *= 0.5; }
  return v;
}
vec2 toPx(vec2 uv) { return vec2(uv.x, 1.0 - uv.y) * uRes; }
vec2 toUv(vec2 px) { return vec2(px.x / uRes.x, 1.0 - px.y / uRes.y); }

vec3 sampleA(vec2 px) {
  if (length(uDir) > 0.5) {
    vec3 acc = vec3(0.0);
    float j = hash(px + uFrame * 1.3);
    for (int i = 0; i < 16; i++) acc += texture(uA, toUv(px + uDir * ((float(i) + j) / 16.0 - 0.5))).rgb;
    return acc / 16.0;
  }
  if (uZoom < 0.002) return texture(uA, toUv(px)).rgb;
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  float j = hash(px + uFrame * 1.7);
  for (int i = 0; i < 20; i++) {
    float k = (float(i) + j) / 20.0;
    vec2 q = uZC + (px - uZC) * (1.0 - uZoom * 0.28 * k);
    float w = 1.0 - 0.6 * k;
    acc += texture(uA, toUv(q)).rgb * w;
    ws += w;
  }
  return acc / ws;
}

void main() {
  vec2 px = toPx(vUv);
  vec2 dA = vec2(0.0), dB = vec2(0.0);

  if (uHeatAmt > 0.0) {
    float mx = smoothstep(uHeat.x, uHeat.x + 90.0, px.x) * (1.0 - smoothstep(uHeat.z - 90.0, uHeat.z, px.x));
    float my = smoothstep(uHeat.y, uHeat.y + 160.0, px.y) * (1.0 - smoothstep(uHeat.w - 70.0, uHeat.w, px.y));
    vec2 q = px * vec2(0.016, 0.009) + vec2(0.0, uTime * 1.7);
    dA += mx * my * uHeatAmt * vec2(vnoise(q) - 0.5, vnoise(q + 17.3) - 0.5) * vec2(3.2, 4.6);
  }

  float m = 0.0;
  vec3 glowC = vec3(0.0);
  if (uMode == 1) {
    vec2 q = px / uRes.x * 3.0;
    q.y += uTime * 0.38;
    vec2 warp = vec2(fbm(q * 1.3 + uTime * 0.17), fbm(q * 1.3 + 7.1 - uTime * 0.13));
    float n = fbm(q + warp * 1.7);
    float col = abs(px.x - uSeedX) / uRes.x;
    float up = 1.0 - px.y / uRes.y;
    float field = n * 0.58 + (1.0 - col * 1.7) * 0.30 + up * 0.12;
    float th = 1.12 - uProg * 1.55;
    m = smoothstep(th - 0.05, th + 0.05, field);
    float e = smoothstep(th - 0.12, th, field) * (1.0 - smoothstep(th, th + 0.09, field));
    glowC = vec3(1.0, 0.93, 0.80) * e * 0.42;
    dA += (vec2(fbm(q * 2.1 + 3.0), fbm(q * 2.1 + 9.0)) - 0.5) * 46.0 * e;
  } else if (uMode == 2) {
    float r = length(px - uC);
    float R = uRT * 1560.0;
    float front = r - R;
    vec2 dir = (px - uC) / max(r, 1.0);
    float decay = exp(-uRT * 1.4);
    float wave = sin(front * 0.042) * exp(-abs(front) / 150.0) * 30.0 * decay;
    float trail = sin(r * 0.055 - uRT * 16.0) * exp(-max(-front, 0.0) / 380.0) * step(front, 0.0) * 7.0 * decay;
    dA += dir * wave;
    dB += dir * (wave + trail);
    m = 1.0 - smoothstep(-26.0, 26.0, front);
    glowC = vec3(1.0, 0.96, 0.88) * exp(-abs(front + 8.0) / 16.0) * 0.30 * decay;
  }

  vec3 col = sampleA(px + dA);
  if (uMode != 0) col = mix(col, texture(uB, toUv(px + dB)).rgb, m) + glowC;

  vec4 o = texture(uO, vUv);
  col = col * (1.0 - o.a) + o.rgb;

  vec2 v = (vUv - 0.5) * vec2(1.0, 1.3);
  col *= mix(1.0, 1.0 - uVig, smoothstep(0.32, 0.92, length(v) * 1.25));
  col = mix(col, vec3(0.0), uFade);

  float g = hash(px + fract(uFrame * 0.1373) * 977.0) + hash(px.yx * 1.37 + fract(uFrame * 0.2917) * 619.0) - 1.0;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += g * uGrain * (0.55 + 1.8 * lum * (1.0 - lum));
  frag = vec4(col, 1.0);
}`;

export class Compositor {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.p = p;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "aP");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = {};
    ["uA", "uB", "uO"].forEach((name, unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(p, name), unit);
      this.tex[name] = { t, unit };
    });
    this.loc = {};
  }

  upload(name, source) {
    const gl = this.gl, { t, unit } = this.tex[name];
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  u(name) {
    if (!(name in this.loc)) this.loc[name] = this.gl.getUniformLocation(this.p, name);
    return this.loc[name];
  }

  draw(U) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    for (const [k, v] of Object.entries(U)) {
      const l = this.u(k);
      if (l === null) continue;
      if (k === "uMode") gl.uniform1i(l, v);
      else if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : gl.uniform4fv).call(gl, l, v);
      else gl.uniform1f(l, v);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
