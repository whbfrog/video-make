// timeline.js：章节注册、笔刷擦除转场、副歌角落的“耐心值”温度计、歌词条。
// 每章调用 chapter(name, start, end, shots)，shots = [[t0, fn], ...]。镜头函数 fn(t, lt, dur)：
//   t = 歌曲时间，lt = 镜头内时间，dur = 镜头长度。它要画满整帧（含背景），并且只依赖 t。
const CH = [];
function chapter(name, start, end, shots) { CH.push({ name, start, end, shots }); CH.sort((a, b) => a.start - b.start); }

// 章节分界处的笔刷擦除（覆盖到分界点，之后再拖走）
const WIPES = [B(33), B(107), B(160), B(206)];
const WIPE_TR = .3;

// 耐心值：副歌 1~3 每拍掉一截；副歌 4 变成“幸福值”一路涨满
const METER = [[B(33), B(56), 100, 72, 'p'], [B(86), B(107), 72, 41, 'p'], [B(140), B(160), 41, 0, 'p'], [B(185), B(201), 0, 100, 'h']];
let METER_SHOWN = false;
function meterAt(t) {
  let v = 100, kind = 'p';
  for (const [a, b, v0, v1, k] of METER) {
    if (t < a) break;
    kind = k;
    const n = Math.max(1, Math.round((b - a) / BEAT)), p = clamp((t - a) / (b - a)) * n;
    v = t >= b ? v1 : lerp(v0, v1, (Math.floor(p) + easeOut(clamp(frac(p) * 4))) / n);
  }
  return { v, kind };
}
const meterColor = (v, kind) => kind === 'h' ? '#E0506E' : v > 60 ? PAL.sap : v > 30 ? PAL.ochre : '#D8394E';

function drawWorld(t) {
  const ch = CH.find(c => t >= c.start && t < c.end);
  if (!ch) placeholder(t);
  else {
    let i = 0; while (i + 1 < ch.shots.length && t >= ch.shots[i + 1][0]) i++;
    const t0 = ch.shots[i][0], end = i + 1 < ch.shots.length ? ch.shots[i + 1][0] : ch.end;
    ch.shots[i][1](t, t - t0, end - t0);
    CAM = null;
  }
  flushLetters();
  if (!METER_SHOWN) { cornerMeter(t); flushLetters(); }
  WIPES.forEach((b, j) => { if (Math.abs(t - b) < WIPE_TR) wipe((t - (b - WIPE_TR)) / (2 * WIPE_TR), j); });
  lyricBar(t);
}
function placeholder(t) {
  paint(ellPts(960, 460, 520, 260, 30, 20), { fill: PAL.sky, fillOp: 90, bleed: .3, ink: null });
  letter('（这一段还没画）', 960, 440, 60, PAL.ink, { ink: false });
  famDancer('dad', 960, 900, 16, 'idle', t);
}

function cornerMeter(t) {
  for (const [a, b] of METER) {
    if (t < a || t >= b + .3) continue;
    const { v, kind } = meterAt(t), k = backOut((t - a) / .4) * (1 - ease((t - b) / .3));
    if (k < .02) return;
    const col = meterColor(v, kind), x = 1770, y = 90;
    push(); translate(x, y); scale(k * .8);
    paint(rrPts(-36, 50, 72, 330, 36, 2), { wash: PAL.cream, washOp: 255, ink: PAL.ink, sw: 1.3 });
    const hh = 300 * v / 100;
    if (hh > 20) paint(rrPts(-22, 62 + 300 - hh, 44, hh, 22, 1.5), { wash: col, washOp: 235, ink: null });
    for (let q = 1; q < 5; q++) inkLine([[-36, 62 + 300 * q / 5], [-16, 62 + 300 * q / 5]], .7, PAL.ink, 'inkfine', 0);
    paint(ellPts(0, 410, 56, 56, 20, 2), { wash: col, washOp: 240, ink: PAL.ink, sw: 1.3 });
    if (kind === 'h') paint(heartPts(0, 410, 28), { wash: PAL.cream, ink: null });
    pop();
    letter(kind === 'h' ? '幸福值' : '耐心值', x, y + 12, 40 * k, PAL.cream, { stroke: PAL.ink });
    letter(Math.round(v) + '%', x, y + 410 * k * .8, 38 * k, PAL.cream, { stroke: PAL.ink });
  }
}

