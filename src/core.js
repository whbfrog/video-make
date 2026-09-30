// core.js：常量、节拍工具、镜头、几何、水彩绘制封装、手写字、纸张质感、逐帧渲染入口。
// 所有画面都是时间 t 的纯函数：帧会并行、乱序渲染，不能在帧之间保存状态，也不能用 Math.random()。
const W = 1920, H = 1080;
const BPM = 88, BEAT = 60 / BPM, OFF = 0.261, BOIL = 12;
let DUR = 156.65;
const TAU = Math.PI * 2;
const PAL = {
  paper: '#F4ECDD', ink: '#2B2233', cream: '#FFF6E6',
  dad: '#4F7CC2', dadDk: '#2F5796', pants: '#3D4A7A',
  boy: '#E0574A', boyDk: '#A93A32', shorts: '#3F6FB0',
  girl: '#F2B53A', girlDk: '#C98A1C', bow: '#E86A98',
  skin: '#F6D2B4', skinDk: '#E0A988', hair: '#3A2B38', hairG: '#6B4030',
  rose: '#E27A92', ochre: '#E8AA38', sap: '#6E9F58', teal: '#3A9C98', violet: '#7B5CA8',
  sky: '#8EC3E6', night: '#1F2550', indigo: '#2F3C7A', clay: '#D97757', wood: '#B87A4B', woodDk: '#7C4A2C',
  wall: '#F3DDBB', mint: '#BFE3CF', peach: '#F7C6A5', lilac: '#D8C6EE'
};

// ---------- 数学 ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = x => Math.pow(clamp(x), 3);
const backOut = x => { x = clamp(x); const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const elasticOut = x => { x = clamp(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1; };
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const frac = x => x - Math.floor(x);
const seg = (t, a, b) => clamp((t - a) / (b - a));
const wob = (t, f = 1, ph = 0) => Math.sin((t * f + ph) * TAU);
// 手绘抖动：随机种子每秒换 BOIL 次，线条会像手绘动画一样“沸腾”
const jit = a => (random() * 2 - 1) * a;
function kf(t, keys, e = ease) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i], k = e((t - a) / (b - a));
      return Array.isArray(va) ? va.map((v, j) => lerp(v, vb[j], k)) : lerp(va, vb, k);
    }
  }
  return keys[keys.length - 1][1];
}
function mixCol(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = i => Math.round(lerp((pa >> i) & 255, (pb >> i) & 255, clamp(k)));
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}

// ---------- 节拍 ----------
const bpOf = t => (t - OFF) / BEAT;              // 第几拍（浮点）
const beatN = t => Math.floor(bpOf(t));
const B = n => OFF + n * BEAT;                    // 第 n 拍的时间
const pulse = (t, k = 6) => Math.exp(-frac(bpOf(t)) * k);        // 拍点为 1，之后衰减
const pulse3 = (t, k = 6) => Math.exp(-frac(bpOf(t) * 3) * k);   // 三连音细分
const hopB = (t, n = 1, lag = 0) => { const f = frac(bpOf(t) / n - lag); return 4 * f * (1 - f); };  // 拍点落地
const swingB = (t, n = 1, lag = 0) => Math.cos(Math.PI * (bpOf(t) / n - lag));                        // 拍点到极值
const shakeXY = (t, amt) => { const f = Math.floor(t * 24); return [(hash(f * 1.7) - .5) * 2 * amt, (hash(f * 2.3 + 9) - .5) * 2 * amt]; };

// ---------- 镜头 ----------
// camBegin(cx, cy, zoom, rot)：把世界坐标 (cx, cy) 放到画面中心。只允许一层，必须和 camEnd() 成对。
let CAM = null;
function camBegin(cx = W / 2, cy = H / 2, zoom = 1, rot = 0) { push(); translate(W / 2, H / 2); rotate(rot); scale(zoom); translate(-cx, -cy); CAM = { cx, cy, zoom, rot }; }
function camEnd() { pop(); CAM = null; }
function toScreen(x, y) {
  if (!CAM) return [x, y];
  const c = Math.cos(CAM.rot), s = Math.sin(CAM.rot), dx = (x - CAM.cx) * CAM.zoom, dy = (y - CAM.cy) * CAM.zoom;
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}
// 每拍镜头轻推：返回缩放系数
const punch = (t, amt = .03) => 1 + amt * pulse(t, 7);

