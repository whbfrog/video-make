// c01_morning：前奏 + 主歌 1「清晨」（0 – 第 33 拍）。暖桃色卧室，晨光。
// 镜头：片名每拍砸一个字 · 全家冒头 · 爸爸熟睡 · 娃踮脚溜进来 · 床上蹦蹦蹦 · 闹钟狂响 · 爸爸炸毛惊醒 · 拖着两个娃出门
(() => {
  const BED_Y = 610;

  function title(t, lt) {
    sunburst(960, 560, '#FFD9A0', '#FFC27A', bpOf(t) * .05, 18);
    confetti(t, 3, 30, 200);
    const chars = ['奶', '爸', '日', '记'];
    chars.forEach((c, i) => {
      const age = t - B(i);
      if (age < 0) return;
      const k = backOut(age / .3), x = 960 + (i - 1.5) * 250, y = 470 + (i % 2 ? 18 : -12);
      paint(burstPts(x, y, 150 * k * (1 + .06 * pulse(t)), .8, 12), { wash: ['#E0574A', PAL.dad, PAL.girl, PAL.sap][i], washOp: 240, ink: PAL.ink, sw: 1.3 });
      letter(c, x, y, 190 * k * (1 + .05 * pulse(t)), PAL.cream, { rot: (i % 2 ? .08 : -.08), stroke: PAL.ink });
    });
    if (t > B(3)) sfx('咚！', 1600, 220, 80, '#E0574A', t - B(3));
  }

  function familyPop(t, lt) {
    sunburst(960, 900, '#BFE3CF', '#9CD3BC', bpOf(t) * .06, 16);
    const who = [['boy', 520, 4], ['dad', 960, 5], ['girl', 1400, 6]];
    for (const [k, x, b] of who) {
      const age = t - B(b); if (age < -.1) continue;
      const up = backOut(age / .35), R = k === 'dad' ? 190 : 165, y = lerp(1300, 640, up) - hopB(t, 1, k === 'dad' ? 0 : .5) * 30;
      famHead(k, x, y, R, { eyes: k === 'dad' ? 'happy' : 'sparkle', mouth: 'grin', sq: pulse(t, 8) * .06, blush: true });
      if (age > 0 && age < 1) sfx(['嗨！', '我！', '还有我！'][b - 4], x, y - R * 1.4, 70, PAL.ink, age, { stroke: PAL.cream });
    }
    const ak = seg(t, B(7), B(7) + .3);
    if (ak > 0) letter('一个爸爸 × 两个娃 = 天天鸡飞狗跳', 960, 150, 72, '#E0574A', { pop: ak, stroke: PAL.cream });
  }

  function bedroom(t, o = {}) {
    room(t, { wall: o.wall || '#F7D2B8', pattern: 'dots', floor: '#C58E62' });
    windowProp(160, 150, 360, 300, { sky: o.sky || '#FCE3B0', curtainCol: '#E27A92' });
    frameProp(1380, 180, 220, 170, PAL.teal);
    clock(1740, 470, 60, t, o.ring || 0);
    paint(rectPts(1660, 540, 170, 280, 2), { wash: PAL.woodDk, ink: PAL.ink, sw: 1 });
    bed(380, BED_Y, 1080);
  }
  function sleepingDad(t, o = {}) {
    const breath = o.bounce != null ? o.bounce : (Math.sin(bpOf(t) * Math.PI / 2) * .5 + .5);
    famHead('dad', 500, BED_Y - 60 - breath * 6 - (o.lift || 0), 88, { rot: -.25, eyes: o.eyes || 'closed', mouth: o.mouth || 'o', hairUp: o.hairUp || 0, sq: o.sq || 0, emote: o.emote, emoteK: o.emoteK });
    blanket(560, BED_Y - 70 - breath * 14 - (o.lift || 0) * .6, 860, 110, 30 + breath * 22, '#8EC3E6');
  }

  function sleep(t, lt, dur) {
    const z = lerp(1, 1.45, ease(lt / dur));
    camBegin(lerp(960, 640, ease(lt / dur)), lerp(540, 520, ease(lt / dur)), z);
    bedroom(t, { sky: mixCol('#3B4A86', '#FCE3B0', seg(lt, 0, dur)) });
    sleepingDad(t);
    for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) / 2 + i / 3); letter('Z', 620 + ph * 160 + i * 20, 430 - ph * 220, 50 + ph * 50, PAL.indigo, { alpha: 1 - ph, ink: false }); }
    camEnd();
  }

  function sneak(t, lt, dur) {
    const kx = 1850 - (bpOf(t) - bpOf(B(12))) * 70;
    camBegin(kx - 120, 600, 1.7);
    bedroom(t);
    sleepingDad(t);
    // 踮脚大步：每拍落一步，身体前倾
    for (const [k, x0, lag] of [['boy', 1850, 0], ['girl', 2100, .5]]) {
      const x = x0 - (bpOf(t) - bpOf(B(12))) * 70;
      const f = frac(bpOf(t) + lag), step = Math.sin(f * Math.PI);
      fam(k, x, 820, 21, { walk: bpOf(t) / 2 + lag, dy: -step * 1.2, rot: -.12, aL: .3, aR: 1.3, eyes: 'look', lookX: -1, mouth: 'cat', flip: true });
    }
    const sh = seg(t, B(13), B(13) + .3);
    if (sh > 0) sfx('嘘——', 1650, 380, 80, PAL.violet, t - B(13), { life: 2.5 });
    camEnd();
  }

  function bounceBed(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 10 * pulse(t, 8));
    camBegin(960 + sx, 470 + sy, 1.5 * punch(t, .04));
    bedroom(t);
    const hit = pulse(t, 6);
    sleepingDad(t, { bounce: hopB(t, 1, .5) * .6, lift: hopB(t, 1, .5) * 40, eyes: lt > dur * .6 ? 'swirl' : 'closed', mouth: 'wobble', sq: hit * .1 });
    for (const [k, x, lag] of [['boy', 820, 0], ['girl', 1170, .5]]) {
      const h = hopB(t, 1, lag);
      fam(k, x, BED_Y - 20, 21, { dy: -h * 7, sq: (1 - h) * .15 * (h < .15 ? 1 : 0), aL: .9 + h * .5, aR: .9 + h * .5, eyes: 'happy', mouth: 'grin', legSpread: .2 });
    }
    pillow(560 + Math.sin(bpOf(t) * Math.PI) * 30, BED_Y - 170 - hopB(t) * 160, 160, 70, bpOf(t) * .8);
    const age = frac(bpOf(t)) * BEAT;
    sfx(beatN(t) % 2 ? '咚！' : '蹦！', beatN(t) % 2 ? 680 : 1300, 260, 90, '#E0574A', age, { life: .6 });
    camEnd();
  }

  function alarm(t, lt, dur) {
    sunburst(960, 540, '#FFE7A8', '#FFD27A', t * .8, 20);
    const ring = 1;
    camBegin(960, 540, 1 + .06 * pulse(t, 7));
    clock(960, 560, 250, t, ring);
    speedLines(960, 560, 380, 1100, 26, '#E0574A', 3, beatN(t));
    camEnd();
    sfx('叮铃铃——！', 960, 170, 130, '#E0574A', lt, { life: dur + .2, rot: Math.sin(t * 20) * .05 });
  }

  function wake(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 16 * seg(lt, 0, .3) * (1 - seg(lt, .3, .8)));
    camBegin(760 + sx, 440 + sy, 1.55);
    bedroom(t, { ring: 1 - seg(lt, 0, .6) });
    const pop = backOut(lt / .35);
    const m = mood(t, [[B(24), 'wide', 'scream', '!!'], [B(26), 'tired', 'wobble', 'sweat']]);
    // 爸爸坐起来：从床里弹出上半身
    fam('dad', 560, BED_Y + 40 + (1 - pop) * 200, 22, { ...m, hairUp: pop, aL: .2, aR: .2, noShadow: true });
    blanket(460, BED_Y - 20, 960, 110, 30, '#8EC3E6');
    // 娃扑上来挂在爸爸身上
    const kk = seg(t, B(25), B(25) + .3);
    if (kk > 0) {
      fam('boy', lerp(1300, 760, easeOut(kk)), BED_Y - 20 - hopB(t) * 60, 20, { eyes: 'happy', mouth: 'grin', aL: 1.2, aR: 1.3, rot: -.2 });
      fam('girl', lerp(1500, 930, easeOut(kk)), BED_Y - 20 - hopB(t, 1, .5) * 60, 20, { eyes: 'sparkle', mouth: 'grin', aL: 1.3, aR: 1, rot: -.1 });
      sfx('爸爸起床啦！', 1120, 200, 96, '#E0574A', t - B(25), { life: 2.4 });
    }
    camEnd();
  }

  function drag(t, lt, dur) {
    // 走廊横移：爸爸一拍一步往前拖，两个娃挂在腿上
    const x = 600 + (bpOf(t) - bpOf(B(28))) * 110;
    camBegin(x + 60, 600, 1.45);
    room(t, { wall: '#F3E3C4', pattern: 'stripes', floor: '#B98559' });
    for (let i = 0; i < 6; i++) frameProp(200 + i * 420, 200, 170, 140, [PAL.teal, PAL.rose, PAL.ochre][i % 3]);
    const step = hopB(t);
    fam('dad', x, 820, 23, { walk: bpOf(t) / 2, dy: -step * .5, rot: .08, eyes: 'tired', mouth: 'wobble', aL: -1.3, aR: -1.35, hairUp: .7, emote: 'sweat', emoteK: 1 });
    fam('boy', x - 70, 850, 17, { rot: -1.2, eyes: 'happy', mouth: 'grin', aL: 1.4, aR: 1.2, noShadow: true, sit: true });
    fam('girl', x + 90, 850, 16, { rot: 1.1, eyes: 'closed', mouth: 'smile', aL: 1.3, aR: 1.4, noShadow: true, flip: true, sit: true });
    camEnd();
    letter('早上 6:30', 300, 120, 70, PAL.ink, { stroke: PAL.cream, rot: -.05 });
  }

  chapter('morning', 0, B(33), [[0, title], [B(4), familyPop], [B(8), sleep], [B(12), sneak], [B(16), bounceBed], [B(21), alarm], [B(24), wake], [B(28), drag]]);
})();
