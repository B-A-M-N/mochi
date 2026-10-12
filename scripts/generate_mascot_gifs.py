import os
import math
import shutil
import subprocess
from PIL import Image, ImageDraw, ImageFont

W, H = 600, 600
NUM_FRAMES = 40
FPS = 12

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_BOLD = ImageFont.truetype(FONT_PATH, 16)
FONT_TAG = ImageFont.truetype(FONT_PATH, 11)
FONT_MONO = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf", 15)

def draw_speech_bubble(draw, text, tag="MOCHI", tag_bg="#8B67F6", y=70, alpha=1.0):
    """Draw a dynamic-width speech bubble perfectly centered above Mochi."""
    text_bbox = draw.textbbox((0, 0), text, font=FONT_BOLD)
    text_w = text_bbox[2] - text_bbox[0]
    tag_bbox = draw.textbbox((0, 0), tag, font=FONT_TAG)
    tag_w = tag_bbox[2] - tag_bbox[0]

    tag_pad_x = 10
    tag_total_w = tag_w + tag_pad_x * 2
    bubble_h = 42
    bubble_w = tag_total_w + 14 + text_w + 24
    bubble_x = (W - bubble_w) // 2

    # Outer subtle shadow
    draw.rounded_rectangle(
        [bubble_x - 3, y - 3, bubble_x + bubble_w + 3, y + bubble_h + 3],
        radius=14,
        fill=(139, 103, 246, int(30 * alpha)),
    )

    # Main white bubble
    draw.rounded_rectangle(
        [bubble_x, y, bubble_x + bubble_w, y + bubble_h],
        radius=12,
        fill=(255, 255, 255, int(250 * alpha)),
        outline=(139, 103, 246, int(220 * alpha)),
        width=2,
    )

    # Speech tail pointing down toward Mochi
    tx1 = W // 2 - 9
    tx2 = W // 2 + 9
    ty1 = y + bubble_h - 1
    ty2 = ty1 + 12
    draw.polygon([(tx1, ty1), (tx2, ty1), (W // 2, ty2)], fill=(255, 255, 255, int(250 * alpha)))
    draw.line([(tx1, ty1), (W // 2, ty2)], fill=(139, 103, 246, int(220 * alpha)), width=2)
    draw.line([(W // 2, ty2), (tx2, ty1)], fill=(139, 103, 246, int(220 * alpha)), width=2)

    # Tag pill
    draw.rounded_rectangle(
        [bubble_x + 10, y + 9, bubble_x + 10 + tag_total_w, y + 33],
        radius=6,
        fill=tag_bg,
    )
    draw.text((bubble_x + 10 + tag_pad_x, y + 13), tag, font=FONT_TAG, fill=(255, 255, 255, 255))

    # Main text
    draw.text((bubble_x + 10 + tag_total_w + 14, y + 11), text, font=FONT_BOLD, fill=(26, 22, 51, int(250 * alpha)))

def draw_sparkle(draw, cx, cy, radius, color=(168, 85, 247, 220)):
    """Draw a 4-point star sparkle."""
    points = [
        (cx, cy - radius),
        (cx + radius * 0.25, cy - radius * 0.25),
        (cx + radius, cy),
        (cx + radius * 0.25, cy + radius * 0.25),
        (cx, cy + radius),
        (cx - radius * 0.25, cy + radius * 0.25),
        (cx - radius, cy),
        (cx - radius * 0.25, cy - radius * 0.25),
    ]
    draw.polygon(points, fill=color)

def compile_gif(frame_dir, out_path):
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(frame_dir, "frame_%03d.png"),
        "-vf", "split[s0][s1];[s0]palettegen=reserve_transparent=on:stats_mode=full[p];[s1][p]paletteuse=dither=none:alpha_threshold=128",
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    print(f"Generated {out_path} ({os.path.getsize(out_path)} bytes)")

# ─────────────────────────────────────────────────────────────────────────────
# 1. DOCS MASCOT GIF
# ─────────────────────────────────────────────────────────────────────────────
def generate_docs_gif():
    frame_dir = "/tmp/docs_frames"
    os.makedirs(frame_dir, exist_ok=True)
    base_img = Image.open("site/public/docs-mascot.png").convert("RGBA")

    target_w, target_h = 430, 430
    mascot_crop = base_img.crop(base_img.getbbox())
    aspect = mascot_crop.width / mascot_crop.height
    if aspect > 1:
        mw = target_w
        mh = int(target_w / aspect)
    else:
        mh = target_h
        mw = int(target_h * aspect)
    mascot_resized = mascot_crop.resize((mw, mh), Image.Resampling.LANCZOS)

    messages = [
        ("Read the API Guides ✦", "DOCS"),
        ("16 Specialist Roles ✦", "ROLES"),
        ("Zero-Dep Bun Binary ★", "SETUP"),
        ("Bubblewrap Sandboxed ✓", "SECURE"),
    ]

    for i in range(NUM_FRAMES):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        t = (i / NUM_FRAMES) * 2 * math.pi
        phase_idx = (i // (NUM_FRAMES // len(messages))) % len(messages)
        text, tag = messages[phase_idx]

        bounce_y = int(math.sin(t) * 9)
        squash_x = 1.0 + 0.02 * math.cos(t)
        squash_y = 1.0 - 0.02 * math.cos(t)

        cur_mw = int(mw * squash_x)
        cur_mh = int(mh * squash_y)
        scaled_mascot = mascot_resized.resize((cur_mw, cur_mh), Image.Resampling.BILINEAR)

        mx = (W - cur_mw) // 2
        my = H - cur_mh - 25 + bounce_y
        im.paste(scaled_mascot, (mx, my), scaled_mascot)

        # Floating doc rune particles drifting upwards from the open book
        runes = ["{ }", "API", "01", "DAG", "AST"]
        for r_idx, r_text in enumerate(runes):
            r_t = (i + r_idx * 8) % NUM_FRAMES / NUM_FRAMES
            rx = 180 + r_idx * 55 + math.sin(r_t * 2 * math.pi) * 16
            ry = 380 - r_t * 220
            r_alpha = int(220 * math.sin(r_t * math.pi))
            if r_alpha > 10:
                draw.text((rx, ry), r_text, font=FONT_MONO, fill=(139, 103, 246, r_alpha))

        # Floating sparkles
        for s_idx, (sx, sy, sr) in enumerate([(90, 220, 8), (510, 260, 10), (120, 480, 6), (490, 460, 7)]):
            st = math.sin(t + s_idx * 1.5)
            s_radius = max(3, int(sr + st * 3))
            draw_sparkle(draw, sx, sy, s_radius, (168, 85, 247, int(180 + st * 50)))

        bubble_y = 65 + int(math.sin(t * 1.5) * 4)
        draw_speech_bubble(draw, text=text, tag=tag, tag_bg="#7965E8", y=bubble_y)

        im.save(f"{frame_dir}/frame_{i:03d}.png")

    out_gif = "site/public/docs-mascot.gif"
    compile_gif(frame_dir, out_gif)
    shutil.copyfile(out_gif, "docs/assets/docs-mascot.gif")
    shutil.rmtree(frame_dir)

# ─────────────────────────────────────────────────────────────────────────────
# 2. BENCHMARKS MASCOT GIF
# ─────────────────────────────────────────────────────────────────────────────
def generate_benchmarks_gif():
    frame_dir = "/tmp/benchmarks_frames"
    os.makedirs(frame_dir, exist_ok=True)
    base_img = Image.open("site/public/benchmarks-mascot.png").convert("RGBA")

    target_w, target_h = 440, 440
    mascot_crop = base_img.crop(base_img.getbbox())
    aspect = mascot_crop.width / mascot_crop.height
    if aspect > 1:
        mw = target_w
        mh = int(target_w / aspect)
    else:
        mh = target_h
        mw = int(target_h * aspect)
    mascot_resized = mascot_crop.resize((mw, mh), Image.Resampling.LANCZOS)

    messages = [
        ("38.2 ms First Input! ⚡", "TTFI"),
        ("18.2 MB Peak RSS! ✦", "MEMORY"),
        ("21.2x Lighter Runtime ★", "FOOTPRINT"),
        ("Supersonic Bun Core ⚡", "SPEED"),
    ]

    for i in range(NUM_FRAMES):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        t = (i / NUM_FRAMES) * 2 * math.pi
        phase_idx = (i // (NUM_FRAMES // len(messages))) % len(messages)
        text, tag = messages[phase_idx]

        bounce_y = int(math.sin(t * 2) * 8)
        squash_x = 1.0 + 0.03 * math.sin(t * 2)
        squash_y = 1.0 - 0.03 * math.sin(t * 2)

        cur_mw = int(mw * squash_x)
        cur_mh = int(mh * squash_y)
        scaled_mascot = mascot_resized.resize((cur_mw, cur_mh), Image.Resampling.BILINEAR)

        for l_idx in range(5):
            ly = 260 + l_idx * 55
            lx_start = (int(i * 35 + l_idx * 110) % (W + 100)) - 100
            lw = 70 + (l_idx * 25) % 80
            draw.line([(lx_start, ly), (lx_start + lw, ly)], fill=(168, 85, 247, 95), width=2)

        mx = (W - cur_mw) // 2
        my = H - cur_mh - 25 + bounce_y
        im.paste(scaled_mascot, (mx, my), scaled_mascot)

        bolt_t = (i % 8) / 8.0
        if bolt_t < 0.6:
            bx1, by1 = 110, 260
            pts = [(bx1, by1), (bx1 + 18, by1 + 25), (bx1 + 6, by1 + 35), (bx1 + 28, by1 + 65)]
            draw.line(pts, fill=(192, 132, 252, 240), width=3)
            draw.line(pts, fill=(255, 255, 255, 200), width=1)
            bx2, by2 = 470, 240
            pts2 = [(bx2, by2), (bx2 - 20, by2 + 30), (bx2 - 8, by2 + 45), (bx2 - 25, by2 + 80)]
            draw.line(pts2, fill=(192, 132, 252, 240), width=3)
            draw.line(pts2, fill=(255, 255, 255, 200), width=1)

        for s_idx, (sx, sy, sr) in enumerate([(80, 200, 9), (510, 220, 11), (95, 450, 7), (500, 480, 8)]):
            st = math.sin(t * 2 + s_idx)
            s_radius = max(3, int(sr + st * 3))
            draw_sparkle(draw, sx, sy, s_radius, (192, 132, 252, int(200 + st * 50)))

        bubble_y = 65 + int(math.sin(t * 2) * 4)
        draw_speech_bubble(draw, text=text, tag=tag, tag_bg="#6D28D9", y=bubble_y)

        im.save(f"{frame_dir}/frame_{i:03d}.png")

    out_gif = "site/public/benchmarks-mascot.gif"
    compile_gif(frame_dir, out_gif)
    shutil.copyfile(out_gif, "docs/assets/benchmarks-mascot.gif")
    shutil.rmtree(frame_dir)

# ─────────────────────────────────────────────────────────────────────────────
# 3. CHANGELOG MASCOT GIF
# ─────────────────────────────────────────────────────────────────────────────
def generate_changelog_gif():
    frame_dir = "/tmp/changelog_frames"
    os.makedirs(frame_dir, exist_ok=True)
    base_img = Image.open("site/public/changelog-mascot.png").convert("RGBA")

    target_w, target_h = 440, 440
    mascot_crop = base_img.crop(base_img.getbbox())
    aspect = mascot_crop.width / mascot_crop.height
    if aspect > 1:
        mw = target_w
        mh = int(target_w / aspect)
    else:
        mh = target_h
        mw = int(target_h * aspect)
    mascot_resized = mascot_crop.resize((mw, mh), Image.Resampling.LANCZOS)

    messages = [
        ("v0.22.0 Just Shipped! ★", "RELEASE"),
        ("35 Releases Logged ✦", "HISTORY"),
        ("1,459 Tests Passing ✓", "VERIFIED"),
        ("AST Unified Diff Engine ✦", "ENGINE"),
    ]

    confetti_colors = [
        (168, 85, 247, 220),
        (236, 72, 153, 220),
        (234, 179, 8, 220),
        (99, 102, 241, 220),
    ]

    for i in range(NUM_FRAMES):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        t = (i / NUM_FRAMES) * 2 * math.pi
        phase_idx = (i // (NUM_FRAMES // len(messages))) % len(messages)
        text, tag = messages[phase_idx]

        bounce_y = int(math.sin(t) * 8)
        squash_x = 1.0 + 0.02 * math.cos(t)
        squash_y = 1.0 - 0.02 * math.cos(t)

        cur_mw = int(mw * squash_x)
        cur_mh = int(mh * squash_y)
        scaled_mascot = mascot_resized.resize((cur_mw, cur_mh), Image.Resampling.BILINEAR)

        for c_idx in range(16):
            c_phase = ((i + c_idx * 3) % NUM_FRAMES) / NUM_FRAMES
            cx = int((c_idx * 39 + math.sin(c_phase * 2 * math.pi) * 20) % (W - 40) + 20)
            cy = int(c_phase * H)
            c_color = confetti_colors[c_idx % len(confetti_colors)]
            draw.rectangle([cx, cy, cx + 5, cy + 8], fill=c_color)

        mx = (W - cur_mw) // 2
        my = H - cur_mh - 25 + bounce_y
        im.paste(scaled_mascot, (mx, my), scaled_mascot)

        rx, ry = 485, 280 + int(math.sin(t * 2) * 14)
        draw.polygon([(rx, ry), (rx + 16, ry + 36), (rx - 16, ry + 36)], fill=(124, 58, 237, 240))
        draw.ellipse([rx - 5, ry + 12, rx + 5, ry + 22], fill=(255, 255, 255, 230))
        flame_len = 14 + int(math.sin(t * 6) * 6)
        draw.polygon([(rx - 10, ry + 36), (rx + 10, ry + 36), (rx, ry + 36 + flame_len)], fill=(245, 158, 11, 240))
        draw.polygon([(rx - 5, ry + 36), (rx + 5, ry + 36), (rx, ry + 36 + flame_len * 0.6)], fill=(254, 240, 138, 240))

        for s_idx, (sx, sy, sr) in enumerate([(90, 230, 8), (110, 470, 7), (490, 460, 9)]):
            st = math.sin(t + s_idx)
            s_radius = max(3, int(sr + st * 3))
            draw_sparkle(draw, sx, sy, s_radius, (236, 72, 153, int(190 + st * 40)))

        bubble_y = 65 + int(math.sin(t) * 4)
        draw_speech_bubble(draw, text=text, tag=tag, tag_bg="#9333EA", y=bubble_y)

        im.save(f"{frame_dir}/frame_{i:03d}.png")

    out_gif = "site/public/changelog-mascot.gif"
    compile_gif(frame_dir, out_gif)
    shutil.copyfile(out_gif, "docs/assets/changelog-mascot.gif")
    shutil.rmtree(frame_dir)

# ─────────────────────────────────────────────────────────────────────────────
# 4. SOURCE MASCOT GIF
# ─────────────────────────────────────────────────────────────────────────────
def generate_source_gif():
    frame_dir = "/tmp/source_frames"
    os.makedirs(frame_dir, exist_ok=True)
    base_img = Image.open("site/public/source-mascot.png").convert("RGBA")

    target_w, target_h = 440, 440
    mascot_crop = base_img.crop(base_img.getbbox())
    aspect = mascot_crop.width / mascot_crop.height
    if aspect > 1:
        mw = target_w
        mh = int(target_w / aspect)
    else:
        mh = target_h
        mw = int(target_h * aspect)
    mascot_resized = mascot_crop.resize((mw, mh), Image.Resampling.LANCZOS)

    messages = [
        ("100% Open Source! ♥", "GITHUB"),
        ("MIT Licensed & Free ✦", "LICENSE"),
        ("Pure Bun + Rust Core ✦", "STACK"),
        ("Star Mochi on GitHub! ★", "COMMUNITY"),
    ]

    for i in range(NUM_FRAMES):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        t = (i / NUM_FRAMES) * 2 * math.pi
        phase_idx = (i // (NUM_FRAMES // len(messages))) % len(messages)
        text, tag = messages[phase_idx]

        bounce_y = int(math.sin(t) * 8)
        squash_x = 1.0 + 0.02 * math.cos(t)
        squash_y = 1.0 - 0.02 * math.cos(t)

        cur_mw = int(mw * squash_x)
        cur_mh = int(mh * squash_y)
        scaled_mascot = mascot_resized.resize((cur_mw, cur_mh), Image.Resampling.BILINEAR)

        mx = (W - cur_mw) // 2
        my = H - cur_mh - 25 + bounce_y

        git_y = 540
        draw.line([(80, git_y), (520, git_y)], fill=(139, 103, 246, 120), width=3)
        commits = [140, 260, 380, 480]
        for c_idx, cx in enumerate(commits):
            c_active = (i // 10) == c_idx
            c_rad = 7 if c_active else 5
            c_col = (192, 132, 252, 255) if c_active else (139, 103, 246, 180)
            draw.ellipse([cx - c_rad, git_y - c_rad, cx + c_rad, git_y + c_rad], fill=c_col)

        im.paste(scaled_mascot, (mx, my), scaled_mascot)

        heart_pulse = 1.0 + 0.15 * math.sin(t * 3)
        hr = int(22 * heart_pulse)
        hx, hy = 300, my + 190
        draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], outline=(236, 72, 153, 90), width=2)
        draw.ellipse([hx - hr - 8, hy - hr - 8, hx + hr + 8, hy + hr + 8], outline=(168, 85, 247, 50), width=1)

        for s_idx, (sx, sy, sr) in enumerate([(80, 220, 10), (510, 240, 10), (100, 470, 7), (500, 460, 8)]):
            st = math.sin(t + s_idx)
            s_radius = max(3, int(sr + st * 3))
            draw_sparkle(draw, sx, sy, s_radius, (168, 85, 247, int(190 + st * 50)))

        bubble_y = 65 + int(math.sin(t) * 4)
        draw_speech_bubble(draw, text=text, tag=tag, tag_bg="#7C3AED", y=bubble_y)

        im.save(f"{frame_dir}/frame_{i:03d}.png")

    out_gif = "site/public/source-mascot.gif"
    compile_gif(frame_dir, out_gif)
    shutil.copyfile(out_gif, "docs/assets/source-mascot.gif")
    shutil.rmtree(frame_dir)

# ─────────────────────────────────────────────────────────────────────────────
# 5. HOME MASCOT GIF
# ─────────────────────────────────────────────────────────────────────────────
def generate_home_gif():
    frame_dir = "/tmp/home_frames"
    os.makedirs(frame_dir, exist_ok=True)
    base_img = Image.open("site/public/mochi-mascot.png").convert("RGBA")

    target_w, target_h = 440, 360
    mascot_crop = base_img.crop(base_img.getbbox())
    aspect = mascot_crop.width / mascot_crop.height
    if aspect > 1:
        mw = target_w
        mh = int(target_w / aspect)
    else:
        mh = target_h
        mw = int(target_h * aspect)
    mascot_resized = mascot_crop.resize((mw, mh), Image.Resampling.LANCZOS)

    messages = [
        ("Hi, I'm Mochi! ✦", "AI AGENT"),
        ("A Softer Intelligence ✦", "CORE"),
        ("16 Specialist Roles ★", "SWARM"),
        ("Ready to Build? ★", "START"),
    ]

    for i in range(NUM_FRAMES):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(im)

        t = (i / NUM_FRAMES) * 2 * math.pi
        phase_idx = (i // (NUM_FRAMES // len(messages))) % len(messages)
        text, tag = messages[phase_idx]

        bounce_y = int(math.sin(t) * 9)
        squash_x = 1.0 + 0.025 * math.cos(t)
        squash_y = 1.0 - 0.025 * math.cos(t)

        cur_mw = int(mw * squash_x)
        cur_mh = int(mh * squash_y)
        scaled_mascot = mascot_resized.resize((cur_mw, cur_mh), Image.Resampling.BILINEAR)

        mx = (W - cur_mw) // 2
        my = H - cur_mh - 45 + bounce_y
        im.paste(scaled_mascot, (mx, my), scaled_mascot)

        for s_idx, (sx, sy, sr) in enumerate([(70, 220, 10), (520, 240, 11), (90, 470, 7), (510, 480, 8)]):
            st = math.sin(t + s_idx)
            s_radius = max(3, int(sr + st * 3))
            draw_sparkle(draw, sx, sy, s_radius, (168, 85, 247, int(190 + st * 50)))

        bubble_y = 65 + int(math.sin(t) * 4)
        draw_speech_bubble(draw, text=text, tag=tag, tag_bg="#8B67F6", y=bubble_y)

        im.save(f"{frame_dir}/frame_{i:03d}.png")

    out_gif = "site/public/home-mascot.gif"
    compile_gif(frame_dir, out_gif)
    shutil.copyfile(out_gif, "docs/assets/home-mascot.gif")
    shutil.rmtree(frame_dir)

if __name__ == "__main__":
    generate_docs_gif()
    generate_benchmarks_gif()
    generate_changelog_gif()
    generate_source_gif()
    generate_home_gif()
    print("Regenerated all GIFs with vector symbols!")