// ---------- 几何 ----------
function rectPts(x, y, w, h, j = 0) {
  return [[x + jit(j), y + jit(j)], [x + w / 2 + jit(j), y + jit(j) * .5], [x + w + jit(j), y + jit(j)],
    [x + w + jit(j) * .5, y + h / 2], [x + w + jit(j), y + h + jit(j)], [x + w / 2 + jit(j), y + h + jit(j) * .5],
    [x + jit(j), y + h + jit(j)], [x + jit(j) * .5, y + h / 2]];
}
function ellPts(cx, cy, rx, ry, n = 24, j = 0, rot = 0) {
  const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; p.push([cx + Math.cos(a) * rx + jit(j), cy + Math.sin(a) * ry + jit(j)]); } return p;
}
function rrPts(x, y, w, h, r, j = 0) {
  r = Math.min(r, w / 2, h / 2);
  const p = [], n = 5, corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r + jit(j), cy + Math.sin(a) * r + jit(j)]); } };
  corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
  return p;
}
function starPts(cx, cy, r, inner = .42, n = 5, rot = -Math.PI / 2) {
  const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * inner : r; p.push([cx + Math.cos(a) * q, cy + Math.sin(a) * q]); } return p;
}
function heartPts(cx, cy, r, n = 26) {
  const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push([cx + r * 16 * Math.pow(Math.sin(a), 3) / 16, cy - r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]); } return p;
}
function burstPts(cx, cy, r, inner = .7, n = 14, j = 0) {   // 漫画爆炸框
  const p = []; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, q = (i % 2 ? r * inner : r) * (1 + .12 * hash(i * 3.1)); p.push([cx + Math.cos(a) * q + jit(j), cy + Math.sin(a) * q * .8 + jit(j)]); } return p;
}

