// c06_explode：副歌 3「七窍生烟」（第 140 – 160 拍）。警报红 + 蒸汽白，全片最炸的一段。
// 镜头：火山喷发 · 烧开的水壶 · 巨人爸爸每拍跺脚 · “对不起”牌子让他定格 · 漏气气球满屋乱飞 · 笑成一团，蒸汽变爱心
(() => {
  function volcano(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 26 * pulse(t, 5));
    sunburst(960 + sx, 620 + sy, '#FF8A6A', '#D8394E', t * 1.2, 22);
    camBegin(960 + sx, 560 + sy, 1.05 + .08 * pulse(t, 6));
    // 三根巨大的蒸汽柱，每拍喷一股
    const hx = 960, hy = 640, R = 260;
    for (const [dx, dy, ang] of [[0, -1, -Math.PI / 2], [-1, 0, Math.PI + .5], [1, 0, -.5]]) {
      for (let i = 0; i < 6; i++) {
        const ph = frac(bpOf(t) + i / 6), d = R * (1 + ph * 3.2), x = hx + dx * R * .9 + Math.cos(ang) * (d - R), y = hy + dy * R * .95 + Math.sin(ang) * (d - R);
        blob(x, y, 70 + ph * 150, 60 + ph * 120, '#FBF8F2', { op: 255 * (1 - ph * .7), sw: 1.2 * (1 - ph) });
      }
    }
    famHead('dad', hx, hy, R * (1 + .06 * pulse(t, 7)), { eyes: 'angry', mouth: 'scream', red: .9, hairUp: 1, sq: pulse(t, 8) * .08 });
    emote('anger', hx + R * .75, hy - R * .7, 90, .8 + .2 * pulse(t, 6));
    camEnd();
    const k = seg(t, B(140), B(140) + .2);
    letter('七窍生烟！', 960, 160, 170 * lerp(2.2, 1, k * k) * (1 + .08 * pulse(t)), '#FFE36A', { alpha: k, stroke: '#7A1C2B', rot: -.05 });
    flash(.7 * (1 - seg(lt, 0, .15)), '#FFFFFF');
  }

  function kettle(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 14 * pulse(t, 5));
    camBegin(960 + sx, 520 + sy, 1.25);
    room(t, { wall: '#F4C0A8', pattern: 'stripes', floor: '#B98559' });
    // 风：横向的风线把一切往右吹
    for (let i = 0; i < 14; i++) { const y = 150 + hash(i) * 650, ph = frac(bpOf(t) * 2 + hash(i + 3)); inkLine([[700 + ph * 1400, y], [900 + ph * 1400, y + 6]], 2, PAL.cream, 'inkfine', .3); }
    const h = fam('dad', 520, 860, 30, { eyes: 'angry', mouth: 'O', red: .85, aL: .2, aR: .2, sx: 1 + pulse(t, 8) * .08, sy: 1 - pulse(t, 8) * .05, hairUp: 1 });
    // 头顶的壶嘴 + 喷射的蒸汽
    push(); translate(h.hx + h.R * .3, h.hy - h.R * .9); rotate(.6);
    paint(rrPts(-24, -110, 48, 110, 20), { wash: PAL.skin, ink: PAL.ink, sw: 1.1 });
    pop();
    for (let i = 0; i < 8; i++) { const ph = frac(bpOf(t) * 2 + i / 8); blob(h.hx + h.R * .8 + ph * 900, h.hy - h.R * 1.4 - ph * 120 + Math.sin(ph * 8) * 30, 40 + ph * 70, 30 + ph * 50, '#FBF8F2', { op: 255 * (1 - ph), sw: .8 * (1 - ph) }); }
    // 两个娃的头发和衣服被吹得往后飘，脚快离地了
    for (const [k, x, lag] of [['boy', 1220, 0], ['girl', 1520, .3]]) {
      const lift = .5 + .5 * Math.sin((bpOf(t) + lag) * Math.PI);
      fam(k, x, 860 - lift * 40, 23, { rot: .35 + lift * .15, aL: .8, aR: -.2, eyes: 'wide', mouth: 'O', hairUp: 1, flip: true, lookX: -1 });
    }
    camEnd();
    sfx('呜呜呜——！', 960, 150, 130, '#E0574A', lt, { life: dur + .2, rot: Math.sin(t * 25) * .04 });
  }

  function giant(t, lt, dur) {
    // 低机位：巨人爸爸每拍跺一脚，玩具都被震飞，两个娃在脚边乱跑
    const stomp = pulse(t, 6), [sx, sy] = shakeXY(t, 30 * stomp);
    camBegin(960 + sx, 600 + sy, 1, (beatN(t) % 2 ? 1 : -1) * .03 * stomp);
    room(t, { wall: '#F4B7A0', pattern: 'dots', floor: '#B98559', floorY: 900 });
    const h = famDancer('dad', 960, 1060, 58, 'stomp', t, { eyes: 'angry', mouth: 'teeth', red: .85, hairUp: 1 });
    steam(h.hx, h.hy, h.R, t, 1);
    for (let i = 0; i < 6; i++) {
      const x = 180 + i * 300 + (i > 2 ? 200 : -100), up = hopB(t, 1, .1) * (120 + hash(i) * 120);
      if (i % 3 === 0) block(x, 930 - up, 1.1, [PAL.rose, PAL.sky, PAL.ochre][i % 3], bpOf(t) * (i % 2 ? 1 : -1));
      else if (i % 3 === 1) ball(x, 900 - up, 36, PAL.sky, bpOf(t));
      else robot(x, 960 - up, .7, { rot: Math.sin(bpOf(t) * Math.PI) * .3 });
    }
    // 两个小娃绕着脚跑
    const ph = bpOf(t) * .25;
    for (const [k, off] of [['boy', 0], ['girl', .5]]) { const a = (ph + off) * TAU, x = 960 + Math.cos(a) * 620; fam(k, x, 1000 + Math.sin(a) * 30, 12, { walk: bpOf(t) * .75, flip: Math.sin(a) > 0, eyes: 'wide', mouth: 'scream', aL: 1.3, aR: 1.3 }); }
    camEnd();
    sfx(beatN(t) % 2 ? '咚！' : '轰！', 960, 180, 150, '#7A1C2B', frac(bpOf(t)) * BEAT, { life: .6, stroke: PAL.ochre });
  }

  function sorry(t, lt, dur) {
    // 第 150 拍：两个娃跪着举起“对不起”和一朵小花；第 151 拍爸爸一只脚悬在半空，定住
    const frozen = t > B(151);
    camBegin(960, 540, frozen ? 1.3 : 1.15);
    room(t, { wall: '#F4B7A0', pattern: 'dots', floor: '#B98559' });
    const h = fam('dad', 1260, 830, 30, { eyes: frozen ? 'wide' : 'angry', mouth: frozen ? 'o' : 'teeth', red: frozen ? .5 : .85, legSpread: frozen ? .7 : 0, dy: frozen ? -1 : -hopB(t) * 1.5,
      aL: 1.1, aR: 1.1, sq: frozen ? 0 : pulse(t, 8) * .1 });
    if (!frozen) steam(h.hx, h.hy, h.R, t, 1);
    const up = backOut(seg(t, B(150), B(150) + .3));
    fam('boy', 520, 840, 22, { sit: true, eyes: 'sparkle', mouth: 'wobble', aL: .9 + up * .4, aR: .9 + up * .4 });
    fam('girl', 760, 840, 21, { sit: true, eyes: 'sparkle', mouth: 'wobble', aL: .8, aR: 1.3 * up,
      handR: (u, sw) => { inkLine([[0, 0], [u * 2, -u * .5]], sw, PAL.sap, 'ink', 0); for (let i = 0; i < 5; i++) blob(u * 2.3 + Math.cos(i * TAU / 5) * u * .5, -u * .6 + Math.sin(i * TAU / 5) * u * .5, u * .35, u * .35, PAL.rose, { sw: sw * .4 }); blob(u * 2.3, -u * .6, u * .25, u * .25, PAL.ochre, { sw: sw * .3 }); } });
    // 牌子
    if (up > 0) {
      push(); translate(520, 840 - 22 * 10 - 150 * up); rotate(-.05);
      paint(rectPts(-190, -90, 380, 180, 2), { wash: PAL.cream, ink: PAL.ink, sw: 1.3 });
      pop();
      letter('对不起', 520, 840 - 22 * 10 - 150 * up, 90 * up, '#D8394E', { ink: false, rot: -.05 });
    }
    if (frozen) { letter('……', 1260, 250, 120, PAL.ink, { pop: seg(t, B(151), B(151) + .3), stroke: PAL.cream }); flash(.4 * (1 - seg(t, B(151), B(151) + .15))); }
    camEnd();
  }

  function deflate(t, lt, dur) {
    // 漏气气球：越来越小，满屋乱飞，最后瘪在地上
    camBegin(960, 540, 1.1);
    room(t, { wall: mixCol('#F4B7A0', '#F7D2B8', seg(lt, 0, dur)), pattern: 'dots', floor: '#B98559' });
    const k = seg(lt, 0, dur * .8), s = lerp(1, .35, k);
    const path = a => [960 + Math.sin(a * 3.1) * 600, 460 + Math.sin(a * 5.3) * 250];
    const [x, y] = k < 1 ? path(lt * 1.6) : [960, 800];
    if (k < 1) {
      push(); translate(x, y); rotate(lt * 9); scale(s);
      famHead('dad', 0, 0, 170, { eyes: 'swirl', mouth: 'o', red: .6 * (1 - k) });
      pop();
      for (let i = 1; i < 6; i++) { const [px, py] = path(lt * 1.6 - i * .06); blob(px, py, 16 - i * 2, 16 - i * 2, '#FBF8F2', { op: 200 - i * 30, ink: null }); }
      sfx('噗噗噗～', x, y - 200 * s - 60, 80, PAL.violet, frac(lt / (BEAT * 2)) * BEAT * 2, { life: 1 });
    } else {
      fam('dad', 960, 830, 26, { sy: .35, sx: 1.4, eyes: 'x', mouth: 'wobble', aL: .1, aR: .1, noShadow: true });
      sfx('噗叽……', 960, 520, 90, PAL.ink, lt - dur * .8);
    }
    // 两个娃拿手指戳
    fam('boy', 540, 830, 21, { eyes: 'look', lookX: 1, mouth: 'o', aL: -1.1, aR: k < 1 ? .6 : .1 });
    fam('girl', 1380, 830, 21, { eyes: 'look', lookX: -1, mouth: 'o', aL: k < 1 ? .6 : .1, aR: -1.1, flip: true });
    camEnd();
  }

  function laugh(t, lt, dur) {
    sunburst(960, 620, '#FFE7A8', '#FFD27A', t * .3, 18);
    camBegin(960, 560, 1.15 * punch(t, .04));
    // 三个人躺在地上打滚笑，爸爸头顶冒出来的蒸汽变成了爱心
    paint(rectPts(-100, 820, W + 200, 400), { wash: '#D9A874', ink: PAL.ink, sw: 1 });
    const roll = k => Math.sin(bpOf(t) * Math.PI + k) * .35;
    fam('dad', 960, 900, 28, { rot: -Math.PI / 2 + roll(0), eyes: 'happy', mouth: 'grin', aL: .8 + roll(1), aR: .6, noShadow: true, legSpread: .4 });
    fam('boy', 560, 880, 22, { rot: Math.PI / 2 + roll(2), eyes: 'happy', mouth: 'grin', aL: 1.2, aR: .4, noShadow: true });
    fam('girl', 1360, 880, 21, { rot: -Math.PI / 2 + roll(3), eyes: 'happy', mouth: 'grin', aL: .9, aR: 1.2, noShadow: true });
    for (let i = 0; i < 6; i++) { const ph = frac(bpOf(t) / 2 + i / 6); paint(heartPts(700 + i * 50 + Math.sin(ph * 6 + i) * 40, 700 - ph * 560, 22 + ph * 26), { wash: i % 2 ? '#E0506E' : '#F28BA8', washOp: 240 * (1 - ph), ink: PAL.ink, sw: .6 }); }
    camEnd();
    const age = frac(bpOf(t)) * BEAT;
    sfx(['哈！', '哈哈！', '嘻嘻！', '哈哈哈！'][beatN(t) % 4], 300 + (beatN(t) % 4) * 440, 220 + (beatN(t) % 2) * 60, 90, ['#E0574A', PAL.teal, PAL.violet, PAL.ochre][beatN(t) % 4], age, { life: .7 });
  }

  chapter('explode', B(140), B(160), [[B(140), volcano], [B(143), kettle], [B(146), giant], [B(150), sorry], [B(153), deflate], [B(156), laugh]]);
})();