// 笔刷擦除：几条粗笔刷横扫盖住旧画面，分界点处完全盖住，然后再拖走露出新画面
const WIPE_COLS = [[PAL.clay, PAL.ochre], [PAL.indigo, PAL.violet], [PAL.night, PAL.indigo], [PAL.rose, PAL.ochre]];
function wipe(p, idx) {
  const [c1, c2] = WIPE_COLS[idx % WIPE_COLS.length], n = 5, bh = (H + 420) / n + 40;
  push(); translate(W / 2, H / 2); rotate(-.1); translate(-W / 2, -H / 2);
  for (let i = 0; i < n; i++) {
    const y0 = -230 + i * (H + 420) / n, d = [0, .14, .06, .18, .1][i];
    const q = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - d))) : ease(clamp(((p - .5) * 2 - d) / (1 - d)));
    const x0 = p < .5 ? -300 : lerp(-300, W + 400, q), x1 = p < .5 ? lerp(-300, W + 400, q) : W + 400;
    if (x1 - x0 < 30) continue;
    const pts = [], rag = (k, side) => side * (40 + 50 * hash(i * 31 + k)) + jit(12);
    for (let k = 0; k <= 8; k++) pts.push([lerp(x0, x1, k / 8), y0 + Math.sin(k * .9 + i) * 14 + jit(5)]);
    for (let k = 1; k < 9; k++) pts.push([x1 + rag(k, 1) - 40, y0 + bh * k / 9]);
    for (let k = 8; k >= 0; k--) pts.push([lerp(x0, x1, k / 8), y0 + bh + Math.sin(k * .8 + i * 2) * 14 + jit(5)]);
    if (p >= .5) for (let k = 8; k > 0; k--) pts.push([x0 - rag(k + 20, 1) + 40, y0 + bh * k / 9]);
    paint(pts, { wash: i % 2 ? c1 : c2, washOp: 255, fill: i % 2 ? c2 : c1, fillOp: 70, bleed: .05, tex: .8, border: .6, ink: null });
  }
  pop();
}

// ---------- 歌词条（歌词由渲染器从 --lyrics 指定的 LRC 文件读入 window.LY；没有就不显示） ----------
function lyricBar(t) {
  const LY = window.LY || [];
  const L = LY.find(l => t >= l[0] && t < l[1]); if (!L) return;
  const [a, b, txt] = L;
  outX.font = `50px ${FONT_CN}`;
  const tw = outX.measureText(txt).width, grow = easeOut((t - a) / .18) * (1 - ease((t - (b - .12)) / .12));
  if (grow < .02) return;
  const w = (tw + 110) * grow, x0 = 960 - w / 2, y0 = 978;
  const pts = [[x0 + jit(8), y0 + jit(4)], [x0 + w / 2, y0 - 4 + jit(4)], [x0 + w + jit(8), y0 + jit(4)], [x0 + w + 14 + jit(8), y0 + 44], [x0 + w + jit(8), y0 + 88 + jit(4)], [x0 + w / 2, y0 + 92 + jit(4)], [x0 + jit(8), y0 + 88 + jit(4)], [x0 - 14 + jit(8), y0 + 44]];
  paint(pts, { wash: PAL.ink, washOp: 225, fill: PAL.violet, fillOp: 60, tex: .7, border: .4, ink: null });
  LYRIC = { a, b, txt, grow };
}
function drawLyricText(c) {
  if (!LYRIC || LYRIC.grow < .85) return;
  const { a, b, txt } = LYRIC, t = T;
  c.font = `50px ${FONT_CN}`; c.textBaseline = 'middle'; c.textAlign = 'left';
  const chars = [...txt], ws = chars.map(ch => c.measureText(ch).width), total = ws.reduce((p, q) => p + q, 0);
  const singDur = Math.min(b - a - .1, .45 + chars.length * .12), sung = clamp((t - a) / singDur) * chars.length;
  let x = 960 - total / 2; const y = 1022;
  chars.forEach((ch, i) => {
    const f = clamp(sung - i), bump = f > 0 && f < 1 ? -8 * Math.sin(f * Math.PI) : 0;
    c.fillStyle = f >= .5 ? PAL.ochre : PAL.cream; c.fillText(ch, x, y + bump);
    x += ws[i];
  });
}