// ---------- 绘制封装 ----------
// 一次调用画一个形状：可选平涂(wash)、水彩晕染(fill)、排线(hatch)，最后是一整条粗细变化的墨线。
// 软件渲染下 p5.brush 的水彩晕染（fill）一次要 2 秒多，这里用“几层外扩、抖动的半透明平涂”模拟晕染边缘，快两个数量级。
// 设 REAL_FILL = true 可换回真正的晕染（有显卡时）。
const REAL_FILL = /realfill/.test(location.search);
function softFill(pts, col, op = 170, bleed = .1) {
  let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= pts.length; cy /= pts.length;
  let r = 0; for (const q of pts) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cy));
  const spread = r * clamp(bleed, .02, .4) * .35;
  for (let k = 0; k < 3; k++) {
    const sc = 1 + (k - 1) * clamp(bleed, .02, .4) * .45;
    brush.noFill(); brush.noHatch(); brush.noStroke(); brush.wash(col, op * (k === 1 ? .5 : .28));
    brush.polygon(pts.map(q => [cx + (q[0] - cx) * sc + jit(spread), cy + (q[1] - cy) * sc + jit(spread)]));
  }
}
function paint(pts, o = {}) {
  if (o.fill && !REAL_FILL) {
    if (o.wash) paint(pts, { wash: o.wash, washOp: o.washOp, ink: null, curv: o.curv });
    softFill(pts, o.fill, o.fillOp ?? 170, o.bleed ?? .1);
    if (o.hatch || o.ink !== null) paint(pts, { hatch: o.hatch, ink: o.ink, sw: o.sw, br: o.br, curv: o.curv });
    return;
  }
  if (o.wash || o.fill || o.hatch) {
    if (o.wash) brush.wash(o.wash, o.washOp ?? 255); else brush.noWash();
    if (o.fill) { brush.fill(o.fill, o.fillOp ?? 170); brush.fillBleed(o.bleed ?? .1); brush.fillTexture(o.tex ?? .4, o.border ?? .35); } else brush.noFill();
    if (o.hatch) { brush.hatch(o.hatch.d, o.hatch.a, o.hatch.o || { rand: .15 }); brush.hatchStyle(o.hatch.b || 'HB', o.hatch.c || PAL.ink, o.hatch.w || 1); } else brush.noHatch();
    brush.noStroke();
    if (o.curv) { brush.beginShape(o.curv); for (const q of pts) brush.vertex(q[0], q[1]); brush.endShape(true); }
    else brush.polygon(pts);
  }
  if (o.ink !== null) {
    brush.noWash(); brush.noFill(); brush.noHatch(); brush.set(o.br || 'ink', o.ink || PAL.ink, o.sw ?? 1);
    brush.beginShape(o.curv || 0); for (const q of pts) brush.vertex(q[0], q[1]); brush.endShape(true);
  }
}
// 大面积纯色（墙、地板、放射背景、整屏闪白）：用 p5 原生多边形画，比笔刷平涂快得多。
// 先把 p5.brush 缓存的笔触合成进画面，保证图层顺序正确。
function flushBrush() {
  brush.noStroke(); brush.noHatch(); brush.noWash(); brush.fill('#000000', 1); brush.fillBleed(0); brush.fillTexture(0, 0);
  brush.polygon([[-50, -50], [-40, -50], [-40, -40]]); brush.noFill();
}
function flat(pts, col, op = 255) {
  flushBrush();
  push(); noStroke(); const c = color(col); c.setAlpha(op); fill(c);
  beginShape(); for (const q of pts) vertex(q[0], q[1]); endShape(CLOSE); pop();
}
function flatMany(list) {   // [[pts, col, op], ...] 一次刷新画多个
  flushBrush(); push(); noStroke();
  for (const [pts, col, op] of list) { const c = color(col); c.setAlpha(op ?? 255); fill(c); beginShape(); for (const q of pts) vertex(q[0], q[1]); endShape(CLOSE); }
  pop();
}
function inkLine(pts, sw = 1, col = PAL.ink, br = 'ink', curv = .5) {
  brush.noFill(); brush.noWash(); brush.noHatch(); brush.set(br, col, sw); brush.spline(pts, curv);
}
// 常用小形状
const blob = (x, y, rx, ry, col, o = {}) => paint(ellPts(x, y, rx, ry, o.n || 22, o.j || 0, o.rot || 0), { wash: col, washOp: o.op ?? 255, ink: o.ink === undefined ? PAL.ink : o.ink, sw: o.sw ?? 1, fill: o.fill, fillOp: o.fillOp, bleed: o.bleed, tex: o.tex, border: o.border });
const glow = (x, y, r, col, op = 90) => paint(ellPts(x, y, r, r * .9, 16), { fill: col, fillOp: op, bleed: .3, tex: .3, border: .1, ink: null });

// ---------- 手写字（在 2D 合成层上画，压在纸纹下面） ----------
const FONT_CN = '"ZCOOL KuaiLe", "Permanent Marker", sans-serif';
function letter(txt, x, y, size, color, o = {}) {
  if (CAM && !o.screen) { [x, y] = toScreen(x, y); size *= CAM.zoom; o = { ...o, rot: (o.rot || 0) + CAM.rot }; }
  LETTERS.push({ txt, x, y, size, color, ...o });
}
// 漫画拟声字：age=0 时弹出、抖动、在 life 秒内淡出
function sfx(txt, x, y, size, color, age, o = {}) {
  const life = o.life ?? 1.1; if (age < 0 || age > life) return;
  letter(txt, x, y, size, color, { pop: age * 5, rot: (o.rot ?? -.08) + Math.sin(age * 20) * .04 * (1 - age / life), alpha: 1 - seg(age, life - .25, life), stroke: o.stroke ?? PAL.cream, ...o });
}
function drawLetters(c) {
  for (const L of LETTERS) {
    const k = L.pop != null ? backOut(L.pop) : 1; if (k <= .01) continue;
    c.save(); c.translate(L.x, L.y); c.rotate(L.rot || 0); c.scale(k, k); c.globalAlpha = clamp(L.alpha ?? 1);
    c.font = `${L.size}px ${L.font || FONT_CN}`;
    c.textAlign = L.align || 'center'; c.textBaseline = 'middle';
    if (L.stroke) { c.lineJoin = 'round'; c.lineWidth = L.size * .16; c.strokeStyle = L.stroke; c.strokeText(L.txt, 0, 0); }
    if (L.ink !== false) { c.fillStyle = PAL.ink; c.fillText(L.txt, L.size * .045, L.size * .055); }
    c.fillStyle = L.color; c.fillText(L.txt, 0, 0);
    c.restore();
  }
}
// 把已排队的字画进画面里（之后画的东西——比如转场——会盖住它们）
function flushLetters() {
  if (!LETTERS.length) return;
  letG.clear(); drawLetters(letG.drawingContext); LETTERS = [];
  push(); resetMatrix(); translate(-W / 2, -H / 2);
  brush.noStroke(); brush.noHatch(); brush.noWash(); brush.fill('#000000', 1); brush.fillBleed(0); brush.fillTexture(0, 0);
  brush.polygon([[-50, -50], [-40, -50], [-40, -40]]); brush.noFill();   // 触发 p5.brush 把缓存的笔触合成到画面上
  image(letG, 0, 0); pop();
}

