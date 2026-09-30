// c03_office：主歌 2「居家办公」（第 56 – 86 拍）。淡紫客厅，屏幕蓝光。
// 镜头：开会点头 · 过肩看领导 · 披风超人飞过 · 枕头大战 · 领导看呆 · 回头一秒定格装乖 · 转回去假笑、背后又乱 · 拍下静音键无声尖叫
(() => {
  const living = t => {
    room(t, { wall: '#E6DCF3', pattern: 'hearts', floor: '#B98559' });
    windowProp(1450, 150, 300, 240, { sky: '#CFE8F7', curtainCol: PAL.violet });
    frameProp(180, 170, 200, 150, PAL.rose); frameProp(430, 210, 150, 120, PAL.ochre);
    paint(rrPts(700, 180, 360, 110, 16), { wash: PAL.cream, ink: PAL.ink, sw: 1 });
    letter('会议中 请勿打扰', 880, 235, 44, '#D8394E', { ink: false });
  };
  const deskFront = (x, y) => {   // 爸爸前面的桌子 + 电脑背面
    paint(rectPts(x - 420, y, 840, 36, 2), { wash: PAL.wood, ink: PAL.ink, sw: 1.1 });
    paint(rectPts(x - 390, y + 36, 780, 400), { wash: mixCol(PAL.wood, PAL.ink, .15), ink: PAL.ink, sw: 1 });
    laptop(x - 30, y + 4, .62);
    paint(rrPts(x + 250, y - 70, 60, 70, 10), { wash: PAL.clay, ink: PAL.ink, sw: .9 });   // 咖啡杯
    glow(x, y - 150, 260, '#BFE3F5', 60);
  };

  function meeting(t, lt, dur) {
    camBegin(960, 560, 1.45 * punch(t, .025));
    living(t);
    sofa(1150, 640, 620, PAL.teal);
    const nod = pulse(t, 5);
    fam('dad', 960, 900, 26, { hat: 'headset', eyes: 'normal', mouth: frac(bpOf(t) * 2) < .5 ? 'o' : 'smile', aL: -.5, aR: -.5, headRot: nod * .12, dy: -nod * .3 });
    deskFront(960, 800);
    const age = frac(bpOf(t)) * BEAT;
    if (beatN(t) % 2 === 0) sfx(['嗯嗯！', '好的！', '收到！', '没问题！'][(beatN(t) / 2) % 4], 560, 330, 70, PAL.dad, age, { life: .9 });
    camEnd();
  }

  function screen(t, lt, dur) {
    // 过肩镜头：屏幕上是领导，嘴巴一拍一张
    const z = lerp(1.2, 1.45, ease(lt / dur));
    camBegin(980, 480, z);
    living(t);
    laptop(980, 760, 2.3, s => {
      paint(rectPts(-150 * s, -94 * s, 300 * s, 188 * s), { wash: '#DDEBF5', ink: null });
      boss(0, -10 * s, s * .75, { shock: false });
      if (frac(bpOf(t)) < .5) blob(0, 12 * s, 9 * s, 6 * s, '#8E2A3A', { ink: null });
      letter('第三季度……', 0, -70 * s, 22 * s, PAL.ink, { ink: false, screen: false });
    });
    // 前景：爸爸的后脑勺和肩膀
    paint(rrPts(260, 780, 600, 400, 160), { wash: PAL.dad, ink: PAL.ink, sw: 1.3 });
    blob(560, 690, 190, 180, PAL.hair, { sw: 1.3 });
    blob(740, 700, 38, 50, PAL.skin, { sw: 1 });
    inkLine([[380, 620], [560, 520], [740, 620]], 7, '#3B3B48', 'ink', .6);
    camEnd();
  }

  function superhero(t, lt, dur) {
    camBegin(960, 520, 1.15);
    living(t);
    sofa(1150, 640, 620, PAL.teal);
    // 哥哥披着披风从右往左飞过（第 65 拍起跳，飞两拍）
    const f = seg(t, B(65), B(67)), x = lerp(2000, -200, f), y = 520 - Math.sin(f * Math.PI) * 260;
    if (f > 0 && f < 1) {
      fam('boy', x, y, 22, { cape: true, rot: -1.25, aL: 1.4, aR: -.8, eyes: 'happy', mouth: 'grin', flip: true, noShadow: true });
      speedLines(x + 300, y - 120, 60, 420, 10, PAL.violet, 2, 3);
      sfx('嗖——！', x + 200, y - 260, 90, PAL.violet, t - B(65), { life: 1.2 });
    }
    // 妹妹骑着小熊跟在后面蹦
    const g = seg(t, B(66), B(68));
    if (g > 0) { const gx = lerp(1900, 1200, g), gy = 820 - hopB(t) * 90; teddy(gx, gy + 10, 1.2, Math.sin(bpOf(t) * Math.PI) * .2); fam('girl', gx, gy - 90, 18, { aL: 1.3, aR: 1.3, eyes: 'sparkle', mouth: 'grin', flip: true, noShadow: true, sit: true }); }
    fam('dad', 700, 900, 26, { hat: 'headset', eyes: 'normal', mouth: frac(bpOf(t) * 2) < .5 ? 'o' : 'smile', aL: -.5, aR: -.5, headRot: pulse(t, 5) * .1 });
    deskFront(700, 800);
    camEnd();
  }

  function pillows(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 8 * pulse(t, 8));
    camBegin(960 + sx, 520 + sy, 1.3 * punch(t, .04));
    living(t);
    sofa(560, 640, 800, PAL.teal);
    const bi = beatN(t), boyHits = bi % 2 === 0;
    for (const [k, x, me] of [['boy', 760, true], ['girl', 1160, false]]) {
      const swing = me === boyHits ? 1 - frac(bpOf(t)) : frac(bpOf(t)) * .6;
      fam(k, x, 660 - hopB(t, 1, me ? 0 : .5) * 60, 22, { aL: me ? -.8 : .3 + swing * 1.2, aR: me ? .3 + swing * 1.2 : -.8, flip: !me, eyes: 'happy', mouth: 'grin',
        [me ? 'handR' : 'handL']: (u, sw) => pillow(u * 1.6, 0, u * 3.2, u * 2, .3) });
    }
    feathers(960, 330, B(bi), t, 12, 300, bi);
    sfx(boyHits ? '砰！' : '啪！', boyHits ? 1260 : 640, 240, 110, '#E0574A', frac(bpOf(t)) * BEAT, { life: .6 });
    camEnd();
  }

  function bossSees(t, lt, dur) {
    sunburst(960, 540, '#D8ECF7', '#BFDDF0', t * .3, 16);
    camBegin(960, 540, 1 + .04 * pulse(t, 6));
    laptop(960, 900, 3.4, s => {
      paint(rectPts(-150 * s, -94 * s, 300 * s, 188 * s), { wash: '#DDEBF5', ink: null });
      boss(-60 * s, -5 * s, s * .62, { shock: t > B(73) });
      // 小窗：爸爸的摄像头画面，一个枕头飞进来
      paint(rectPts(40 * s, -80 * s, 100 * s, 72 * s), { wash: '#E6DCF3', ink: PAL.ink, sw: .8 });
      famHead('dad', 90 * s, -40 * s, 22 * s, { eyes: t > B(73) ? 'wide' : 'normal', mouth: t > B(73) ? 'O' : 'smile' });
      const pf = seg(t, B(72) + .3, B(73));
      if (pf > 0) pillow(lerp(160 * s, 90 * s, pf), -50 * s, 40 * s, 22 * s, pf * 3);
    });
    camEnd();
    if (t > B(73)) { sfx('？？？', 960, 170, 150, PAL.violet, t - B(73), { life: 2 }); }
  }

  function freeze(t, lt, dur) {
    // 第 76 拍爸爸猛一回头，两个娃瞬间定格装乖
    const turned = t >= B(76);
    camBegin(960, 520, turned ? 1.35 : 1.2);
    living(t);
    sofa(1150, 640, 620, PAL.teal);
    if (!turned) {
      famDancer('boy', 1250, 780, 22, 'shimmy', t, { eyes: 'happy', mouth: 'grin' });
      famDancer('girl', 1560, 640, 20, 'hop', t, { eyes: 'sparkle', mouth: 'grin' });
      fam('dad', 700, 900, 26, { hat: 'headset', eyes: 'normal', mouth: 'smile', aL: -.5, aR: -.5 });
    } else {
      const m = mood(t, [[B(76), 'angry', 'teeth', 'anger']]);
      fam('boy', 1250, 780, 22, { eyes: 'sparkle', mouth: 'cat', aL: 1.35, aR: -1.3, rot: .15, hat: null, draw: halo });
      fam('girl', 1560, 640, 20, { eyes: 'sparkle', mouth: 'cat', aL: -1.2, aR: 1.3, rot: -.2, draw: halo, sit: true });
      fam('dad', 700, 900, 26, { ...m, hat: 'headset', aL: -.5, aR: -.5, flip: true, red: .4 });
      sfx('……', 1400, 330, 110, PAL.ink, t - B(76) - .3, { life: 2 });
    }
    deskFront(700, 800);
    camEnd();
    if (turned) flash(.5 * (1 - seg(t, B(76), B(76) + .15)));
  }
  const halo = (u, sw) => paint(ellPts(0, -SPEC.boy.leg * u - SPEC.boy.bodyH * u - 5.6 * u, 2 * u, .5 * u, 16), { ink: PAL.ochre, sw: sw * 1.4 });

  function fakeSmile(t, lt, dur) {
    camBegin(960, 520, 1.2 * punch(t, .03));
    living(t);
    sofa(1150, 640, 620, PAL.teal);
    // 背后：乱成一锅粥
    famDancer('boy', 1250, 700, 22, 'hop', t, { eyes: 'happy', mouth: 'grin', cape: true });
    famDancer('girl', 1600, 820, 20, 'spin', t, { eyes: 'sparkle', mouth: 'grin' });
    feathers(1400, 380, B(beatN(t)), t, 8, 240, beatN(t) + 50);
    pillow(1100 + Math.sin(bpOf(t) * Math.PI) * 300, 300 - hopB(t) * 120, 140, 70, bpOf(t));
    // 前景：爸爸假笑
    fam('dad', 700, 900, 26, { hat: 'headset', eyes: 'happy', mouth: 'grin', aL: .1 + .4 * swingB(t), aR: -.5, emote: 'sweat', emoteK: 1, dy: -pulse(t, 6) * .2 });
    deskFront(700, 800);
    camEnd();
    letter('没事没事，您继续！', 700, 180, 80, PAL.dad, { pop: seg(lt, 0, .3), stroke: PAL.cream });
  }

  function mute(t, lt, dur) {
    sunburst(960, 560, '#F5C3C3', '#EFA0A0', t * .4, 18);
    const hit = seg(t, B(84), B(84) + .12);
    camBegin(960, 560, 1 + .08 * pulse(t, 7));
    // 大红静音键
    paint(rrPts(560, 560 + hit * 30, 800, 300, 60), { wash: '#8E1F33', ink: PAL.ink, sw: 1.6 });
    paint(rrPts(560, 500 + hit * 60, 800, 300, 60), { wash: '#D8394E', ink: PAL.ink, sw: 1.6 });
    letter('静 音', 960, 650 + hit * 60, 150, PAL.cream, { stroke: PAL.ink });
    // 巨大的拳头砸下来
    const fy = lerp(-200, 380 + hit * 60, easeIn(seg(t, B(83) + .2, B(84))));
    blob(960, fy, 170, 140, PAL.skin, { sw: 1.6 });
    paint(rrPts(870, fy - 520, 180, 420, 60), { wash: PAL.dad, ink: PAL.ink, sw: 1.4 });
    for (let i = 0; i < 3; i++) inkLine([[880 + i * 60, fy + 40], [900 + i * 60, fy + 100]], 1.2, PAL.ink, 'ink', .4);
    camEnd();
    if (t > B(84)) {
      flash(.6 * (1 - seg(t, B(84), B(84) + .2)));
      speedLines(960, 560, 350, 1300, 30, '#FFFFFF', 3, 7);
      sfx('啪！', 1500, 250, 140, '#E0574A', t - B(84), { life: 1 });
    }
    if (t > B(85)) {   // 静音后：无声尖叫
      famHead('dad', 380, 330, 170, { eyes: 'x', mouth: 'scream', hairUp: 1, red: .5, sq: pulse(t, 8) * .1 });
      sfx('（无声尖叫）', 380, 580, 56, PAL.ink, t - B(85), { life: 1.5 });
    }
  }

  chapter('office', B(56), B(86), [[B(56), meeting], [B(60), screen], [B(64), superhero], [B(68), pillows], [B(72), bossSees], [B(75), freeze], [B(79), fakeSmile], [B(83), mute]]);
})();
