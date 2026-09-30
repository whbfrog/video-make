// family.js：原创角色——爸爸、哥哥、妹妹（水彩平涂 + 墨线）。
// fam(kind, x, y, u, o)：(x, y) 为双脚之间的地面点，u 为单位长度。
//   爸爸身高约 15u，孩子约 10.5u。主角特写时 u≈28~40，普通 u≈16~24。
// 姿势：dy（向上为负，单位 u）、sq（压扁，负值拉长）、rot、flip、sx/sy、aL/aR（手臂角度：0 水平外伸，正值抬起，约 -1.25 自然下垂）、
//   walk（步伐相位）、sit、legSpread。
// 脸：eyes（normal look happy closed wide angry cry star heart swirl tired x sparkle dot）、mouth（smile grin o O flat wobble frown teeth cat scream）、
//   brows（angry worried up）、blush、red（0~1 脸红）、tears（0~1 泪流）、hairUp（0~1 头发炸起）、lookX/lookY。
// 钩子：handL/handR(u, sw) 在手心处调用（手臂坐标系，+x 沿手臂向外），用来拿道具；draw(u, sw) 在身体坐标系里画配件。
const SPEC = {
  dad: { leg: 4.6, legW: 1.35, hip: 1.05, bodyW: 5.4, bodyH: 5.8, headR: 2.75, neck: 2.35, arm: 4.3, armW: 1.15, sh: 2.35,
    col: PAL.dad, dk: PAL.dadDk, low: PAL.pants, hair: PAL.hair, shoe: '#5A3D33' },
  boy: { leg: 2.7, legW: 1.1, hip: .85, bodyW: 4.0, bodyH: 3.5, headR: 2.65, neck: 2.2, arm: 2.9, armW: .95, sh: 1.75,
    col: PAL.boy, dk: PAL.boyDk, low: PAL.shorts, hair: PAL.hair, shoe: '#F5F1E8' },
  girl: { leg: 2.5, legW: .95, hip: .75, bodyW: 3.4, bodyH: 3.9, headR: 2.6, neck: 2.25, arm: 2.7, armW: .9, sh: 1.45,
    col: PAL.girl, dk: PAL.girlDk, low: PAL.skin, hair: PAL.hairG, shoe: '#E86A98' }
};

