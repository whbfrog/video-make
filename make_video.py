#!/usr/bin/env python3
"""奶爸日记 —— 纯代码绘制的原创动画短片，可配外部音轨合成 MP4。

故事：爸爸带着两个娃，每天鸡飞狗跳——早起被吵醒、早餐打翻牛奶、居家开会娃在身后打仗、
辅导作业气到七窍生烟、抢玩具哭闹、深夜一地狼藉……可孩子一句“爸爸辛苦啦”，
所有烦恼都化了：孩子带来的快乐，永远多于烦恼。

用法：
    python3 make_video.py --audio audio/original.m4a --out output/naiba.mp4
    python3 make_video.py --duration 90 --out output/preview.mp4     # 无声预览
    python3 make_video.py --stills output/stills                    # 每个场景导出一张截图

提供 --audio 时，画面总时长自动等于音频时长，各场景按权重等比拉伸。
"""
import argparse
import math
import os
import random
import re
import shutil
import subprocess
import sys
from functools import lru_cache
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
SS = 2  # 超采样倍数，绘制在 2x 画布上再缩小，用于抗锯齿
FPS = 24

INK = (45, 35, 35)
WHITE = (255, 255, 255)
SKIN = (255, 222, 195)
MILK = (236, 244, 255)
PALETTE = [(255, 120, 120), (255, 190, 80), (120, 200, 150), (110, 170, 240), (200, 140, 230)]

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "C:/Windows/Fonts/msyhbd.ttc",
    "C:/Windows/Fonts/msyh.ttc",
    "C:/Windows/Fonts/simhei.ttf",
]

CFG = {}  # 在各进程中由 init_worker 填充


# ---------------------------------------------------------------- 工具函数

def clamp(v, a=0.0, b=1.0):
    return a if v < a else b if v > b else v


def lerp(a, b, k):
    return a + (b - a) * k


def smooth(a, b, u):
    k = clamp((u - a) / (b - a))
    return k * k * (3 - 2 * k)


def ease_out_back(k):
    c = 1.70158
    return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2


def mix(c1, c2, k):
    return tuple(int(lerp(a, b, k)) for a, b in zip(c1, c2))


def rgba(c, a):
    return tuple(c[:3]) + (int(clamp(a) * 255),)


@lru_cache(maxsize=64)
def font(px):
    return ImageFont.truetype(CFG["font"], max(1, int(px)))


class Pen:
    """在 SS 倍画布上绘制，接受 1280x720 逻辑坐标。"""

    def __init__(self, img, mode="RGBA"):
        self.img = img
        self.d = ImageDraw.Draw(img, mode)

    @staticmethod
    def _w(width):
        return max(1, round(width * SS))

    def ellipse(self, cx, cy, rx, ry, fill=None, outline=None, width=0):
        rx, ry = abs(rx), abs(ry)
        self.d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS],
                       fill=fill, outline=outline, width=self._w(width) if outline else 0)

    def circle(self, cx, cy, r, fill=None, outline=None, width=0):
        self.ellipse(cx, cy, r, r, fill, outline, width)

    def rect(self, x0, y0, x1, y1, fill=None, r=0, outline=None, width=0):
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        r = max(0, min(r, (x1 - x0) / 2, (y1 - y0) / 2))
        self.d.rounded_rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], radius=r * SS,
                                 fill=fill, outline=outline, width=self._w(width) if outline else 0)

    def poly(self, pts, fill=None, outline=None, width=0):
        self.d.polygon([(x * SS, y * SS) for x, y in pts], fill=fill, outline=outline,
                       width=self._w(width) if outline else 1)

    def line(self, pts, fill, width, cap=True):
        self.d.line([(x * SS, y * SS) for x, y in pts], fill=fill, width=self._w(width), joint="curve")
        if cap:
            for x, y in (pts[0], pts[-1]):
                self.circle(x, y, width / 2, fill=fill)

    def arc(self, cx, cy, rx, ry, a0, a1, fill, width):
        self.d.arc([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], a0, a1,
                   fill=fill, width=self._w(width))

    def chord(self, cx, cy, rx, ry, a0, a1, fill=None, outline=None, width=0):
        self.d.chord([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], a0, a1,
                     fill=fill, outline=outline, width=self._w(width) if outline else 0)

    def text(self, x, y, s, size, fill, anchor="mm", stroke=0, stroke_fill=None):
        if size < 1:
            return
        self.d.text((x * SS, y * SS), s, font=font(size * SS), fill=fill, anchor=anchor,
                    stroke_width=round(stroke * SS), stroke_fill=stroke_fill)

    def text_size(self, s, size):
        b = font(size * SS).getbbox(s)
        return (b[2] - b[0]) / SS, (b[3] - b[1]) / SS


# ---------------------------------------------------------------- 小道具与特效

def heart(p, x, y, size, fill):
    pts = []
    for k in range(40):
        a = 2 * math.pi * k / 40
        hx = 16 * math.sin(a) ** 3
        hy = -(13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a))
        pts.append((x + hx * size / 32, y + hy * size / 32))
    p.poly(pts, fill)


def star(p, x, y, r, fill, rot=0.0):
    pts = []
    for k in range(10):
        a = rot - math.pi / 2 + k * math.pi / 5
        rr = r if k % 2 == 0 else r * 0.45
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    p.poly(pts, fill)


def sweat(p, x, y, s):
    p.poly([(x, y - s * 0.7), (x - s * 0.33, y + s * 0.1), (x + s * 0.33, y + s * 0.1)], fill=(140, 200, 255))
    p.circle(x, y + s * 0.12, s * 0.35, fill=(140, 200, 255))
    p.circle(x - s * 0.1, y + s * 0.05, s * 0.1, fill=WHITE)


def anger_vein(p, x, y, s, color=(230, 45, 45)):
    o = s * 0.55
    r = s * 0.45
    w = s * 0.2
    p.arc(x + o, y + o, r, r, 180, 270, color, w)
    p.arc(x - o, y + o, r, r, 270, 360, color, w)
    p.arc(x - o, y - o, r, r, 0, 90, color, w)
    p.arc(x + o, y - o, r, r, 90, 180, color, w)


def steam(p, hx, hy, r, t, k=1.0):
    """七窍生烟：头顶和两耳冒出蒸汽。"""
    if k <= 0:
        return
    sources = [(hx, hy - r * 0.95, 0), (hx - r * 1.05, hy, -1), (hx + r * 1.05, hy, 1)]
    for j, (sx, sy, dx) in enumerate(sources):
        for i in range(4):
            ph = (t * 1.4 + i / 4 + j * 0.13) % 1
            px = sx + dx * ph * 70 + math.sin(ph * 7 + i + j) * 8
            py = sy - ph * (120 if dx == 0 else 70)
            rr = (9 + ph * 26) * (0.6 + 0.4 * k)
            a = (1 - ph) * 0.9 * k
            p.circle(px, py, rr, fill=rgba((248, 248, 248), a), outline=rgba((190, 190, 195), a), width=2)


def zzz(p, x, y, t):
    for i in range(3):
        ph = (t * 0.6 + i / 3) % 1
        p.text(x + ph * 60 + i * 6, y - ph * 90, "Z", 22 + ph * 22, rgba((70, 90, 160), 1 - ph * 0.8))


def spiral(p, x, y, t, r=30):
    pts = []
    for a in np.linspace(0, 5 * math.pi, 70):
        rr = r * a / (5 * math.pi)
        pts.append((x + math.cos(a + t * 5) * rr, y + math.sin(a + t * 5) * rr * 0.55))
    p.line(pts, INK, 3)


def bubble(p, x, y, text, tail, size=30, fill=WHITE, ink=INK, alpha=1.0):
    if alpha <= 0.01:
        return
    tw, _ = p.text_size(text, size)
    pw, ph = tw / 2 + size * 0.75, size * 0.95
    x = clamp(x, pw + 12, W - pw - 12)
    f, o = rgba(fill, alpha), rgba(ink, alpha)
    tx, ty = tail
    sign = 1 if ty > y else -1
    bx = clamp(tx, x - pw + size, x + pw - size)
    by = y + ph * 0.5 * sign
    p.poly([(bx - size * 0.32, by), (bx + size * 0.32, by), (tx, ty)], fill=f, outline=o, width=3)
    p.rect(x - pw, y - ph, x + pw, y + ph, fill=f, r=ph, outline=o, width=3)
    p.poly([(bx - size * 0.26, by), (bx + size * 0.26, by),
            (lerp(tx, bx, 0.12), lerp(ty, by, 0.12))], fill=f)
    p.text(x, y, text, size, o)


def pop_word(p, x, y, text, size, color, k):
    if k <= 0:
        return
    s = size * ease_out_back(clamp(k))
    star(p, x, y, s * 1.2, rgba((255, 235, 120), 0.9), rot=0.3)
    p.text(x, y, text, s, color, stroke=4, stroke_fill=WHITE)


