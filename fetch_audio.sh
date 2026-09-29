#!/usr/bin/env bash
# 下载视频的音轨（只要声音不要画面），并尽量顺带下载字幕/歌词（转成 LRC）。
# 用法：./fetch_audio.sh "https://www.youtube.com/watch?v=8j-hR4fJywU"
set -euo pipefail
URL="${1:?用法: ./fetch_audio.sh <视频网址>}"
mkdir -p audio lyrics
python3 -m pip install -q -U yt-dlp imageio-ffmpeg
FFMPEG="$(command -v ffmpeg || python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"

python3 -m yt_dlp -f bestaudio -x --audio-format m4a \
  --ffmpeg-location "$FFMPEG" -o "audio/original.%(ext)s" "$URL"

# 字幕不一定有；没有就跳过，你可以自己写 lyrics/lyrics.lrc
python3 -m yt_dlp --skip-download --write-subs --write-auto-subs \
  --sub-langs "zh.*,zh-Hans,zh-Hant" --convert-subs lrc \
  --ffmpeg-location "$FFMPEG" -o "lyrics/lyrics.%(ext)s" "$URL" || true

echo "音轨：audio/original.m4a"
ls lyrics/*.lrc 2>/dev/null && echo "↑ 找到字幕，可直接用 --lyrics 指定" || echo "未找到字幕，参考 lyrics/example.lrc 自己写一份"
