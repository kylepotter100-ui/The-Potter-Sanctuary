// Rendered beauty imagery, generated in code (no photography):
//  · stones(): a raymarched product set — sage plaster wall with an arched
//    niche, a two-tier cream podium, glossy basalt stones; soft shadows,
//    ambient occlusion, wet-stone reflections, and eucalyptus leaf shadows
//    projected along the key light.
//  · swirl(): a top-down macro of whipped body butter in a ceramic jar — a
//    piped spiral height field, self-shadowed and satin-lit.
// Each renders into an offscreen target, gets an FXAA pass (the raymarch
// takes one sample per pixel, so silhouettes would stair-step), and lands in
// this module's own WebGL canvas, which the film then draws (masked, scaled)
// into its 2D layers.

const VS = `#version 300 es
in vec2 aP;
void main() { gl_Position = vec4(aP, 0.0, 1.0); }`;

const COMMON = `#version 300 es
precision highp float;
out vec4 frag;
uniform vec2 uRes;
uniform float uTime;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
`;

const STONES_FS = COMMON + `
uniform vec3 uCamPos, uCamTgt;
uniform float uFov;
uniform vec3 uS[5];      // stone centres
uniform vec3 uSR[5];     // stone radii
uniform float uYaw[5];
uniform sampler2D uLeaf;
uniform vec2 uLeafOff;

const vec3 SUN = normalize(vec3(-0.58, 0.74, 0.40));
const float WALL_Z = -1.25;

float sdRoundCyl(vec3 p, float r, float h, float rr) {
  vec2 d = vec2(length(p.xz) - r + rr, abs(p.y) - h + rr);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rr;
}
float sdEll(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdArch2(vec2 p, float w, float h) {
  return min(sdBox2(p - vec2(0.0, h * 0.5), vec2(w, h * 0.5)), length(p - vec2(0.0, h)) - w);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// material ids: 1 wall, 2 niche, 3 floor, 4 podium, 5 stone
vec2 map(vec3 p) {
  vec2 res = vec2(p.y, 3.0);
  float wall = p.z - WALL_Z;
  float niche = max(sdArch2(p.xy, 1.12, 1.85), abs(p.z - (WALL_Z - 0.2)) - 0.31);
  wall = max(wall, -niche);
  if (wall < res.x) res = vec2(wall, p.z < WALL_Z - 0.02 ? 2.0 : 1.0);
  float pod = min(sdRoundCyl(p - vec3(0.0, 0.11, -0.45), 1.02, 0.11, 0.025),
                  sdRoundCyl(p - vec3(0.0, 0.50, -0.45), 0.74, 0.29, 0.03));
  if (pod < res.x) res = vec2(pod, 4.0);
  float bound = length(p - vec3(0.0, 0.9, -0.3)) - 1.55;
  if (bound < res.x) {
    float st = 1e9;
    for (int i = 0; i < 5; i++) {
      vec3 q = p - uS[i];
      q.xz = rot(uYaw[i]) * q.xz;
      st = min(st, sdEll(q, uSR[i]));
    }
    if (st < res.x) res = vec2(st, 5.0);
  }
  return res;
}

vec3 calcNormal(vec3 p) {
  const vec2 e = vec2(1.0, -1.0) * 0.0009;
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd) {
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 28; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.02, 0.3);
    if (res < 0.003 || t > 5.0) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
float ao(vec3 p, vec3 n) {
  float o = 0.0, s = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.015 + 0.12 * float(i) / 4.0;
    o += (h - map(p + n * h).x) * s;
    s *= 0.7;
  }
  return clamp(1.0 - 2.4 * o, 0.0, 1.0);
}
float gobo(vec3 p) {
  vec3 r = normalize(cross(SUN, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, SUN);
  vec2 uv = vec2(dot(p, r), dot(p, u)) * 0.42 + uLeafOff;
  return texture(uLeaf, uv).r;
}

void main() {
  vec2 frc = gl_FragCoord.xy + (vec2(hash(gl_FragCoord.xy + uTime), hash(gl_FragCoord.yx - uTime)) - 0.5) * 0.6;
  vec2 uv = (2.0 * frc - uRes) / uRes.y;
  vec3 ww = normalize(uCamTgt - uCamPos);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  float fl = 1.0 / tan(uFov * 0.5);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + fl * ww);
  vec3 ro = uCamPos;

  float t = 0.0;
  vec2 h = vec2(0.0);
  for (int i = 0; i < 96; i++) {
    h = map(ro + rd * t);
    if (abs(h.x) < 0.0007 * t || t > 14.0) break;
    t += h.x * 0.95;
  }
  vec3 sage = vec3(0.245, 0.33, 0.225);
  vec3 col;
  if (t > 14.0) {
    col = sage * 0.8;
  } else {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float m = h.y;
    vec3 alb;
    float rough = 1.0;
    if (m < 1.5) alb = vec3(0.255, 0.335, 0.232) * (0.94 + 0.08 * fbm(p.xy * 3.0));          // sage plaster
    else if (m < 2.5) alb = vec3(0.215, 0.29, 0.198) * (0.94 + 0.08 * fbm(p.xy * 3.0));      // niche, deeper
    else if (m < 3.5) alb = vec3(0.40, 0.45, 0.35) * (0.95 + 0.05 * fbm(p.xz * 2.0));        // floor
    else if (m < 4.5) { alb = vec3(0.88, 0.80, 0.64); rough = 0.7; }                          // cream podium
    else { alb = vec3(0.010, 0.011, 0.010) * (0.8 + 0.4 * vnoise(p.xz * 30.0)); rough = 0.12;
           n = normalize(n + 0.05 * vec3(vnoise(p.xz * 22.0) - 0.5, 0.0, vnoise(p.zx * 22.0) - 0.5)); } // basalt

    float dif = clamp(dot(n, SUN), 0.0, 1.0);
    float sh = dif > 0.0 ? softShadow(p + n * 0.003, SUN) : 0.0;
    float leaf = mix(0.16, 1.0, smoothstep(0.15, 0.85, gobo(p)));
    float occ = ao(p, n);
    vec3 sun = vec3(1.0, 0.94, 0.84) * 3.1;
    vec3 sky = mix(vec3(0.42, 0.47, 0.40), vec3(0.78, 0.82, 0.74), 0.5 + 0.5 * n.y);
    vec3 bounce = vec3(0.30, 0.33, 0.26) * clamp(-n.y * 0.5 + 0.5, 0.0, 1.0);
    col = alb * (sun * dif * sh * leaf + sky * occ * 0.75 + bounce * occ * 0.4);

    if (m > 4.5) {
      // wet basalt: tight sun glint, clearcoat reflection of the room
      vec3 hv = normalize(SUN - rd);
      float spec = pow(clamp(dot(n, hv), 0.0, 1.0), 180.0) * sh * leaf;
      vec3 r = reflect(rd, n);
      float fre = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 5.0);
      vec3 env = mix(vec3(0.07, 0.09, 0.065), vec3(0.85, 0.80, 0.70), smoothstep(0.05, 0.9, r.y));
      env *= mix(0.3, 1.0, occ * clamp(r.y * 2.0 + 0.6, 0.0, 1.0));
      col += sun * spec * 2.2 + env * fre * 0.55 * occ;
    } else if (m > 3.5) {
      vec3 hv = normalize(SUN - rd);
      col += vec3(1.0, 0.96, 0.9) * pow(clamp(dot(n, hv), 0.0, 1.0), 24.0) * 0.12 * sh;
    }
    // atmospheric depth toward the sage room tone
    float far = max(t - 6.0, 0.0);
    col = mix(col, sage * 0.9, 1.0 - exp(-0.02 * far * far));
  }
  col = aces(col * 1.05);
  col = pow(col, vec3(1.0 / 2.2));
  frag = vec4(col, 1.0);
}`;