def clock(p, cx, cy, r, t, ring):
    if ring:
        cx += math.sin(t * 45) * 4
    for s in (-1, 1):
        p.circle(cx + s * r * 0.6, cy - r * 0.85, r * 0.3, fill=(230, 80, 70), outline=INK, width=3)
    p.circle(cx, cy, r, fill=(230, 80, 70), outline=INK, width=3)
    p.circle(cx, cy, r * 0.82, fill=WHITE)
    for k in range(12):
        a = k * math.pi / 6
        p.circle(cx + math.sin(a) * r * 0.68, cy - math.cos(a) * r * 0.68, 2.5, fill=INK)
    ha, ma = math.radians(195), math.radians(180)  # 6:30
    p.line([(cx, cy), (cx + math.sin(ha) * r * 0.4, cy - math.cos(ha) * r * 0.4)], INK, 5)
    p.line([(cx, cy), (cx + math.sin(ma) * r * 0.62, cy - math.cos(ma) * r * 0.62)], INK, 3.5)
    p.circle(cx, cy, 5, fill=INK)
    if ring:
        for s in (-1, 1):
            for i in range(3):
                a = math.radians(-60 + i * 30) if s > 0 else math.radians(-120 - i * 30)
                p.line([(cx + math.cos(a) * r * 1.2, cy + math.sin(a) * r * 1.2),
                        (cx + math.cos(a) * r * 1.45, cy + math.sin(a) * r * 1.45)], INK, 3)
        p.text(cx, cy + r + 32, "叮铃铃！", 26, (220, 60, 50), stroke=3, stroke_fill=WHITE)


def robot(p, x, y):
    p.rect(x - 26, y - 20, x + 26, y + 34, fill=(110, 170, 230), r=8, outline=INK, width=2.5)
    p.rect(x - 20, y - 52, x + 20, y - 22, fill=(160, 205, 245), r=8, outline=INK, width=2.5)
    p.line([(x, y - 52), (x, y - 66)], INK, 3)
    p.circle(x, y - 68, 5, fill=(240, 80, 80))
    for s in (-1, 1):
        p.circle(x + s * 9, y - 38, 5, fill=(255, 220, 80), outline=INK, width=1.5)
    for i, c in enumerate(PALETTE[:3]):
        p.circle(x - 12 + i * 12, y + 5, 4, fill=c)


def kid_drawing(p, x, y, alpha=1.0):
    """孩子画给爸爸的画：一家三口 + 爱心。"""
    p.rect(x - 85, y - 62, x + 85, y + 62, fill=rgba((255, 253, 245), alpha), r=4,
           outline=rgba((200, 190, 170), alpha), width=2)
    for i, (dx, hh, c) in enumerate(((-45, 34, (230, 90, 80)), (0, 48, (70, 125, 205)), (45, 32, (255, 180, 50)))):
        bx, by = x + dx, y + 18
        p.circle(bx, by - hh, 10, outline=rgba(c, alpha), width=2.5)
        p.line([(bx, by - hh + 10), (bx, by)], rgba(c, alpha), 2.5)
        p.line([(bx - 12, by - hh + 20), (bx + 12, by - hh + 20)], rgba(c, alpha), 2.5)
        p.line([(bx - 8, by + 14), (bx, by), (bx + 8, by + 14)], rgba(c, alpha), 2.5)
    heart(p, x + 62, y - 40, 22, rgba((235, 60, 80), alpha))
    p.text(x, y + 48, "爸爸辛苦了", 18, rgba((220, 70, 70), alpha))


# ---------------------------------------------------------------- 角色（原创：爸爸、哥哥、妹妹）

CHAR = {
    "dad": dict(leg=110, body=130, bw=96, hr=46, arm=105, lw=22, shirt=(70, 125, 205),
                pants=(55, 60, 85), hair=(45, 35, 35), shoe=(70, 50, 45)),
    "boy": dict(leg=62, body=76, bw=66, hr=40, arm=66, lw=16, shirt=(235, 85, 70),
                pants=(55, 95, 165), hair=(40, 30, 25), shoe=(245, 245, 245)),
    "girl": dict(leg=58, body=80, bw=60, hr=39, arm=60, lw=15, shirt=(255, 195, 70),
                 pants=SKIN, hair=(115, 65, 40), shoe=(230, 90, 120)),
}


def face(p, cx, cy, r, expr, who, t):
    ey, dx, er, my = cy + r * 0.08, r * 0.36, r * 0.1, cy + r * 0.5
    lw = max(1.5, r * 0.065)

    def dot_eyes(scale=1.0, sides=(-1, 1)):
        for s in sides:
            p.ellipse(cx + s * dx, ey, er * 0.85 * scale, er * scale, fill=INK)
            p.circle(cx + s * dx + er * 0.3, ey - er * 0.35, er * 0.3 * scale, fill=WHITE)

    def half_eyes(bags=False):
        for s in (-1, 1):
            p.chord(cx + s * dx, ey - er * 0.1, er * 1.0, er * 0.9, 0, 180, fill=INK)
            p.line([(cx + s * dx - er * 1.3, ey - er * 0.1), (cx + s * dx + er * 1.3, ey - er * 0.1)], INK, lw)
            if bags:
                p.arc(cx + s * dx, ey + er * 0.7, er * 1.1, er * 0.6, 20, 160, (150, 120, 150), lw * 0.7)

    def brows(tilt=0.0, lift=0.0, w=1.0):
        for s in (-1, 1):
            o = (cx + s * (dx + er * 1.5), ey - r * 0.3 - lift - tilt * r * 0.05)
            i = (cx + s * (dx - er * 1.3), ey - r * 0.3 - lift + tilt * r * 0.09)
            p.line([o, i], INK, lw * w)

    def blush(a=0.45, k=1.0):
        for s in (-1, 1):
            p.ellipse(cx + s * r * 0.6, cy + r * 0.33, r * 0.15 * k, r * 0.09 * k, fill=rgba((255, 120, 120), a))

    if expr in ("neutral", "talk"):
        dot_eyes()
        brows()
        if expr == "talk" and int(t * 7) % 2 == 0:
            p.ellipse(cx, my - r * 0.02, r * 0.13, r * 0.1, fill=(150, 50, 55))
        else:
            p.arc(cx, my - r * 0.12, r * 0.18, r * 0.12, 30, 150, INK, lw)
    elif expr == "happy":
        for s in (-1, 1):
            p.arc(cx + s * dx, ey + er * 0.6, er * 1.3, er * 1.3, 200, 340, INK, lw)
        p.chord(cx, my - r * 0.2, r * 0.28, r * 0.22, 0, 180, fill=(170, 50, 60))
        p.ellipse(cx, my - r * 0.03, r * 0.12, r * 0.05, fill=(240, 120, 130))
        blush()
    elif expr == "tired":
        half_eyes(bags=True)
        brows(-0.7)
        pts = [(cx - r * 0.18 + k * r * 0.036, my - r * 0.05 + math.sin(k * 1.3) * r * 0.025) for k in range(11)]
        p.line(pts, INK, lw, cap=False)
    elif expr == "angry":
        dot_eyes(0.9)
        brows(1.5, w=1.6)
        if who == "dad":
            p.rect(cx - r * 0.26, my - r * 0.16, cx + r * 0.26, my + r * 0.05, fill=WHITE, r=r * 0.05,
                   outline=INK, width=lw * 0.8)
            p.line([(cx - r * 0.26, my - r * 0.055), (cx + r * 0.26, my - r * 0.055)], INK, lw * 0.6, cap=False)
            for k in (-1, 0, 1):
                p.line([(cx + k * r * 0.09, my - r * 0.16), (cx + k * r * 0.09, my + r * 0.05)], INK, lw * 0.6, cap=False)
        else:
            p.arc(cx, my + r * 0.05, r * 0.2, r * 0.12, 200, 340, INK, lw)
    elif expr == "shock":
        for s in (-1, 1):
            p.circle(cx + s * dx, ey, er * 1.6, fill=WHITE, outline=INK, width=lw * 0.7)
            p.circle(cx + s * dx, ey, er * 0.55, fill=INK)
        brows(0, lift=r * 0.12)
        p.ellipse(cx, my - r * 0.02, r * 0.11, r * 0.15, fill=(120, 40, 50))
    elif expr == "cry":
        for s in (-1, 1):
            ex = cx + s * dx
            p.line([(ex + s * er * 1.2, ey - er * 1.1), (ex - s * er * 1.0, ey), (ex + s * er * 1.2, ey + er * 1.1)], INK, lw)
        brows(-1.2)
        p.ellipse(cx, my, r * 0.2 + math.sin(t * 20) * r * 0.03, r * 0.16, fill=(150, 40, 55))
        for s in (-1, 1):
            p.line([(cx + s * (dx + er * 0.3), ey + er * 1.2), (cx + s * (dx + er * 1.0), cy + r * 0.9)],
                   (120, 190, 255, 210), er * 1.1)
            ph = (t * 2.2 + (s + 1) * 0.25) % 1
            p.circle(cx + s * (dx + er * 1.3 + ph * r * 0.35), cy + r * 0.85 + ph * r * 0.9, er * 0.65,
                     fill=(120, 190, 255, int(230 * (1 - ph))))
        blush(0.6)
    elif expr == "sleep":
        for s in (-1, 1):
            p.arc(cx + s * dx, ey - er * 0.6, er * 1.2, er * 1.0, 20, 160, INK, lw)
        p.circle(cx, my, r * 0.06, fill=(150, 60, 60))
        blush(0.3)
    elif expr == "mischief":
        dot_eyes(sides=(-1,))
        p.arc(cx + dx, ey + er * 0.6, er * 1.3, er * 1.3, 200, 340, INK, lw)
        brows(0.5)
        p.chord(cx, my - r * 0.15, r * 0.3, r * 0.18, 0, 180, fill=WHITE, outline=INK, width=lw * 0.8)
        blush()
    elif expr == "pout":
        half_eyes()
        brows(0.6)
        blush(0.55, 1.3)
        p.line([(cx - r * 0.1, my), (cx + r * 0.1, my - r * 0.03)], INK, lw)

    # 鼻子
    p.arc(cx, cy + r * 0.27, r * 0.06, r * 0.05, 0, 180, (205, 145, 125), lw * 0.7)
    if who == "girl" and expr not in ("happy", "cry", "mischief", "pout", "sleep"):
        blush(0.3)
    if who == "dad":
        gc = (35, 35, 45)
        for s in (-1, 1):
            p.circle(cx + s * dx, ey, er * 2.3, outline=gc, width=lw * 0.8)
        p.line([(cx - dx + er * 2.3, ey), (cx + dx - er * 2.3, ey)], gc, lw * 0.8, cap=False)