function fam(kind, x, y, u, o = {}) {
  const S = SPEC[kind], sq = (o.sq || 0) + (o.take || 0), dy = (o.dy || 0) * u;
  const sw = clamp(u / 14, .5, 2.6) * (o.swMul || 1), J = u * .06;
  const skin = o.red ? mixCol(PAL.skin, '#EE6A5A', o.red) : PAL.skin;
  const sil = o.sil;   // 剪影色：整个人只用一种颜色
  const C = c => sil || c;
  if (!o.noShadow) {
    const f = 1 - Math.min(.5, Math.abs(o.dy || 0) * .05);
    paint(ellPts(x, y + u * .12, u * (kind === 'dad' ? 3.6 : 2.8) * f, u * .6 * f, 16), { wash: PAL.ink, washOp: sil ? 0 : 55, ink: null });
  }
  push();
  translate(x, y + dy);
  if (o.rot) rotate(o.rot);
  scale((o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .6), (o.sy ?? 1) * (1 - sq));

  const legTop = -S.leg * u, bodyTop = legTop - S.bodyH * u, headY = bodyTop - S.neck * u * .55 - S.headR * u * .62;
  const inkO = sil ? null : PAL.ink;

  // 腿
  const legs = [-1, 1].map(side => {
    let a = side * (o.legSpread || 0);
    if (o.walk != null) a += Math.sin((o.walk + (side > 0 ? .5 : 0)) * TAU) * .45;
    return a;
  });
  [-1, 1].forEach((side, i) => {
    push(); translate(side * S.hip * u, legTop - u * .2); rotate(-legs[i]);
    const L = (o.sit ? .55 : 1) * S.leg * u + u * .2;
    const legCol = kind === 'girl' ? skin : S.low;
    paint(rrPts(-S.legW * u / 2, 0, S.legW * u, L, S.legW * u * .45, J * .5), { wash: C(legCol), ink: inkO, sw: sw * .8 });
    if (kind === 'girl' && !sil) paint(rectPts(-S.legW * u / 2, L - u * 1.1, S.legW * u, u * .8), { wash: PAL.cream, ink: null });
    paint(ellPts(side * u * .3, L, S.legW * u * .85, u * .5, 12, J * .4), { wash: C(S.shoe), ink: inkO, sw: sw * .7 });
    pop();
  });

  // 手臂（在身体前面画，但“抱头”姿势会在头之后再画一遍）
  const arm = (side, a, hook) => {
    const L = S.arm * u, w = S.armW * u;
    push(); translate(side * S.sh * u, bodyTop + u * .7); rotate(side < 0 ? a : -a);
    const x0 = side < 0 ? -L : 0;
    paint(rrPts(x0, -w / 2, L, w, w * .45, J * .5), { wash: C(skin), ink: inkO, sw: sw * .75 });
    paint(rrPts(side < 0 ? -L * .42 : 0, -w * .58, L * .42, w * 1.16, w * .5, J * .5), { wash: C(S.col), ink: inkO, sw: sw * .75 });
    paint(ellPts(side * L, 0, w * .62, w * .62, 12, J * .3), { wash: C(skin), ink: inkO, sw: sw * .6 });
    if (hook && !sil) { translate(side * L, 0); if (side < 0) scale(-1, 1); hook(u, sw); }
    pop();
  };
  const armBehind = o.armsBehind;
  if (armBehind) { arm(-1, o.aL ?? -1.2, o.handL); arm(1, o.aR ?? -1.2, o.handR); }

  // 身体
  if (kind === 'girl') {
    const tw = S.bodyW * u * .46, bw = S.bodyW * u * .8, top = bodyTop + u * .2, bot = legTop + u * .9;
    const dress = [[-tw, top], [tw, top], [bw, bot], [0, bot + u * .15], [-bw, bot]];
    paint(dress, { wash: C(S.col), ink: null, curv: .15 });
    if (!sil) {
      paint([[-bw * .9, bot - u * .9], [bw * .9, bot - u * .9], [bw, bot], [-bw, bot]], { wash: S.dk, washOp: 110, ink: null });
      for (const [dx, dy2] of [[-.35, .35], [.3, .5], [-.1, .7], [.55, .78], [-.6, .82]]) paint(ellPts(dx * bw, lerp(top, bot, dy2), u * .18, u * .18, 8), { wash: PAL.cream, ink: null });
      paint(ellPts(0, top + u * .15, tw * .95, u * .55, 14), { wash: PAL.cream, ink: PAL.ink, sw: sw * .5 });
    }
    paint(dress, { ink: inkO, sw, curv: .15 });
  } else {
    const bw = S.bodyW * u, body = rrPts(-bw / 2, bodyTop, bw, S.bodyH * u + u * .4, bw * .32, J);
    paint(body, { wash: C(S.col), ink: null });
    if (!sil) {
      paint(ellPts(-bw * .15, bodyTop + S.bodyH * u * .3, bw * .3, S.bodyH * u * .22, 10), { fill: '#FFFFFF', fillOp: 45, bleed: .2, tex: .6, border: .6, ink: null });
      paint(rectPts(-bw * .48, legTop - u * .6, bw * .96, u * .8, J), { wash: S.dk, washOp: 120, ink: null });
      if (kind === 'dad') {
        paint([[-bw * .2, bodyTop], [bw * .2, bodyTop], [0, bodyTop + u * 1.2]], { wash: PAL.cream, ink: PAL.ink, sw: sw * .5 });
        inkLine([[0, bodyTop + u * 1.3], [0, legTop - u * .4]], sw * .5, S.dk, 'inkfine', 0);
        for (let i = 0; i < 3; i++) blob(0 + u * .25, bodyTop + u * (1.9 + i * 1.2), u * .15, u * .15, PAL.cream, { ink: null });
      } else {
        paint(starPts(0, bodyTop + S.bodyH * u * .48, u * 1.0, .45, 5), { wash: '#FFD65A', ink: PAL.ink, sw: sw * .5 });
      }
    }
    paint(body, { ink: inkO, sw });
  }
  if (o.apron && !sil) {
    const aw = S.bodyW * u * .36;
    paint(rrPts(-aw, bodyTop + u * 1.4, aw * 2, S.bodyH * u - u * .6, u * .5), { wash: '#FFF9F0', ink: PAL.ink, sw: sw * .6 });
    paint(rrPts(-aw * .55, bodyTop + u * 3, aw * 1.1, u * 1.1, u * .3), { wash: PAL.rose, washOp: 200, ink: PAL.ink, sw: sw * .4 });
  }
  if (o.cape && !sil) paint([[-S.bodyW * u * .5, bodyTop + u * .3], [S.bodyW * u * .5, bodyTop + u * .3], [S.bodyW * u * .9 + wob(T, 3) * u * .4, legTop + u], [-S.bodyW * u * .9 - wob(T, 3, .3) * u * .4, legTop + u]], { wash: PAL.violet, washOp: 230, ink: PAL.ink, sw: sw * .7, curv: .3 });

  if (!armBehind) {
    if (o.aL !== 'head') arm(-1, o.aL ?? -1.2, o.handL);
    if (o.aR !== 'head') arm(1, o.aR ?? -1.2, o.handR);
  }

  // 头
  push(); translate(0, headY); if (o.headRot) rotate(o.headRot);
  head(kind, S.headR * u, o, sw, skin, C, inkO);
  pop();
  // 抱头：手放到头两侧
  for (const [side, key, hk] of [[-1, 'aL', 'handL'], [1, 'aR', 'handR']]) {
    if (o[key] !== 'head') continue;
    const R = S.headR * u, sx0 = side * S.sh * u, sy0 = bodyTop + u * .7, hx = side * R * .95, hy = headY + R * .1;
    const ex = side * (S.sh * u + S.arm * u * .45), ey = sy0 - S.arm * u * .35;
    inkLine([[sx0, sy0], [ex, ey], [hx, hy]], S.armW * u * .9 / 5, C(skin), 'ink', .3);
    paint(ellPts(ex, ey, S.armW * u * .5, S.armW * u * .5, 10), { wash: C(S.col), ink: inkO, sw: sw * .6 });
    paint(ellPts(hx, hy, S.armW * u * .62, S.armW * u * .62, 10), { wash: C(skin), ink: inkO, sw: sw * .6 });
  }
  if (o.draw && !sil) o.draw(u, sw);
  pop();
  if (o.emote && !sil) emote(o.emote, x + (o.flip ? -1 : 1) * S.headR * u * 1.25, y + dy + headY * (1 - sq) - S.headR * u * .9, u * 1.1, o.emoteK ?? 1);
  // 头顶世界坐标（给蒸汽、冒汗等特效用）
  return { hx: x, hy: y + dy + headY * (1 - sq), R: S.headR * u };
}

