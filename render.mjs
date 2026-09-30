// render.mjs：在无头 Chromium 里逐帧渲染 studio.html，再用 ffmpeg 合成 MP4。
//   node render.mjs --sheet=6,7.5,9 [--cols=3] [--w=640] --out=out/check.jpg   接触表（快速看画面）
//   node render.mjs --stills=0.8,3 --out=out/stills                          全尺寸 PNG
//   node render.mjs --clip=0:6 --out=out/clip.mp4                            带音频的短片
//   node render.mjs --frames=0:156.65 --workers=4                            全片逐帧 → out/frames（可断点续渲）
//   node render.mjs --encode --out=out/naiba.mp4                             帧 + 原曲 → MP4
// 可选：--lyrics=lyrics/xxx.lrc 显示歌词条；--song=songs/pdoom.json 指定音频
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import imageFfmpeg from './ffmpeg-path.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const CHROME = args.chrome || process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SONG = JSON.parse(readFileSync(args.song || 'songs/pdoom.json', 'utf8'));
const AUDIO = SONG.audio, FFMPEG = imageFfmpeg();
const fps = +(args.fps || 24), FRAMES_DIR = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });

// 音频时长
const probe = await new Promise(ok => { const p = spawn(FFMPEG, ['-i', AUDIO]); let e = ''; p.stderr.on('data', d => e += d); p.on('close', () => ok(e)); });
const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(probe);
const DUR = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 156.65;

if (args.encode) {
  const out = args.out || 'out/naiba.mp4', n = readdirSync(FRAMES_DIR).filter(f => f.endsWith('.jpg')).length;
  mkdirSync(dirname(out), { recursive: true });
  console.log(`合成 ${n} 帧 → ${out}`);
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES_DIR}/f%05d.jpg`, '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', out]);
  console.log('完成 ' + out);
  process.exit(0);
}

// 歌词（LRC）：[[开始, 结束, 文本], ...]
let LY = [];
if (args.lyrics) {
  const rows = [];
  for (const ln of readFileSync(args.lyrics, 'utf8').split(/\r?\n/)) {
    const stamps = [...ln.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], txt = ln.replace(/\[[^\]]*\]/g, '').trim();
    for (const s of stamps) rows.push([+s[1] * 60 + +s[2], txt]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  LY = rows.map((r, i) => [r[0], i + 1 < rows.length ? rows[i + 1][0] : Math.min(DUR, r[0] + 6), r[1]]).filter(r => r[2] && !r[2].startsWith('（第'));
  console.log(`歌词 ${LY.length} 句`);
}
// 需要预加载的汉字：源码 + 歌词里出现的所有非 ASCII 字符
const srcTxt = [];
const walk = d => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else if (p.endsWith('.js')) srcTxt.push(readFileSync(p, 'utf8')); } };
walk('src');
const GLYPHS = [...new Set((srcTxt.join('') + LY.map(l => l[2]).join('')).replace(/[\x00-\x7F]/g, ''))].join('');

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--allow-file-access-from-files', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--window-size=1920,1080', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--no-sandbox']
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(pathToFileURL(resolve('studio.html')).href + '?render', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  await page.evaluate((ly, dur, g) => { window.LY = ly; DUR = dur; return window.preloadGlyphs(g); }, LY, DUR, GLYPHS);
  return page;
}
const frameOf = async (page, t, type, q) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const times = s => String(s).split(',').map(Number);

if (args.sheet) {
  const page = await openPage(), out = args.out || 'out/sheet.jpg'; mkdirSync(dirname(out), { recursive: true });
  const { url, ms } = await page.evaluate((ts, c, w) => window.renderSheet(ts, c, w), times(args.sheet), +(args.cols || 3), +(args.w || 640));
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  ms/帧: ${ms.join(' ')}`);
} else if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
  console.log('GPU:', await page.evaluate(() => window.gpuInfo()));
  for (const s of times(args.stills)) {
    const t0 = Date.now(), buf = await frameOf(page, s, 'image/png');
    const f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`; writeFileSync(f, buf);
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.frames) {
  // 并行、可续渲：每个 worker 领取下一个缺失的帧，原子写入
  const [a, b] = String(args.frames).split(':').map(Number), workers = +(args.workers || 4);
  mkdirSync(FRAMES_DIR, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(DUR * fps) - 1, Math.round(b * fps) - 1);
  const todo = []; for (let i = first; i <= last; i++) { const f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`待渲染 ${todo.length} 帧（已完成 ${last - first + 1 - todo.length}），${workers} 个 worker`);
  let next = 0, done = 0; const start = Date.now();
  const work = async w => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES_DIR}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await frameOf(page, i / fps, 'image/jpeg', .94);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 48 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`帧 ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/帧（并行后）  剩余约 ${((todo.length - done) * el / done / 60).toFixed(1)} 分钟`);
      }
    }
  };
  await Promise.all(Array.from({ length: workers }, (_, w) => work(w)));
} else {
  const page = await openPage();
  const [a, b] = args.clip ? String(args.clip).split(':').map(Number) : [0, DUR];
  const out = args.out || 'out/clip.mp4'; mkdirSync(dirname(out), { recursive: true });
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-ss', String(a), '-t', String(b - a), '-i', AUDIO,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((b - a) * fps), start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frameOf(page, a + i / fps, 'image/jpeg', .92);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 24 === 0 || i === n - 1) console.log(`帧 ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/帧`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`完成 ${out}`);
}
await browser.close();