def head(p, cx, cy, r, who, expr="neutral", t=0.0, red=0.0, sil=None):
    c = CHAR[who]
    skin = sil or mix(SKIN, (240, 95, 85), red)
    hair = sil or c["hair"]
    if who == "girl":
        for s in (-1, 1):
            p.circle(cx + s * r * 1.12, cy - r * 0.15, r * 0.42, fill=hair)
        p.ellipse(cx, cy + r * 0.05, r * 1.08, r * 1.02, fill=hair)
    else:
        for s in (-1, 1):
            p.circle(cx + s * r * 0.97, cy + r * 0.1, r * 0.2, fill=skin)
    p.circle(cx, cy, r, fill=skin)
    if who == "dad":
        p.chord(cx, cy - r * 0.22, r * 1.05, r * 0.9, 180, 360, fill=hair)
        p.poly([(cx - r * 0.2, cy - r * 1.08), (cx + r * 0.65, cy - r * 1.0), (cx + r * 0.15, cy - r * 0.62)], fill=hair)
    elif who == "boy":
        p.chord(cx, cy - r * 0.2, r * 1.05, r * 0.92, 180, 360, fill=hair)
        for k in range(5):
            a = math.radians(-150 + k * 30)
            oy = cy - r * 0.2
            p.poly([(cx + math.cos(a - 0.22) * r * 0.85, oy + math.sin(a - 0.22) * r * 0.8),
                    (cx + math.cos(a + 0.22) * r * 0.85, oy + math.sin(a + 0.22) * r * 0.8),
                    (cx + math.cos(a) * r * 1.3, oy + math.sin(a) * r * 1.2)], fill=hair)
    else:
        p.chord(cx, cy - r * 0.25, r * 1.06, r * 0.85, 180, 360, fill=hair)
        bow = sil or (240, 90, 130)
        for s in (-1, 1):
            bx, by = cx + s * r * 1.1, cy - r * 0.55
            p.poly([(bx, by), (bx - r * 0.3, by - r * 0.2), (bx - r * 0.3, by + r * 0.2)], fill=bow)
            p.poly([(bx, by), (bx + r * 0.3, by - r * 0.2), (bx + r * 0.3, by + r * 0.2)], fill=bow)
            p.circle(bx, by, r * 0.09, fill=bow)
    if sil is None:
        face(p, cx, cy, r, expr, who, t)


def person(p, x, y, who, s=1.0, expr="neutral", arms=(15, 15), legs=(0, 0), t=0.0, red=0.0,
           sit=False, sil=None, extras=()):
    """画一个角色。(x, y) 是双脚落地的中点。

    arms 每项可以是：角度（0=下垂, 90=水平外展, 180=举过头顶, 负数=向内）、
    'head'（双手抱头）、或 (x, y) 绝对坐标（手伸到该点）。
    返回手和头的位置，方便画手持道具。
    """
    c = CHAR[who]
    col = (lambda cc: sil) if sil else (lambda cc: cc)
    leg = c["leg"] * s * (0.55 if sit else 1)
    body, bw, hr, arm, lw = c["body"] * s, c["bw"] * s, c["hr"] * s, c["arm"] * s, c["lw"] * s
    skin = col(mix(SKIN, (240, 95, 85), red))
    hip_y = y - leg
    top = hip_y - body
    hcx, hcy = x, top - hr * 0.78

    # 腿
    for sg, ang in ((-1, legs[0]), (1, legs[1])):
        hx = x + sg * bw * 0.22
        if sit:
            foot = (hx + sg * bw * 0.12, y)
        else:
            a = math.radians(ang)
            foot = (hx + math.sin(a) * leg, hip_y + math.cos(a) * leg)
        p.line([(hx, hip_y), foot], col(c["pants"] if who != "girl" else skin), lw * (0.8 if who == "girl" else 1.05))
        p.ellipse(foot[0] + sg * lw * 0.25, foot[1] - lw * 0.15, lw * 0.85, lw * 0.45, fill=col(c["shoe"]))

    # 身体
    p.rect(x - hr * 0.25, top - hr * 0.3, x + hr * 0.25, top + 8, fill=skin)
    if who == "girl":
        p.poly([(x - bw * 0.42, top + 2 * s), (x + bw * 0.42, top + 2 * s),
                (x + bw * 0.85, hip_y + 18 * s), (x - bw * 0.85, hip_y + 18 * s)], fill=col(c["shirt"]))
        if not sil:
            p.chord(x, top + 2 * s, bw * 0.34, bw * 0.2, 0, 180, fill=WHITE)
            for i in range(5):
                p.circle(x - bw * 0.5 + i * bw * 0.25, hip_y + 5 * s, 3.5 * s, fill=(255, 245, 220))
    else:
        p.rect(x - bw / 2, top, x + bw / 2, hip_y + 8 * s, fill=col(c["shirt"]), r=bw * 0.3)
        if not sil and who == "dad":
            p.poly([(x - bw * 0.16, top), (x + bw * 0.16, top), (x, top + bw * 0.2)], fill=(240, 240, 245))
            p.line([(x, top + bw * 0.25), (x, hip_y)], (55, 100, 170), 2, cap=False)
        if not sil and who == "boy":
            star(p, x, top + body * 0.45, bw * 0.2, (255, 220, 90))
    if not sil and "apron" in extras:
        p.rect(x - bw * 0.36, top + bw * 0.3, x + bw * 0.36, hip_y + 14 * s, fill=(250, 240, 228), r=8)
        p.rect(x - bw * 0.2, top + bw * 0.55, x + bw * 0.2, top + bw * 0.85, fill=(240, 150, 150), r=4)

    shoulder_y = top + 16 * s
    hands = {}

    def draw_arm(sg, spec):
        sx = x + sg * (bw * 0.42 if who == "girl" else bw / 2 - lw * 0.3)
        if spec == "head":
            hand = (hcx + sg * hr * 0.95, hcy - hr * 0.1)
            pts = [(sx, shoulder_y), (sx + sg * arm * 0.5, shoulder_y - arm * 0.25), hand]
        elif isinstance(spec, tuple):
            hand = spec
            pts = [(sx, shoulder_y), hand]
        else:
            a = math.radians(spec)
            hand = (sx + sg * math.sin(a) * arm, shoulder_y + math.cos(a) * arm)
            pts = [(sx, shoulder_y), hand]
        p.line(pts, skin, lw * 0.85)
        sleeve = (lerp(pts[0][0], pts[1][0], 0.38), lerp(pts[0][1], pts[1][1], 0.38))
        p.line([pts[0], sleeve], col(c["shirt"]), lw * 1.05)
        p.circle(hand[0], hand[1], lw * 0.62, fill=skin)
        hands["l" if sg < 0 else "r"] = hand

    later = []
    for sg, spec in ((-1, arms[0]), (1, arms[1])):
        (later.append((sg, spec)) if spec == "head" else draw_arm(sg, spec))

    head(p, hcx, hcy, hr, who, expr, t, red, sil)
    for sg, spec in later:
        draw_arm(sg, spec)

    if not sil and "headset" in extras:
        hc = (45, 45, 55)
        p.arc(hcx, hcy - hr * 0.1, hr * 1.12, hr * 1.1, 185, 355, hc, hr * 0.12)
        for sg in (-1, 1):
            p.ellipse(hcx + sg * hr * 1.05, hcy + hr * 0.05, hr * 0.17, hr * 0.28, fill=hc)
        p.line([(hcx - hr * 1.05, hcy + hr * 0.2), (hcx - hr * 0.55, hcy + hr * 0.6)], hc, 3)
        p.circle(hcx - hr * 0.5, hcy + hr * 0.62, 5, fill=hc)

    return dict(lh=hands.get("l"), rh=hands.get("r"), head=(hcx, hcy, hr), top=top, hip=hip_y)


def walk_legs(t, amp=20, speed=9):
    a = math.sin(t * speed) * amp
    return (a, -a)


# ---------------------------------------------------------------- 背景（静态，按进程缓存）

def vgrad(c0, c1, h0=0, h1=H):
    a = np.clip((np.arange(H * SS) / SS - h0) / (h1 - h0), 0, 1)[:, None, None]
    arr = (np.array(c0, float) * (1 - a) + np.array(c1, float) * a).astype(np.uint8)
    return Image.fromarray(np.repeat(arr, W * SS, axis=1), "RGB")


def radial_glow(img, cx, cy, radius, color, strength):
    yy, xx = np.mgrid[0:H * SS, 0:W * SS] / SS
    k = np.clip(1 - np.hypot(xx - cx, yy - cy) / radius, 0, 1) ** 2 * strength
    arr = np.asarray(img, float)
    arr = arr * (1 - k[..., None]) + np.array(color, float) * k[..., None]
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def floor(p, y, c, plank=True):
    p.rect(0, y, W, H, fill=c)
    if plank:
        dark = mix(c, (0, 0, 0), 0.12)
        for yy in range(int(y) + 28, H, 34):
            p.line([(0, yy), (W, yy)], dark, 2, cap=False)