const SWIRL_FS = COMMON + `
uniform vec2 uC;
uniform float uR;
uniform float uRot;

float hgt(vec2 p) {
  float r = length(p);
  float a = atan(p.y, p.x) + uRot;
  float dome = sqrt(max(0.0, 1.0 - r * r));
  float s = a * 2.0 + log(max(r, 0.015)) * 4.6;
  float ridge = 0.5 + 0.5 * cos(s);
  ridge = ridge * ridge * (3.0 - 2.0 * ridge);
  float lumps = fbm(p * 5.0 + vec2(uRot * 0.3, 0.0)) * 0.7 + fbm(p * 13.0 - uRot * 0.2) * 0.3;
  float tip = exp(-r * r * 26.0) * 0.32;
  float h = dome * (0.40 + 0.38 * ridge * smoothstep(0.03, 0.35, r)) + tip + (lumps - 0.5) * 0.085;
  return h * smoothstep(1.0, 0.86, r);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (px - uC) / uR;
  float r = length(p);
  if (r > 1.17) { frag = vec4(0.0); return; }
  vec3 L = normalize(vec3(-0.48, -0.58, 0.66));
  vec3 col;
  float alpha = 1.0;
  if (r <= 1.0) {
    float e = 0.004;
    float h0 = hgt(p);
    float hx = hgt(p + vec2(e, 0.0)) - hgt(p - vec2(e, 0.0));
    float hy = hgt(p + vec2(0.0, e)) - hgt(p - vec2(0.0, e));
    vec3 n = normalize(vec3(-hx / (2.0 * e) * 0.42, -hy / (2.0 * e) * 0.42, 1.0));
    // self-shadow: march towards the light across the height field
    float sh = 1.0;
    vec2 dir = normalize(L.xy);
    for (int i = 1; i <= 10; i++) {
      float d = float(i) * 0.022;
      float hh = hgt(p + dir * d);
      sh = min(sh, clamp(1.0 - (hh - (h0 + d * L.z / length(L.xy) * 0.9)) * 14.0, 0.0, 1.0));
    }
    // cavities darken
    float avg = 0.25 * (hgt(p + vec2(0.05, 0.0)) + hgt(p - vec2(0.05, 0.0)) + hgt(p + vec2(0.0, 0.05)) + hgt(p - vec2(0.0, 0.05)));
    float cav = clamp(1.0 - (avg - h0) * 7.0, 0.55, 1.0);
    float dif = clamp((dot(n, L) + 0.25) / 1.25, 0.0, 1.0);
    vec3 base = vec3(1.0, 0.95, 0.85);
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(n, hv), 0.0, 1.0), 28.0) * 0.38;
    col = base * (0.42 + 0.72 * dif * mix(0.6, 1.0, sh)) * cav + spec * sh;
    col += vec3(0.12, 0.07, 0.02) * (1.0 - dif) * 0.45;      // warm, buttery shadow
    col *= mix(0.62, 1.0, smoothstep(0.84, 0.97 - 0.0, 1.0 - r + 0.84)); // rim shadow
  } else {
    // the jar's ceramic rim, seen from above
    float x = (r - 1.085) / 0.085;
    vec2 radial = p / r;
    vec3 n = normalize(vec3(radial * x * 0.95, sqrt(max(0.05, 1.0 - x * x))));
    float dif = clamp(dot(n, L), 0.0, 1.0);
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(clamp(dot(n, hv), 0.0, 1.0), 60.0) * 0.6;
    col = vec3(0.93, 0.91, 0.86) * (0.42 + 0.7 * dif) + spec;
    alpha = smoothstep(1.17, 1.155, r);
  }
  frag = vec4(col * alpha, alpha);
}`;

