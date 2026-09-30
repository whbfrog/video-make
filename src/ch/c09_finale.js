// c09_finale：尾声（第 206 拍 – 结束）。先蹦迪，再夕阳，最后爱心收尾。
// 镜头：迪斯科派对（地板每拍变色）· 一字长队舞 · 每拍咔嚓一张合影 · 夕阳下牵手走 · 大拥抱 + 爱心收黑
(() => {
  function disco(t, lt, dur) {
    const bi = beatN(t), cols = [PAL.rose, PAL.ochre, PAL.teal, PAL.violet, PAL.sap, PAL.sky];
    flatMany([[rectPts(-60, -60, W + 120, H + 120), '#2A1F4A', 255]]);
    for (let i = 0; i < 5; i++) spotlight(160 + i * 400, cols[(i + bi) % 6], Math.sin(bpOf(t) * Math.PI / 2 + i * 1.3) * .5, 70 + 50 * pulse(t, 5));
    const tiles = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) tiles.push([rectPts(c * 196 - 20, 840 + r * 90, 192, 86), mixCol(cols[(r + c + bi) % 6], '#2A1F4A', .55 - .45 * pulse(t, 5)), 255]);
    flatMany(tiles);
    const drop = backOut(seg(lt, 0, .5));
    discoBall(960, lerp(-120, 150, drop), 80, t);
    camBegin(960, 560, 1.05 * punch(t, .04));
    const style = ['roof', 'bounce', 'shimmy', 'clap'][Math.floor(bpOf(t) / 4) % 4];
    famDancer('boy', 520, 880, 28, 'hop', t + BEAT / 2, { eyes: 'happy', mouth: 'grin', hat: 'party' });
    famDancer('dad', 960, 900, 34, style, t, { eyes: 'happy', mouth: 'grin', hat: 'party' });
    famDancer('girl', 1400, 880, 28, 'hop', t, { eyes: 'sparkle', mouth: 'grin', hat: 'party' });
    camEnd();
    for (let i = 0; i < 6; i++) { const ph = frac(bpOf(t) / 2 + i / 6); letter('♪', 150 + i * 330, 800 - ph * 600, 60, cols[i], { alpha: 1 - ph, stroke: PAL.cream }); }
  }

  function conga(t, lt, dur) {
    // 一字长队：爸爸领头，后面跟着娃、机器人、小熊，一拍一步从左往右
    sunburst(960, 1000, '#FFE3A0', '#FFC27A', t * .2, 18);
    flat(rectPts(-60, 860, W + 120, 300), '#D9A874');
    const x0 = -200 + (bpOf(t) - bpOf(B(210))) * 150;
    const kick = i => (beatN(t) + i) % 2 ? .35 : -.1;
    famDancer('dad', x0 + 900, 900, 28, 'walk', t, { eyes: 'happy', mouth: 'grin', hat: 'party', aL: .3, aR: .3, rot: .05 });
    famDancer('boy', x0 + 620, 900, 22, 'walk', t + BEAT / 2, { eyes: 'happy', mouth: 'grin', hat: 'party', aL: .1, aR: .1 });
    famDancer('girl', x0 + 400, 900, 21, 'walk', t, { eyes: 'sparkle', mouth: 'grin', hat: 'party', aL: .1, aR: .1 });
    robot(x0 + 190, 900 - hopB(t, 1, .5) * 30, .9, { rot: kick(1) * .3 });
    teddy(x0, 900 - hopB(t) * 30, 1, kick(0) * .4);
    confetti(t, 44, 30);
    sfx('一、二、三、踢！', 960, 180, 90, '#E0574A', frac(bpOf(t) / 4) * BEAT * 4, { life: 1.8 });
  }

  function snapshots(t, lt, dur) {
    // 每拍一声“咔嚓”：定格一个姿势，拍立得照片一张张落进相册
    flat(rectPts(-60, -60, W + 120, H + 120), '#F7E6CF');
    for (let i = 0; i < 40; i++) paint(heartPts(hash(i) * W, hash(i + 3) * H, 14), { wash: '#F2C9C9', washOp: 150, ink: null });
    const n = Math.max(0, beatN(t) - 214);
    const poses = [
      () => { famHead('dad', 0, 20, 70, { eyes: 'happy', mouth: 'grin' }); famHead('boy', -80, -40, 44, { eyes: 'happy', mouth: 'grin' }); famHead('girl', 80, -40, 44, { eyes: 'sparkle', mouth: 'grin' }); },
      () => { famHead('dad', 0, 0, 70, { eyes: 'x', mouth: 'O', hairUp: 1 }); famHead('boy', -85, 50, 40, { eyes: 'happy', mouth: 'grin' }); },
      () => { famHead('girl', -40, 10, 60, { eyes: 'heart', mouth: 'grin' }); famHead('dad', 50, 0, 64, { eyes: 'moved', mouth: 'smile' }); },
      () => { famHead('boy', -60, 0, 56, { eyes: 'happy', mouth: 'cat' }); famHead('girl', 60, 0, 56, { eyes: 'closed', mouth: 'cat' }); }];
    for (let i = 0; i <= Math.min(n, 3); i++) {
      const top = i === n, k = top ? backOut(frac(bpOf(t)) * 2.5) : 1;
      polaroid(420 + i * 370, 520 + (1 - k) * -700, 1.05, (hash(i * 3) - .5) * .35, poses[i]);
    }
    const f = frac(bpOf(t));
    if (f < .12) flash(1 - f / .12, '#FFFFFF');
    sfx('咔嚓！', 1650, 170, 90, PAL.ink, f * BEAT, { life: .6 });
  }

  function sunset(t, lt, dur) {
    flatMany([[rectPts(-60, -60, W + 120, H + 120), '#F4A77A', 255], [rectPts(-60, -60, W + 120, 360), '#B07AA6', 150]]);
    glow(960, 640, 520, '#FFE7A8', 150);
    blob(960, 680, 200, 200, '#FFE7A8', { ink: null });
    flatMany([[[[-60, 700], [300, 600], [700, 690], [1000, 640], [1400, 700], [1980, 620], [1980, 1140], [-60, 1140]], '#C9706A', 255],
      [[[-60, 820], [1980, 800], [1980, 1140], [-60, 1140]], '#7A4658', 255]]);
    heartsRise(t, 5, 10, 180);
    const x = 560 + lt * 90, sil = '#4A2A40';
    const lm = [x - 150, 700 - hopB(t) * 6], rm = [x + 150, 700 - hopB(t) * 6];
    fam('boy', x - 250, 830, 18, { walk: bpOf(t) / 2, sil, aL: -1.2, aR: .3, noShadow: true });
    fam('dad', x, 840, 22, { walk: bpOf(t) / 2, sil, aL: -.6, aR: -.6, noShadow: true });
    fam('girl', x + 250, 830, 18, { walk: bpOf(t) / 2 + .5, sil, aL: .3, aR: -1.2, noShadow: true });
    const lines = [['孩子带来的烦恼很多', 150, 0], ['但快乐，永远更多', 270, 2]];
    for (const [txt, y, b] of lines) { const k = seg(t, B(218 + b), B(218 + b) + .35); if (k > 0) letter(txt, 960, y, 96, PAL.cream, { pop: k, stroke: '#7A3A52' }); }
  }

  function finalHug(t, lt, dur) {
    sunburst(960, 560, '#FFD6E0', '#FFB6C9', t * .15, 18);
    heartsRise(t, 9, 16, 200);
    camBegin(960, 540, lerp(1.1, 1.3, ease(lt / dur)));
    fam('dad', 960, 920, 34, { eyes: 'happy', mouth: 'grin', aL: .5, aR: .5, blush: true, sq: pulse(t, 8) * .04 });
    fam('boy', 760, 780, 25, { eyes: 'happy', mouth: 'grin', aL: 1.1, aR: .4, rot: .12, noShadow: true });
    fam('girl', 1160, 780, 24, { eyes: 'sparkle', mouth: 'grin', aL: .4, aR: 1.1, rot: -.12, flip: true, noShadow: true });
    camEnd();
    letter('—— 致每一位奶爸 ——', 960, 150, 84, '#A8324E', { pop: seg(lt, .3, .7), stroke: PAL.cream });
    const end = seg(t, DUR - 2.2, DUR - .8);
    if (end > 0) irisShape(heartPts(960, 560, lerp(1400, 1, easeIn(end))), PAL.ink);
  }

  chapter('finale', B(206), 999, [[B(206), disco], [B(210), conga], [B(214), snapshots], [B(218), sunset], [B(223), finalHug]]);
})();