def window(p, x0, y0, x1, y1, sky=(170, 215, 250), curtain=(245, 170, 170), sun=True):
    p.rect(x0 - 10, y0 - 10, x1 + 10, y1 + 10, fill=(250, 250, 250), r=6)
    p.rect(x0, y0, x1, y1, fill=sky)
    if sun:
        p.circle(x0 + (x1 - x0) * 0.7, y0 + (y1 - y0) * 0.35, 30, fill=(255, 225, 110))
    p.line([((x0 + x1) / 2, y0), ((x0 + x1) / 2, y1)], (250, 250, 250), 8, cap=False)
    p.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], (250, 250, 250), 8, cap=False)
    for s, xx in ((-1, x0), (1, x1)):
        p.poly([(xx - s * 5, y0 - 20), (xx + s * 45, y0 - 20), (xx + s * 30, y1 + 25), (xx - s * 5, y1 + 25)], fill=curtain)


def sofa(p, x0, x1, y_back, y_seat, y_floor, c):
    dark = mix(c, (0, 0, 0), 0.18)
    p.rect(x0 + 20, y_back, x1 - 20, y_seat + 20, fill=c, r=28)
    p.rect(x0, y_seat - 30, x0 + 55, y_floor - 20, fill=dark, r=22)
    p.rect(x1 - 55, y_seat - 30, x1, y_floor - 20, fill=dark, r=22)
    p.rect(x0 + 40, y_seat, x1 - 40, y_floor - 25, fill=mix(c, WHITE, 0.08), r=16)
    for xx in (x0 + 60, x1 - 60):
        p.rect(xx - 8, y_floor - 30, xx + 8, y_floor, fill=(90, 60, 45), r=3)


def bg_title(p):
    rnd = random.Random(7)
    for _ in range(40):
        p.circle(rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(4, 14), fill=rgba(rnd.choice(PALETTE), 0.25))


def bg_bedroom(p):
    floor(p, 570, (205, 165, 125))
    window(p, 110, 110, 380, 320)
    p.ellipse(640, 640, 380, 45, fill=(230, 200, 210))
    # 床
    p.rect(250, 290, 300, 565, fill=(150, 100, 70), r=12)
    p.rect(950, 380, 995, 565, fill=(150, 100, 70), r=12)
    p.rect(250, 470, 995, 540, fill=(170, 118, 82), r=10)
    p.rect(290, 425, 960, 480, fill=(252, 252, 250), r=14)
    p.ellipse(372, 420, 62, 26, fill=WHITE, outline=(215, 215, 225), width=2)
    # 墙上装饰
    p.rect(560, 120, 760, 250, fill=(255, 250, 235), r=6, outline=(200, 170, 140), width=6)
    for i, cc in enumerate(PALETTE[:3]):
        p.circle(610 + i * 50, 185, 18, fill=cc)


def bg_kitchen(p):
    p.rect(0, 0, W, 60, fill=(240, 228, 205))
    floor(p, 600, (225, 205, 175))
    window(p, 120, 110, 360, 300, curtain=(170, 210, 190))
    # 橱柜与台面
    for yy in range(250, 432, 30):
        p.line([(860, yy), (W, yy)], (235, 225, 205), 2, cap=False)
    for xx in range(880, W, 40):
        p.line([(xx, 250), (xx, 430)], (235, 225, 205), 2, cap=False)
    p.rect(860, 90, W, 220, fill=(205, 160, 120), r=6)
    for xx in (960, 1100, 1220):
        p.circle(xx, 200, 6, fill=(120, 90, 70))
    p.rect(860, 430, W, 600, fill=(200, 150, 110))
    p.rect(850, 420, W, 440, fill=(240, 240, 240), r=4)
    p.rect(1080, 405, 1230, 422, fill=(60, 60, 65), r=4)


def bg_living(p):
    floor(p, 580, (190, 150, 115))
    for i, (x0, cc) in enumerate(((170, (255, 200, 150)), (330, (170, 210, 240)))):
        p.rect(x0, 110, x0 + 120, 210, fill=(255, 252, 240), outline=(170, 130, 100), width=6, r=4)
        p.circle(x0 + 60, 160, 28, fill=cc)
    sofa(p, 760, 1220, 330, 470, 585, (120, 175, 165))
    # 绿植
    p.rect(60, 520, 120, 585, fill=(200, 110, 80), r=6)
    for a in range(-60, 61, 30):
        rr = math.radians(a - 90)
        p.ellipse(90 + math.cos(rr) * 40, 500 + math.sin(rr) * 45, 16, 30, fill=(90, 170, 100))


def bg_study(p):
    floor(p, 600, (200, 165, 130))
    p.rect(30, 120, 170, 600, fill=(170, 120, 85), r=6)
    rnd = random.Random(3)
    for shelf in range(4):
        sy = 140 + shelf * 115
        p.rect(42, sy + 100, 158, sy + 108, fill=(140, 95, 65))
        xx = 46
        while xx < 138:
            w = rnd.randint(14, 26)
            hh = rnd.randint(60, 95)
            p.rect(xx, sy + 100 - hh, xx + w, sy + 100, fill=rnd.choice(PALETTE), r=2)
            xx += w + 3
    window(p, 950, 110, 1180, 300, curtain=(200, 190, 240))


def bg_night(p):
    p.circle(1010, 140, 55, fill=(255, 245, 200))
    p.circle(1035, 125, 50, fill=(22, 30, 66))
    rnd = random.Random(11)
    xx = 0
    while xx < W:
        w = rnd.randint(60, 130)
        hh = rnd.randint(120, 300)
        p.rect(xx, 440 - hh, xx + w, 460, fill=(30, 35, 65))
        for wy in range(int(440 - hh) + 15, 440, 28):
            for wx in range(xx + 10, xx + w - 12, 22):
                if rnd.random() < 0.35:
                    p.rect(wx, wy, wx + 10, wy + 14, fill=(255, 215, 120))
        xx += w + rnd.randint(5, 20)
    p.rect(0, 580, W, H, fill=(75, 70, 95))
    p.rect(0, 430, W, 446, fill=(150, 145, 170), r=4)
    for bx in range(20, W, 55):
        p.rect(bx, 446, bx + 8, 585, fill=(125, 120, 150))


def bg_warm(p):
    floor(p, 600, (185, 135, 100))
    window(p, 110, 110, 330, 290, sky=(40, 50, 100), curtain=(220, 150, 120), sun=False)
    p.circle(260, 160, 22, fill=(255, 245, 200))
    sofa(p, 360, 920, 330, 480, 605, (205, 125, 100))
    # 落地灯
    p.rect(1096, 250, 1104, 600, fill=(90, 70, 60))
    p.poly([(1050, 250), (1150, 250), (1125, 180), (1075, 180)], fill=(255, 225, 160))
    p.ellipse(1100, 600, 40, 8, fill=(90, 70, 60))


def bg_sunset(p):
    p.circle(640, 540, 120, fill=(255, 238, 180))
    p.poly([(0, 560), (0, 470), (200, 430), (420, 480), (560, 520), (0, 560)], fill=(215, 105, 95))
    p.poly([(700, 560), (880, 470), (1060, 430), (1280, 470), (1280, 560)], fill=(200, 95, 95))
    p.rect(0, 540, W, H, fill=(120, 70, 80))
    p.rect(0, 610, W, H, fill=(95, 55, 70))


BACKGROUNDS = {
    "title": (((255, 242, 210), (255, 205, 175)), bg_title, None),
    "bedroom": (((222, 232, 248), (198, 214, 240)), bg_bedroom, None),
    "kitchen": (((253, 245, 226), (245, 232, 205)), bg_kitchen, None),
    "living": (((240, 230, 250), (225, 215, 242)), bg_living, None),
    "study": (((232, 244, 226), (215, 234, 210)), bg_study, None),
    "night": (((12, 18, 52), (58, 66, 122)), bg_night, None),
    "warm": (((255, 222, 178), (240, 190, 150)), bg_warm, (1100, 230, 520, (255, 235, 180), 0.55)),
    "sunset": (((120, 80, 150), (255, 190, 120)), bg_sunset, (640, 540, 700, (255, 220, 150), 0.5)),
}


@lru_cache(maxsize=None)
def background(name):
    (c0, c1), fn, glow = BACKGROUNDS[name]
    img = vgrad(c0, c1)
    if glow:
        img = radial_glow(img, *glow)
    fn(Pen(img))
    return img


# ---------------------------------------------------------------- 场景

class Ctx:
    def __init__(self, lt, dur):
        self.t, self.dur, self.u = lt, dur, lt / dur

    def win(self, a, b, fade=0.25):
        """在进度 a~b 之间显示（带淡入淡出）的透明度。"""
        s, e = a * self.dur, b * self.dur
        return clamp((self.t - s) / fade) * clamp((e - self.t) / fade)