function head(kind, R, o, sw, skin, C, inkO) {
  const S = SPEC[kind], J = R * .02;
  // 后面的头发 / 马尾
  if (kind === 'girl') {
    const sway = Math.sin(bpOf(T) * Math.PI) * .12;
    for (const s of [-1, 1]) {
      push(); translate(s * R * .95, -R * .35); rotate(s * (.35 + sway));
      paint(ellPts(s * R * .35, R * .25, R * .42, R * .62, 14, J), { wash: C(S.hair), ink: inkO, sw: sw * .7 });
      pop();
    }
    paint(ellPts(0, R * .1, R * 1.08, R * 1.02, 22, J), { wash: C(S.hair), ink: inkO, sw });
  }
  if (kind !== 'girl') for (const s of [-1, 1]) paint(ellPts(s * R * .98, R * .12, R * .2, R * .26, 10, J), { wash: C(skin), ink: inkO, sw: sw * .6 });
  const face = ellPts(0, 0, R, R * .96, 26, J);
  paint(face, { wash: C(skin), ink: null });
  if (!o.sil) paint(ellPts(R * .15, R * .45, R * .75, R * .4, 12), { fill: PAL.skinDk, fillOp: 60, bleed: .2, tex: .6, border: .6, ink: null });
  paint(face, { ink: inkO, sw });
  // 前面的头发
  const hc = C(S.hair), up = o.hairUp || 0;
  if (kind === 'dad') {
    paint([[-R * 1.02, -R * .05], [-R * .9, -R * .72], [-R * .3, -R * 1.08], [R * .45, -R * 1.02], [R, -R * .55], [R * 1.02, -R * .08], [R * .72, -R * .42], [R * .1, -R * .5], [-R * .55, -R * .38]], { wash: hc, ink: inkO, sw: sw * .8, curv: .3 });
    if (up > .01) for (let i = 0; i < 7; i++) { const a = -Math.PI * (.15 + i * .7 / 6); paint([[Math.cos(a - .12) * R * .85, Math.sin(a - .12) * R * .85], [Math.cos(a) * R * (1.1 + up * .7 + jit(.05)), Math.sin(a) * R * (1.1 + up * .7)], [Math.cos(a + .12) * R * .85, Math.sin(a + .12) * R * .85]], { wash: hc, ink: inkO, sw: sw * .6 }); }
  } else if (kind === 'boy') {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI, rr = (i % 2 ? 1.02 : 1.3 + up * .4) * R; pts.push([Math.cos(a) * rr, Math.sin(a) * rr * .95 - R * .08]); }
    pts.push([R * .95, -R * .2], [R * .3, -R * .5], [-R * .4, -R * .45], [-R * .95, -R * .2]);
    paint(pts, { wash: hc, ink: inkO, sw: sw * .8 });
  } else {
    paint([[-R * 1.02, -R * .1], [-R * .85, -R * .75], [0, -R * 1.05], [R * .85, -R * .75], [R * 1.02, -R * .1], [R * .6, -R * .45], [R * .2, -R * .3], [-R * .25, -R * .45], [-R * .65, -R * .3]], { wash: hc, ink: inkO, sw: sw * .8, curv: .35 });
    if (!o.sil) for (const s of [-1, 1]) {
      const bx = s * R * .95, by = -R * .72;
      paint([[bx, by], [bx - R * .38, by - R * .25], [bx - R * .38, by + R * .25]], { wash: PAL.bow, ink: PAL.ink, sw: sw * .5 });
      paint([[bx, by], [bx + R * .38, by - R * .25], [bx + R * .38, by + R * .25]], { wash: PAL.bow, ink: PAL.ink, sw: sw * .5 });
      blob(bx, by, R * .1, R * .1, PAL.bow, { sw: sw * .4 });
    }
  }
  if (o.hat) hat(o.hat, R, sw);
  if (o.sil) return;
  faceFeatures(kind, R, o, sw);
}

