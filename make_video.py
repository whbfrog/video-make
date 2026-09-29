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
import json
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



# ---------------------------------------------------------------- 节奏：节拍 / 重音 / 能量

class Rhythm:
    """节拍网格。pos(t) 为第几拍（浮点），accent(i) 为第 i 拍鼓点强度 0~1。"""

    def __init__(self, bpm, offset, total, accents=None, energy=None):
        self.bpm, self.P, self.offset, self.total = bpm, 60.0 / bpm, offset, total
        self.acc = None if accents is None else np.asarray(accents, float)
        self.energy = energy

    def pos(self, t):
        return (t - self.offset) / self.P

    def t_of(self, i):
        return self.offset + i * self.P

    def snap(self, t):
        return self.t_of(round(self.pos(t)))

    def snap_strong(self, t, reach=1):
        """吸附到附近鼓点最重的一拍（用于场景切换）。"""
        c, x = round(self.pos(t)), self.pos(t)
        best = max(range(c - reach, c + reach + 1), key=lambda i: self.accent(i) - 0.35 * abs(i - x))
        return self.t_of(best)

    def accent(self, i):
        if self.acc is None or i < 0 or i >= len(self.acc):
            return 0.7
        return float(self.acc[i])

    def energy_at(self, t):
        if self.energy is None:
            return 0.6
        return float(np.interp(t, *self.energy))