def scene_title(p, c):
    t = c.t
    rnd = random.Random(1)
    for i in range(26):
        x0, sp, ph = rnd.uniform(0, W), rnd.uniform(30, 70), rnd.uniform(0, H)
        y0 = (ph + t * sp) % (H + 40) - 20
        cc = rnd.choice(PALETTE)
        if i % 3 == 0:
            heart(p, x0 + math.sin(t * 2 + i) * 10, y0, 20, rgba(cc, 0.75))
        else:
            star(p, x0, y0, 10, rgba(cc, 0.75), rot=t + i)
    k = clamp(t / 0.9)
    p.text(640, 185, "奶爸日记", 120 * ease_out_back(k), (225, 85, 60), stroke=8, stroke_fill=WHITE)
    a = clamp((t - 0.9) / 0.5)
    p.text(640, 295, "一个爸爸 × 两个娃 = 每天鸡飞狗跳", 40, rgba((95, 60, 50), a), stroke=4, stroke_fill=rgba(WHITE, a))
    person(p, 460, 690 - abs(math.sin(t * 4.5)) * 25, "boy", expr="mischief", arms=(20, 160 + 15 * math.sin(t * 6)), t=t)
    person(p, 640, 700, "dad", expr="happy", arms=(20, 145 + 20 * math.sin(t * 5)), t=t)
    person(p, 820, 690 - abs(math.sin(t * 4.5 + 1.5)) * 25, "girl", expr="happy", arms=(160, 160), t=t)


def scene_morning(p, c):
    t, u = c.t, c.u
    wake = u > 0.4
    clock(p, 1080, 170, 58, t, ring=0.3 < u < 0.55)
    head(p, 372, 395, 40, "dad", expr="sleep" if not wake else ("shock" if u < 0.62 else "tired"), t=t)
    bump = math.sin(t * 11) * 3 if u > 0.3 else 0
    p.rect(415, 400 + bump, 945, 470, fill=(120, 160, 222), r=26)
    for xx in range(460, 930, 60):
        p.line([(xx, 405 + bump), (xx + 20, 465)], (150, 185, 235), 6)
    if not wake:
        zzz(p, 420, 350, t)
    else:
        sweat(p, 420, 365, 22)
    # 两个娃：先踮脚溜进来，再跳上床蹦
    for i, (who, tx) in enumerate((("boy", 620), ("girl", 800))):
        a0 = 0.02 + i * 0.04
        if u < a0 + 0.2:
            k = clamp((u - a0) / 0.2)
            x, y, legs = lerp(1380 + i * 120, tx, k), 600, walk_legs(t, 15, 7)
            arms, expr = (40, 40), "mischief"
        elif u < a0 + 0.26:
            k = (u - a0 - 0.2) / 0.06
            x, y, legs = tx, lerp(600, 432, k) - math.sin(math.pi * k) * 90, (0, 0)
            arms, expr = (150, 150), "happy"
        else:
            x, y, legs = tx, 432 - abs(math.sin(t * 5.5 + i * 1.7)) * 85, (-10, 10)
            arms, expr = (160 + 10 * math.sin(t * 8), 160 - 10 * math.sin(t * 8)), "happy"
        person(p, x, y, who, expr=expr, arms=arms, legs=legs, t=t)
    bubble(p, 620, 150, "爸爸！起床啦！", (620, 230), size=32, alpha=c.win(0.32, 0.62))
    bubble(p, 470, 250, "才六点半啊……", (410, 340), size=28, alpha=c.win(0.66, 1.0))


def cup(p, px, py, ang):
    a = math.radians(ang)

    def rot(dx, dy):
        return (px + dx * math.cos(a) - dy * math.sin(a), py + dx * math.sin(a) + dy * math.cos(a))

    p.poly([rot(-32, 0), rot(0, 0), rot(2, -46), rot(-34, -46)], fill=(250, 250, 255), outline=(140, 170, 210), width=3)
    p.poly([rot(-30, -3), rot(-2, -3), rot(0, -30), rot(-32, -30)], fill=(255, 255, 255))


def scene_breakfast(p, c):
    t, u = c.t, c.u
    spill = smooth(0.28, 0.4, u)
    person(p, 400, 600, "boy", expr="mischief" if u < 0.55 else "happy",
           arms=(25, 95 + 10 * math.sin(t * 3)), t=t)
    girl_expr = "neutral" if u < 0.3 else "shock" if u < 0.58 else "happy"
    person(p, 640, 600, "girl", expr=girl_expr, arms=(30, 70 if u < 0.45 else 30), t=t)
    # 餐桌
    p.rect(230, 462, 830, 492, fill=(245, 240, 228), r=6)
    p.rect(245, 490, 268, 600, fill=(160, 110, 75), r=4)
    p.rect(792, 490, 815, 600, fill=(160, 110, 75), r=4)
    for px in (400, 600):
        p.ellipse(px, 462, 48, 10, fill=WHITE, outline=(210, 210, 220), width=2)
    p.ellipse(600, 457, 16, 7, fill=WHITE)
    p.circle(600, 456, 6, fill=(255, 190, 40))
    # 牛奶杯倒下 + 洒一地
    if spill > 0:
        p.ellipse(760 + spill * 25, 463, 15 + spill * 70, 4 + spill * 5, fill=MILK, outline=(170, 200, 235), width=2)
        drip = clamp((u - 0.36) / 0.15)
        if drip > 0:
            p.line([(828, 468), (830, 468 + drip * 120)], MILK, 9)
            p.ellipse(840, 600, 10 + drip * 70, 4 + drip * 8, fill=MILK, outline=(170, 200, 235), width=2)
    cup(p, 735, 462, spill * 92)
    if 0.3 < u < 0.5:
        pop_word(p, 790, 380, "哗！", 36, (90, 150, 230), (u - 0.3) / 0.05)
    # 爸爸在灶台前
    dexpr = "talk" if u < 0.3 else "shock" if u < 0.48 else "tired"
    d = person(p, 1010, 600, "dad", expr=dexpr, arms=(80, 25), t=t, extras=("apron",))
    hx, hy = d["lh"]
    egg_y = hy - 14 - abs(math.sin(t * 3)) * 60
    p.line([(hx, hy), (hx - 45, hy)], (50, 50, 55), 8)
    p.ellipse(hx - 88, hy, 45, 12, fill=(50, 50, 55))
    p.ellipse(hx - 88, egg_y, 22, 8, fill=WHITE)
    p.circle(hx - 88, egg_y - 3, 7, fill=(255, 185, 40))
    if u > 0.48:
        sweat(p, 1060, 250, 20)
    bubble(p, 700, 250, "哎呀……", (650, 330), size=28, alpha=c.win(0.42, 0.62))
    bubble(p, 1010, 150, "我的天哪！", (1010, 225), size=30, alpha=c.win(0.62, 0.95))


def scene_work(p, c):
    t, u = c.t, c.u
    # 后面沙发上：枕头大战
    rnd = random.Random(5)
    for i in range(14):
        ph = (t * rnd.uniform(0.15, 0.3) + rnd.random()) % 1
        fx = 970 + rnd.uniform(-220, 220) + math.sin(t * 2 + i) * 20
        fy = 180 + ph * 380
        p.ellipse(fx, fy, 9, 4, fill=rgba(WHITE, 1 - ph * 0.6))
    for i, (who, x) in enumerate((("boy", 880), ("girl", 1080))):
        jump = abs(math.sin(t * 5 + i * 1.3)) * 40
        sw = math.sin(t * 7 + i * 2)
        arms = (30, 95 + 70 * sw) if i == 0 else (95 + 70 * sw, 30)
        k = person(p, x, 475 - jump, who, s=0.9, expr="mischief" if i == 0 else "happy", arms=arms, t=t)
        hx, hy = k["rh"] if i == 0 else k["lh"]
        p.rect(hx - 30, hy - 20, hx + 30, hy + 20, fill=(252, 252, 255), r=14, outline=(200, 200, 215), width=2)
    if u > 0.25:
        k = (t * 1.2) % 1
        pop_word(p, 980, 230, "砰！", 40, (230, 80, 60), k * 6 if k < 0.5 else 0)
    # 前景：爸爸戴着耳机开会
    shake = math.sin(t * 40) * 2.5 if u > 0.68 else 0
    dexpr = "talk" if u < 0.35 else "tired" if u < 0.68 else "angry"
    red = smooth(0.68, 0.8, u) * 0.5
    d = person(p, 360 + shake, 590, "dad", expr=dexpr, arms=(-15, -15), t=t, red=red, extras=("headset",))
    p.rect(100, 470, 640, 495, fill=(150, 105, 75), r=6)
    p.rect(120, 495, 140, 600, fill=(130, 90, 65))
    p.rect(600, 495, 620, 600, fill=(130, 90, 65))
    p.poly([(255, 470), (465, 470), (452, 372), (268, 372)], fill=(190, 196, 208), outline=(150, 155, 170), width=2)
    p.circle(360, 420, 12, fill=(225, 228, 235))
    p.rect(535, 435, 568, 470, fill=(235, 110, 90), r=5)
    p.arc(570, 452, 12, 11, 270, 90, (235, 110, 90), 5)
    hx, hy, hr = d["head"]
    if 0.35 < u < 0.68:
        sweat(p, hx + hr * 1.1, hy - hr * 0.5, 20)
    if u > 0.7:
        anger_vein(p, hx + hr * 0.55, hy - hr * 0.65, 14)
    bubble(p, 360, 150, "好的好的，方案我马上改！", (360, 225), size=28, alpha=c.win(0.03, 0.34))
    bubble(p, 520, 330, "你那边怎么这么吵？", (430, 390), size=24, fill=(220, 238, 255), alpha=c.win(0.44, 0.7))
    bubble(p, 380, 150, "……能不能安静一会儿！", (370, 225), size=30, alpha=c.win(0.74, 1.0))