function faceFeatures(kind, R, o, sw) {
  const ey = R * .08, ex = R * .38, e = R * .12, my = R * .5, sqz = 1 - (o.squint || 0);
  const lx = (o.lookX || 0) * e * .5, ly = (o.lookY || 0) * e * .5;
  const eyes = o.eyes || 'normal';
  if (o.blush || ['happy', 'moved', 'sparkle', 'heart', 'cry'].includes(eyes) || kind === 'girl')
    for (const s of [-1, 1]) paint(ellPts(s * R * .6, R * .35, R * .17, R * .1, 10), { wash: PAL.rose, washOp: o.blush ? 190 : 120, ink: null });
  for (const s of [-1, 1]) {
    const cx = s * ex;
    switch (eyes) {
      case 'moved':
      case 'happy': inkLine([[cx - e * 1.3, ey + e * .4], [cx, ey - e * .9], [cx + e * 1.3, ey + e * .4]], sw * 1.1, PAL.ink, 'ink', .6); break;
      case 'closed': inkLine([[cx - e * 1.2, ey - e * .2], [cx, ey + e * .6], [cx + e * 1.2, ey - e * .2]], sw * 1.1, PAL.ink, 'ink', .6); break;
      case 'wide': blob(cx, ey, e * 1.7, e * 1.9 * sqz, PAL.cream, { sw: sw * .7 }); blob(cx + lx, ey + ly, e * .55, e * .6 * sqz, PAL.ink, { ink: null }); break;
      case 'angry':
        blob(cx + lx, ey + ly, e * .75, e * .95 * sqz, PAL.ink, { ink: null });
        inkLine([[cx + s * e * 1.8, ey - e * 2.4], [cx - s * e * 1.2, ey - e * 1.3]], sw * 1.5, PAL.ink, 'ink', 0); break;
      case 'cry': inkLine([[cx + s * e * 1.2, ey - e], [cx - s * e * .9, ey], [cx + s * e * 1.2, ey + e]], sw * 1.1, PAL.ink, 'ink', 0); break;
      case 'star': paint(starPts(cx, ey, e * 1.9, .45, 5), { wash: PAL.ochre, ink: PAL.ink, sw: sw * .6 }); break;
      case 'heart': paint(heartPts(cx, ey, e * 1.6), { wash: '#E0283F', ink: PAL.ink, sw: sw * .6 }); break;
      case 'swirl': { const p = []; for (let i = 0; i < 20; i++) { const a = i * .6 + T * 8 * s, r = e * 1.6 * i / 20; p.push([cx + Math.cos(a) * r, ey + Math.sin(a) * r]); } inkLine(p, sw * .8, PAL.ink, 'inkfine', .5); break; }
      case 'tired':
        blob(cx + lx, ey + e * .3, e * .8, e * .5, PAL.ink, { ink: null });
        inkLine([[cx - e * 1.3, ey - e * .1], [cx + e * 1.3, ey - e * .1]], sw * 1.1, PAL.ink, 'ink', 0);
        inkLine([[cx - e * 1.1, ey + e * 1.4], [cx, ey + e * 1.8], [cx + e * 1.1, ey + e * 1.4]], sw * .6, '#9C7C9A', 'inkfine', .6); break;
      case 'x': inkLine([[cx - e, ey - e], [cx + e, ey + e]], sw, PAL.ink, 'ink', 0); inkLine([[cx - e, ey + e], [cx + e, ey - e]], sw, PAL.ink, 'ink', 0); break;
      case 'sparkle':
        blob(cx + lx, ey + ly, e * 1.25, e * 1.45 * sqz, PAL.ink, { ink: null });
        blob(cx + lx + e * .4, ey + ly - e * .5, e * .45, e * .45, PAL.cream, { ink: null });
        blob(cx + lx - e * .4, ey + ly + e * .5, e * .22, e * .22, PAL.cream, { ink: null }); break;
      case 'dot': blob(cx, ey, e * .45, e * .45 * sqz, PAL.ink, { ink: null }); break;
      default:
        blob(cx + lx, ey + ly, e * .8, e * 1.05 * sqz, PAL.ink, { ink: null });
        if (sqz > .5) blob(cx + lx + e * .3, ey + ly - e * .4, e * .28, e * .28, PAL.cream, { ink: null });
    }
    if (o.brows === 'worried') inkLine([[cx - s * e * 1.4, ey - e * 2.5], [cx + s * e * 1.2, ey - e * 1.8]], sw, PAL.ink, 'ink', 0);
    if (o.brows === 'up') inkLine([[cx - e * 1.2, ey - e * 2.4], [cx, ey - e * 2.9], [cx + e * 1.2, ey - e * 2.4]], sw, PAL.ink, 'ink', .6);
    if (o.brows === 'angry' && eyes !== 'angry') inkLine([[cx + s * e * 1.8, ey - e * 2.4], [cx - s * e * 1.2, ey - e * 1.3]], sw * 1.4, PAL.ink, 'ink', 0);
  }
  if (kind === 'dad') {   // 圆眼镜
    for (const s of [-1, 1]) paint(ellPts(s * ex, ey, e * 2.5, e * 2.3, 16), { ink: PAL.ink, sw: sw * .7, br: 'inkfine' });
    inkLine([[-ex + e * 2.5, ey], [ex - e * 2.5, ey]], sw * .6, PAL.ink, 'inkfine', 0);
  }
  if (eyes === 'moved') o = { ...o, tears: Math.max(o.tears || 0, .75) };
  if (o.tears > .01) for (const s of [-1, 1]) {
    const L = R * (.3 + .9 * o.tears);
    paint([[s * ex - e * .5, ey + e], [s * ex + e * .5, ey + e], [s * (ex + e * .2) + e * .6, ey + e + L], [s * (ex + e * .2) - e * .6, ey + e + L]], { wash: '#8FCBF2', washOp: 210, ink: null });
    const ph = frac(T * 2 + (s + 1) * .25);
    blob(s * (ex + e * .8 + ph * R * .4), ey + e + L + ph * R * .6, e * .45, e * .6, '#8FCBF2', { ink: null, op: 230 * (1 - ph) });
  }
  const m = o.mouth || 'smile';
  switch (m) {
    case 'smile': inkLine([[-R * .2, my - R * .06], [0, my + R * .06], [R * .2, my - R * .06]], sw, PAL.ink, 'ink', .6); break;
    case 'grin': paint([[-R * .3, my - R * .12], [R * .3, my - R * .12], [R * .18, my + R * .14], [0, my + R * .2], [-R * .18, my + R * .14]], { wash: '#8E2A3A', ink: PAL.ink, sw: sw * .8, curv: .4 });
      paint(ellPts(0, my + R * .08, R * .12, R * .06, 8), { wash: PAL.rose, ink: null }); break;
    case 'o': blob(0, my, R * .08, R * .1, '#8E2A3A', { sw: sw * .6 }); break;
    case 'O': blob(0, my + R * .02, R * .16, R * .2, '#8E2A3A', { sw: sw * .7 }); break;
    case 'scream': blob(0, my + R * .05, R * .26, R * .3 + Math.sin(T * 30) * R * .03, '#8E2A3A', { sw: sw * .8 }); blob(0, my + R * .2, R * .15, R * .08, PAL.rose, { ink: null }); break;
    case 'flat': inkLine([[-R * .18, my], [R * .18, my]], sw, PAL.ink, 'ink', 0); break;
    case 'wobble': inkLine([[-R * .22, my], [-R * .11, my - R * .05], [0, my], [R * .11, my - R * .05], [R * .22, my]], sw, PAL.ink, 'inkfine', .5); break;
    case 'frown': inkLine([[-R * .2, my + R * .06], [0, my - R * .06], [R * .2, my + R * .06]], sw, PAL.ink, 'ink', .6); break;
    case 'cat': inkLine([[-R * .22, my - R * .04], [-R * .11, my + R * .05], [0, my - R * .03], [R * .11, my + R * .05], [R * .22, my - R * .04]], sw, PAL.ink, 'ink', .5); break;
    case 'teeth':
      paint(rrPts(-R * .3, my - R * .12, R * .6, R * .24, R * .06), { wash: PAL.cream, ink: PAL.ink, sw: sw * .8 });
      inkLine([[-R * .3, my], [R * .3, my]], sw * .5, PAL.ink, 'inkfine', 0);
      for (const k of [-1, 0, 1]) inkLine([[k * R * .1, my - R * .12], [k * R * .1, my + R * .12]], sw * .5, PAL.ink, 'inkfine', 0); break;
  }
}

