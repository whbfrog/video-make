// c07_night：桥段「深夜」（第 160 – 181 拍）。靛蓝夜色 + 台灯暖黄。
// 音乐还很满，所以夜里也是踩着拍子的“收拾蒙太奇”；最后落到温柔的一刻。
// 镜头：掖被子（星星随三连音闪）· 玩具一拍一个飞进箱子 · 顶着盘子塔洗碗 · 一个人喝茶翻手机 · 相册里孩子的笑脸一拍一张
(() => {
  const nightRoom = (t, lamp = true) => {
    room(t, { wall: '#3A447E', pattern: 'dots', floor: '#6E5A6E' });
    windowProp(1400, 140, 340, 280, { night: true, curtainCol: PAL.violet });
    if (lamp) glow(300, 420, 420, '#FFD98A', 80);
  };

  function tuck(t, lt, dur) {
    camBegin(900, 560, 1.35);
    nightRoom(t);
    bed(420, 640, 900);
    famHead('boy', 520, 540, 62, { rot: -.3, eyes: 'closed', mouth: 'smile' });
    famHead('girl', 680, 530, 60, { rot: .2, eyes: 'closed', mouth: 'smile' });
    teddy(600, 560, .5, .2);
    const tk = seg(t, B(161), B(163));
    blanket(560, 590, 760, 100, 26 + Math.sin(bpOf(t) * Math.PI / 2) * 6, PAL.lilac);
    // 爸爸踮着脚，把被角掖好
    fam('dad', lerp(1500, 1280, ease(tk)), 830, 26, { eyes: 'happy', mouth: 'smile', aL: -.3 - tk * .4, aR: -1.2, flip: true, walk: tk < 1 ? bpOf(t) / 2 : null, dy: -hopB(t) * .3 });
    for (let i = 0; i < 3; i++) { const ph = frac(bpOf(t) / 2 + i / 3); letter('z', 640 + ph * 80 + i * 16, 460 - ph * 140, 32 + ph * 24, '#FFF3C4', { alpha: 1 - ph, ink: false }); }
    camEnd();
    letter('嘘……', 1350, 200, 70, '#FFF3C4', { pop: seg(lt, .3, .6), stroke: PAL.indigo });
  }

  const TOYS = [['block', 300, PAL.rose], ['ball', 480, PAL.sky], ['robot', 640, null], ['block', 1500, PAL.ochre], ['teddy', 1660, null], ['block', 1800, PAL.sap]];
  function cleanup(t, lt, dur) {
    camBegin(960, 540, 1.1 * punch(t, .03));
    nightRoom(t);
    const box = [1060, 700];
    toyBox(box[0] - 150, box[1], 300, 130);
    const b0 = bpOf(B(164));
    TOYS.forEach(([kind, x0, col], i) => {
      const k = seg(bpOf(t) - b0, i * .6 + .2, i * .6 + 1.2);   // 每个玩具飞一拍，错开半拍多一点
      if (k >= 1) return;
      const x = lerp(x0, box[0], k), y = lerp(800, box[1] - 30, k) - Math.sin(k * Math.PI) * 330, r = k * TAU;
      if (kind === 'block') block(x, y, .9, col, r);
      else if (kind === 'ball') ball(x, y - 30, 34, col, r);
      else if (kind === 'robot') robot(x, y + 60, .6, { rot: r });
      else teddy(x, y + 60, .6, r);
      if (k > .9) sfx('咚！', box[0], box[1] - 80, 60, PAL.ochre, (k - .9) * BEAT);
    });
    const sw = swingB(t);
    fam('dad', 760, 830, 25, { hat: 'sock', eyes: 'tired', mouth: 'flat', aL: .3 + sw * .8, aR: .3 - sw * .8, dy: -hopB(t) * .4 });
    camEnd();
  }

  function dishes(t, lt, dur) {
    camBegin(900, 520, 1.3);
    room(t, { wall: '#34406F', pattern: 'stripes', floor: '#6E5A6E' });
    glow(900, 300, 380, '#FFE7A8', 70);
    counter(260, 640, 1200);
    // 盘子塔：每拍晃一下，第 171 拍最上面那只滑出去，被爸爸接住
    const wob = Math.sin(bpOf(t) * Math.PI) * .06, fall = seg(t, B(170) + .3, B(171));
    push(); translate(920, 620); rotate(wob);
    for (let i = 0; i < 9; i++) paint(ellPts(Math.sin(i * 1.7) * 6, -i * 30, 120, 22, 18), { wash: i % 2 ? '#FFFDF6' : '#DCEBF5', ink: PAL.ink, sw: .9 });
    pop();
    const px = lerp(920, 1250, fall), py = lerp(340, 470, fall) - Math.sin(fall * Math.PI) * 60;
    push(); translate(px, py); rotate(fall * 2.5); paint(ellPts(0, 0, 120, 22, 18), { wash: '#FFFDF6', ink: PAL.ink, sw: .9 }); pop();
    const caught = t > B(171);
    fam('dad', 1340, 830, 26, { eyes: caught ? 'wide' : 'tired', mouth: caught ? 'O' : 'flat', aL: caught ? .5 : -.2, aR: -1.2, flip: true, apron: true, emote: caught ? '!' : 'sweat', emoteK: 1, sq: caught ? pulse(t, 8) * .1 : 0 });
    if (caught) sfx('接住！', 1250, 250, 90, PAL.sap, t - B(171));
    camEnd();
  }

  function tea(t, lt, dur) {
    camBegin(960, 560, lerp(1.2, 1.4, ease(lt / dur)));
    nightRoom(t);
    table(560, 660, 800, '#8A5A3E');
    fam('dad', 960, 900, 26, { sit: true, eyes: 'tired', mouth: 'flat', aL: -.3, aR: .1, headRot: -.1,
      handR: (u, sw) => phone(u * .6, -u * .3, u / 26 * .35, beatN(t)) });
    paint(rrPts(700, 590, 80, 70, 14), { wash: PAL.cream, ink: PAL.ink, sw: .9 });
    for (let i = 0; i < 2; i++) { const ph = frac(bpOf(t) / 2 + i / 2); inkLine([[730 + i * 20, 580 - ph * 80], [740 + i * 20 + Math.sin(ph * 6) * 10, 540 - ph * 80]], 1.2, '#FFFFFF', 'inkfine', .5); }
    const sigh = frac(lt / (BEAT * 4));
    if (sigh < .6) { blob(820 - sigh * 120, 400 - sigh * 80, 20 + sigh * 40, 16 + sigh * 30, '#E9E6F2', { op: 200 * (1 - sigh / .6), ink: null }); letter('唉……', 760 - sigh * 120, 330 - sigh * 80, 56, '#E9E6F2', { alpha: 1 - sigh / .6, ink: false }); }
    camEnd();
  }

  function photos(t, lt, dur) {
    // 相册：孩子的笑脸一拍翻一张；爸爸在旁边也笑了
    flat(rectPts(-60, -60, W + 120, H + 120), '#2A3368');
    glow(960, 540, 700, '#FFD98A', 70);
    const n = Math.max(0, beatN(t) - 176), scenes = [
      () => { famHead('boy', 0, -10, 90, { eyes: 'happy', mouth: 'grin' }); },
      () => { famHead('girl', 0, -10, 90, { eyes: 'sparkle', mouth: 'grin' }); paint(heartPts(80, -100, 26), { wash: '#E0283F', ink: PAL.ink, sw: .6 }); },
      () => { famHead('dad', 0, 20, 70, { eyes: 'happy', mouth: 'grin' }); famHead('boy', -70, -60, 45, { eyes: 'happy', mouth: 'grin' }); famHead('girl', 70, -60, 45, { eyes: 'happy', mouth: 'grin' }); },
      () => { kidDrawing(0, -10, .5); },
      () => { famHead('girl', -40, 0, 60, { eyes: 'closed', mouth: 'smile' }); famHead('boy', 40, 0, 60, { eyes: 'closed', mouth: 'smile' }); }];
    const k = backOut(frac(bpOf(t)) * 3);
    for (let i = Math.max(0, n - 3); i <= n; i++) {
      const top = i === n, rot = (hash(i) - .5) * .3, x = 960 + (hash(i + 5) - .5) * 200;
      polaroid(x, 480 + (top ? (1 - k) * -400 : 0), 1.3, rot, scenes[i % scenes.length]);
    }
    famHead('dad', 1640, 820, 170, { eyes: 'moved', mouth: 'smile', rot: -.1 });
    letter('今天也辛苦了', 420, 900, 70, '#FFE7A8', { pop: seg(lt, 1, 1.4), stroke: PAL.indigo });
  }

  chapter('night', B(160), B(181), [[B(160), tuck], [B(164), cleanup], [B(168), dishes], [B(172), tea], [B(176), photos]]);
})();