def scene_homework(p, c):
    t, u = c.t, c.u
    # 妹妹在墙上涂鸦
    n = int(8 + smooth(0, 1, u) * 60)
    pts = [(215 + k * 1.6 + math.sin(k * 0.9) * 20, 330 + math.cos(k * 0.55) * 55 + k * 0.4) for k in range(n)]
    p.line(pts, (240, 90, 140), 5)
    if n > 30:
        heart(p, 300, 260, 30, (255, 170, 60))
    g = person(p, 262, 600, "girl", s=0.95, expr="mischief", arms=(30, 125 + 12 * math.sin(t * 7)), t=t)
    gx, gy = g["rh"]
    p.line([(gx, gy), (gx + 10, gy - 22)], (240, 90, 140), 7)
    # 哥哥趴在书桌前
    bexpr = "pout" if u < 0.4 else "tired" if u < 0.6 else "shock"
    b = person(p, 610, 610, "boy", expr=bexpr, arms=(35, -20), t=t)
    p.rect(390, 482, 880, 505, fill=(175, 125, 85), r=5)
    p.rect(400, 505, 870, 600, fill=(160, 112, 78), r=4)
    for dx in (520, 750):
        p.rect(dx - 50, 530, dx + 50, 570, outline=(130, 90, 60), width=3, r=4)
        p.circle(dx, 550, 5, fill=(130, 90, 60))
    p.poly([(520, 482), (610, 470), (610, 488)], fill=WHITE, outline=(190, 190, 200), width=2)
    p.poly([(700, 482), (610, 470), (610, 488)], fill=(250, 250, 245), outline=(190, 190, 200), width=2)
    p.text(560, 480, "37×8=?", 15, (200, 60, 60))
    bx, by = b["rh"]
    p.line([(bx, by), (bx - 16, by + 12)], (255, 200, 60), 6)
    p.rect(800, 400, 812, 482, fill=(90, 90, 100))
    p.poly([(770, 400), (850, 400), (830, 360), (790, 360)], fill=(120, 190, 150))
    # 爸爸：从耐心讲题 → 崩溃 → 七窍生烟
    angry = u > 0.55
    shake = math.sin(t * 45) * 3 if angry else 0
    dexpr = "talk" if u < 0.3 else "tired" if u < 0.55 else "angry"
    red = smooth(0.55, 0.78, u) * 0.75
    d = person(p, 990 + shake, 600, "dad", expr=dexpr, arms=(100, 20 if not angry else "head"), t=t, red=red)
    hx, hy, hr = d["head"]
    if 0.3 < u < 0.55:
        sweat(p, hx + hr * 1.1, hy - hr * 0.4, 20)
    if angry:
        anger_vein(p, hx + hr * 0.5, hy - hr * 0.7, 15)
        steam(p, hx, hy, hr, t, smooth(0.55, 0.7, u))
    bubble(p, 600, 280, "不想写！", (605, 345), size=30, alpha=c.win(0.08, 0.3))
    bubble(p, 930, 160, "这道题讲第八遍了……", (960, 235), size=26, alpha=c.win(0.32, 0.54))
    bubble(p, 590, 280, "还是不会……", (605, 345), size=28, alpha=c.win(0.42, 0.58))
    bubble(p, 880, 120, "你到底有没有在听！！", (950, 215), size=32, alpha=c.win(0.62, 1.0))


def scene_fight(p, c):
    t, u = c.t, c.u
    tug = math.sin(t * 4) * 22
    rx, ry = 640 + tug, 440
    gexpr = "angry" if u < 0.5 else "cry"
    person(p, 460 + tug * 0.5, 600, "boy", expr="angry", arms=(20, (rx - 30, ry + 5)), legs=(-14, 8), t=t)
    person(p, 820 + tug * 0.5, 600, "girl", expr=gexpr, arms=((rx + 30, ry + 5), 20), legs=(-8, 14), t=t)
    robot(p, rx, ry)
    # 爸爸闻声赶来，抱头崩溃
    k = smooth(0.25, 0.45, u)
    dx = lerp(1450, 1090, k)
    moving = 0.25 < u < 0.45
    d = person(p, dx, 600, "dad", expr="tired" if u > 0.45 else "shock",
               arms=("head", "head") if u > 0.45 else (30, 30), legs=walk_legs(t) if moving else (0, 0), t=t)
    hx, hy, hr = d["head"]
    if u > 0.45:
        spiral(p, hx, hy - hr * 1.5, t)
        sweat(p, hx + hr * 1.25, hy - hr * 0.2, 20)
    bubble(p, 410, 190, "是我的！", (440, 285), size=30, alpha=c.win(0.04, 0.5))
    bubble(p, 800, 180, "我先拿到的！", (815, 280), size=30, alpha=c.win(0.14, 0.5))
    bubble(p, 700, 170, "哇——爸爸！他抢我的！", (815, 280), size=28, alpha=c.win(0.52, 0.8))
    bubble(p, 350, 200, "是她先动手的！", (440, 285), size=28, alpha=c.win(0.6, 0.85))
    bubble(p, 1080, 110, "……", (1085, 175), size=30, alpha=c.win(0.84, 1.0))


def scene_night(p, c):
    t, u = c.t, c.u
    rnd = random.Random(9)
    for i in range(45):
        sx, sy = rnd.uniform(0, W), rnd.uniform(15, 300)
        if abs(sx - 1010) < 90 and sy < 220:
            continue
        a = 0.45 + 0.55 * (0.5 + 0.5 * math.sin(t * rnd.uniform(1.5, 3.5) + i))
        star(p, sx, sy, rnd.uniform(3, 6), rgba((255, 250, 220), a))
    # 地上散落的玩具
    for x0, cc in ((300, PALETTE[0]), (335, PALETTE[3]), (318, PALETTE[1])):
        p.rect(x0, 610 - (25 if cc == PALETTE[1] else 0), x0 + 28, 638 - (25 if cc == PALETTE[1] else 0), fill=cc, r=3)
    p.circle(950, 630, 22, fill=(240, 120, 110))
    p.arc(950, 630, 22, 10, 0, 360, WHITE, 3)
    robot(p, 1100, 628)
    expr = "tired" if u < 0.7 else "neutral"
    d = person(p, 640, 620, "dad", expr=expr, arms=(20, (700, 480)), t=t, sit=True)
    mx, my = d["rh"]
    p.rect(mx - 4, my - 30, mx + 26, my + 6, fill=(240, 240, 235), r=5)
    p.arc(mx + 28, my - 12, 9, 10, 270, 90, (240, 240, 235), 4)
    for i in range(2):
        ph = (t * 0.5 + i * 0.5) % 1
        p.line([(mx + 8 + i * 8 + math.sin(ph * 6) * 4, my - 36 - ph * 30),
                (mx + 8 + i * 8 + math.sin(ph * 6 + 1) * 4, my - 44 - ph * 30)], rgba(WHITE, 0.6 * (1 - ph)), 3)
    hx, hy, hr = d["head"]
    ph = (t / 3.2) % 1
    if u < 0.75 and ph < 0.7:
        k = ph / 0.7
        p.circle(hx - hr * 0.6 - k * 60, hy + hr * 0.3 - k * 40, 10 + k * 22, fill=rgba((230, 230, 240), 0.7 * (1 - k)))
        p.text(hx - hr * 1.6 - k * 40, hy - hr * 0.8 - k * 30, "唉……", 30, rgba(WHITE, 1 - k))


def scene_warm(p, c):
    t, u = c.t, c.u
    dexpr = "tired" if u < 0.3 else "shock" if u < 0.42 else "happy"
    hug = u > 0.6
    bk, gk = smooth(0.06, 0.3, u), smooth(0.14, 0.38, u)
    bx, gx = lerp(-120, 480, bk), lerp(1400, 800, gk)
    d = person(p, 640, 575, "dad", expr=dexpr,
               arms=((560, 470), (730, 470)) if hug else (15, 15), t=t, sit=True)
    p.rect(385, 525, 895, 580, fill=(215, 135, 110), r=14)
    b = person(p, bx, 605, "boy", expr="happy" if u > 0.3 else "neutral",
               arms=(165, 165) if u > 0.3 else (30, 30), legs=walk_legs(t) if 0.06 < u < 0.3 else (0, 0), t=t)
    person(p, gx, 605, "girl", expr="happy", arms=(40, 40) if not hug else ((690, 440), 30),
           legs=walk_legs(t) if 0.14 < u < 0.38 else (0, 0), t=t)
    if u > 0.3:
        lx, ly = b["lh"]
        rx, ry = b["rh"]
        kid_drawing(p, (lx + rx) / 2, min(ly, ry) - 92)
    if u > 0.42:
        rnd = random.Random(4)
        for i in range(12):
            sp = rnd.uniform(0.18, 0.35)
            ph = ((t - 0.42 * c.dur) * sp + rnd.random()) % 1
            hx0 = 640 + rnd.uniform(-330, 330) + math.sin(t * 2 + i) * 15
            heart(p, hx0, 560 - ph * 480, rnd.uniform(18, 34), rgba(rnd.choice(((240, 80, 100), (255, 130, 150))), 0.85 * (1 - ph)))
    hx, hy, hr = d["head"]
    if u > 0.72:
        p.circle(hx + hr * 0.52, hy + hr * 0.3 + ((t * 0.8) % 1) * 12, 4.5, fill=(140, 200, 255))
    bubble(p, 440, 120, "爸爸，你辛苦啦！", (470, 180), size=30, alpha=c.win(0.32, 0.58))
    bubble(p, 860, 170, "我们最爱你！", (810, 255), size=30, alpha=c.win(0.5, 0.78))
    bubble(p, 640, 110, "有你们真好。", (645, 190), size=30, alpha=c.win(0.8, 1.0))