function hat(h, R, sw) {
  if (h === 'crown') paint([[-R * .6, -R * .85], [-R * .7, -R * 1.5], [-R * .3, -R * 1.2], [0, -R * 1.65], [R * .3, -R * 1.2], [R * .7, -R * 1.5], [R * .6, -R * .85]], { wash: PAL.ochre, ink: PAL.ink, sw: sw * .7 });
  if (h === 'sock') paint([[-R * .7, -R * .8], [R * .5, -R * 1.0], [R * .9, -R * 1.5], [R * 1.4, -R * 1.45], [R * 1.3, -R * 1.1], [R * .8, -R * .7]], { wash: '#E9E2F5', ink: PAL.ink, sw: sw * .6, curv: .3 });
  if (h === 'party') { paint([[-R * .45, -R * .85], [R * .45, -R * .85], [R * .05, -R * 1.9]], { wash: PAL.teal, ink: PAL.ink, sw: sw * .7 }); blob(R * .05, -R * 1.95, R * .15, R * .15, PAL.ochre, { sw: sw * .5 }); }
  if (h === 'headset') {
    inkLine([[-R * 1.05, R * .1], [-R * .9, -R * .8], [0, -R * 1.15], [R * .9, -R * .8], [R * 1.05, R * .1]], sw * 2.2, '#3B3B48', 'ink', .6);
    for (const s of [-1, 1]) paint(rrPts(s * R * 1.05 - R * .18, -R * .1, R * .36, R * .5, R * .12), { wash: '#3B3B48', ink: PAL.ink, sw: sw * .5 });
    inkLine([[-R * 1.05, R * .35], [-R * .6, R * .72], [-R * .3, R * .62]], sw * .8, '#3B3B48', 'inkfine', .4);
  }
  if (h === 'whistle') { inkLine([[-R * .6, R * .9], [0, R * 1.3], [R * .6, R * .9]], sw * .6, PAL.ink, 'inkfine', .5); }
}

