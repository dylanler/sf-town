"""
Generate simple city-themed spritesheet PNGs that match the existing JSON
layouts used by Pixi in this project. This overwrites the images in
public/assets/spritesheets/ so no code changes are required.

Sheets produced (identical filenames/sizes to current ones):
- campfire.png          → 128x32 (4 frames of 32x32)  [now: steam vent]
- gentlesparkle32.png   → 192x320 (top row has 3 frames of 32x32) [now: window blink]
- gentlewaterfall32.png → 192x320 (row at y=32 has 6 frames of 32x96) [now: bay water]
- windmill.png          → 624x624 (grid of 3x3, 8 frames at 208x208) [now: radar dish]

The JSONs in data/animations/*.json already expect these exact dimensions and
frame placements.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Tuple

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/assets/spritesheets"


def _ensure_out() -> None:
    OUT.mkdir(parents=True, exist_ok=True)


def _new_canvas(width: int, height: int, color: Tuple[int, int, int, int] = (0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", (width, height), color)


def _draw_checker_bg(img: Image.Image, cell: int = 8) -> None:
    # very light checker to hint transparency when viewed directly
    draw = ImageDraw.Draw(img)
    w, h = img.size
    c1 = (235, 235, 235, 255)
    c2 = (245, 245, 245, 255)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=c1 if ((x // cell + y // cell) % 2 == 0) else c2)


def generate_campfire_replacement() -> None:
    # 4 frames (32x32) across → 128x32
    canvas = _new_canvas(128, 32)
    draw = ImageDraw.Draw(canvas)
    # steam puff rising from a street vent
    base_colors = [(140, 140, 140, 255), (170, 170, 170, 255), (200, 200, 200, 255), (230, 230, 230, 255)]
    for i in range(4):
        ox = i * 32
        # vent grate
        draw.rectangle([ox + 8, 22, ox + 24, 28], fill=(70, 70, 70, 255))
        for bar in range(8, 25, 3):
            draw.line([(ox + bar, 22), (ox + bar, 28)], fill=(110, 110, 110, 255))
        # steam puff at different heights/sizes
        r = 6 + i  # grows slightly
        cx, cy = ox + 16, 18 - i * 2
        col = base_colors[i]
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        # subtle highlight
        draw.ellipse([cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3], fill=(255, 255, 255, 60))
    (OUT / "campfire.png").unlink(missing_ok=True)
    canvas.save(OUT / "campfire.png")


def generate_gentlesparkle_replacement() -> None:
    # 192x320; JSON uses only three 32x32 frames at top-left row
    canvas = _new_canvas(192, 320)
    # background left transparent; draw three 32x32 tiles that simulate
    # blinking window lights in a high-rise
    for i in range(3):
        tile = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        # building silhouette
        d.rectangle([2, 2, 29, 29], outline=(40, 40, 60, 255), width=2)
        # windows pattern; vary lit windows per frame
        lit = [(5, 7), (9, 7), (13, 7), (17, 7), (21, 7), (25, 7), (5, 15), (9, 15), (13, 15), (17, 15), (21, 15), (25, 15)]
        for (wx, wy) in lit:
            on = ((wx + wy + i * 3) // 4) % 2 == 0
            color = (255, 230, 120, 255) if on else (60, 60, 70, 255)
            d.rectangle([wx, wy, wx + 2, wy + 2], fill=color)
        canvas.alpha_composite(tile, (i * 32, 0))
    (OUT / "gentlesparkle32.png").unlink(missing_ok=True)
    canvas.save(OUT / "gentlesparkle32.png")


def generate_gentlewaterfall_replacement() -> None:
    # 192x320; JSON expects six frames (32x96) starting at y=32
    canvas = _new_canvas(192, 320)
    for i in range(6):
        tile = Image.new("RGBA", (32, 96), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        # bay water stripes with a phase shift
        for y in range(0, 96):
            # sine-like wave offset per frame
            phase = (i / 6.0) * 2 * math.pi
            s = int(4 * math.sin(phase + y / 8.0))
            color = (70, 140, 200, 255) if (y + s) % 8 < 4 else (60, 120, 180, 255)
            d.line([(0, y), (31, y)], fill=color)
        # highlights
        for y in range(0, 96, 8):
            d.line([(0, y), (31, y)], fill=(180, 220, 255, 70))
        canvas.alpha_composite(tile, (i * 32, 32))
    (OUT / "gentlewaterfall32.png").unlink(missing_ok=True)
    canvas.save(OUT / "gentlewaterfall32.png")


def generate_windmill_replacement() -> None:
    # 624x624; 8 frames arranged in a 3x3 grid of 208px tiles
    canvas = _new_canvas(624, 624)
    tile_w = tile_h = 208
    positions = [
        (0, 0), (208, 0), (416, 0),
        (0, 208), (208, 208), (416, 208),
        (0, 416), (208, 416),
    ]
    # Traffic light: draw a static housing with changing light per frame
    # Cycle: green → yellow → red → red+red (blink) → red → yellow → green → off
    cycle = [
        ("green", (0, 200, 0, 255)),
        ("yellow", (230, 200, 40, 255)),
        ("red", (220, 40, 40, 255)),
        ("red", (220, 40, 40, 180)),  # softer blink
        ("red", (220, 40, 40, 255)),
        ("yellow", (230, 200, 40, 255)),
        ("green", (0, 200, 0, 255)),
        ("off", (80, 80, 80, 120)),
    ]
    for idx, (ox, oy) in enumerate(positions):
        tile = Image.new("RGBA", (tile_w, tile_h), (0, 0, 0, 0))
        d = ImageDraw.Draw(tile)
        # pole
        d.rectangle([96, 40, 112, tile_h - 10], fill=(80, 80, 90, 255))
        # housing box
        d.rounded_rectangle([72, 60, 136, 180], radius=12, fill=(35, 35, 40, 255), outline=(90, 90, 100, 255), width=3)
        # three sockets
        sockets = [(104, 80), (104, 112), (104, 144)]  # centers
        radius = 18
        for (cx, cy) in sockets:
            d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(25, 25, 28, 255))
        # active light color based on frame
        stage, col = cycle[idx]
        if stage in ("green", "yellow", "red", "off"):
            # map stage to index: green bottom, yellow middle, red top
            target_idx = {"red": 0, "yellow": 1, "green": 2}.get(stage, None)
            if target_idx is not None:
                cx, cy = sockets[target_idx]
                glow = Image.new("RGBA", (tile_w, tile_h), (0, 0, 0, 0))
                gd = ImageDraw.Draw(glow)
                for r in range(22, 52, 6):
                    alpha = max(0, 120 - (r - 22) * 6)
                    gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(col[0], col[1], col[2], alpha))
                tile = Image.alpha_composite(tile, glow)
                d.ellipse([cx - radius + 2, cy - radius + 2, cx + radius - 2, cy + radius - 2], fill=col)
        # mount arms
        d.rectangle([136, 96, tile_w - 20, 106], fill=(80, 80, 90, 255))
        canvas.alpha_composite(tile, (ox, oy))
    (OUT / "windmill.png").unlink(missing_ok=True)
    canvas.save(OUT / "windmill.png")


def main() -> None:
    _ensure_out()
    generate_campfire_replacement()
    generate_gentlesparkle_replacement()
    generate_gentlewaterfall_replacement()
    generate_windmill_replacement()
    print("Spritesheets regenerated in:", OUT)


if __name__ == "__main__":
    main()