def scene_end(p, c):
    t, u = c.t, c.u
    sil = (62, 38, 58)
    gx = 470 + u * 340
    bob = abs(math.sin(t * 4.5)) * 4
    lm, rm = (gx - 88, 482 - bob), (gx + 88, 482 - bob)
    person(p, gx - 150, 612 - bob, "boy", arms=(20, lm), legs=walk_legs(t, 16, 4.5), sil=sil)
    person(p, gx + 150, 612 - bob, "girl", arms=(rm, 20), legs=walk_legs(t + 0.7, 16, 4.5), sil=sil)
    person(p, gx, 612, "dad", arms=(lm, rm), legs=walk_legs(t, 14, 4.5), sil=sil)
    rnd = random.Random(2)
    for i in range(10):
        ph = (t * rnd.uniform(0.1, 0.2) + rnd.random()) % 1
        heart(p, rnd.uniform(80, 1200) + math.sin(t + i) * 12, 560 - ph * 420, rnd.uniform(14, 28),
              rgba((255, 110, 130), 0.7 * (1 - ph)))
    for text, y, size, col, a0 in (("孩子带来的烦恼很多", 90, 56, WHITE, 0.15),
                                   ("但快乐，永远比烦恼更多", 170, 60, (255, 240, 190), 0.42),
                                   ("—— 致每一位奶爸 ——", 240, 34, WHITE, 0.72)):
        a = clamp((u - a0) / 0.1)
        p.text(640, y + (1 - a) * 15, text, size, rgba(col, a), stroke=4, stroke_fill=rgba((150, 70, 90), a))


# 权重决定各场景在总时长中所占比例；captions 为 (进度, 字幕)。
SCENES = [
    dict(bg="title", w=0.8, draw=scene_title, captions=[]),
    dict(bg="bedroom", w=1.3, draw=scene_morning,
         captions=[(0.0, "清晨六点半，闹钟还没响……"), (0.3, "娃，先“响”了！")]),
    dict(bg="kitchen", w=1.3, draw=scene_breakfast,
         captions=[(0.0, "一边煎蛋，一边看娃"), (0.3, "一转身——"), (0.45, "牛奶洒了一地，早饭吃成了“战场”")]),
    dict(bg="living", w=1.5, draw=scene_work,
         captions=[(0.0, "居家办公，爸爸在开会"), (0.3, "身后，两个娃在“打仗”"), (0.66, "会议开成了“现场直播”")]),
    dict(bg="study", w=1.6, draw=scene_homework,
         captions=[(0.0, "写作业时间到——"), (0.3, "一道题，讲了八遍"), (0.58, "爸爸气得……七窍生烟！")]),
    dict(bg="living", w=1.3, draw=scene_fight,
         captions=[(0.0, "抢玩具、告状、哭闹……"), (0.52, "爸爸每天都在“断案”")]),
    dict(bg="night", w=1.4, draw=scene_night,
         captions=[(0.0, "夜深了，娃终于睡着了"), (0.33, "看着满地狼藉，累到不想说话"), (0.68, "可是……日子还得继续")]),
    dict(bg="warm", w=1.6, draw=scene_warm,
         captions=[(0.0, "就在快要崩溃的时候……"), (0.32, "一张画，一句“爸爸辛苦啦”"), (0.64, "所有的烦恼，一下子都化了")]),
    dict(bg="sunset", w=1.4, draw=scene_end, captions=[]),
]


# ---------------------------------------------------------------- 歌词 / 字幕特效

LYRIC_EFFECTS = ["bounce", "type", "wave", "pop", "slide", "rainbow", "stamp"]
BURSTS = ["stars", "hearts", "notes", "confetti"]
LYRIC_Y = 650


def note(p, x, y, s, fill):
    p.ellipse(x, y, s * 0.42, s * 0.32, fill=fill)
    p.line([(x + s * 0.36, y), (x + s * 0.36, y - s * 1.2)], fill, s * 0.14, cap=False)
    p.poly([(x + s * 0.36, y - s * 1.2), (x + s * 0.85, y - s * 0.9), (x + s * 0.36, y - s * 0.85)], fill=fill)


def burst(p, kind, cx, cy, lt, seed, spread):
    """每句开头从文字处炸开一圈小粒子。"""
    if lt > 0.9:
        return
    k = lt / 0.9
    rnd = random.Random(seed)
    for i in range(16):
        ang = rnd.uniform(-math.pi, 0) if rnd.random() < 0.75 else rnd.uniform(0, math.pi)
        dist = rnd.uniform(0.5, 1.0) * (1 - (1 - k) ** 3)
        x = cx + rnd.uniform(-spread, spread) * 0.9 + math.cos(ang) * 160 * dist
        y = cy + math.sin(ang) * 110 * dist + k * k * 40
        a = 1 - k
        cc = rnd.choice(PALETTE)
        sz = rnd.uniform(10, 20)
        if kind == "stars":
            star(p, x, y, sz, rgba((255, 225, 90), a), rot=lt * 4 + i)
        elif kind == "hearts":
            heart(p, x, y, sz * 1.6, rgba(cc, a))
        elif kind == "notes":
            note(p, x, y, sz * 1.2, rgba(cc, a))
        else:
            rr = math.radians(i * 37 + lt * 400)
            w, h = sz * 0.9, sz * 0.4
            p.poly([(x + math.cos(rr) * w - math.sin(rr) * h, y + math.sin(rr) * w + math.cos(rr) * h),
                    (x - math.cos(rr) * w - math.sin(rr) * h, y - math.sin(rr) * w + math.cos(rr) * h),
                    (x - math.cos(rr) * w + math.sin(rr) * h, y - math.sin(rr) * w - math.cos(rr) * h),
                    (x + math.cos(rr) * w + math.sin(rr) * h, y + math.sin(rr) * w - math.cos(rr) * h)], fill=rgba(cc, a))


def hsv(h, s=0.65, v=1.0):
    import colorsys
    return tuple(int(c * 255) for c in colorsys.hsv_to_rgb(h % 1, s, v))


def draw_lyric(p, text, lt, dur, idx, effect=None):
    """逐字特效。每句轮换一种效果（也可在 LRC 中用 {效果名} 指定），并在句首放一次粒子爆发。"""
    size = 46
    f = font(size * SS)
    widths = [f.getlength(ch) / SS for ch in text]
    total = sum(widths)
    if total > W - 120:
        size *= (W - 120) / total
        widths = [w * (W - 120) / total for w in widths]
        total = W - 120
    eff = effect if effect in LYRIC_EFFECTS else LYRIC_EFFECTS[idx % len(LYRIC_EFFECTS)]
    col = mix(PALETTE[idx % len(PALETTE)], (0, 0, 0), 0.25)
    out = clamp((dur - lt) / 0.3)            # 句尾：淡出并上浮
    rise = (1 - out) * 22
    n = max(1, len(text))
    y0 = LYRIC_Y - rise

    burst(p, BURSTS[idx % len(BURSTS)], 640, y0, lt, idx * 7 + 1, total / 2)

    shake = 0.0
    if eff == "stamp":
        k = clamp(lt / 0.22)
        if 0.22 < lt < 0.5:
            shake = math.sin(lt * 90) * 5 * (0.5 - lt) / 0.28
            for i in range(10):
                ang = i * math.pi / 5 + 0.3
                r0 = total / 2 + 20
                p.line([(640 + math.cos(ang) * r0, y0 + math.sin(ang) * 40),
                        (640 + math.cos(ang) * (r0 + 40), y0 + math.sin(ang) * 65)], rgba(col, (0.5 - lt) / 0.28), 4)
    type_n = int(lt / clamp(dur * 0.5 / n, 0.03, 0.09)) + 1

    x = 640 - total / 2
    for i, (ch, w) in enumerate(zip(text, widths)):
        cx = x + w / 2
        x += w
        if ch.isspace():
            continue
        a, dx, dy, sc = out, shake, 0.0, 1.0
        fill, stroke = WHITE, col
        if eff == "bounce":
            k = clamp((lt - i * 0.05) / 0.35)
            dy = -(1 - ease_out_back(k)) * 70
            a *= clamp(k * 3)
        elif eff == "type":
            if i >= type_n:
                continue
            if i == type_n - 1 and type_n < n and int(lt * 6) % 2 == 0:
                p.rect(cx + w / 2 + 2, y0 - size * 0.45, cx + w / 2 + 6, y0 + size * 0.45, fill=rgba(WHITE, a))
        elif eff == "wave":
            a *= clamp((lt - i * 0.03) / 0.2)
            dy = math.sin(lt * 6 - i * 0.6) * 9
        elif eff == "pop":
            k = clamp((lt - i * 0.02) / 0.35)
            sc = ease_out_back(k)
            dx = (cx - 640) * (sc - 1)
        elif eff == "slide":
            k = smooth(0, 1, (lt - i * 0.04) / 0.3)
            dx = (1 - k) * 320
            a *= k
        elif eff == "rainbow":
            fill, stroke = hsv(i / n + lt * 0.4), (60, 40, 70)
            dy = math.sin(lt * 5 + i * 0.8) * 5
            a *= clamp((lt - i * 0.03) / 0.2)
        elif eff == "stamp":
            k = clamp(lt / 0.22)
            sc = lerp(2.4, 1.0, k * k)
            dx += (cx - 640) * (sc - 1)
            a *= k
        if a <= 0.01 or sc <= 0.05:
            continue
        p.text(cx + dx + 3, y0 + dy + 4, ch, size * sc, rgba((0, 0, 0), a * 0.35))
        p.text(cx + dx, y0 + dy, ch, size * sc, rgba(fill, a), stroke=4, stroke_fill=rgba(stroke, a))