// ---------- 整屏效果（屏幕坐标） ----------
function flash(k, col = '#FFFDF6') { if (k > .01) flat(rectPts(-60, -60, W + 120, H + 120), col, 255 * clamp(k)); }
function irisShape(pts, col = PAL.ink, far = 4000) {   // 把形状以外的地方全涂掉（圆形、爱心、钥匙孔……）
  const n = pts.length; let cx = 0, cy = 0; for (const q of pts) { cx += q[0]; cy += q[1]; } cx /= n; cy /= n;
  const out = q => { const dx = q[0] - cx, dy = q[1] - cy, d = Math.hypot(dx, dy) || 1; return [cx + dx / d * far, cy + dy / d * far]; };
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], ex = (b[0] - a[0]) * .06, ey = (b[1] - a[1]) * .06;
    const a2 = [a[0] - ex, a[1] - ey], b2 = [b[0] + ex, b[1] + ey];
    list.push([[a2, b2, out(b2), out(a2)], col, 255]);
  }
  flatMany(list);
}
function iris(cx, cy, r, col = PAL.ink) { if (r < 4) flat(rectPts(-60, -60, W + 120, H + 120), col); else irisShape(ellPts(cx, cy, r, r, 40), col); }
// 放射背景
function sunburst(cx, cy, a, b, rot = 0, n = 16, r = 2400, op = 150) {
  const list = [[rectPts(-400, -400, W + 800, H + 800), b, 255]];
  for (let i = 0; i < n; i++) {
    const a0 = rot + i / n * TAU, a1 = a0 + TAU / n / 2;
    list.push([[[cx, cy], [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r]], a, op]);
  }
  flatMany(list);
}
// 速度线
function speedLines(cx, cy, r0, r1, n, col = PAL.cream, sw = 2, seed = 0) {
  for (let i = 0; i < n; i++) {
    const a = hash(i * 7.3 + seed) * TAU, rr = r0 + hash(i * 3.3 + seed) * 120;
    inkLine([[cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], sw, col, 'inkfine', 0);
  }
}

// ---------- 纸张与颗粒 ----------
function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function makePaper() {
  const g = createGraphics(W, H); g.pixelDensity(1); const c = g.drawingContext, rnd = lcg(11);
  c.fillStyle = PAL.paper; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * H, r = 120 + rnd() * 380, gr = c.createRadialGradient(x, y, 0, x, y, r), a = .045 * rnd(); gr.addColorStop(0, `rgba(160,125,80,${a})`); gr.addColorStop(1, 'rgba(160,125,80,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  c.lineWidth = 1;
  for (let i = 0; i < 1400; i++) { const x = rnd() * W, y = rnd() * H, l = 6 + rnd() * 26, a = rnd() * TAU; c.strokeStyle = `rgba(110,88,60,${.035 + rnd() * .06})`; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  return g;
}
function makeGrain() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), rnd = lcg(5);
  const id = c.createImageData(W, H), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = 255 - (rnd() < .55 ? rnd() * rnd() * 34 : 0); d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 3; d[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  const g = c.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,95,70,.35)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  return cv;
}
function defineBrushes() {
  brush.add('ink', { type: 'default', weight: 5, scatter: .25, sharpness: .8, grain: 40, opacity: 235, spacing: .2, pressure: [1.15, .75], rotate: 'natural', noise: .15 });
  brush.add('inkfine', { type: 'default', weight: 2.6, scatter: .15, sharpness: .85, grain: 40, opacity: 230, spacing: .2, pressure: [1.1, .8], rotate: 'natural', noise: .1 });
  brush.add('dry', { type: 'default', weight: 14, scatter: 3, sharpness: .3, grain: 6, opacity: 90, spacing: .6, pressure: [1, .6], rotate: 'natural', noise: .4 });
}

// ---------- 帧 ----------
let T = 0, paperG = null, grainC = null, letG = null, outC = null, outX = null;
let LETTERS = [], LYRIC = null;
async function setup() {
  createCanvas(W, H, WEBGL); pixelDensity(1); noLoop();
  brush.scaleBrushes(5); defineBrushes();
  paperG = makePaper(); grainC = makeGrain(); letG = createGraphics(W, H); letG.pixelDensity(1);
  outC = document.getElementById('out'); outX = outC.getContext('2d');
  await Promise.all([document.fonts.load(`100px ${FONT_CN}`, '奶爸日记'), document.fonts.load('100px "Permanent Marker"', 'A')]);
  window.ready = true;
  if (!location.search.includes('render')) devUI();
}
// 渲染前预加载所有用到的汉字（字体按 unicode 分块加载）
window.preloadGlyphs = async txt => { await document.fonts.load(`100px ${FONT_CN}`, txt); await document.fonts.ready; };
function draw() {
  if (!window.ready) return;
  LETTERS = []; LYRIC = null; CAM = null;
  push(); translate(-W / 2, -H / 2);
  randomSeed(1000 + Math.floor(T * BOIL)); noiseSeed(77);
  image(paperG, 0, 0);
  drawWorld(T);
  pop();
}
function composite() {
  const c = outX;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.drawImage(drawingContext.canvas, 0, 0, W, H);
  drawLetters(c);
  c.globalCompositeOperation = 'multiply'; c.drawImage(grainC, 0, 0);
  c.globalCompositeOperation = 'source-over';
  drawLyricText(c);
  const f = clamp(Math.min(T / .5, (DUR - T) / 1.2));   // 片头淡入、片尾淡出
  if (f < 1) { c.fillStyle = `rgba(20,16,26,${1 - f})`; c.fillRect(0, 0, W, H); }
}
window.renderAt = async (t, type = 'image/png', q = .92) => { T = t; await redraw(); composite(); return outC.toDataURL(type, q); };
window.renderSheet = async (times, cols = 3, w = 640) => {
  const h = Math.round(w * 9 / 16), rows = Math.ceil(times.length / cols), sc = document.createElement('canvas');
  sc.width = cols * w; sc.height = rows * h; const c = sc.getContext('2d'), ms = [];
  for (let i = 0; i < times.length; i++) {
    const t0 = performance.now(); T = times[i]; await redraw(); composite(); ms.push(Math.round(performance.now() - t0));
    const x = (i % cols) * w, y = Math.floor(i / cols) * h;
    c.drawImage(outC, x, y, w, h); c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x, y, 96, 26); c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.fillText(times[i].toFixed(2) + 's', x + 6, y + 18);
  }
  return { url: sc.toDataURL('image/jpeg', .88), ms };
};
window.gpuInfo = () => { const gl = drawingContext, e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); };
function devUI() {
  const s = document.getElementById('scrub'), lab = document.getElementById('tt');
  let busy = false, want = null;
  const go = async () => { if (busy) return; busy = true; while (want != null) { const t = want; want = null; const t0 = performance.now(); await window.renderAt(t); lab.textContent = `${t.toFixed(2)}s · ${Math.round(performance.now() - t0)} ms/帧`; } busy = false; };
  s.addEventListener('input', () => { want = +s.value; go(); });
  want = +(new URLSearchParams(location.search).get('t') || 0); s.value = want; go();
}
