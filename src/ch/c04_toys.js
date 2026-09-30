// c04_toys：副歌 2「抢玩具」（第 86 – 107 拍）。红黄对撞配色。
// 镜头：哥哥 VS 妹妹 · 拔河机器人（手臂越拉越长）· 烟尘云大乱斗 · 爸爸吹哨当裁判（两道泪瀑布）· 法官敲槌 · 变出第二个玩具
(() => {
  const playroom = t => {
    room(t, { wall: '#FFE0C2', pattern: 'dots', floor: '#C58E62' });
    windowProp(160, 150, 300, 240, { sky: '#CFE8F7', curtainCol: PAL.ochre });
    paint(rectPts(1500, 380, 320, 440, 2), { wash: PAL.woodDk, ink: PAL.ink, sw: 1 });   // 玩具柜
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) block(1560 + c * 100, 440 + r * 130, .8, [PAL.rose, PAL.sky, PAL.ochre, PAL.sap][(r + c) % 4]);
  };

  function vs(t, lt, dur) {
    const k = backOut(lt / .35);
    flatMany([[rectPts(-60, -60, W + 120, H + 120), '#2B2233', 255],
      [[[-60, -60], [lerp(-60, 1060, k), -60], [lerp(-60, 860, k), H + 60], [-60, H + 60]], '#E0574A', 255],
      [[[W + 60, -60], [lerp(W + 60, 1060, k), -60], [lerp(W + 60, 860, k), H + 60], [W + 60, H + 60]], '#F2B53A', 255]]);
    for (let i = 0; i < 12; i++) inkLine([[lerp(-60, 1000, hash(i)), hash(i + 3) * H], [lerp(-60, 1000, hash(i)) - 300, hash(i + 3) * H]], 2, '#FFB0A0', 'inkfine', 0);
    famHead('boy', lerp(-300, 470, k), 480 - hopB(t) * 30, 250, { eyes: 'angry', mouth: 'teeth', sq: pulse(t, 8) * .06 });
    famHead('girl', lerp(W + 300, 1450, k), 480 - hopB(t, 1, .5) * 30, 245, { eyes: 'angry', mouth: 'frown', sq: pulse(t, 8) * .06 });
    letter('哥哥', 470, 900, 90, PAL.cream, { stroke: PAL.ink });
    letter('妹妹', 1450, 900, 90, PAL.cream, { stroke: PAL.ink });
    const ph = frac(bpOf(t));   // 中间的闪电
    paint([[1000, -20], [880, 430], [1010, 450], [860, 1100], [1100, 520], [960, 500], [1090, -20]], { wash: '#FFF3A0', washOp: 255 * (1 - ph * .6), ink: PAL.ink, sw: 1.5 });
    const vk = seg(t, B(87), B(87) + .25);
    if (vk > 0) letter('VS', 970, 500, 300 * lerp(2.2, 1, vk * vk) * (1 + .08 * pulse(t)), '#FFD65A', { stroke: PAL.ink, alpha: vk, rot: -.08, font: '"Permanent Marker", sans-serif' });
    if (t > B(88)) sfx('开打！', 970, 160, 110, PAL.cream, t - B(88), { stroke: '#D8394E' });
  }

  function tug(t, lt, dur) {
    const pull = swingB(t) * 50, stretch = .4 + seg(lt, 0, dur) * 1.8 + (1 + swingB(t)) * .3;
    camBegin(960 + pull * .3, 560, 1.3 * punch(t, .03));
    playroom(t);
    const rx = 1060 + pull;
    robot(rx, 820, 1.5, { armStretch: stretch, rot: pull * .002 });
    const handL = rx - 75 - (1 + stretch) * 90, handR = rx + 75 + 90;
    fam('boy', handL - 150 + pull, 820, 24, { rot: -.25, aL: -.8, aR: .05, legSpread: .35, eyes: 'angry', mouth: 'teeth', red: .3 });
    fam('girl', handR + 150 + pull, 820, 23, { rot: .25, aL: .05, aR: -.8, legSpread: .35, eyes: 'angry', mouth: 'teeth', red: .3, flip: true });
    for (const [x, s] of [[handL - 200, -1], [handR + 200, 1]]) for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) + i / 3); blob(x + s * ph * 120, 830 - ph * 40, 26 * (1 - ph) + 6, 18 * (1 - ph) + 4, '#E9DCC8', { ink: null, op: 200 }); }
    sfx(beatN(t) % 2 ? '哟！' : '嘿！', beatN(t) % 2 ? 1500 : 500, 300, 90, beatN(t) % 2 ? PAL.girlDk : PAL.boy, frac(bpOf(t)) * BEAT, { life: .6 });
    camEnd();
  }

  function brawl(t, lt, dur) {
    const [sx, sy] = shakeXY(t, 18 * pulse(t, 6));
    camBegin(960 + sx, 540 + sy, 1.2);
    playroom(t);
    brawlCloud(960, 560, 330 * (1 + .06 * pulse(t, 8)), t);
    const words = ['砰！', '啪！', '嘭！', '哎哟！'], bi = beatN(t);
    sfx(words[bi % 4], 960 + (bi % 2 ? 420 : -420), 260 + (bi % 3) * 60, 120, ['#E0574A', PAL.violet, PAL.teal, PAL.ochre][bi % 4], frac(bpOf(t)) * BEAT, { life: .6 });
    block(560 + Math.sin(bpOf(t) * 2) * 100, 500 - hopB(t) * 300, 1, PAL.rose, bpOf(t) * 2);
    ball(1400, 520 - hopB(t, 1, .5) * 280, 40, PAL.sky, bpOf(t));
    camEnd();
  }

  function referee(t, lt, dur) {
    camBegin(960, 560, 1.45);
    playroom(t);
    // 爸爸第 96 拍跳进来，双手一分
    const jump = seg(t, B(96), B(96) + .35);
    fam('dad', 960, 830 - Math.sin(jump * Math.PI) * 200, 26, { aL: .15, aR: .15, eyes: 'angry', mouth: 'O', hat: 'whistle', sq: pulse(t, 8) * .08 * (t > B(96) ? 1 : 0) });
    if (t > B(96)) sfx('嘟——！', 960, 140, 120, PAL.ink, t - B(96), { life: 1.4, stroke: PAL.ochre });
    // 两个娃哭成两道瀑布
    const cry = seg(t, B(97), B(97) + .3);
    for (const [k, x, fl] of [['boy', 470, false], ['girl', 1450, true]]) {
      fam(k, x, 830, 22, { eyes: cry > 0 ? 'cry' : 'angry', mouth: cry > 0 ? 'scream' : 'teeth', tears: cry, flip: fl, aL: -1, aR: -1, sq: pulse(t, 7) * .06 });
      if (cry > 0) for (const s of [-1, 1]) {   // 两道泪瀑布：从眼角向外斜着冲到地上
        const ey = 830 - 9.05 * 22 + 6, ex = x + s * 24, L = cry;
        paint([[ex - 8, ey], [ex + 8, ey], [ex + s * 200 * L + 40, ey + 200 * L], [ex + s * 200 * L - 40, ey + 200 * L]], { wash: '#8FCBF2', washOp: 190, ink: PAL.ink, sw: .5 });
        for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) * 2 + i / 3); blob(ex + s * (200 * L + ph * 60), ey + 200 * L + ph * 30, 14 * (1 - ph) + 4, 10, '#8FCBF2', { ink: null, op: 220 }); }
      }
    }
    camEnd();
  }

  function court(t, lt, dur) {
    flatMany([[rectPts(-60, -60, W + 120, H + 120), '#6B4A3A', 255], [rectPts(-60, 760, W + 120, 400), '#8A5A3E', 255]]);
    for (let i = 0; i < 7; i++) paint(rectPts(80 + i * 270, 80, 40, 680), { wash: '#7C5442', washOp: 200, ink: null });
    camBegin(960, 600, 1.4 * punch(t, .04));
    // 法官台
    paint(rectPts(560, 560, 800, 300, 2), { wash: '#5A3A2A', ink: PAL.ink, sw: 1.2 });
    letter('家庭法庭', 960, 700, 70, PAL.ochre, { stroke: PAL.ink });
    const bang = frac(bpOf(t)), up = bang > .7 ? (bang - .7) / .3 : 1 - bang * 4;
    fam('dad', 960, 620, 24, { aL: -.9, aR: .2 + clamp(up) * 1.1, eyes: 'angry', mouth: 'flat', noShadow: true,
      handR: (u, sw) => { paint(rectPts(0, -u * .2, u * 2.4, u * .4), { wash: PAL.woodDk, ink: PAL.ink, sw: sw * .5 }); paint(rrPts(u * 1.6, -u * .9, u * 1.4, u * 1.8, u * .3), { wash: PAL.wood, ink: PAL.ink, sw: sw * .6 }); } });
    // 两个娃坐在小椅子上抽泣
    for (const [k, x] of [['boy', 460], ['girl', 1460]]) {
      paint(rectPts(x - 80, 780, 160, 30, 2), { wash: PAL.wood, ink: PAL.ink, sw: .9 });
      fam(k, x, 860, 19, { sit: true, eyes: 'cry', mouth: 'wobble', tears: .6, aL: -1.2, aR: -1.2, dy: -pulse(t, 5) * .3 });
    }
    camEnd();
    if (bang < .3) sfx('肃静！', 960, 180, 130, '#E0574A', bang * BEAT, { life: .6 });
  }

  function solution(t, lt, dur) {
    camBegin(960, 520, lerp(1.25, 1.4, ease(lt / dur)));
    playroom(t);
    const reveal = seg(t, B(104), B(104) + .3);
    const m = mood(t, [[B(103), 'normal', 'smile'], [B(104), 'happy', 'grin', 'spark'], [B(106), 'x', 'wobble', 'sweat']]);
    const slump = seg(t, B(106), B(106) + .4);
    fam('dad', 960, 830, 26, { ...m, aL: -1.2, aR: reveal > 0 && slump < 1 ? .3 + reveal : -1.2, rot: slump * -.5, dy: slump * 1.2,
      handR: reveal > 0 && slump < .5 ? (u, sw) => teddy(u * 1.5, u * 2, u / 22 * 1.3 * backOut(reveal)) : null });
    if (reveal > 0 && slump < .5) for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 3; paint(starPts(1240 + Math.cos(a) * 180, 420 + Math.sin(a) * 140, 20, .4, 4), { wash: PAL.ochre, ink: null }); }
    const happy = reveal > .5;
    robot(560, 830, 1.1);
    fam('boy', 460, 830, 21, { eyes: happy ? 'happy' : 'cry', mouth: happy ? 'grin' : 'wobble', tears: happy ? 0 : .5, aL: .3, aR: happy ? 1.2 : -1, dy: -hopB(t) * (happy ? 1.5 : 0) });
    fam('girl', 1460, 830, 21, { eyes: happy ? 'sparkle' : 'cry', mouth: happy ? 'grin' : 'wobble', tears: happy ? 0 : .5, aL: happy ? 1.3 : -1, aR: .3, flip: true, dy: -hopB(t, 1, .5) * (happy ? 1.5 : 0) });
    if (t > B(105)) sfx('耶！', 960, 200, 110, PAL.sap, t - B(105));
    if (slump > .3) letter('搞定……', 1000, 360, 80, PAL.ink, { pop: slump, stroke: PAL.cream });
    camEnd();
  }

  chapter('toys', B(86), B(107), [[B(86), vs], [B(89), tug], [B(93), brawl], [B(96), referee], [B(99), court], [B(103), solution]]);
})();