// FXAA (after Timothy Lottes' console version): blends along the local edge
// direction where luma contrast says there is one.
const FXAA_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
out vec4 frag;
float luma(vec4 c) { return dot(c.rgb, vec3(0.299, 0.587, 0.114)); }
vec4 at(vec2 uv) { return texture(uTex, uv); }
void main() {
  vec2 px = 1.0 / uRes, uv = gl_FragCoord.xy * px;
  vec4 cM = at(uv);
  float lNW = luma(at(uv + vec2(-1.0, -1.0) * px)), lNE = luma(at(uv + vec2(1.0, -1.0) * px));
  float lSW = luma(at(uv + vec2(-1.0, 1.0) * px)), lSE = luma(at(uv + vec2(1.0, 1.0) * px));
  float lM = luma(cM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float reduce = max((lNW + lNE + lSW + lSE) * (0.25 / 8.0), 1.0 / 128.0);
  dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + reduce), -8.0, 8.0) * px;
  vec4 a = 0.5 * (at(uv + dir * (1.0 / 3.0 - 0.5)) + at(uv + dir * (2.0 / 3.0 - 0.5)));
  vec4 b = 0.5 * a + 0.25 * (at(uv - dir * 0.5) + at(uv + dir * 0.5));
  float lB = luma(b);
  frag = (lB < lMin || lB > lMax) ? a : b;
}`;

export class Beauty3D {
  constructor(W, H, leaf) {
    this.canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const gl = this.canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.W = W;
    this.H = H;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.progs = { stones: this.program(STONES_FS), swirl: this.program(SWIRL_FS), fxaa: this.program(FXAA_FS) };
    // offscreen target for the raymarch, read back by the FXAA pass (unit 1)
    this.target = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.target, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, leaf);
  }

  program(fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return { p, loc: {} };
  }

  use(name, U) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    this.pass(name, U);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.pass("fxaa", { uTex: 1 });
    return this.canvas;
  }

  pass(name, U) {
    const gl = this.gl, pr = this.progs[name];
    gl.useProgram(pr.p);
    const loc = (k) => (k in pr.loc ? pr.loc[k] : (pr.loc[k] = gl.getUniformLocation(pr.p, k)));
    const a = gl.getAttribLocation(pr.p, "aP");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(loc("uRes"), this.W, this.H);
    for (const [k, v] of Object.entries(U)) {
      const l = loc(k);
      if (l === null) continue;
      if (k === "uLeaf" || k === "uTex") gl.uniform1i(l, v);
      else if (k === "uYaw") gl.uniform1fv(l, v);
      else if (k === "uS" || k === "uSR") gl.uniform3fv(l, v.flat());
      else if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : gl.uniform3fv).call(gl, l, v);
      else gl.uniform1f(l, v);
    }
    gl.viewport(0, 0, this.W, this.H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** The hot-stones product set. stones: [{c:[x,y,z], r:[rx,ry,rz], yaw}] */
  stones({ time, cam, target, fov = 0.62, stones, leafOff = [0, 0] }) {
    return this.use("stones", {
      uTime: time, uCamPos: cam, uCamTgt: target, uFov: fov, uLeaf: 0, uLeafOff: leafOff,
      uS: stones.map((s) => s.c), uSR: stones.map((s) => s.r), uYaw: stones.map((s) => s.yaw || 0),
    });
  }

  /** Whipped body butter in a jar, seen from above, centred at c (px). */
  swirl({ time, c, r, rot }) {
    return this.use("swirl", { uTime: time, uC: c, uR: r, uRot: rot });
  }
}
