// 找 ffmpeg：优先系统里的，其次 Python 的 imageio-ffmpeg，最后 Playwright 自带的（精简版）
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
export default function ffmpegPath() {
  try { return execSync('command -v ffmpeg', { encoding: 'utf8' }).trim() || fallback(); } catch { return fallback(); }
}
function fallback() {
  try { return execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"', { encoding: 'utf8' }).trim(); } catch { /* 没装 imageio-ffmpeg */ }
  const pw = '/opt/pw-browsers';
  if (existsSync(pw)) for (const d of readdirSync(pw)) if (d.startsWith('ffmpeg')) { const p = `${pw}/${d}/ffmpeg-linux`; if (existsSync(p)) return p; }
  return 'ffmpeg';
}