def parse_lyrics(path, offset, total):
    """读取 LRC / SRT / VTT / 纯文本。纯文本按行均分总时长。返回 [(开始, 结束, 文本, 效果)]。"""
    raw = open(path, encoding="utf-8-sig").read()
    items = []
    ext = os.path.splitext(path)[1].lower()
    if ext in (".srt", ".vtt"):
        pat = re.compile(r"(\d+):(\d+):(\d+)[.,](\d+)\s*-->\s*(\d+):(\d+):(\d+)[.,](\d+)[^\n]*\n(.*?)(?:\n\s*\n|\Z)", re.S)
        for m in pat.finditer(raw):
            g = m.groups()
            st = int(g[0]) * 3600 + int(g[1]) * 60 + int(g[2]) + int(g[3]) / 10 ** len(g[3])
            text = re.sub(r"<[^>]+>", "", " ".join(g[8].strip().splitlines())).strip()
            items.append((st, text))
    elif re.search(r"^\[\d+:\d+", raw, re.M):
        for ln in raw.splitlines():
            stamps = re.findall(r"\[(\d+):(\d+(?:\.\d+)?)\]", ln)
            text = re.sub(r"\[[^\]]*\]", "", ln).strip()
            for mi, se in stamps:
                items.append((int(mi) * 60 + float(se), text))
    else:
        rows = [r.strip() for r in raw.splitlines() if r.strip()]
        items = [(total * i / len(rows), r) for i, r in enumerate(rows)]
    items.sort()
    lines = []
    for i, (st, text) in enumerate(items):
        end = items[i + 1][0] if i + 1 < len(items) else min(total, st + 6)
        eff = None
        m = re.match(r"\{(\w+)\}\s*(.*)", text)
        if m:
            eff, text = m.group(1), m.group(2)
        if text:
            lines.append((st + offset, end + offset, text, eff))
    return lines


def story_lines(times):
    lines = []
    for sc, (st, d) in zip(SCENES, times):
        caps = sc["captions"]
        for j, (a, text) in enumerate(caps):
            end = st + (caps[j + 1][0] if j + 1 < len(caps) else 1.0) * d
            lines.append((st + a * d, end, text, None))
    return lines


# ---------------------------------------------------------------- 场景转场

TRANSITIONS = ["iris", "slide", "heart", "diag", "stars", "zoom", "blinds", "iris"]
TR_DUR = 0.7


def transition(a_img, b_img, k, kind):
    """a_img → b_img，k∈[0,1]。所有图都是 SS 尺寸。"""
    k = smooth(0, 1, k)
    size = a_img.size
    if kind == "slide":
        out = Image.new("RGB", size)
        off = int(k * size[0])
        out.paste(a_img, (-off, 0))
        out.paste(b_img, (size[0] - off, 0))
        return out
    if kind == "zoom":
        z = 1 + k * 0.6
        cw, ch = int(size[0] / z), int(size[1] / z)
        x0, y0 = (size[0] - cw) // 2, (size[1] - ch) // 2
        za = a_img.crop((x0, y0, x0 + cw, y0 + ch)).resize(size, Image.BILINEAR)
        return Image.blend(za, b_img, k)
    mask = Image.new("L", size, 0)
    m = Pen(mask, None)
    deco = []
    if kind == "iris":
        r = k * 780
        m.circle(640, 360, r, fill=255)
        deco.append(lambda p: p.circle(640, 360, r, outline=(255, 255, 255), width=10))
    elif kind == "heart":
        hs = k * 2200
        heart(m, 640, 400, hs, 255)
    elif kind == "diag":
        x = lerp(-900, W + 200, k)
        m.poly([(x, 0), (x + 700, 0), (x + 200, H), (x - 500, H)], fill=255)
        m.rect(0, 0, max(0, x + 1), H, fill=255)
        m.poly([(0, 0), (x + 1, 0), (x - 499, H), (0, H)], fill=255)
    elif kind == "stars":
        for gy in range(0, H + 120, 120):
            for gx in range(0, W + 120, 120):
                off = ((gx + gy) / (W + H)) * 0.5
                kk = clamp((k - off) / 0.5)
                if kk > 0:
                    star(m, gx + (60 if (gy // 120) % 2 else 0), gy, kk * 150, 255, rot=kk * 2)
    elif kind == "blinds":
        for i in range(10):
            kk = clamp(k * 1.6 - i * 0.06)
            x0 = i * W / 10
            m.rect(x0, 0, x0 + W / 10 * kk + 1, H, fill=255)
    out = Image.composite(b_img, a_img, mask)
    if deco and 0 < k < 1:
        p = Pen(out)
        for d in deco:
            d(p)
    return out


# ---------------------------------------------------------------- 渲染

def init_worker(cfg):
    CFG.update(cfg)


def locate(t):
    for k, (start, dur) in enumerate(CFG["times"]):
        if t < start + dur or k == len(CFG["times"]) - 1:
            return k, min(t - start, dur - 1e-6), dur


def render_scene(k, lt):
    sc = SCENES[k]
    dur = CFG["times"][k][1]
    img = background(sc["bg"]).copy()
    sc["draw"](Pen(img), Ctx(lt, dur))
    return img


def render_frame(i):
    t = i / CFG["fps"]
    k, lt, dur = locate(t)
    img = render_scene(k, lt)
    if k > 0 and lt < TR_DUR:
        prev = render_scene(k - 1, CFG["times"][k - 1][1] - 1e-3)
        img = transition(prev, img, lt / TR_DUR, TRANSITIONS[(k - 1) % len(TRANSITIONS)])
    p = Pen(img)
    for j, (st, en, text, eff) in enumerate(CFG["lines"]):
        if st <= t < en:
            draw_lyric(p, text, t - st, en - st, j, eff)
    img = img.reduce(SS)
    f = clamp(min(t / 0.6, (CFG["total"] - t) / 1.5))  # 片头淡入、片尾淡出
    if f < 1:
        img = Image.blend(Image.new("RGB", img.size), img, f)
    return img.tobytes()


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("找不到 ffmpeg：请安装 ffmpeg，或 pip install imageio-ffmpeg")


def find_font(user_font):
    for f in ([user_font] if user_font else []) + FONT_CANDIDATES:
        if f and os.path.exists(f):
            return f
    sys.exit("找不到中文字体，请用 --font 指定一个 .ttf/.ttc/.otf 字体文件")


def audio_duration(ffmpeg, path):
    err = subprocess.run([ffmpeg, "-i", path], capture_output=True, text=True).stderr
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    if not m:
        sys.exit(f"无法读取音频时长：{path}\n{err[-500:]}")
    h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + float(s)


def main():
    ap = argparse.ArgumentParser(description="奶爸日记：原创动画 + 外部音轨")
    ap.add_argument("--audio", help="音轨文件（原视频配音/配乐），画面时长将自动匹配")
    ap.add_argument("--out", default="output/naiba.mp4")
    ap.add_argument("--duration", type=float, default=90, help="无音频时的总时长（秒）")
    ap.add_argument("--fps", type=int, default=FPS)
    ap.add_argument("--lyrics", help="歌词文件（.lrc/.srt/.vtt/.txt），每句自动配特效")
    ap.add_argument("--lyrics-offset", type=float, default=0.0, help="歌词整体偏移（秒，可为负）")
    ap.add_argument("--no-subs", action="store_true", help="不显示字幕/歌词")
    ap.add_argument("--font", help="中文字体路径")
    ap.add_argument("--workers", type=int, default=os.cpu_count())
    ap.add_argument("--stills", help="只导出每个场景的截图到该目录")
    args = ap.parse_args()

    ffmpeg = find_ffmpeg()
    total = audio_duration(ffmpeg, args.audio) if args.audio else args.duration
    wsum = sum(s["w"] for s in SCENES)
    times, start = [], 0.0
    for s in SCENES:
        d = total * s["w"] / wsum
        times.append((start, d))
        start += d
    if args.no_subs:
        lines = []
    elif args.lyrics:
        lines = parse_lyrics(args.lyrics, args.lyrics_offset, total)
        print(f"读取歌词 {len(lines)} 句")
    else:
        lines = story_lines(times)
    cfg = dict(font=find_font(args.font), fps=args.fps, times=times, total=total, lines=lines)

    if args.stills:
        init_worker(cfg)
        os.makedirs(args.stills, exist_ok=True)
        for k, (st, d) in enumerate(times):
            for frac in (0.02, 0.2, 0.5, 0.85):
                i = int((st + d * frac) * args.fps)
                img = Image.frombytes("RGB", (W, H), render_frame(i))
                img.save(os.path.join(args.stills, f"{k:02d}_{SCENES[k]['bg']}_{int(frac * 100)}.png"))
        print(f"截图已导出到 {args.stills}")
        return

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    n = int(math.ceil(total * args.fps))
    cmd = [ffmpeg, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(args.fps), "-i", "-"]
    if args.audio:
        cmd += ["-i", args.audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", args.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    print(f"渲染 {n} 帧（{total:.1f} 秒，{args.fps}fps）→ {args.out}")
    with Pool(args.workers, initializer=init_worker, initargs=(cfg,)) as pool:
        for i, frame in enumerate(pool.imap(render_frame, range(n), chunksize=4)):
            proc.stdin.write(frame)
            if i % (args.fps * 5) == 0:
                print(f"  {i / n * 100:5.1f}%", flush=True)
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit("ffmpeg 编码失败")
    print("完成：", args.out)


if __name__ == "__main__":
    main()
