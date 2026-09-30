// c08_thanks：副歌 4「爸爸辛苦啦」（第 181 – 206 拍）。先催泪，再欢乐爆发。暖橙灯光 + 玫瑰粉。
// 镜头：踮脚端蛋糕 · 画弹开、爸爸感动落泪 · 扑进怀里（爱心每拍炸开）· 抛高高 · 幸福值涨满爆开 · 一起吹蜡烛
(() => {
  const warm = t => {
    room(t, { wall: '#F9D3B4', pattern: 'hearts', floor: '#B98559' });
    windowProp(1450, 150, 300, 240, { night: true, curtainCol: PAL.rose });
    glow(260, 360, 440, '#FFE3A0', 90);
    paint(rectPts(250, 250, 12, 570), { wash: '#6B5A50', ink: PAL.ink, sw: .8 });
    paint([[180, 250], [330, 250], [300, 170], [210, 170]], { wash: '#FFE3A0', ink: PAL.ink, sw: .9 });
  };

  function surprise(t, lt, dur) {
    camBegin(960, 560, 1.3);
    warm(t);
    sofa(560, 640, 800, '#D9826A');
    fam('dad', 960, 760, 24, { sit: true, eyes: 'closed', mouth: 'o', aL: -1, aR: -1, headRot: .3, noShadow: true });
    for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) / 2 + i / 3); letter('z', 1060 + ph * 80, 420 - ph * 140, 34 + ph * 20, PAL.indigo, { alpha: 1 - ph, ink: false }); }
    // 两个娃踮着脚一拍一步走进来，一个端蛋糕、一个藏着画
    const k = seg(t, B(181), B(185));
    const step = hopB(t);
    fam('boy', lerp(-120, 420, k), 830, 22, { walk: bpOf(t) / 2, dy: -step * .8, aL: .2, aR: .2, eyes: 'look', lookX: 1, mouth: 'cat', armsBehind: false,
      handL: (u, sw) => cake(u * 1.2, u * .3, u / 22 * .7, 1) });
    fam('girl', lerp(-320, 220, k), 830, 21, { walk: bpOf(t) / 2 + .5, dy: -hopB(t, 1, .5) * .8, aL: -1.4, aR: -1.4, armsBehind: true, eyes: 'sparkle', mouth: 'cat' });
    camEnd();
    letter('嘘——', 420, 200, 80, PAL.violet, { pop: seg(lt, .4, .7), stroke: PAL.cream });
  }

  function card(t, lt, dur) {
    // 画“啪”地弹开（第 185 拍），爸爸愣住，然后感动落泪（慢慢推近）
    sunburst(960, 560, '#FFE3C8', '#FBD1B0', t * .1, 16, 2400, 110);
    const open = seg(t, B(185), B(185) + .35);
    kidDrawing(640, 500, 1.6, -.04, open);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t, r = 460 + Math.sin(t * 3 + i) * 30; paint(starPts(640 + Math.cos(a) * r, 500 + Math.sin(a) * r * .7, 18 * open, .4, 4), { wash: PAL.ochre, ink: null }); }
    const z = lerp(1, 1.25, ease(lt / dur));
    camBegin(1480, 600, z);
    famHead('dad', 1480, 600, 230, { ...mood(t, [[B(185), 'wide', 'o', '!'], [B(186) + .3, 'moved', 'wobble', 'heart']]), blush: true });
    camEnd();
  }

  function hug(t, lt, dur) {
    camBegin(960, 520, 1.35 * punch(t, .03));
    warm(t);
    sofa(560, 640, 800, '#D9826A');
    const leap = seg(t, B(189) + .3, B(190));
    // 爱心每拍从中间炸开一圈
    if (leap >= 1) { const ph = frac(bpOf(t)); for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + beatN(t) * .3; paint(heartPts(960 + Math.cos(a) * (120 + ph * 520), 420 + Math.sin(a) * (80 + ph * 330), 30 + (i % 2) * 14), { wash: i % 2 ? '#E0506E' : '#F28BA8', washOp: 240 * (1 - ph), ink: PAL.ink, sw: .6 }); } }
    fam('dad', 960, 760, 26, { sit: true, eyes: leap >= 1 ? 'moved' : 'happy', mouth: 'grin', aL: leap >= 1 ? .5 : .9, aR: leap >= 1 ? .5 : .9, noShadow: true, blush: true });
    const bx = lerp(300, 860, easeOut(leap)), gx = lerp(1640, 1060, easeOut(leap)), hy = Math.sin(leap * Math.PI) * 200;
    fam('boy', bx, 730 - hy, 21, { eyes: 'happy', mouth: 'grin', aL: 1.2, aR: .6, rot: leap < 1 ? .3 : .15, noShadow: true });
    fam('girl', gx, 730 - hy, 20, { eyes: 'happy', mouth: 'grin', aL: .6, aR: 1.2, rot: leap < 1 ? -.3 : -.15, flip: true, noShadow: true });
    camEnd();
    if (leap >= 1) sfx('爸爸最棒！', 960, 150, 100, '#E0506E', t - B(190), { life: 2.5 });
  }

  function toss(t, lt, dur) {
    // 抛高高：一拍抛哥哥，下一拍抛妹妹
    sunburst(960, 900, '#FFD6E0', '#FFB6C9', t * .3, 18);
    camBegin(960, 520, 1.05);
    paint(rectPts(-100, 860, W + 200, 400), { wash: '#D9A874', ink: PAL.ink, sw: 1 });
    const bi = beatN(t), f = frac(bpOf(t)), boyUp = bi % 2 === 0;
    fam('dad', 960, 960, 30, { eyes: 'happy', mouth: 'grin', aL: 1.25 - (1 - f) * .3, aR: 1.25 - (1 - f) * .3, blush: true, sq: pulse(t, 8) * .08 });
    for (const [k, me] of [['boy', true], ['girl', false]]) {
      const up = me === boyUp, h = up ? Math.sin(f * Math.PI) * 460 : 0, x = me ? 840 : 1080;
      fam(k, x, 450 - h, 21, { eyes: up ? 'happy' : 'sparkle', mouth: 'grin', aL: 1.3, aR: 1.3, rot: up ? f * TAU * .5 * (me ? 1 : -1) : 0, noShadow: true, legSpread: .3 });
    }
    camEnd();
    confetti(t, 21, 40);
    sfx(boyUp ? '飞咯！' : '再来！', boyUp ? 600 : 1320, 220, 90, boyUp ? PAL.boy : PAL.girlDk, f * BEAT, { life: .7 });
  }

  function meterBurst(t, lt, dur) {
    METER_SHOWN = true;
    sunburst(960, 560, '#FFC9D6', '#F7A8BC', t * .6, 20);
    const { v } = meterAt(t), burst = seg(t, B(200), B(200) + .5);
    push(); translate(960, 110); scale(1.6 * (1 + .04 * pulse(t, 6)));
    if (burst < 1) {
      paint(rrPts(-60, 20, 120, 420, 60, 2), { wash: PAL.cream, ink: PAL.ink, sw: 1.6 });
      const hh = 390 * v / 100; if (hh > 20) paint(rrPts(-38, 40 + 390 - hh, 76, hh, 30), { wash: '#E0506E', ink: null });
      paint(ellPts(0, 500, 90, 90, 22, 2), { wash: '#E0506E', ink: PAL.ink, sw: 1.6 });
      paint(heartPts(0, 500, 44), { wash: PAL.cream, ink: null });
    }
    pop();
    if (burst > 0) for (let i = 0; i < 24; i++) { const a = hash(i) * TAU, d = easeOut(burst) * (300 + hash(i + 7) * 600); paint(heartPts(960 + Math.cos(a) * d, 560 + Math.sin(a) * d * .7, 30 + hash(i + 3) * 30), { wash: i % 2 ? '#E0506E' : '#F28BA8', washOp: 255 * (1 - seg(burst, .7, 1)), ink: PAL.ink, sw: .7 }); }
    letter('幸福值', 960, 80, 70, PAL.cream, { stroke: '#A8324E' });
    letter(burst > 0 ? '爆表啦！！' : `${Math.round(v)}%`, 960, 960, burst > 0 ? 140 : 110, '#E0506E', { stroke: PAL.cream, pop: burst > 0 ? burst * 3 : undefined });
    // 三个人的头在两边跟着拍子晃
    famHead('boy', 300, 700 - hopB(t) * 40, 130, { eyes: 'sparkle', mouth: 'grin' });
    famHead('dad', 1560, 640 - hopB(t, 1, .5) * 30, 150, { eyes: 'happy', mouth: 'grin', blush: true });
    famHead('girl', 1760, 820 - hopB(t) * 40, 110, { eyes: 'heart', mouth: 'grin' });
  }

  function candles(t, lt, dur) {
    // 一起吹蜡烛：第 204 拍一口气吹灭，灯暗一下，然后彩纸炸开
    const blow = t > B(204), dark = seg(t, B(204), B(204) + .2) * (1 - seg(t, B(205), B(205) + .3));
    camBegin(960, 560, lerp(1.2, 1.35, ease(lt / dur)));
    warm(t);
    table(460, 700, 1000, '#C98A5A');
    cake(960, 690, 1.3, blow ? 0 : 1);
    const lean = blow ? 0 : seg(t, B(203), B(204)) * .15;
    fam('dad', 960, 900, 25, { eyes: 'happy', mouth: blow ? 'grin' : 'o', aL: -1, aR: -1, rot: 0, sq: -lean });
    fam('boy', 620, 830, 21, { eyes: 'happy', mouth: blow ? 'grin' : 'o', aL: .9, aR: blow ? 1.3 : .3, rot: lean });
    fam('girl', 1300, 830, 21, { eyes: 'sparkle', mouth: blow ? 'grin' : 'o', aL: blow ? 1.3 : .3, aR: .9, rot: -lean, flip: true });
    if (!blow && lt > .4) letter('一、二、三——', 960, 200, 80, PAL.violet, { stroke: PAL.cream, pop: seg(lt, .4, .7) });
    camEnd();
    if (dark > 0) flash(dark * .55, PAL.night);
    if (t > B(205)) { confetti(t, 33, 60); sfx('爸爸，我们爱你！', 960, 180, 90, '#E0506E', t - B(205), { life: 2 }); }
    if (blow && t < B(205)) sfx('呼——！', 960, 380, 110, PAL.sky, t - B(204));
  }

  chapter('thanks', B(181), B(206), [[B(181), surprise], [B(185), card], [B(189), hug], [B(193), toss], [B(197), meterBurst], [B(201), candles]]);
})();
