// props.js：家里的布景和道具（水彩 + 墨线），各章共用。坐标都是世界坐标，1920×1080，y 向下。

// 房间：墙 + 墙纸花纹 + 地板 + 踢脚线。o.wall / o.floor / o.pattern('dots'|'stripes'|'hearts') / o.floorY
function room(t, o = {}) {
  const fy = o.floorY ?? 820, wall = o.wall || PAL.wall, fl = o.floor || PAL.wood;
  const pc = mixCol(wall, PAL.ink, .1), list = [[rectPts(-400, -400, W + 800, fy + 400), wall, 255]];
  // 墙上几块浅色水痕，给平涂一点水彩的不均匀
  for (let i = 0; i < 5; i++) list.push([ellPts(hash(i * 3.3) * W, hash(i * 5.1) * fy, 260 + hash(i) * 200, 180 + hash(i + 2) * 120, 14), mixCol(wall, '#FFFFFF', .5), 60]);
  if (o.pattern === 'stripes') for (let x = -400; x < W + 400; x += 120) list.push([rectPts(x, -400, 46, fy + 400), pc, 70]);
  if (o.pattern === 'dots') for (let y = 60; y < fy - 40; y += 110) for (let x = (y / 110 % 2) * 70 - 300; x < W + 300; x += 140) list.push([ellPts(x, y, 9, 9, 10), pc, 130]);
  if (o.pattern === 'hearts') for (let y = 80; y < fy - 60; y += 150) for (let x = (y / 150 % 2) * 90 - 300; x < W + 300; x += 180) list.push([heartPts(x, y, 16, 16), pc, 120]);
  list.push([rectPts(-400, fy, W + 800, H - fy + 400), fl, 255], [rectPts(-400, fy, W + 800, 50), mixCol(fl, '#000000', .25), 150]);
  flatMany(list);
  for (let y = fy + 70; y < H + 300; y += 70) inkLine([[-300, y + jit(3)], [W + 300, y + jit(3)]], .6, mixCol(fl, '#000000', .35), 'inkfine', 0);
  paint(rectPts(-300, fy - 16, W + 600, 22), { wash: PAL.cream, ink: PAL.ink, sw: .7 });
}
function windowProp(x, y, w, h, o = {}) {
  const night = o.night, sky = night ? PAL.night : (o.sky || PAL.sky);
  paint(rrPts(x - 16, y - 16, w + 32, h + 32, 10), { wash: PAL.cream, ink: PAL.ink, sw: 1.1 });
  paint(rectPts(x, y, w, h), { wash: sky, ink: null });
  if (night) { blob(x + w * .7, y + h * .32, h * .14, h * .14, '#FFF3C4', { ink: null }); blob(x + w * .7 + h * .06, y + h * .28, h * .12, h * .12, sky, { ink: null }); for (let i = 0; i < 6; i++) paint(starPts(x + hash(i) * w, y + hash(i + 9) * h * .8, 6 + 4 * pulse3(T + i * .1), .4, 4), { wash: '#FFF3C4', ink: null }); }
  else { glow(x + w * .72, y + h * .3, h * .22, '#FFE39A', 150); blob(x + w * .72, y + h * .3, h * .11, h * .11, '#FFD65A', { ink: null }); blob(x + w * .28, y + h * .6, w * .18, h * .08, PAL.cream, { ink: null }); }
  inkLine([[x + w / 2, y], [x + w / 2, y + h]], 3, PAL.cream, 'ink', 0); inkLine([[x, y + h / 2], [x + w, y + h / 2]], 3, PAL.cream, 'ink', 0);
  paint(rectPts(x, y, w, h), { ink: PAL.ink, sw: .9 });
  if (o.curtain !== false) for (const s of [-1, 1]) {
    const cx = s < 0 ? x - 30 : x + w + 30, sw0 = 70;
    paint([[cx - sw0 / 2, y - 40], [cx + sw0 / 2, y - 40], [cx + sw0 / 2 + s * 20, y + h + 60], [cx - sw0 / 2 + s * 20, y + h + 60]], { wash: o.curtainCol || PAL.rose, washOp: 235, ink: PAL.ink, sw: .8, curv: .2 });
  }
}
function frameProp(x, y, w, h, col) {
  paint(rectPts(x, y, w, h, 1.5), { wash: PAL.cream, ink: PAL.ink, sw: 1 });
  paint(rectPts(x + 12, y + 12, w - 24, h - 24), { wash: col, washOp: 160, ink: null });
  blob(x + w / 2, y + h * .55, w * .22, h * .2, mixCol(col, PAL.ink, .3), { ink: null, op: 180 });
}
// 床（侧面）：(x, y) 为床板左上角，w 宽
function bed(x, y, w, o = {}) {
  paint(rrPts(x - 40, y - 190, 50, 330, 14), { wash: PAL.woodDk, ink: PAL.ink, sw: 1.1 });
  paint(rrPts(x + w - 10, y - 90, 44, 230, 14), { wash: PAL.woodDk, ink: PAL.ink, sw: 1.1 });
  paint(rectPts(x - 10, y + 30, w + 30, 70, 2), { wash: PAL.wood, ink: PAL.ink, sw: 1 });
  paint(rrPts(x, y - 30, w, 64, 24), { wash: '#FFFDF6', ink: PAL.ink, sw: 1 });
}
function blanket(x, y, w, h, bump = 0, col = PAL.sky) {
  const pts = [[x, y + h], [x, y + 10], [x + w * .25, y - bump], [x + w * .5, y + 4 - bump * .6], [x + w * .8, y - bump * .3], [x + w, y + 8], [x + w + 10, y + h]];
  paint(pts, { wash: col, ink: PAL.ink, sw: 1, curv: .5 });
  for (let i = 1; i < 6; i++) inkLine([[x + w * i / 6, y + 12 - bump * .4], [x + w * i / 6 + 14, y + h - 6]], .8, mixCol(col, '#FFFFFF', .5), 'inkfine', .2);
}
function pillow(x, y, w, h, rot = 0) {
  push(); translate(x, y); rotate(rot);
  paint(rrPts(-w / 2, -h / 2, w, h, h * .45, 2), { wash: '#FFFDF6', ink: PAL.ink, sw: 1 });
  inkLine([[-w * .3, -h * .1], [w * .3, -h * .1]], .6, '#C9C2D8', 'inkfine', .3);
  pop();
}
function feathers(cx, cy, t0, t, n = 10, spread = 260, seed = 0) {   // 每拍从 (cx, cy) 炸开一团羽毛
  const age = t - t0; if (age < 0 || age > 1.6) return;
  for (let i = 0; i < n; i++) {
    const a = hash(i * 3 + seed) * TAU, d = spread * (.4 + .6 * hash(i * 7 + seed)) * easeOut(age / .6);
    const x = cx + Math.cos(a) * d + Math.sin(age * 5 + i) * 18, y = cy + Math.sin(a) * d * .6 + age * age * 120;
    push(); translate(x, y); rotate(Math.sin(age * 6 + i) * .8);
    paint(ellPts(0, 0, 22, 8, 10), { wash: '#FFFDF6', washOp: 255 * (1 - seg(age, 1.1, 1.6)), ink: PAL.ink, sw: .5, br: 'inkfine' });
    pop();
  }
}
function sofa(x, y, w, col = PAL.teal) {   // (x, y) 为坐垫顶部左端
  const dk = mixCol(col, PAL.ink, .25);
  paint(rrPts(x + 20, y - 190, w - 40, 210, 40), { wash: col, ink: PAL.ink, sw: 1.1 });
  paint(rrPts(x - 30, y - 90, 90, 230, 36), { wash: dk, ink: PAL.ink, sw: 1.1 });
  paint(rrPts(x + w - 60, y - 90, 90, 230, 36), { wash: dk, ink: PAL.ink, sw: 1.1 });
  paint(rrPts(x + 40, y, w - 80, 110, 24), { wash: mixCol(col, '#FFFFFF', .12), ink: PAL.ink, sw: 1.1 });
  inkLine([[x + w / 2, y + 8], [x + w / 2, y + 100]], .8, dk, 'inkfine', 0);
  for (const fx of [x + 30, x + w - 40]) paint(rectPts(fx, y + 110, 14, 40), { wash: PAL.woodDk, ink: PAL.ink, sw: .7 });
}
function table(x, y, w, col = PAL.wood) {   // (x, y) 桌面左上角
  paint(rectPts(x, y, w, 28, 2), { wash: col, ink: PAL.ink, sw: 1.1 });
  paint(rectPts(x - 10, y - 16, w + 20, 22, 1), { wash: PAL.cream, ink: PAL.ink, sw: .8 });
  for (const lx of [x + 20, x + w - 44]) paint(rectPts(lx, y + 28, 24, 820 - y - 28), { wash: mixCol(col, PAL.ink, .2), ink: PAL.ink, sw: .9 });
}
function counter(x, y, w) {
  paint(rectPts(x, y, w, 820 - y), { wash: '#C98E62', ink: PAL.ink, sw: 1 });
  paint(rectPts(x - 10, y - 20, w + 20, 26), { wash: '#EFE9E1', ink: PAL.ink, sw: .9 });
  for (let i = 0; i < Math.floor(w / 200); i++) { paint(rrPts(x + 20 + i * 200, y + 50, 170, 180, 10), { ink: PAL.ink, sw: .7 }); blob(x + 150 + i * 200, y + 140, 7, 7, PAL.woodDk, { ink: null }); }
}
function plate(x, y, s = 1, food = 'egg') {
  paint(ellPts(x, y, 70 * s, 18 * s, 16), { wash: '#FFFDF6', ink: PAL.ink, sw: .8 });
  if (food === 'egg') { blob(x, y - 6 * s, 34 * s, 12 * s, '#FFFDF6', { sw: .6 }); blob(x, y - 9 * s, 12 * s, 9 * s, PAL.ochre, { sw: .5 }); }
  if (food === 'pancake') for (let i = 0; i < 3; i++) paint(ellPts(x, y - 8 * s - i * 12 * s, 46 * s, 12 * s, 14), { wash: '#E3A657', ink: PAL.ink, sw: .6 });
}
function pan(u, sw, egg = 0) {   // 手持平底锅（手柄从手心往外）
  paint(rectPts(0, -u * .18, u * 2.2, u * .36), { wash: '#4A4450', ink: PAL.ink, sw: sw * .6 });
  paint(ellPts(u * 3.6, 0, u * 1.5, u * .38, 16), { wash: '#3B3540', ink: PAL.ink, sw: sw * .7 });
}
function egg(x, y, s, rot = 0) {
  push(); translate(x, y); rotate(rot);
  blob(0, 0, 40 * s, 16 * s, '#FFFDF6', { sw: .7 }); blob(0, -3 * s, 14 * s, 11 * s, PAL.ochre, { sw: .5 });
  pop();
}
function cup(x, y, s = 1, tilt = 0, col = '#FFFDF6') {   // 牛奶杯，(x, y) 杯底中心，tilt 弧度
  push(); translate(x, y); rotate(tilt);
  paint([[-26 * s, 0], [26 * s, 0], [32 * s, -80 * s], [-32 * s, -80 * s]], { wash: col, ink: PAL.ink, sw: .9 });
  paint([[-24 * s, -8 * s], [24 * s, -8 * s], [29 * s, -60 * s], [-29 * s, -60 * s]], { wash: '#FFFFFF', washOp: 230, ink: null });
  pop();
}
function spoon(u, sw) { paint(rectPts(0, -u * .1, u * 1.6, u * .2), { wash: '#C9C4CF', ink: PAL.ink, sw: sw * .4 }); blob(u * 1.9, 0, u * .4, u * .28, '#C9C4CF', { sw: sw * .5 }); }
function desk(x, y, w) {
  paint(rectPts(x, y, w, 34, 2), { wash: PAL.wood, ink: PAL.ink, sw: 1.1 });
  paint(rectPts(x + 20, y + 34, w - 40, 820 - y - 34), { wash: mixCol(PAL.wood, PAL.ink, .15), ink: PAL.ink, sw: 1 });
  for (const dx of [.28, .72]) { paint(rrPts(x + w * dx - 80, y + 90, 160, 110, 8), { ink: PAL.ink, sw: .8 }); blob(x + w * dx, y + 145, 7, 7, PAL.woodDk, { ink: null }); }
}
// 笔记本电脑（正面朝向观众是背面），screen=true 时画屏幕朝外的样子，screenFn 在屏幕坐标里画内容
function laptop(x, y, s = 1, screenFn = null) {
  if (screenFn) {
    paint(rrPts(x - 170 * s, y - 230 * s, 340 * s, 220 * s, 14 * s), { wash: '#3B3B48', ink: PAL.ink, sw: 1 });
    paint(rectPts(x - 152 * s, y - 214 * s, 304 * s, 188 * s), { wash: '#DDEBF5', ink: null });
    push(); translate(x, y - 120 * s); screenFn(s); pop();
    paint([[x - 200 * s, y - 10 * s], [x + 200 * s, y - 10 * s], [x + 220 * s, y + 8 * s], [x - 220 * s, y + 8 * s]], { wash: '#9A9AA8', ink: PAL.ink, sw: .9 });
  } else {
    paint([[x - 170 * s, y], [x + 170 * s, y], [x + 150 * s, y - 220 * s], [x - 150 * s, y - 220 * s]], { wash: '#B9BAC8', ink: PAL.ink, sw: 1 });
    blob(x, y - 110 * s, 18 * s, 18 * s, '#E6E7EE', { ink: null });
  }
}
// 视频会议里的领导（原创配角）
function boss(cx, cy, s, o = {}) {
  paint(rrPts(cx - 90 * s, cy + 40 * s, 180 * s, 90 * s, 30 * s), { wash: '#55606E', ink: PAL.ink, sw: .8 });
  paint([[cx - 12 * s, cy + 40 * s], [cx + 12 * s, cy + 40 * s], [cx + 6 * s, cy + 110 * s], [cx - 6 * s, cy + 110 * s]], { wash: '#D8394E', ink: PAL.ink, sw: .5 });
  paint(rrPts(cx - 60 * s, cy - 70 * s, 120 * s, 120 * s, 40 * s), { wash: PAL.skin, ink: PAL.ink, sw: .9 });
  inkLine([[cx - 40 * s, cy - 30 * s], [cx - 15 * s, cy - 22 * s]], 1.2, PAL.ink, 'ink', 0); inkLine([[cx + 40 * s, cy - 30 * s], [cx + 15 * s, cy - 22 * s]], 1.2, PAL.ink, 'ink', 0);
  for (const sx of [-1, 1]) blob(cx + sx * 26 * s, cy - 8 * s, 5 * s, (o.shock ? 9 : 5) * s, PAL.ink, { ink: null });
  paint([[cx - 30 * s, cy + 12 * s], [cx, cy + 5 * s], [cx + 30 * s, cy + 12 * s], [cx, cy + 20 * s]], { wash: '#4A3A33', ink: null });
  if (o.shock) blob(cx, cy + 30 * s, 10 * s, 13 * s, '#8E2A3A', { sw: .5 });
}
function clock(x, y, r, t, ring = 0) {
  const [sx, sy] = ring ? shakeXY(t * 3, 10 * ring) : [0, 0];
  push(); translate(x + sx, y + sy); rotate(ring ? Math.sin(t * 60) * .12 * ring : 0);
  for (const s of [-1, 1]) { blob(s * r * .62, -r * .92, r * .32, r * .3, '#E0574A'); inkLine([[s * r * .4, -r * .7], [s * r * .75, -r * 1.2]], 1, PAL.ink, 'ink', 0); }
  for (const s of [-1, 1]) inkLine([[s * r * .5, r * .75], [s * r * .75, r * 1.15]], 2, PAL.ink, 'ink', 0);
  blob(0, 0, r, r, '#E0574A', { sw: 1.2 }); blob(0, 0, r * .8, r * .8, PAL.cream, { sw: .8 });
  for (let k = 0; k < 12; k++) { const a = k * TAU / 12; blob(Math.sin(a) * r * .66, -Math.cos(a) * r * .66, 3, 3, PAL.ink, { ink: null }); }
  const spin = ring ? t * 20 : 0, ha = TAU * 6.5 / 12 + spin * .1, ma = Math.PI + spin;
  inkLine([[0, 0], [Math.sin(ha) * r * .4, -Math.cos(ha) * r * .4]], 3, PAL.ink, 'ink', 0);
  inkLine([[0, 0], [Math.sin(ma) * r * .62, -Math.cos(ma) * r * .62]], 2, PAL.ink, 'ink', 0);
  pop();
  if (ring) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const a = (s < 0 ? Math.PI : 0) + s * (-.5 + i * .5); inkLine([[x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3], [x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65]], 2, PAL.ink, 'ink', 0); }
}
// 玩具
function block(x, y, s, col, rot = 0, ch = '') {
  push(); translate(x, y); rotate(rot);
  paint(rectPts(-30 * s, -30 * s, 60 * s, 60 * s, 1), { wash: col, ink: PAL.ink, sw: .9 });
  if (ch) letter(ch, x, y, 36 * s, PAL.cream, { ink: false, screen: false });
  pop();
}
function ball(x, y, r, col = PAL.rose, rot = 0) {
  blob(x, y, r, r, col, { sw: .9 });
  push(); translate(x, y); rotate(rot); inkLine([[-r, 0], [0, -r * .3], [r, 0]], 1, PAL.cream, 'ink', .6); inkLine([[0, -r], [r * .3, 0], [0, r]], 1, PAL.cream, 'ink', .6); pop();
}
function robot(x, y, s, o = {}) {   // (x, y) 为脚底中心
  push(); translate(x, y); rotate(o.rot || 0);
  const arm = o.armStretch || 0;
  for (const sx of [-1, 1]) paint(rectPts(sx * 22 * s - 9 * s, -40 * s, 18 * s, 40 * s), { wash: '#6E7FA8', ink: PAL.ink, sw: .8 });
  paint(rrPts(-50 * s, -130 * s, 100 * s, 95 * s, 16 * s), { wash: '#6FA9E0', ink: PAL.ink, sw: 1 });
  for (const sx of [-1, 1]) { const L = (sx < 0 ? 1 + arm : 1) * 60 * s; paint(rectPts(sx < 0 ? -50 * s - L : 50 * s, -115 * s, L, 20 * s), { wash: '#6E7FA8', ink: PAL.ink, sw: .8 }); blob(sx * (50 * s + L), -105 * s, 14 * s, 14 * s, '#6E7FA8', { sw: .7 }); }
  paint(rrPts(-38 * s, -200 * s, 76 * s, 64 * s, 14 * s), { wash: '#9CC8F0', ink: PAL.ink, sw: 1 });
  inkLine([[0, -200 * s], [0, -228 * s]], 1.4, PAL.ink, 'ink', 0); blob(0, -232 * s, 8 * s, 8 * s, '#E0283F', { sw: .6 });
  for (const sx of [-1, 1]) blob(sx * 16 * s, -170 * s, 8 * s, 8 * s, o.angry ? '#E0283F' : PAL.ochre, { sw: .6 });
  for (let i = 0; i < 3; i++) blob(-18 * s + i * 18 * s, -85 * s, 7 * s, 7 * s, PALETTE3[i], { sw: .5 });
  pop();
}
const PALETTE3 = [PAL.rose, PAL.ochre, PAL.sap];
function teddy(x, y, s, rot = 0) {
  push(); translate(x, y); rotate(rot);
  for (const sx of [-1, 1]) blob(sx * 38 * s, -150 * s, 20 * s, 20 * s, '#B98559', { sw: .8 });
  blob(0, -60 * s, 52 * s, 58 * s, '#B98559', { sw: 1 }); blob(0, -125 * s, 46 * s, 42 * s, '#B98559', { sw: 1 });
  blob(0, -112 * s, 18 * s, 13 * s, '#E9CFAE', { sw: .6 }); for (const sx of [-1, 1]) blob(sx * 16 * s, -132 * s, 5 * s, 6 * s, PAL.ink, { ink: null });
  blob(0, -116 * s, 6 * s, 4 * s, PAL.ink, { ink: null });
  pop();
}
function toyBox(x, y, w, h) {
  paint(rectPts(x, y, w, h, 2), { wash: '#E3A657', ink: PAL.ink, sw: 1.1 });
  paint(rectPts(x - 10, y - 12, w + 20, 26, 1), { wash: '#C98A3A', ink: PAL.ink, sw: 1 });
  letter('玩具箱', x + w / 2, y + h / 2, h * .28, PAL.cream, { stroke: PAL.woodDk });
}
// 作业本、书
function homework(x, y, s = 1, rot = 0, marks = 0) {
  push(); translate(x, y); rotate(rot);
  paint(rectPts(-160 * s, -110 * s, 320 * s, 220 * s, 1.5), { wash: '#FFFDF6', ink: PAL.ink, sw: 1 });
  for (let i = 0; i < 5; i++) inkLine([[-140 * s, -60 * s + i * 38 * s], [140 * s, -60 * s + i * 38 * s]], .5, '#A9C5E8', 'inkfine', 0);
  pop();
  letter('37×8=?', x - 20 * s, y - 50 * s, 44 * s, '#D8394E', { ink: false, rot });
}
function crayonScribble(pts, col, sw = 3) { inkLine(pts, sw, col, 'dry', .6); inkLine(pts, sw * .5, col, 'ink', .6); }
// 孩子画给爸爸的画：一家三口 + 爱心 + “爸爸辛苦了”
function kidDrawing(x, y, s = 1, rot = 0, k = 1) {
  push(); translate(x, y); rotate(rot); scale(s * backOut(k));
  paint(rectPts(-190, -140, 380, 280, 2), { wash: '#FFFDF6', ink: PAL.ink, sw: 1.1 });
  const fig = (fx, fy, h, col) => { paint(ellPts(fx, fy - h, 22, 22, 12, 2), { ink: col, sw: 1.4 }); inkLine([[fx, fy - h + 22], [fx, fy - 10]], 1.4, col, 'ink', 0); inkLine([[fx - 28, fy - h + 48], [fx + 28, fy - h + 48]], 1.4, col, 'ink', 0); inkLine([[fx - 20, fy + 30], [fx, fy - 10], [fx + 20, fy + 30]], 1.4, col, 'ink', 0); };
  fig(-100, 40, 90, '#E0574A'); fig(0, 40, 130, PAL.dad); fig(100, 40, 85, PAL.girlDk);
  paint(heartPts(130, -90, 34), { wash: '#E0283F', ink: PAL.ink, sw: .8 });
  paint(starPts(-140, -95, 22, .45, 5), { wash: PAL.ochre, ink: null });
  pop();
  if (k > .3) letter('爸爸辛苦了', x, y + 100 * s * backOut(k), 40 * s, '#E0506E', { ink: false, rot });
}
function cake(x, y, s = 1, lit = 1) {
  paint(rrPts(x - 110 * s, y - 120 * s, 220 * s, 120 * s, 18 * s), { wash: '#F7D7E3', ink: PAL.ink, sw: 1 });
  paint([[x - 110 * s, y - 100 * s], [x + 110 * s, y - 100 * s], [x + 110 * s, y - 80 * s], [x + 70 * s, y - 60 * s], [x + 30 * s, y - 82 * s], [x - 20 * s, y - 60 * s], [x - 70 * s, y - 84 * s], [x - 110 * s, y - 64 * s]], { wash: PAL.cream, ink: null, curv: .4 });
  for (let i = -1; i <= 1; i++) { paint(rectPts(x + i * 50 * s - 6 * s, y - 170 * s, 12 * s, 50 * s), { wash: PAL.sky, ink: PAL.ink, sw: .6 }); if (lit) { glow(x + i * 50 * s, y - 185 * s, 26 * s, '#FFD65A', 110); paint(ellPts(x + i * 50 * s + jit(2), y - 185 * s, 8 * s, 14 * s, 10), { wash: PAL.ochre, ink: null }); } }
  paint(ellPts(x, y + 4 * s, 140 * s, 18 * s, 18), { wash: '#FFFDF6', ink: PAL.ink, sw: .8 });
}
function discoBall(x, y, r, t) {
  inkLine([[x, -20], [x, y - r]], 1.2, PAL.ink, 'inkfine', 0);
  blob(x, y, r, r, '#C9CDE0', { sw: 1.2 });
  for (let i = -3; i <= 3; i++) inkLine([[x + i * r / 4, y - r * .95], [x + i * r / 4, y + r * .95]], .5, '#8C92AE', 'inkfine', .5);
  for (let i = -2; i <= 2; i++) inkLine([[x - r * .95, y + i * r / 3], [x + r * .95, y + i * r / 3]], .5, '#8C92AE', 'inkfine', .5);
  const ph = frac(bpOf(t));
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + beatN(t) * .5; paint(starPts(x + Math.cos(a) * r * (1.3 + ph), y + Math.sin(a) * r * (1.3 + ph), 16 * (1 - ph), .35, 4), { wash: PAL.cream, ink: null }); }
}
function spotlight(x, col, ang = 0, op = 90) {
  push(); translate(x, -40); rotate(ang);
  paint([[-30, 0], [30, 0], [260, 1250], [-260, 1250]], { fill: col, fillOp: op, bleed: .15, tex: .3, border: .1, ink: null });
  pop();
}
function confetti(t, seed = 0, n = 40, op = 255) {
  for (let i = 0; i < n; i++) {
    const sp = 120 + hash(i + seed) * 160, x = hash(i * 3.1 + seed) * W + Math.sin(t * 2 + i) * 30, y = frac(hash(i * 7.7 + seed) + t * sp / 1200) * (H + 100) - 50;
    const col = [PAL.rose, PAL.ochre, PAL.teal, PAL.violet, PAL.sap, PAL.sky][i % 6];
    push(); translate(x, y); rotate(t * 3 + i);
    paint(rectPts(-10, -5, 20, 10), { wash: col, washOp: op, ink: null });
    pop();
  }
}
function heartsRise(t, seed = 0, n = 12, op = 230) {
  for (let i = 0; i < n; i++) {
    const ph = frac(hash(i * 2.3 + seed) + t * (.12 + .1 * hash(i + seed))), x = hash(i * 5.1 + seed) * W + Math.sin(t * 2 + i) * 20;
    paint(heartPts(x, H + 40 - ph * (H + 120), 16 + 18 * hash(i * 9 + seed)), { wash: i % 2 ? '#E0506E' : '#F28BA8', washOp: op * (1 - ph * .6), ink: PAL.ink, sw: .5 });
  }
}
// 打架烟尘云：一团云，四周伸出手脚和星星
function brawlCloud(cx, cy, r, t) {
  const bp = bpOf(t), ph = frac(bp);
  for (let i = 0; i < 5; i++) {   // 伸出来的手脚（每拍换位置）
    const a = hash(beatN(t) * 5 + i) * TAU, L = r * (1.05 + .25 * Math.sin(ph * Math.PI));
    const col = i % 2 ? PAL.skin : (i % 3 ? PAL.boy : PAL.girl);
    push(); translate(cx + Math.cos(a) * r * .6, cy + Math.sin(a) * r * .5); rotate(a);
    paint(rrPts(0, -14, L * .55, 28, 12), { wash: col, ink: PAL.ink, sw: .9 }); blob(L * .55, 0, 20, 20, PAL.skin, { sw: .8 });
    pop();
  }
  for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + bp * .7, rr = r * (.55 + .12 * Math.sin(bp * 3 + i)); blob(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .7, r * .42, r * .36, '#F4EFE6', { sw: 1.1 }); }
  blob(cx, cy, r * .7, r * .55, '#F4EFE6', { ink: null });
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + bp; paint(starPts(cx + Math.cos(a) * r * 1.1, cy + Math.sin(a) * r * .8, 28 * (1 - ph * .5), .4, 5), { wash: PAL.ochre, ink: PAL.ink, sw: .6 }); }
}
// 牛奶浪：从左往右盖满画面的奶白色大浪（k 0..1）
function milkWave(k, t) {
  if (k <= 0) return;
  const x1 = lerp(-400, W + 600, easeOut(k)), pts = [[-100, H + 100], [-100, -100]];
  for (let i = 0; i <= 10; i++) { const y = -100 + i * (H + 200) / 10; pts.push([x1 - 200 + Math.sin(i * 1.3 + t * 8) * 80 - (i % 2) * 90, y]); }
  pts.push([-100, H + 100]);
  paint(pts, { wash: '#FBF8F1', ink: PAL.ink, sw: 1.4, curv: .5 });
  for (let i = 0; i < 8; i++) blob(x1 - 160 + hash(i) * 140, hash(i + 4) * H, 20 + hash(i + 8) * 26, 20 + hash(i + 8) * 26, '#FBF8F1', { sw: .8 });
}
// 手机相册
function phone(x, y, s, photo, rot = 0) {
  push(); translate(x, y); rotate(rot); scale(s);
  paint(rrPts(-120, -220, 240, 440, 30), { wash: '#2F2B3A', ink: PAL.ink, sw: 1.2 });
  paint(rrPts(-104, -196, 208, 380, 14), { wash: ['#FDE2C9', '#D8ECF7', '#F8D8E5', '#E3F1D6'][photo % 4], ink: null });
  pop();
}
// 拍立得照片框（里面由 fn 在照片坐标里画）
function polaroid(x, y, s, rot, fn) {
  push(); translate(x, y); rotate(rot); scale(s);
  paint(rectPts(-170, -170, 340, 380, 1.5), { wash: '#FFFDF6', ink: PAL.ink, sw: 1.1 });
  paint(rectPts(-145, -145, 290, 280), { wash: PAL.sky, ink: null });
  if (fn) fn();
  paint(rectPts(-145, -145, 290, 280), { ink: PAL.ink, sw: .7 });
  pop();
}
