// c05_homework：主歌 3「辅导作业」（第 107 – 140 拍）。薄荷绿书房，越往后颜色越热。
// 这一段是憋火：每个镜头都比上一个更接近爆发，爆发留给下一章副歌。
// 镜头：钟每拍嘀嗒 · 本子上每拍多一笔涂鸦 · 第 1~8 遍计数，脸一遍比一遍红 · 墙上每拍多一道彩虹 · 鼻涕泡一拍一鼓 · 打坐深呼吸却漏气 · 温度计每拍裂一道 · 眼皮抽搐→收黑
(() => {
  const study = (t, heat = 0) => {
    room(t, { wall: mixCol('#D5EEDC', '#F4C0A8', heat), pattern: 'stripes', floor: '#B98559' });
    windowProp(1450, 140, 300, 240, { sky: mixCol('#FCE3B0', '#F2A283', heat), curtainCol: PAL.sap });
    paint(rectPts(80, 160, 300, 660, 2), { wash: PAL.woodDk, ink: PAL.ink, sw: 1 });   // 书架
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) paint(rectPts(100 + i * 38, 190 + r * 160, 30, 120 - hash(i + r * 7) * 30, 1), { wash: [PAL.rose, PAL.sky, PAL.ochre, PAL.sap, PAL.violet][(i + r) % 5], ink: PAL.ink, sw: .5 });
    clock(1180, 230, 70, t, 0);
  };
  const deskAt = (x, y, w) => { desk(x, y, w); };
  const lamp = (x, y) => { paint(rectPts(x - 8, y - 170, 16, 170), { wash: '#6B6F80', ink: PAL.ink, sw: .8 }); paint([[x - 90, y - 170], [x + 60, y - 170], [x + 20, y - 240], [x - 50, y - 240]], { wash: PAL.sap, ink: PAL.ink, sw: .9 }); glow(x - 15, y - 120, 140, '#FFF2B8', 70); };
  const tick = t => { const f = frac(bpOf(t)); if (f < .25) sfx(beatN(t) % 2 ? '嗒' : '嘀', 1180, 110, 50, PAL.ink, f * BEAT, { life: .4 }); };

  function intro(t, lt, dur) {
    camBegin(960, 520, 1.35);
    study(t);
    fam('boy', 820, 720, 22, { eyes: 'tired', mouth: 'flat', aL: -.3, aR: -.2 });
    deskAt(560, 640, 800); lamp(1250, 640);
    homework(900, 610, .45, -.05);
    fam('dad', 1500, 830, 25, { eyes: 'happy', mouth: 'grin', aL: .35 + pulse(t, 5) * .15, aR: -1.1, flip: true });
    tick(t);
    camEnd();
    letter('来，这题很简单～', 1400, 250, 72, PAL.dad, { pop: seg(lt, .2, .5), stroke: PAL.cream });
  }

  function doodle(t, lt, dur) {
    // 作业本大特写：不写答案，每拍多画一笔火箭
    flat(rectPts(-60, -60, W + 120, H + 120), '#B98559');
    push(); translate(960, 560); rotate(-.04);
    paint(rectPts(-700, -420, 1400, 840, 3), { wash: '#FFFDF6', ink: PAL.ink, sw: 1.4 });
    for (let i = 0; i < 10; i++) inkLine([[-660, -300 + i * 72], [660, -300 + i * 72]], .8, '#A9C5E8', 'inkfine', 0);
    pop();
    letter('37 × 8 = ?', 700, 250, 120, '#D8394E', { rot: -.04 });
    const n = clamp(beatN(t) - 110, 0, 8);
    const strokes = [
      [[1100, 800], [1100, 480]], [[1100, 480], [1180, 380], [1260, 480]], [[1260, 480], [1260, 800]], [[1100, 800], [1260, 800]],
      [[1100, 700], [1020, 830], [1100, 790]], [[1260, 700], [1340, 830], [1260, 790]], [[1140, 830], [1180, 950], [1220, 830]], [[1180, 560], [1180, 580]]];
    for (let i = 0; i < n; i++) inkLine(strokes[i], 3.5, i === 6 ? '#E0574A' : PAL.indigo, 'ink', .4);
    if (n >= 8) for (let i = 0; i < 5; i++) paint(starPts(1400 + i * 60, 400 + hash(i) * 300, 18, .4, 5), { wash: PAL.ochre, ink: PAL.ink, sw: .5 });
    // 铅笔跟着画
    const tip = n > 0 ? strokes[Math.min(n, 8) - 1].slice(-1)[0] : [1100, 800];
    push(); translate(tip[0], tip[1]); rotate(-.6);
    paint(rectPts(0, -14, 300, 28), { wash: PAL.ochre, ink: PAL.ink, sw: .9 }); paint([[0, -14], [0, 14], [-40, 0]], { wash: '#F1D2A6', ink: PAL.ink, sw: .8 });
    pop();
    // 角落里爸爸的笑容在抽搐
    famHead('dad', 300, 820, 150, { eyes: 'happy', mouth: 'teeth', squint: pulse(t, 4) * .6, red: .15 * seg(lt, 0, dur), emote: 'sweat', emoteK: 1, dy: Math.sin(t * 50) * 3 * seg(lt, 1, dur) });
  }

  function tally(t, lt, dur) {
    const n = clamp(beatN(t) - 114, 1, 8), heat = n / 8;
    camBegin(1000, 520, 1.3 + heat * .25);
    study(t, heat * .6);
    fam('boy', 820, 720, 22, { eyes: 'swirl', mouth: 'wobble', aL: -.3, aR: -.2, headRot: Math.sin(bpOf(t) * Math.PI) * .15 });
    deskAt(560, 640, 800);
    homework(900, 610, .45, -.05);
    const m = n >= 7 ? { eyes: 'angry', mouth: 'teeth' } : n >= 4 ? { eyes: 'tired', mouth: 'flat' } : { eyes: 'normal', mouth: frac(bpOf(t) * 2) < .5 ? 'O' : 'o' };
    fam('dad', 1450, 830, 26, { ...m, red: heat * .75, aL: .3 + pulse(t, 5) * .3, aR: -1.1, flip: true, emote: n >= 6 ? 'anger' : n >= 3 ? 'sweat' : null, emoteK: 1, sq: pulse(t, 8) * .05 * heat });
    camEnd();
    const age = frac(bpOf(t)) * BEAT;
    letter(`第 ${n} 遍`, 330, 200, 110 * (1 + .12 * pulse(t, 8)), mixCol(PAL.dad, '#D8394E', heat), { stroke: PAL.cream, rot: -.06 });
    for (let i = 0; i < n; i++) inkLine([[160 + i * 34, 300], [170 + i * 34, 380]], 3, PAL.ink, 'ink', 0);
    if (age < .5) sfx('讲！', 1600, 260, 70, '#D8394E', age, { life: .5 });
  }

  function rainbow(t, lt, dur) {
    camBegin(960, 480, 1.25);
    study(t, .3);
    const n = clamp(beatN(t) - 119, 0, 6), cols = ['#E0574A', '#F29A3A', '#F2D23A', '#6EBF58', '#4F9FE0', '#9A6ED0'];
    for (let i = 0; i < n; i++) { const r = 520 - i * 50; const p = []; for (let k = 0; k <= 24; k++) { const a = Math.PI + k / 24 * Math.PI; p.push([900 + Math.cos(a) * r, 760 + Math.sin(a) * r * .8]); } crayonScribble(p, cols[i], 9); }
    const f = frac(bpOf(t));
    fam('girl', 520 + n * 60, 830, 23, { aL: -1, aR: .6 + Math.sin(f * Math.PI) * 1, eyes: 'happy', mouth: 'grin', dy: -hopB(t) * .8,
      handR: (u, sw) => { paint(rectPts(0, -u * .2, u * 1.6, u * .4), { wash: cols[Math.min(n, 5)], ink: PAL.ink, sw: sw * .5 }); } });
    if (n >= 6) for (let i = 0; i < 4; i++) paint(heartPts(620 + i * 200, 180 + (i % 2) * 40, 26), { wash: PAL.rose, ink: PAL.ink, sw: .6 });
    camEnd();
    // 爸爸在前景一侧，眼角抽动
    famHead('dad', 1700, 900, 190, { eyes: 'wide', mouth: 'flat', red: .35, lookX: -1, emote: 'anger', emoteK: pulse(t, 3) });
    sfx('唰！', 900, 200, 80, cols[Math.min(n, 5)], f * BEAT, { life: .5 });
  }

  function asleep(t, lt, dur) {
    camBegin(900, 560, 1.7);
    study(t, .45);
    deskAt(560, 640, 800);
    homework(930, 620, .5, .1);
    // 哥哥趴在作业本上睡着，鼻涕泡一拍一鼓，第 127 拍啪一声破掉
    famHead('boy', 780, 560, 70, { rot: -1.2, eyes: 'closed', mouth: 'o' });
    const pop = t > B(127), bub = pop ? 0 : .3 + .7 * hopB(t);
    if (!pop) { paint(ellPts(720, 610, 34 * bub + 8, 30 * bub + 8, 18), { wash: '#CFEFFF', washOp: 170, ink: PAL.ink, sw: .6 }); blob(710, 598, 6 * bub + 2, 6 * bub + 2, '#FFFFFF', { ink: null }); }
    else sfx('啪！', 720, 540, 70, PAL.teal, t - B(127), { life: .8 });
    for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) / 2 + i / 3); letter('z', 860 + ph * 90, 480 - ph * 120, 34 + ph * 20, PAL.indigo, { alpha: 1 - ph, ink: false }); }
    // 爸爸的青筋每拍跳一下
    fam('dad', 1220, 830, 26, { eyes: 'angry', mouth: 'teeth', red: .55, aL: -1.2, aR: -1.2, flip: true, emote: 'anger', emoteK: .6 + .4 * pulse(t, 6), sq: pulse(t, 8) * .06 });
    camEnd();
  }

  function zen(t, lt, dur) {
    // 打坐深呼吸（两拍一吸一呼），可耳朵在漏气，越漏越多
    sunburst(960, 560, '#F4D6C8', '#EFC2AE', t * .1, 14, 2400, 120);
    const br = Math.sin(bpOf(t) * Math.PI / 2), leak = seg(lt, 0, dur);
    glow(960, 520, 420 + br * 40, '#FFF3C4', 90);
    const h = fam('dad', 960, 900, 32, { sit: true, legSpread: .8, eyes: 'closed', mouth: 'flat', aL: .15 + br * .15, aR: .15 + br * .15, red: .3 + leak * .4, sx: 1 + br * .05, sy: 1 + br * .04 });
    steam(h.hx, h.hy, h.R, t, leak * .7);
    letter(br > 0 ? '吸——' : '呼——', 960, 170, 90, PAL.teal, { stroke: PAL.cream, alpha: Math.abs(br) });
    letter('深呼吸……冷静……', 960, 1010, 56, PAL.ink, { stroke: PAL.cream });
  }

  function crack(t, lt, dur) {
    // 耐心值温度计：每拍裂一道，最后剩 1%
    sunburst(960, 560, '#F2B8A8', '#E9998A', t * .5, 16);
    const n = clamp(beatN(t) - 132, 0, 5), v = lerp(15, 1, n / 5), [sx, sy] = shakeXY(t, 10 * pulse(t, 7));
    push(); translate(960 + sx, 120 + sy); scale(1.5);
    paint(rrPts(-60, 20, 120, 420, 60, 2), { wash: PAL.cream, ink: PAL.ink, sw: 1.6 });
    const hh = 390 * v / 100; paint(rrPts(-38, 40 + 390 - hh, 76, hh, 30), { wash: '#D8394E', ink: null });
    paint(ellPts(0, 500, 90, 90, 22, 2), { wash: '#D8394E', ink: PAL.ink, sw: 1.6 });
    for (let i = 0; i < n; i++) inkLine([[-60 + hash(i) * 30, 80 + i * 70], [hash(i + 3) * 40 - 10, 110 + i * 70], [60 - hash(i + 5) * 20, 130 + i * 70]], 1.4, PAL.ink, 'ink', 0);
    pop();
    letter('耐心值', 960, 90, 70, PAL.ink, { stroke: PAL.cream });
    letter(`${Math.round(v)}%`, 960, 900, 120, '#D8394E', { stroke: PAL.cream, rot: Math.sin(t * 40) * .03 });
    if (frac(bpOf(t)) < .3) sfx('咔！', 1400, 450, 110, PAL.ink, frac(bpOf(t)) * BEAT, { life: .5, stroke: PAL.cream });
  }

  function eye(t, lt, dur) {
    // 爸爸眼睛大特写：眼皮每拍抽一下，最后圆形收黑（接下一章的爆发）
    flat(rectPts(-60, -60, W + 120, H + 120), mixCol(PAL.skin, '#EE6A5A', .45));
    const tw = pulse(t, 5) * .45;
    paint(ellPts(960, 560, 520, 300 * (1 - tw), 36), { wash: PAL.cream, ink: PAL.ink, sw: 2.4 });
    blob(960 + Math.sin(t * 30) * 10, 560, 170, 170 * (1 - tw), '#3A2B38', { sw: 2 });
    blob(1010, 500, 44, 44 * (1 - tw), PAL.cream, { ink: null });
    for (let i = 0; i < 6; i++) inkLine([[520 + i * 160, 250 - tw * 60], [560 + i * 160, 180 - tw * 60]], 3, PAL.ink, 'ink', 0);
    paint(ellPts(960, 560, 700, 520, 30), { ink: PAL.ink, sw: 3.5, br: 'inkfine' });   // 眼镜
    for (let i = 0; i < 5; i++) inkLine([[300 + i * 40, 200 + hash(i) * 600], [420 + i * 40, 240 + hash(i) * 600]], 2.5, '#D8394E', 'ink', 0);
    const close = seg(t, B(139), B(140) - .02);
    if (close > 0) iris(960, 560, lerp(1300, 0, easeIn(close)), PAL.ink);
  }

  chapter('homework', B(107), B(140), [[B(107), intro], [B(111), doodle], [B(115), tally], [B(120), rainbow], [B(124), asleep], [B(128), zen], [B(133), crack], [B(137), eye]]);
})();