// 表情符号：汗、怒、爱心、Zzz、感叹号、问号、音符、晕、火花
function emote(kind, x, y, s, k = 1) {
  if (k < .02) return;
  const sc = backOut(k);
  push(); translate(x, y); scale(sc);
  switch (kind) {
    case 'sweat': paint([[0, -s * 1.1], [s * .55, s * .2], [0, s * .6], [-s * .55, s * .2]], { wash: '#8FCBF2', ink: PAL.ink, sw: .8, curv: .5 }); break;
    case 'anger': { const c = '#E0283F', w = s * .5; for (const [dx, dy, a] of [[1, 1, 3.14], [-1, 1, 4.71], [-1, -1, 0], [1, -1, 1.57]]) { push(); translate(dx * s * .45, dy * s * .45); rotate(a); inkLine([[-w, 0], [0, 0], [0, -w]], 2.2, c, 'ink', .6); pop(); } break; }
    case 'heart': paint(heartPts(0, 0, s * .8), { wash: '#E0283F', ink: PAL.ink, sw: .8 }); break;
    case 'zzz': letter('Z', 0, 0, s * 1.4, PAL.indigo, { ink: false }); letter('z', s * .9, -s * .9, s, PAL.indigo, { ink: false }); break;
    case '!': case '!!': case '?': case '!?': letter(kind, 0, 0, s * 2.2, kind.includes('?') ? PAL.violet : '#E0283F', { stroke: PAL.cream }); break;
    case 'music': letter('♪', 0, 0, s * 2, PAL.teal, { stroke: PAL.cream }); break;
    case 'swirl': { const p = []; for (let i = 0; i < 26; i++) { const a = i * .5 + T * 6, r = s * .9 * i / 26; p.push([Math.cos(a) * r, Math.sin(a) * r * .6]); } inkLine(p, 1.2, PAL.ink, 'inkfine', .5); break; }
    case 'spark': paint(starPts(0, 0, s, .35, 4), { wash: PAL.ochre, ink: PAL.ink, sw: .7 }); break;
  }
  pop();
}