def onset_envelope(y, sr, hop):
    try:
        import librosa
        S = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop, n_mels=64))
        full = librosa.onset.onset_strength(S=S, sr=sr, hop_length=hop)
        low = librosa.onset.onset_strength(S=S[:8], sr=sr, hop_length=hop)   # 低频 = 底鼓
        return full / (full.max() + 1e-9) + low / (low.max() + 1e-9)
    except ImportError:  # 没装 librosa：用 numpy 算频谱通量
        n = 1024
        frames = np.lib.stride_tricks.sliding_window_view(np.pad(y, (n // 2, n // 2)), n)[::hop]
        mag = np.log1p(np.abs(np.fft.rfft(frames * np.hanning(n), axis=1)))
        flux = np.maximum(0, np.diff(mag, axis=0, prepend=mag[:1])).sum(axis=1)
        return flux / (flux.max() + 1e-9)


def analyze_audio(ffmpeg, path, total, bpm=None, offset=None):
    sr, hop = 22050, 256
    raw = subprocess.run([ffmpeg, "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"],
                         capture_output=True).stdout
    y = np.frombuffer(raw, np.float32).copy()
    env = onset_envelope(y, sr, hop)
    fps_env = sr / hop
    loose = np.max([np.roll(env, s) for s in range(-2, 3)], axis=0)   # 允许 ±2 帧误差

    def score(b, o):
        g = np.arange(o, total, 60.0 / b)
        return loose[np.clip((g * fps_env).astype(int), 0, len(env) - 1)].mean()

    def best_offset(b, steps):
        offs = np.linspace(0, 60.0 / b, steps, endpoint=False)
        sc = [score(b, o) for o in offs]
        k = int(np.argmax(sc))
        return offs[k], sc[k]

    if bpm is None:
        cands = [(b, best_offset(b, 24)[1]) for b in np.arange(60, 181, 0.5)]
        top = max(s for _, s in cands)
        # 分数接近最高的候选里，选最接近 100 BPM 的（避免被三连音/八分音符带偏成 1.5 倍、2 倍）
        bpm = min((b for b, s in cands if s >= 0.88 * top), key=lambda b: abs(b - 100))
        fine = [(b, *best_offset(b, 120)) for b in np.arange(bpm - 0.5, bpm + 0.51, 0.05)]
        bpm, offset, _ = max(fine, key=lambda x: x[2])
    elif offset is None:
        offset = best_offset(bpm, 240)[0]
    P = 60.0 / bpm
    nb = int((total - offset) / P) + 2
    idx = np.clip((np.array([offset + i * P for i in range(nb)]) * fps_env).astype(int), 0, len(env) - 1)
    acc = loose[idx]
    acc = np.clip(acc / (np.percentile(acc, 95) + 1e-9), 0, 1)
    # 能量：RMS，1 秒平滑后归一化
    n = len(y) // hop
    rms = np.sqrt((y[:n * hop].reshape(n, hop) ** 2).mean(axis=1))
    k = int(fps_env)
    rms = np.convolve(rms, np.ones(k) / k, mode="same")
    lo, hi = np.percentile(rms, 5), np.percentile(rms, 95)
    ev = np.clip((rms - lo) / (hi - lo + 1e-9), 0, 1)
    return Rhythm(float(bpm), float(offset), total, acc, (np.arange(n) / fps_env, ev))


def plan_scenes(total, rh, sections=None):
    """各场景起止时间：优先用歌曲段落，否则按权重分配；切点都吸附到拍点。"""
    if sections and len(sections) == len(SCENES):
        starts = [0.0] + [rh.snap(s) for s in sections[1:]]
    else:
        wsum, acc, starts = sum(s["w"] for s in SCENES), 0.0, [0.0]
        for s in SCENES[:-1]:
            acc += s["w"]
            starts.append(rh.snap_strong(total * acc / wsum))
    starts.append(total)
    return [(starts[i], starts[i + 1] - starts[i]) for i in range(len(SCENES))]


# ---------------------------------------------------------------- 场景（跟节拍走）

class Ctx:
    """场景上下文：局部时间 + 节拍工具。所有“事件”都吸附到最近的拍点上。"""

    def __init__(self, lt, dur, start):
        self.t, self.dur, self.u, self.start = lt, dur, lt / dur, start
        self.T = start + lt
        self.rh = CFG["rhythm"]
        self.pos = self.rh.pos(self.T)
        self.b0 = math.ceil(self.rh.pos(start) - 1e-6)
        self.beat = self.pos - self.b0          # 本场景第几拍（浮点）
        self.e = self.rh.energy_at(self.T)      # 当前音乐能量 0~1

    # ---- 事件时间（按场景进度给出，吸附到拍点）
    def at(self, frac):
        return self.rh.snap(self.start + frac * self.dur)

    def after(self, frac):
        return self.T >= self.at(frac)

    def since(self, frac):
        return self.T - self.at(frac)

    def ramp(self, a, b):
        s, e = self.at(a), self.at(b)
        if e <= s:
            return 1.0 if self.T >= s else 0.0
        return smooth(s, e, self.T)

    def win(self, a, b, fade=0.18):
        s, e = self.at(a), self.at(b)
        return clamp((self.T - s) / fade) * clamp((e - self.T) / fade)

    def beat_time(self, k):
        return self.rh.t_of(self.b0 + k)

    # ---- 跟着节拍的动作曲线
    def hop(self, n=1, lag=0.0):
        """拍点上落地（0），两拍之间腾空（1）。"""
        x = self.pos / n - lag
        ph = x - math.floor(x)
        return 4 * ph * (1 - ph)

    def swing(self, n=1, lag=0.0):
        """在 ±1 之间来回，每 n 拍到一次极值（极值正好在拍点上）。"""
        return math.cos(math.pi * (self.pos / n - lag))

    def kick(self, decay=5.0, sub=1):
        """拍点瞬间为 1，然后衰减；鼓点越重越大。sub=3 为三连音细分。"""
        x = self.pos * sub
        ph = x - math.floor(x)
        return math.exp(-ph * decay) * (0.55 + 0.45 * self.rh.accent(math.floor(self.pos)))

    def walk(self, amp=18, n=1):
        a = amp * self.swing(n)
        return (a, -a)

    def bidx(self):
        return math.floor(self.beat)

    def bph(self):
        return self.beat - math.floor(self.beat)


def scene_title(p, c):
    t, k = c.t, c.kick()
    rnd = random.Random(1)
    for i in range(26):
        x0, sp, ph = rnd.uniform(0, W), rnd.uniform(30, 70), rnd.uniform(0, H)
        y0 = (ph + t * sp) % (H + 40) - 20
        cc = rnd.choice(PALETTE)
        if i % 3 == 0:
            heart(p, x0, y0, 20 * (1 + 0.4 * k), rgba(cc, 0.75))
        else:
            star(p, x0, y0, 10 * (1 + 0.4 * k), rgba(cc, 0.75), rot=c.pos * 0.5 + i)
    # 四个字，每拍“砸”下来一个
    for i, ch in enumerate("奶爸日记"):
        kk = clamp((c.T - c.beat_time(1 + i)) / 0.25)
        if kk <= 0:
            continue
        sc = ease_out_back(kk) * (1 + 0.08 * k)
        p.text(640 + (i - 1.5) * 128, 185 - (1 - kk) * 50, ch, 124 * sc, (225, 85, 60), stroke=8, stroke_fill=WHITE)
    a = clamp((c.T - c.beat_time(5)) / 0.3)
    p.text(640, 300, "一个爸爸 × 两个娃 = 每天鸡飞狗跳", 40, rgba((95, 60, 50), a), stroke=4, stroke_fill=rgba(WHITE, a))
    person(p, 460, 690 - c.hop() * 30, "boy", expr="mischief", arms=(20, 160 + 18 * c.swing()), t=t)
    person(p, 640, 700 - c.hop() * 8, "dad", expr="happy", arms=(20, 140 + 28 * c.swing()), t=t)
    person(p, 820, 690 - c.hop(lag=0.5) * 30, "girl", expr="happy",
           arms=(160 + 12 * c.swing(), 160 - 12 * c.swing()), t=t)


def scene_morning(p, c):
    t, P = c.t, c.rh.P
    jump_at = 0.3
    wake = c.after(0.42)
    ring = c.after(jump_at) and not c.after(0.62)
    clock(p, 1080, 170, 58 * (1 + 0.06 * c.kick(sub=3)) if ring else 58, t, ring=ring)
    dexpr = "sleep" if not wake else ("shock" if not c.after(0.62) else "tired")
    head(p, 372, 395, 40, "dad", expr=dexpr, t=t)
    lift = (c.swing(n=2) * 4) if not c.after(jump_at) else c.kick() * 8   # 睡着时两拍一呼吸，娃跳时被震
    p.rect(415, 400 - lift, 945, 470, fill=(120, 160, 222), r=26)
    for xx in range(460, 930, 60):
        p.line([(xx, 405 - lift), (xx + 20, 465)], (150, 185, 235), 6)
    if not wake:
        zzz(p, 420, 350, t)
    else:
        sweat(p, 420, 365, 22)
    if 0 <= c.since(0.42) < 1.0:
        pop_word(p, 330, 320, "！！", 40, (230, 60, 50), c.since(0.42) / 0.2)
    # 两个娃：踩着拍子溜进来 → 一拍跳上床 → 每拍一蹦（妹妹落在反拍）
    for i, (who, tx) in enumerate((("boy", 620), ("girl", 800))):
        e0, e1 = 0.0 + i * 0.05, 0.22 + i * 0.03
        if not c.after(jump_at):
            k = c.ramp(e0, e1)
            x = lerp(1380 + i * 120, tx, k)
            y = 600 - c.hop() * 6
            legs = c.walk(16) if k < 1 else (0, 0)
            arms, expr = (40 + 10 * c.swing(), 40 - 10 * c.swing()), "mischief"
        elif c.since(jump_at) < P:
            k = c.since(jump_at) / P
            x, y, legs = tx, lerp(600, 432, k) - math.sin(math.pi * k) * 100, (0, 0)
            arms, expr = (150, 150), "happy"
        else:
            x = tx
            y = 432 - c.hop(lag=0.5 * i) * (70 + 30 * c.e)
            legs = (-10, 10)
            arms, expr = (160 + 12 * c.swing(), 160 - 12 * c.swing()), "happy"
        person(p, x, y, who, expr=expr, arms=arms, legs=legs, t=t)
    bubble(p, 620, 150, "爸爸！起床啦！", (620, 230), size=32, alpha=c.win(0.34, 0.62))
    bubble(p, 470, 250, "才六点半啊……", (410, 340), size=28, alpha=c.win(0.68, 1.0))


def cup(p, px, py, ang):
    a = math.radians(ang)

    def rot(dx, dy):
        return (px + dx * math.cos(a) - dy * math.sin(a), py + dx * math.sin(a) + dy * math.cos(a))

    p.poly([rot(-32, 0), rot(0, 0), rot(2, -46), rot(-34, -46)], fill=(250, 250, 255), outline=(140, 170, 210), width=3)
    p.poly([rot(-30, -3), rot(-2, -3), rot(0, -30), rot(-32, -30)], fill=(255, 255, 255))


def scene_breakfast(p, c):
    t, P = c.t, c.rh.P
    spill_at = 0.3
    spill = min(ease_out_back(clamp(c.since(spill_at) / (P * 0.5))), 1.05) if c.after(spill_at) else 0.0
    # 哥哥用勺子敲桌子，一拍一下
    b = person(p, 400, 600, "boy", expr="mischief" if not c.after(0.55) else "happy",
               arms=(25, 75 + 45 * c.swing()), t=t)
    bx, by = b["rh"]
    p.line([(bx, by), (bx - 8, by - 26)], (190, 190, 200), 5)
    p.ellipse(bx - 9, by - 30, 7, 5, fill=(190, 190, 200))
    girl_expr = "neutral" if not c.after(spill_at) else "shock" if not c.after(0.58) else "happy"
    person(p, 640, 600 - c.hop(lag=0.5) * 6, "girl", expr=girl_expr,
           arms=(30 + 15 * c.swing(lag=0.5), 70 if not c.after(0.45) else 30), t=t)
    # 餐桌（盘子随拍子跳一下）
    j = c.kick() * 4
    p.rect(230, 462, 830, 492, fill=(245, 240, 228), r=6)
    p.rect(245, 490, 268, 600, fill=(160, 110, 75), r=4)
    p.rect(792, 490, 815, 600, fill=(160, 110, 75), r=4)
    for px in (400, 600):
        p.ellipse(px, 462 - j, 48, 10, fill=WHITE, outline=(210, 210, 220), width=2)
    p.ellipse(600, 457 - j, 16, 7, fill=WHITE)
    p.circle(600, 456 - j, 6, fill=(255, 190, 40))
    if spill > 0:
        s1 = min(spill, 1.0)
        p.ellipse(760 + s1 * 25, 463, 15 + s1 * 70, 4 + s1 * 5, fill=MILK, outline=(170, 200, 235), width=2)
        drip = clamp((c.since(spill_at) - P * 0.5) / (P * 3))
        if drip > 0:
            p.line([(828, 468), (830, 468 + drip * 120)], MILK, 9)
            p.ellipse(840, 600, 10 + drip * 70, 4 + drip * 8, fill=MILK, outline=(170, 200, 235), width=2)
    cup(p, 735, 462, spill * 92)
    if 0 <= c.since(spill_at) < 1.2:
        pop_word(p, 790, 380, "哗！", 40, (90, 150, 230), c.since(spill_at) / 0.2)
    # 爸爸颠勺：蛋每两拍翻一次，正好在拍点落回锅里
    dexpr = "talk" if not c.after(spill_at) else "shock" if not c.after(0.48) else "tired"
    d = person(p, 1010, 600 - c.hop() * 5, "dad", expr=dexpr, arms=(80 + 8 * c.kick(), 25), t=t, extras=("apron",))
    hx, hy = d["lh"]
    egg_y = hy - 14 - c.hop(n=2) * 90
    ew = 4 + 20 * abs(math.cos(math.pi * c.pos / 2))
    p.line([(hx, hy), (hx - 45, hy)], (50, 50, 55), 8)
    p.ellipse(hx - 88, hy, 45, 12, fill=(50, 50, 55))
    p.ellipse(hx - 88, egg_y, 22, ew * 0.4 + 3, fill=WHITE)
    if ew > 12:
        p.circle(hx - 88, egg_y - 3, 7, fill=(255, 185, 40))
    if c.after(0.48):
        sweat(p, 1060, 250, 20)
    bubble(p, 700, 250, "哎呀……", (650, 330), size=28, alpha=c.win(0.4, 0.62))
    bubble(p, 1010, 150, "我的天哪！", (1010, 225), size=30, alpha=c.win(0.62, 0.95))


def feather_burst(p, x, y, c, n=10):
    ph = c.bph()
    rnd = random.Random(c.bidx())
    for _ in range(n):
        ang = rnd.uniform(0, 2 * math.pi)
        sp = rnd.uniform(60, 140)
        p.ellipse(x + math.cos(ang) * sp * ph, y + math.sin(ang) * sp * ph + ph * ph * 60, 9, 4,
                  fill=rgba(WHITE, 1 - ph))


def scene_work(p, c):
    t = c.t
    rnd = random.Random(5)
    for i in range(12):
        ph = (t * rnd.uniform(0.15, 0.3) + rnd.random()) % 1
        fx = 970 + rnd.uniform(-220, 220) + math.sin(t * 2 + i) * 20
        p.ellipse(fx, 180 + ph * 380, 9, 4, fill=rgba(WHITE, 0.8 - ph * 0.5))
    # 枕头大战：你一拍我一拍
    for i, (who, x) in enumerate((("boy", 880), ("girl", 1080))):
        jump = c.hop(lag=0.5 * i) * 40
        sw = c.swing(lag=i)
        arms = (30, 95 + 70 * sw) if i == 0 else (95 + 70 * sw, 30)
        k = person(p, x, 475 - jump, who, s=0.9, expr="mischief" if i == 0 else "happy", arms=arms, t=t)
        hx, hy = k["rh"] if i == 0 else k["lh"]
        p.rect(hx - 30, hy - 20, hx + 30, hy + 20, fill=(252, 252, 255), r=14, outline=(200, 200, 215), width=2)
    if c.after(0.2):
        feather_burst(p, 980, 330, c)
        if c.bph() < 0.45:
            pop_word(p, 980, 230, "砰！" if c.bidx() % 2 == 0 else "啪！", 40, (230, 80, 60), c.bph() * 5)
    # 前景：爸爸戴耳机开会，跟着拍子点头
    angry = c.after(0.7)
    shake = (c.kick(sub=3) * 5 * (1 if c.bidx() % 2 else -1)) if angry else 0
    dexpr = "talk" if not c.after(0.35) else "tired" if not angry else "angry"
    red = c.ramp(0.7, 0.8) * 0.5
    d = person(p, 360 + shake, 590 + c.kick() * 4, "dad", expr=dexpr, arms=(-15, -15), t=t, red=red,
               extras=("headset",))
    p.rect(100, 470, 640, 495, fill=(150, 105, 75), r=6)
    p.rect(120, 495, 140, 600, fill=(130, 90, 65))
    p.rect(600, 495, 620, 600, fill=(130, 90, 65))
    p.poly([(255, 470), (465, 470), (452, 372), (268, 372)], fill=(190, 196, 208), outline=(150, 155, 170), width=2)
    p.circle(360, 420, 12, fill=(225, 228, 235))
    mj = c.kick() * 5
    p.rect(535, 435 - mj, 568, 470 - mj, fill=(235, 110, 90), r=5)
    p.arc(570, 452 - mj, 12, 11, 270, 90, (235, 110, 90), 5)
    hx, hy, hr = d["head"]
    if c.after(0.35) and not angry:
        sweat(p, hx + hr * 1.1, hy - hr * 0.5, 20)
    if angry:
        anger_vein(p, hx + hr * 0.55, hy - hr * 0.65, 12 + 6 * c.kick())
    bubble(p, 360, 150, "好的好的，方案我马上改！", (360, 225), size=28, alpha=c.win(0.03, 0.34))
    bubble(p, 520, 330, "你那边怎么这么吵？", (430, 390), size=24, fill=(220, 238, 255), alpha=c.win(0.44, 0.7))
    bubble(p, 380, 150, "……能不能安静一会儿！", (370, 225), size=30, alpha=c.win(0.74, 1.0))


def scene_fight(p, c):
    t = c.t
    tug = 26 * c.swing()
    rx, ry = 640 + tug, 440
    gexpr = "angry" if not c.after(0.5) else "cry"
    person(p, 460 + tug * 0.5, 600, "boy", expr="angry", arms=(20, (rx - 30, ry + 5)), legs=(-14, 8), t=t)
    person(p, 820 + tug * 0.5, 600, "girl", expr=gexpr, arms=((rx + 30, ry + 5), 20), legs=(-8, 14), t=t)
    robot(p, rx, ry)
    ph = c.bph()   # 每一拍，玩具上迸出火花
    for i in range(6):
        ang = -math.pi / 2 + (i - 2.5) * 0.45
        star(p, rx + math.cos(ang) * (30 + ph * 70), ry - 30 + math.sin(ang) * (30 + ph * 70), 9,
             rgba((255, 210, 60), 1 - ph))
    k = c.ramp(0.2, 0.42)
    arrived = c.after(0.42)
    d = person(p, lerp(1450, 1090, k), 600 - (c.hop() * 6 if arrived else 0), "dad",
               expr="tired" if arrived else "shock",
               arms=("head", "head") if arrived else (30 + 20 * c.swing(), 30 - 20 * c.swing()),
               legs=c.walk(22) if 0 < k < 1 else (0, 0), t=t)
    hx, hy, hr = d["head"]
    if arrived:
        spiral(p, hx, hy - hr * 1.5, c.pos * 0.4)
        sweat(p, hx + hr * 1.25, hy - hr * 0.2, 20)
    bubble(p, 410, 190, "是我的！", (440, 285), size=30, alpha=c.win(0.04, 0.5))
    bubble(p, 800, 180, "我先拿到的！", (815, 280), size=30, alpha=c.win(0.14, 0.5))
    bubble(p, 700, 170, "哇——爸爸！他抢我的！", (815, 280), size=28, alpha=c.win(0.52, 0.8))
    bubble(p, 350, 200, "是她先动手的！", (440, 285), size=28, alpha=c.win(0.6, 0.85))
    bubble(p, 1080, 110, "……", (1085, 175), size=30, alpha=c.win(0.84, 1.0))


def study_desk(p, c, boy_expr, boy_arms, boy_y=610):
    b = person(p, 610, boy_y, "boy", expr=boy_expr, arms=boy_arms, t=c.t)
    p.rect(390, 482, 880, 505, fill=(175, 125, 85), r=5)
    p.rect(400, 505, 870, 600, fill=(160, 112, 78), r=4)
    for dx in (520, 750):
        p.rect(dx - 50, 530, dx + 50, 570, outline=(130, 90, 60), width=3, r=4)
        p.circle(dx, 550, 5, fill=(130, 90, 60))
    p.poly([(520, 482), (610, 470), (610, 488)], fill=WHITE, outline=(190, 190, 200), width=2)
    p.poly([(700, 482), (610, 470), (610, 488)], fill=(250, 250, 245), outline=(190, 190, 200), width=2)
    p.text(560, 480, "37×8=?", 15, (200, 60, 60))
    p.rect(800, 400, 812, 482, fill=(90, 90, 100))
    p.poly([(770, 400), (850, 400), (830, 360), (790, 360)], fill=(120, 190, 150))
    return b


def scene_homework(p, c):
    """越讲越气，怒气一点点憋着——爆发留给下一段副歌。"""
    t = c.t
    n = int(8 + min(62, c.bidx() * 3))   # 涂鸦每拍多画一笔
    pts = [(215 + k * 1.6 + math.sin(k * 0.9) * 20, 330 + math.cos(k * 0.55) * 55 + k * 0.4) for k in range(n)]
    p.line(pts, (240, 90, 140), 5)
    if n > 30:
        heart(p, 300, 260, 30 * (1 + 0.2 * c.kick()), (255, 170, 60))
    g = person(p, 262, 600, "girl", s=0.95, expr="mischief", arms=(30, 125 + 15 * c.swing()), t=t)
    gx, gy = g["rh"]
    p.line([(gx, gy), (gx + 10, gy - 22)], (240, 90, 140), 7)
    b = study_desk(p, c, "pout" if not c.after(0.45) else "tired", (35, -20 + 14 * c.kick()))
    bx, by = b["rh"]
    p.line([(bx, by), (bx - 16, by + 12)], (255, 200, 60), 6)
    # 爸爸：手指一拍一点，脸越来越红
    boil = c.after(0.62)
    shake = c.kick(sub=3) * 3 * (1 if c.bidx() % 2 else -1) if c.after(0.8) else 0
    dexpr = "talk" if not c.after(0.3) else "tired" if not boil else "angry"
    d = person(p, 990 + shake, 600, "dad", expr=dexpr, arms=(100 + 12 * c.kick(), 20), t=t,
               red=c.ramp(0.55, 1.0) * 0.6)
    hx, hy, hr = d["head"]
    if c.after(0.3) and not boil:
        sweat(p, hx + hr * 1.1, hy - hr * 0.4, 20)
    if boil:
        anger_vein(p, hx + hr * 0.5, hy - hr * 0.7, 10 + 7 * c.kick())
    if c.after(0.82):
        steam(p, hx, hy, hr, c.pos * 0.35, 0.35)
    bubble(p, 600, 280, "不想写！", (605, 345), size=30, alpha=c.win(0.05, 0.26))
    bubble(p, 930, 160, "这道题讲第八遍了……", (960, 235), size=26, alpha=c.win(0.28, 0.5))
    bubble(p, 590, 280, "还是不会……", (605, 345), size=28, alpha=c.win(0.46, 0.64))
    bubble(p, 930, 160, "深呼吸……冷静……", (960, 235), size=28, alpha=c.win(0.68, 0.96))


def scene_explode(p, c):
    """七窍生烟，原地爆炸。"""
    t, k = c.t, c.kick()
    hx0, hy0 = 990, 285
    for i in range(28):   # 漫画式怒气放射线，每拍闪一次
        ang = i * 2 * math.pi / 28 + c.bidx() * 0.11
        p.line([(hx0 + math.cos(ang) * 150, hy0 + math.sin(ang) * 150),
                (hx0 + math.cos(ang) * 1400, hy0 + math.sin(ang) * 1400)], rgba((255, 90, 60), 0.12 + 0.35 * k), 10)
    rnd = random.Random(8)   # 满屋子作业纸乱飞
    for i in range(9):
        ph = (c.pos / 2 + rnd.random()) % 1
        px = rnd.uniform(100, 1180) + math.sin(ph * math.pi * 2 + i) * 60
        py = 620 - ph * 700
        rr = math.radians(ph * 360 * (1 if i % 2 else -1))
        pts = [(px + math.cos(rr) * dx - math.sin(rr) * dy, py + math.sin(rr) * dx + math.cos(rr) * dy)
               for dx, dy in ((-26, -34), (26, -34), (26, 34), (-26, 34))]
        p.poly(pts, fill=(255, 255, 250), outline=(200, 200, 210), width=2)
    person(p, 262, 600 - c.hop(lag=0.5) * 20, "girl", s=0.95, expr="shock", arms=("head", "head"), t=t)
    study_desk(p, c, "shock", ("head", "head"), boy_y=640)
    # 爸爸：每拍跺一脚，挥拳，头顶和两耳冒烟
    sh = c.kick(sub=3) * 6 * (1 if c.bidx() % 2 else -1)
    fist = c.swing()
    d = person(p, 990 + sh, 600 - c.hop() * 14, "dad", expr="angry",
               arms=(150 + 22 * fist, 150 - 22 * fist), t=t, red=0.85)
    hx, hy, hr = d["head"]
    steam(p, hx, hy, hr, c.pos * 0.5, 1.0)
    anger_vein(p, hx + hr * 0.5, hy - hr * 0.75, 14 + 10 * k)
    anger_vein(p, hx - hr * 0.6, hy - hr * 0.5, 10 + 8 * k)
    fill = c.ramp(0.0, 0.18)   # 怒气值，爆表
    p.rect(1160, 170, 1200, 470, fill=WHITE, r=20, outline=INK, width=3)
    p.rect(1166, 464 - 288 * fill, 1194, 464, fill=(235, 60, 50), r=14)
    p.circle(1180, 490, 30, fill=(235, 60, 50), outline=INK, width=3)
    p.text(1180, 140, "怒气值", 24, INK, stroke=3, stroke_fill=WHITE)
    if fill >= 1 and c.bidx() % 2 == 0:
        p.text(1180, 540, "爆表！", 26, (230, 40, 40), stroke=3, stroke_fill=WHITE)
    kk = clamp(c.since(0.0) / 0.25)   # 大字第一拍盖章砸下，之后随节拍跳
    if kk > 0:
        sc = lerp(2.6, 1.0, kk * kk) * (1 + 0.1 * k)
        p.text(560, 120, "七窍生烟！", 76 * sc, rgba((230, 50, 40), kk), stroke=8, stroke_fill=rgba(WHITE, kk))
    bubble(p, 880, 150, "啊啊啊——！！", (950, 225), size=32, alpha=c.win(0.3, 0.6))
    bubble(p, 610, 300, "我、我再想想……", (612, 380), size=26, alpha=c.win(0.62, 0.95))


TOYS = [(170, "block", PALETTE[0]), (290, "ball", (240, 120, 110)), (400, "block", PALETTE[3]),
        (1180, "robot", None), (520, "block", PALETTE[1]), (1060, "ball", (110, 170, 240)),
        (230, "block", PALETTE[2]), (1130, "block", PALETTE[4])]


def toy(p, kind, x, y, col, rot=0.0):
    if kind == "ball":
        p.circle(x, y - 18, 18, fill=col)
        p.arc(x, y - 18, 18, 8, 0, 360, WHITE, 3)
    elif kind == "robot":
        robot(p, x, y - 34)
    else:
        a = math.radians(rot)
        p.poly([(x + math.cos(a) * dx - math.sin(a) * dy, y - 14 + math.sin(a) * dx + math.cos(a) * dy)
                for dx, dy in ((-14, -14), (14, -14), (14, 14), (-14, 14))], fill=col)


def scene_night(p, c):
    """夜深了，一个人收拾，玩具两拍一个飞进箱子。"""
    t = c.t
    rnd = random.Random(9)
    for i in range(45):
        sx, sy = rnd.uniform(0, W), rnd.uniform(15, 300)
        if abs(sx - 1010) < 90 and sy < 220:
            continue
        x = c.pos * 3 + i * 0.37
        a = 0.35 + 0.65 * math.exp(-(x - math.floor(x)) * 4) if i % 3 == 0 else 0.6
        star(p, sx, sy, rnd.uniform(3, 6), rgba((255, 250, 220), a))
    box_x, box_y = 800, 610
    for i, (x0, kind, col) in enumerate(TOYS):
        launch = 1 + 2 * i
        if c.beat < launch:
            toy(p, kind, x0, 632, col)
        elif c.beat < launch + 1:
            k = c.beat - launch
            toy(p, kind, lerp(x0, box_x, k), lerp(632, box_y - 30, k) - math.sin(math.pi * k) * 190, col, rot=k * 360)
    if not c.after(0.72):
        reach = c.swing()
        person(p, 620, 625 - c.hop() * 6, "dad", expr="tired", arms=(100 + 40 * reach, 60 - 40 * reach), t=t)
    else:
        d = person(p, 640, 625, "dad", expr="tired" if not c.after(0.86) else "neutral",
                   arms=(20, (700, 485)), t=t, sit=True)
        mx, my = d["rh"]
        p.rect(mx - 4, my - 30, mx + 26, my + 6, fill=(240, 240, 235), r=5)
        p.arc(mx + 28, my - 12, 9, 10, 270, 90, (240, 240, 235), 4)
        hx, hy, hr = d["head"]
        k = clamp(c.since(0.76) / (c.rh.P * 3))
        if 0 < k < 1:
            p.circle(hx - hr * 0.6 - k * 60, hy + hr * 0.3 - k * 40, 10 + k * 22, fill=rgba((230, 230, 240), 0.7 * (1 - k)))
            p.text(hx - hr * 1.6 - k * 40, hy - hr * 0.8 - k * 30, "唉……", 30, rgba(WHITE, 1 - k))
    p.rect(box_x - 75, box_y - 70, box_x + 75, box_y + 20, fill=(215, 150, 90), r=8, outline=(150, 95, 55), width=3)
    p.text(box_x, box_y - 25, "玩具箱", 22, (120, 70, 40))
    if 2 <= c.beat < 2 * len(TOYS) + 1 and c.bidx() % 2 == 0 and c.bph() < 0.5:
        pop_word(p, box_x + 60, box_y - 100, "咚！", 26, (230, 140, 60), c.bph() * 5)


def scene_warm(p, c):
    """一张画、一个拥抱，全家跟着节拍一起晃。"""
    t = c.t
    dexpr = "tired" if not c.after(0.18) else "shock" if not c.after(0.3) else "happy"
    hug = c.after(0.5)
    sway = 10 * c.swing(n=2) if hug else 0
    bk, gk = c.ramp(0.02, 0.2), c.ramp(0.06, 0.26)
    bx, gx = lerp(-120, 480, bk) + sway, lerp(1400, 800, gk) + sway
    if c.after(0.3):   # 爱心：每拍从中间炸开一圈
        ph = c.bph()
        for i in range(10):
            ang = i * 2 * math.pi / 10 + c.bidx() * 0.3
            heart(p, 640 + math.cos(ang) * (80 + ph * 330), 330 + math.sin(ang) * (60 + ph * 220),
                  22 + 12 * (i % 2), rgba((240, 80, 100) if i % 2 else (255, 140, 160), 0.8 * (1 - ph)))
    d = person(p, 640 + sway, 575, "dad", expr=dexpr,
               arms=((560 + sway, 470), (730 + sway, 470)) if hug else (15, 15), t=t, sit=True)
    p.rect(385, 525, 895, 580, fill=(215, 135, 110), r=14)
    b = person(p, bx, 605 - (0 if hug else c.hop() * 12), "boy", expr="happy" if c.after(0.2) else "neutral",
               arms=(165, 165) if c.after(0.24) else (30, 30), legs=c.walk(18) if 0 < bk < 1 else (0, 0), t=t)
    person(p, gx, 605 - (0 if hug else c.hop(lag=0.5) * 12), "girl", expr="happy",
           arms=(40, 40) if not hug else ((690 + sway, 440), 30), legs=c.walk(18) if 0 < gk < 1 else (0, 0), t=t)
    if c.after(0.24):
        lx, ly = b["lh"]
        rx, ry = b["rh"]
        kk = clamp(c.since(0.24) / 0.3)
        kid_drawing(p, (lx + rx) / 2, min(ly, ry) - 92 + (1 - ease_out_back(kk)) * 40, alpha=kk)
    if hug:   # 彩纸雨
        rnd = random.Random(4)
        for i in range(24):
            ph = (c.pos * 0.25 + rnd.random()) % 1
            star(p, rnd.uniform(40, 1240) + math.sin(ph * 6 + i) * 20, -20 + ph * 740, 8,
                 rgba(rnd.choice(PALETTE), 0.9), rot=ph * 8)
    hx, hy, hr = d["head"]
    if c.after(0.7):
        p.circle(hx + hr * 0.52, hy + hr * 0.3 + c.bph() * 12, 4.5, fill=(140, 200, 255))
    bubble(p, 440, 120, "爸爸，你辛苦啦！", (470, 180), size=30, alpha=c.win(0.26, 0.5))
    bubble(p, 860, 170, "我们最爱你！", (810, 255), size=30, alpha=c.win(0.42, 0.7))
    bubble(p, 640, 110, "有你们真好。", (645, 190), size=30, alpha=c.win(0.74, 1.0))


def scene_end(p, c):
    t, u = c.t, c.u
    sil = (62, 38, 58)
    gx = 470 + u * 340
    bob = c.hop() * 5
    lm, rm = (gx - 88, 482 - bob), (gx + 88, 482 - bob)
    person(p, gx - 150, 612 - bob, "boy", arms=(20, lm), legs=c.walk(16), sil=sil)
    person(p, gx + 150, 612 - bob, "girl", arms=(rm, 20), legs=c.walk(16), sil=sil)
    person(p, gx, 612, "dad", arms=(lm, rm), legs=c.walk(14), sil=sil)
    rnd = random.Random(2)
    for i in range(10):
        ph = (t * rnd.uniform(0.1, 0.2) + rnd.random()) % 1
        heart(p, rnd.uniform(80, 1200) + math.sin(t + i) * 12, 560 - ph * 420,
              rnd.uniform(14, 28) * (1 + 0.3 * c.kick()), rgba((255, 110, 130), 0.7 * (1 - ph)))
    for text, y, size, col, a0 in (("孩子带来的烦恼很多", 90, 56, WHITE, 0.08),
                                   ("但快乐，永远比烦恼更多", 170, 60, (255, 240, 190), 0.3),
                                   ("—— 致每一位奶爸 ——", 240, 34, WHITE, 0.55)):
        kk = clamp(c.since(a0) / 0.3)
        if kk > 0:
            p.text(640, y, text, size * ease_out_back(kk), rgba(col, kk), stroke=4, stroke_fill=rgba((150, 70, 90), kk))


# 场景顺序对应歌曲结构（主歌铺垫、副歌爆发）。w：没有分段信息时的时长权重；
# cam：每拍镜头推近的力度；shake：每拍震屏；captions：(进度, 字幕)，出现时刻吸附到拍点。
SCENES = [
    dict(bg="title", w=0.6, cam=0.8, draw=scene_title, captions=[]),
    dict(bg="bedroom", w=1.3, cam=0.6, draw=scene_morning,
         captions=[(0.0, "清晨六点半，闹钟还没响……"), (0.3, "娃，先“响”了！")]),
    dict(bg="kitchen", w=1.2, cam=1.0, draw=scene_breakfast,
         captions=[(0.0, "一边煎蛋，一边看娃"), (0.26, "一转身——"), (0.4, "牛奶洒了一地，早饭吃成了“战场”")]),
    dict(bg="living", w=1.5, cam=0.6, draw=scene_work,
         captions=[(0.0, "居家办公，爸爸在开会"), (0.2, "身后，两个娃在“打仗”"), (0.66, "会议开成了“现场直播”")]),
    dict(bg="living", w=1.1, cam=1.1, draw=scene_fight,
         captions=[(0.0, "抢玩具、告状、哭闹……"), (0.5, "爸爸每天都在“断案”")]),
    dict(bg="study", w=1.6, cam=0.4, draw=scene_homework,
         captions=[(0.0, "写作业时间到——"), (0.28, "一道题，讲了八遍"), (0.66, "忍住……一定要忍住……")]),
    dict(bg="study", w=1.0, cam=1.6, shake=1.0, draw=scene_explode,
         captions=[(0.0, "忍无可忍！"), (0.3, "爸爸原地爆炸，七窍生烟！")]),
    dict(bg="night", w=1.1, cam=0.7, draw=scene_night,
         captions=[(0.0, "夜深了，娃终于睡着了"), (0.3, "一个人，收拾满地狼藉"), (0.72, "可是……日子还得继续")]),
    dict(bg="warm", w=1.3, cam=1.2, draw=scene_warm,
         captions=[(0.0, "就在快要崩溃的时候……"), (0.24, "一张画，一句“爸爸辛苦啦”"), (0.6, "所有的烦恼，一下子都化了")]),
    dict(bg="sunset", w=1.2, cam=0.5, draw=scene_end, captions=[]),
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


def story_lines(times, rh):
    """故事字幕：每句的出现时刻吸附到拍点。"""
    lines = []
    for sc, (st, d) in zip(SCENES, times):
        starts = [st if a == 0 else max(st, rh.snap(st + a * d)) for a, _ in sc["captions"]]
        for j, (_, text) in enumerate(sc["captions"]):
            end = starts[j + 1] if j + 1 < len(starts) else st + d
            lines.append((starts[j], end, text, None))
    return lines


# ---------------------------------------------------------------- 场景转场

TRANSITIONS = ["iris", "slide", "heart", "diag", "stars", "zoom", "blinds", "iris", "heart"]


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
    start, dur = CFG["times"][k]
    img = background(sc["bg"]).copy()
    sc["draw"](Pen(img), Ctx(lt, dur, start))
    return img


def camera(img, t, sc):
    """每拍镜头轻推一下（鼓点越重、音乐越满推得越多），爆发场景再加震屏。"""
    rh = CFG["rhythm"]
    x = rh.pos(t)
    kick = math.exp(-(x - math.floor(x)) * 6) * (0.55 + 0.45 * rh.accent(math.floor(x)))
    z = 1 + 0.03 * sc.get("cam", 0.6) * kick * (0.4 + 0.6 * rh.energy_at(t))
    shake = sc.get("shake", 0) * kick
    if z < 1.001 and shake < 0.01:
        return img
    rnd = random.Random(math.floor(x))
    cw, ch = W / z, H / z
    x0 = clamp((W - cw) / 2 + rnd.uniform(-1, 1) * 10 * shake, 0, W - cw)
    y0 = clamp((H - ch) / 2 + rnd.uniform(-1, 1) * 8 * shake, 0, H - ch)
    return img.transform((W, H), Image.EXTENT, (x0, y0, x0 + cw, y0 + ch), Image.BILINEAR)


def render_frame(i):
    t = i / CFG["fps"]
    k, lt, dur = locate(t)
    img = render_scene(k, lt)
    tr = CFG["tr"]
    if k > 0 and lt < tr:   # 转场从拍点开始，持续一拍
        prev = render_scene(k - 1, CFG["times"][k - 1][1] - 1e-3)
        img = transition(prev, img, lt / tr, TRANSITIONS[(k - 1) % len(TRANSITIONS)])
    p = Pen(img)
    for j, (st, en, text, eff) in enumerate(CFG["lines"]):
        if st <= t < en:
            draw_lyric(p, text, t - st, en - st, j, eff)
    img = camera(img.reduce(SS), t, SCENES[k])
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
    ap.add_argument("--song", help="歌曲配置 JSON：audio / bpm / offset / sections（各场景开始的秒数）")
    ap.add_argument("--bpm", type=float, help="手动指定 BPM（默认自动检测）")
    ap.add_argument("--beat-offset", type=float, help="第一拍所在秒数（默认自动检测）")
    args = ap.parse_args()

    song = {}
    if args.song:
        with open(args.song, encoding="utf-8") as f:
            song = json.load(f)
    audio = args.audio or song.get("audio")
    bpm = args.bpm or song.get("bpm")
    offset = args.beat_offset if args.beat_offset is not None else song.get("offset")

    ffmpeg = find_ffmpeg()
    total = audio_duration(ffmpeg, audio) if audio else args.duration
    if audio:
        rh = analyze_audio(ffmpeg, audio, total, bpm, offset)
    else:
        rh = Rhythm(bpm or 100.0, offset or 0.0, total)
    times = plan_scenes(total, rh, song.get("sections"))
    print(f"节拍：{rh.bpm:.1f} BPM，第一拍 {rh.offset:.3f}s")
    for sc, (st, d) in zip(SCENES, times):
        print(f"  {sc['draw'].__name__:<16} {st:7.2f}s  +{d:5.2f}s  (第 {rh.pos(st):.1f} 拍)")
    if args.no_subs:
        lines = []
    elif args.lyrics:
        lines = parse_lyrics(args.lyrics, args.lyrics_offset, total)
        print(f"读取歌词 {len(lines)} 句")
    else:
        lines = story_lines(times, rh)
    cfg = dict(font=find_font(args.font), fps=args.fps, times=times, total=total, lines=lines,
               rhythm=rh, tr=rh.P if rh.P >= 0.45 else 2 * rh.P)

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
    if audio:
        cmd += ["-i", audio, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest"]
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
