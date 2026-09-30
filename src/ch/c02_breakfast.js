// c02_breakfast：副歌 1「早餐大战」（第 33 – 56 拍）。奶黄 + 薄荷绿厨房。
// 镜头：颠勺翻蛋 · 勺子打鼓 · 慢动作打翻牛奶→奶浪 · 爸爸滑倒转圈 · 煎饼满天飞 · 锅碗瓢盆舞
(() => {
  const kitchen = (t, o = {}) => {
    room(t, { wall: '#FFF0C9', pattern: 'stripes', floor: '#D9A874' });
    windowProp(1420, 140, 320, 260, { sky: '#CDEBF5', curtainCol: PAL.sap });
    counter(-40, 560, 760);
    paint(rrPts(120, 470, 200, 70, 20), { wash: '#4A4450', ink: PAL.ink, sw: .8 });   // 灶
    for (let i = 0; i < 3; i++) paint(ellPts(90 + i * 130, 130, 40, 30, 12), { wash: [PAL.rose, PAL.ochre, PAL.teal][i], ink: PAL.ink, sw: .8 });   // 墙上的锅
  };

  function flip(t, lt, dur) {
    camBegin(820, 470, 1.55 * punch(t, .03));
    kitchen(t);
    table(820, 640, 760);
    // 两个娃坐在桌边，勺子一拍一敲
    for (const [k, x, lag] of [['boy', 1000, 0], ['girl', 1380, .5]]) {
      const sw = swingB(t, 1, lag);
      fam(k, x, 800, 19, { aL: -.4, aR: .1 + sw * .6, eyes: 'happy', mouth: 'grin', handR: spoon, dy: -hopB(t, 1, lag) * .5 });
    }
    plate(1000, 626, .9); plate(1380, 626, .9, 'pancake');
    // 爸爸颠勺：蛋两拍翻一次，在拍点落回锅里
    const ph = frac(bpOf(t) / 2), up = 4 * ph * (1 - ph);
    fam('dad', 520, 820, 24, { apron: true, aL: .15, aR: -.9 + up * .6, eyes: 'happy', mouth: 'grin', handL: (u, sw) => pan(u, sw), dy: -hopB(t) * .4 });
    const a = .15, u = 24, shx = 520 - SPEC.dad.sh * u, shy = 820 - (SPEC.dad.leg + SPEC.dad.bodyH) * u + u * .7;
    const ex = shx - Math.cos(a) * (SPEC.dad.arm + 3.6) * u, ey = shy - Math.sin(a) * (SPEC.dad.arm + 3.6) * u - 14;
    egg(ex, ey - up * 330, 1.1, ph * TAU);
    if (ph < .25) sfx('滋滋~', ex, ey - 60, 60, PAL.clay, ph * 2 * BEAT, { life: .5 });
    camEnd();
  }

  function drums(t, lt, dur) {
    sunburst(960, 700, '#FFE3A0', '#FFD27A', bpOf(t) * .08, 16);
    table(160, 700, 1600, '#E3A657');
    for (const [k, x, lag] of [['boy', 620, 0], ['girl', 1300, .5]]) {
      const hitK = Math.exp(-frac(bpOf(t) + lag) * 6), sw = swingB(t, 1, lag);
      famHead(k, x, 450 - hopB(t, 1, lag) * 30, 150, { eyes: lag ? 'closed' : 'happy', mouth: 'grin', sq: hitK * .08 });
      // 碗，被敲时跳一下
      const bx = x + (lag ? -230 : 230);
      paint(ellPts(bx, 690 - hitK * 30, 120, 34, 18), { wash: lag ? PAL.rose : PAL.sky, ink: PAL.ink, sw: 1.2 });
      paint([[bx - 120, 690 - hitK * 30], [bx + 120, 690 - hitK * 30], [bx + 80, 760 - hitK * 30], [bx - 80, 760 - hitK * 30]], { wash: lag ? PAL.rose : PAL.sky, ink: PAL.ink, sw: 1.2 });
      push(); translate(bx + (lag ? 60 : -60), 560 - sw * 70); rotate((lag ? -1 : 1) * (.6 + sw * .5));
      paint(rectPts(-12, -140, 24, 170), { wash: '#C9C4CF', ink: PAL.ink, sw: 1 }); blob(0, -150, 34, 26, '#C9C4CF', { sw: 1 });
      pop();
      if (hitK > .6) for (let i = 0; i < 3; i++) emote('music', bx + (i - 1) * 90, 560 - (1 - hitK) * 200 - i * 20, 28, 1);
    }
    const age = frac(bpOf(t)) * BEAT;
    sfx(beatN(t) % 2 ? '哒！' : '咚！', beatN(t) % 2 ? 1560 : 360, 250, 110, '#E0574A', age, { life: .5 });
  }

  function milk(t, lt, dur) {
    // 慢动作：杯子在桌边晃，第 41 拍被胳膊肘碰到，倒下；第 42 拍奶浪扫过整个画面
    const tip = seg(t, B(41), B(42)), [sx, sy] = shakeXY(t, 4);
    camBegin(980 + sx * tip, 560 + sy * tip, 2.1 - tip * .3);
    kitchen(t);
    table(600, 640, 900);
    cup(990 + tip * 60, 626, 1.4, easeIn(tip) * 1.5);
    if (tip > .5) paint(ellPts(1090 + tip * 80, 632, 60 + tip * 90, 12, 14), { wash: '#FBF8F1', ink: PAL.ink, sw: .6 });
    // 妹妹的胳膊肘从右边伸进来
    const el = seg(t, B(40) + .3, B(41));
    fam('girl', 1330 - el * 60, 820, 24, { aL: .2 + el * .3, aR: -1, eyes: tip > .1 ? 'wide' : 'look', lookX: -1, mouth: tip > .1 ? 'O' : 'cat' });
    camEnd();
    if (tip > 0 && tip < 1) letter('慢——动——作', 960, 110, 60, PAL.violet, { alpha: .8, stroke: PAL.cream });
    const wk = seg(t, B(42), B(43));
    milkWave(wk, t);
    if (wk > 0) sfx('哗——！', 900, 480, 200, PAL.sky, t - B(42), { life: 1, stroke: PAL.ink });
  }

  function slip(t, lt, dur) {
    // 爸爸冲进来，第 44 拍踩到牛奶，转两拍，第 46 拍啪叽落地
    const run = seg(t, B(43), B(44)), air = seg(t, B(44), B(46)), [sx, sy] = shakeXY(t, 22 * pulse(t, 10) * (t > B(46) ? 1 : 0));
    camBegin(960 + sx, 560 + sy, 1.3, t > B(44) && t < B(46) ? Math.sin(air * Math.PI) * .12 : 0);
    kitchen(t);
    paint(ellPts(980, 850, 520, 60, 24, 8), { wash: '#FBF8F1', ink: PAL.ink, sw: .8 });   // 地上一滩奶
    const x = t < B(44) ? lerp(200, 900, run) : t < B(46) ? lerp(900, 1100, air) : 1120;
    if (t < B(44)) fam('dad', x, 820, 24, { apron: true, walk: bpOf(t) * .75, rot: .1, eyes: 'normal', mouth: 'smile', aL: -.3, aR: .3 });
    else if (t < B(46)) {
      const h = Math.sin(air * Math.PI) * 420;
      push(); translate(x, 700 - h); rotate(air * TAU * 1.5); translate(-x, -(700 - h));
      fam('dad', x, 820 - h, 24, { apron: true, eyes: 'wide', mouth: 'scream', aL: 1.3, aR: 1.1, hairUp: 1, noShadow: true, legSpread: .6 });
      pop();
      egg(x - 300 + air * 200, 300 - Math.sin(air * Math.PI) * 200, 1.3, air * 9);
      push(); translate(x + 260, 260 + air * 100); rotate(air * 10); pan(24, 1.2); pop();
    } else {
      fam('dad', x, 860, 24, { apron: true, rot: -Math.PI / 2 + .05, eyes: 'swirl', mouth: 'wobble', aL: 1, aR: .8, noShadow: true, sq: pulse(t, 10) * .15 });
      egg(x - 500, 780, 1.3, .3);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t * 5; paint(starPts(x - 360 + Math.cos(a) * 110, 640 + Math.sin(a) * 30, 22, .4, 5), { wash: PAL.ochre, ink: PAL.ink, sw: .6 }); }
      sfx('啪叽！', x - 200, 480, 140, '#E0574A', t - B(46), { life: 1.2 });
    }
    if (t < B(44) + .2 && t > B(44) - .05) sfx('哧溜～', 900, 380, 110, PAL.teal, t - B(44) + .05);
    // 两个娃在旁边笑
    for (const [k, x2, lag] of [['boy', 1580, 0], ['girl', 1760, .5]]) fam(k, x2, 820, 20, { eyes: 'happy', mouth: 'grin', aL: .3 + hopB(t, 1, lag) * .8, aR: -.8, dy: -hopB(t, 1, lag) * 1.2, flip: true });
    camEnd();
  }

  function fight(t, lt, dur) {
    camBegin(960, 500, 1.45 * punch(t, .04));
    kitchen(t);
    table(360, 700, 1200);
    fam('boy', 360, 820, 22, { eyes: 'happy', mouth: 'grin', aL: -.6, aR: .6 + swingB(t) * .7 });
    fam('girl', 1560, 820, 22, { eyes: 'sparkle', mouth: 'grin', aL: .6 + swingB(t, 1, 1) * .7, aR: -.6, flip: true });
    // 煎饼：每拍从一边飞到另一边，一左一右交替
    const bi = beatN(t), f = frac(bpOf(t)), dir = bi % 2 ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const k = clamp(f * 1.2 - i * .1), x = dir > 0 ? lerp(420, 1500, k) : lerp(1500, 420, k), y = 520 - Math.sin(k * Math.PI) * (260 + i * 60);
      push(); translate(x, y); rotate(k * TAU * dir);
      paint(ellPts(0, 0, 60, 22, 14), { wash: '#E3A657', ink: PAL.ink, sw: .9 }); paint(ellPts(0, -4, 40, 10, 10), { wash: '#F1C98A', ink: null });
      pop();
    }
    // 爸爸在中间躲，头顶一个煎蛋
    const duck = hopB(t);
    fam('dad', 960, 820, 24, { apron: true, dy: duck * 1.5, sq: -duck * .1 + pulse(t, 9) * .12, eyes: bi % 4 < 2 ? 'wide' : 'x', mouth: 'O', aL: 'head', aR: 'head', emote: 'sweat', emoteK: 1,
      draw: (u, sw) => { egg(0, -5.8 * u - 4.6 * u - 2.35 * u * .55 - 2.75 * u * 1.5, 1, .2); } });
    sfx(bi % 2 ? '嗖！' : '啪！', dir > 0 ? 1300 : 620, 250, 90, '#E0574A', f * BEAT, { life: .6 });
    camEnd();
  }

  function dance(t, lt, dur) {
    sunburst(960, 560, '#FFD27A', '#FFB65C', bpOf(t) * .1, 18);
    const z = 1 + .05 * pulse(t, 6);
    camBegin(960, 560, z);
    paint(rectPts(-100, 820, W + 200, 400), { wash: '#D9A874', ink: PAL.ink, sw: 1 });
    famDancer('boy', 440, 960, 36, 'hop', t, { eyes: 'happy', mouth: 'grin', handR: spoon });
    famDancer('dad', 960, 980, 40, 'mix', t, { apron: true, eyes: 'happy', mouth: 'grin', handL: (u, sw) => pan(u, sw), seed: 2 });
    famDancer('girl', 1480, 960, 36, 'hop', t + BEAT / 2, { eyes: 'sparkle', mouth: 'grin', handL: spoon });
    camEnd();
    confetti(t, 11, 30);
    const age = frac(bpOf(t)) * BEAT;
    if (beatN(t) % 2 === 0) sfx(['叮！', '当！', '咚！'][Math.floor(beatN(t) / 2) % 3], 240 + (beatN(t) % 3) * 700, 200, 90, '#E0574A', age, { life: .6 });
  }

  chapter('breakfast', B(33), B(56), [[B(33), flip], [B(37), drums], [B(40), milk], [B(43), slip], [B(47), fight], [B(51), dance]]);
})();