// 七窍生烟：头顶和两耳往外喷蒸汽（phase 用节拍驱动，每拍喷一团）
function steam(hx, hy, R, t, k = 1) {
  if (k < .02) return;
  const srcs = [[0, -R * 1.05, 0, -1], [-R * 1.05, R * .05, -1, -.5], [R * 1.05, R * .05, 1, -.5]];
  srcs.forEach(([sx, sy, dx, dyy], j) => {
    for (let i = 0; i < 4; i++) {
      const ph = frac(bpOf(t) * .5 + i / 4 + j * .13);
      const px = hx + sx + dx * ph * R * 1.6 + Math.sin(ph * 7 + i) * R * .15, py = hy + sy + dyy * ph * R * 2.2;
      const r = R * (.18 + ph * .55) * (.6 + .4 * k);
      paint(ellPts(px, py, r, r * .85, 12, r * .05), { wash: '#FBF8F2', washOp: 235 * (1 - ph) * k, ink: PAL.ink, sw: .6 * (1 - ph), br: 'inkfine' });
    }
  });
}

// 表情变化：先眯眼压扁，再弹开。keys: [[t0, eyes, mouth, emote], ...]
function mood(t, keys) {
  let i = 0; while (i + 1 < keys.length && t >= keys[i + 1][0]) i++;
  const [t0, eyes, mouth, em] = keys[i], age = t - t0, nextIn = i + 1 < keys.length ? keys[i + 1][0] - t : 9;
  let squint = 0, take = 0;
  if (i > 0 && age < .16) { squint = 1 - age / .16; take = -.14 * Math.sin(age / .16 * Math.PI); }
  if (nextIn < .08) squint = Math.max(squint, 1 - nextIn / .08);
  if (i > 0 && age >= .16 && age < .4) take = .1 * Math.sin((age - .16) / .24 * Math.PI) * (1 - (age - .16) / .24);
  const r = { eyes, squint, take, emote: em, emoteK: em ? seg(age, .05, .3) * (1 - seg(age, 1.6, 1.9)) : 0 };
  if (mouth) r.mouth = mouth;
  return r;
}

