import os
import math
import subprocess
from PIL import Image, ImageDraw, ImageEnhance
import numpy as np

W, H = 1058, 702
NUM_FRAMES = 36
FPS = 12

base = Image.open("site/public/mochi-mascot.png").convert("RGBA")

# Extract sub-regions
# 1. Left Petal: [0, 204, 150, 280]
petal_bbox = (0, 200, 150, 285)
petal_img = base.crop(petal_bbox)

# 2. Sparkle Star: [30, 360, 135, 465]
sparkle_bbox = (30, 360, 135, 465)
sparkle_img = base.crop(sparkle_bbox)

# 3. Eyes:
# Left eye: [244, 391, 338, 525]
left_eye_bbox = (244, 391, 338, 525)
left_eye_img = base.crop(left_eye_bbox)

# Right eye: [493, 405, 592, 547]
right_eye_bbox = (493, 405, 592, 547)
right_eye_img = base.crop(right_eye_bbox)

# Create base image with eyes, sparkle, and petal isolated if needed, or composite layers
# Actually, we can animate the whole character with seamless mesh/layer transformations!

os.makedirs("/tmp/home_gif_frames", exist_ok=True)

# Generate frames
for i in range(NUM_FRAMES):
    t = (i / NUM_FRAMES) * 2 * math.pi

    # Breathing oscillation
    dy = int(math.sin(t) * 6)
    scale_x = 1.0 + 0.018 * math.cos(t)
    scale_y = 1.0 - 0.018 * math.cos(t)

    # Frame canvas
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Whole mascot squash and stretch with pivot at bottom
    new_w = int(W * scale_x)
    new_h = int(H * scale_y)
    scaled_base = base.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Center horizontally, anchor to bottom
    ox = (W - new_w) // 2
    oy = H - new_h + dy
    frame.paste(scaled_base, (ox, oy), scaled_base)

    # Eye blinking logic
    # Blink happens around frame 18..22 (i in [18, 19, 20, 21, 22])
    blink_amount = 0.0
    if 17 <= i <= 23:
        # progress from 0 -> 1 -> 0
        p = (i - 17) / 6.0
        blink_amount = math.sin(p * math.pi)

    if blink_amount > 0.05:
        # We overlay curved happy-eyes or closed slit when blinking
        draw = ImageDraw.Draw(frame)
        
        # Calculate eye positions in scaled frame
        # Left eye center
        lex = ox + int((244 + 338) / 2 * scale_x)
        ley = oy + int((391 + 525) / 2 * scale_y)
        lew = int((338 - 244) * scale_x)
        leh = int((525 - 391) * scale_y)

        # Right eye center
        rex = ox + int((493 + 592) / 2 * scale_x)
        rey = oy + int((405 + 547) / 2 * scale_y)
        rew = int((592 - 493) * scale_x)
        reh = int((547 - 405) * scale_y)

        # Draw white patch over eyes matching slime color (#FEFDFF)
        slime_color = (254, 253, 255, int(255 * min(1.0, blink_amount * 1.5)))
        draw.ellipse([lex - lew // 2 - 2, ley - leh // 2 - 2, lex + lew // 2 + 2, ley + leh // 2 + 2], fill=slime_color)
        draw.ellipse([rex - rew // 2 - 2, rey - reh // 2 - 2, rex + rew // 2 + 2, rey + reh // 2 + 2], fill=slime_color)

        # Draw cute closed crescent smiling arcs in dark ink (#1A1633)
        arc_color = (26, 22, 51, int(255 * blink_amount))
        # Left eye arc (happy ^ arc)
        arc_w = int(lew * 0.75)
        arc_h = int(leh * 0.35)
        draw.arc([lex - arc_w, ley - arc_h + 10, lex + arc_w, ley + arc_h + 10], start=190, end=350, fill=arc_color, width=7)
        # Right eye arc
        arc_rw = int(rew * 0.75)
        arc_rh = int(reh * 0.35)
        draw.arc([rex - arc_rw, rey - arc_rh + 10, rex + arc_rw, rey + arc_rh + 10], start=190, end=350, fill=arc_color, width=7)

    # Star sparkle pulsing glint (on left sparkle)
    draw = ImageDraw.Draw(frame)
    sp_cx = ox + int(85 * scale_x)
    sp_cy = oy + int(415 * scale_y)
    sparkle_pulse = 0.5 + 0.5 * math.sin(t * 2)
    if sparkle_pulse > 0.4:
        # Draw central white/lavender diamond glint
        glint_rad = int(8 * sparkle_pulse)
        draw.ellipse([sp_cx - glint_rad, sp_cy - glint_rad, sp_cx + glint_rad, sp_cy + glint_rad], fill=(255, 255, 255, int(200 * sparkle_pulse)))

    # Extra magical floating particles around Mochi
    for s_idx, (px, py, pr) in enumerate([
        (160, 320, 6), (930, 380, 7), (190, 560, 5), (880, 540, 6), (530, 130, 5)
    ]):
        st = math.sin(t + s_idx * 1.3)
        r = max(2, int(pr + st * 2))
        alpha = int(140 + st * 80)
        col = (168, 85, 247, alpha)
        # 4-point sparkle
        pts = [
            (px, py - r), (px + r * 0.3, py - r * 0.3),
            (px + r, py), (px + r * 0.3, py + r * 0.3),
            (px, py + r), (px - r * 0.3, py + r * 0.3),
            (px - r, py), (px - r * 0.3, py - r * 0.3),
        ]
        draw.polygon(pts, fill=col)

    frame.save(f"/tmp/home_gif_frames/frame_{i:03d}.png")

out_gif = "site/public/mochi-mascot.gif"
cmd = [
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", "/tmp/home_gif_frames/frame_%03d.png",
    "-vf", "split[s0][s1];[s0]palettegen=reserve_transparent=on:stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=2",
    out_gif
]
subprocess.run(cmd, check=True)
print("mochi-mascot.gif created, size:", os.path.getsize(out_gif))