// 跟节拍的舞步：返回姿势偏移
function move(style, t, seed = 0) {
  const bp = bpOf(t), bi = Math.floor(bp), bf = bp - bi, hit = Math.max(0, 1 - bf * 3.5), s1 = Math.sin(bp * Math.PI), ab = Math.abs(s1);
  const o = { dy: 0, sq: 0, aL: -1.1, aR: -1.1, rot: 0, walk: null, sx: 1, dx: 0 };
  if (style === 'mix') style = ['bounce', 'roof', 'sway', 'spin', 'hop', 'wave', 'shimmy', 'clap'][(Math.floor(bp / 8) + seed) % 8];
  switch (style) {
    case 'bounce': o.dy = -ab * 1.4; o.sq = hit * .12; o.aL = .1 + s1 * .9; o.aR = .1 - s1 * .9; break;
    case 'hop': o.dy = -ab * 3.2; o.sq = hit * .18; o.aL = o.aR = .2 + ab * 1.1; break;
    case 'roof': o.dy = -ab * 1.1; o.sq = hit * .1; o.aL = o.aR = 1.2 + .25 * Math.sin(bp * TAU); break;
    case 'sway': o.dx = s1 * 1.5; o.rot = s1 * .12; o.aL = .2 + .7 * s1; o.aR = .2 - .7 * s1; o.sq = hit * .08; break;
    case 'spin': { const ph = (((bi % 4) + 4) % 4 === 3) ? bf : 0; o.sx = Math.cos(ph * TAU); o.dy = -Math.sin(ph * Math.PI) * 2.5 - ab; o.aL = o.aR = .3 + ph; o.sq = hit * .1; break; }
    case 'wave': o.dy = -ab * .8; o.aL = 1.1 + .5 * Math.sin(bp * TAU * 2); o.aR = -1.1; o.sq = hit * .08; break;
    case 'walk': o.walk = bp / 2; o.dy = -ab * .4; o.aL = -1.1 + .5 * s1; o.aR = -1.1 - .5 * s1; break;
    case 'run': o.walk = bp * .75; o.dy = -Math.abs(Math.sin(bp * TAU)) * .8; o.aL = -.6 + .9 * Math.sin(bp * TAU * .75); o.aR = -.6 - .9 * Math.sin(bp * TAU * .75); o.rot = -.06; break;
    case 'idle': o.dy = -ab * .4; o.sq = hit * .05; break;
    case 'stomp': o.dy = -Math.max(0, Math.sin(bp * TAU)) * 1.2; o.sq = hit * .2; o.rot = (bi % 2 ? 1 : -1) * .06 * hit; o.aL = o.aR = -.5 + hit * 1.2; break;
    case 'shimmy': o.dx = Math.sin(bp * TAU * 2) * .4; o.rot = Math.sin(bp * TAU * 2) * .06; o.aL = .6 + .4 * Math.sin(bp * TAU * 2); o.aR = .6 - .4 * Math.sin(bp * TAU * 2); o.dy = -ab * .5; break;
    case 'clap': o.dy = -ab * .8; o.sq = hit * .1; o.aL = o.aR = hit > .5 ? .35 : .9; break;
  }
  return o;
}
function famDancer(kind, x, y, u, style, t, extra = {}) { const m = move(style, t, extra.seed || 0); return fam(kind, x + m.dx * u, y, u, { ...m, ...extra }); }

// 只画一个头（特写、躺床、插卡用）。(x, y) 为头中心，R 为头半径。
function famHead(kind, x, y, R, o = {}) {
  const sw = clamp(R / 2.7 / 14, .5, 2.6), sq = (o.sq || 0) + (o.take || 0);
  const skin = o.red ? mixCol(PAL.skin, '#EE6A5A', o.red) : PAL.skin;
  push(); translate(x, y + (o.dy || 0)); if (o.rot) rotate(o.rot); scale(1 + sq * .6, 1 - sq);
  head(kind, R, o, sw, skin, c => o.sil || c, o.sil ? null : PAL.ink);
  pop();
  if (o.emote) emote(o.emote, x + R * 1.15, y - R * .95, R * .42, o.emoteK ?? 1);
}
