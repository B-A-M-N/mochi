import os
import math
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw

# 1. Load cropped pasted image
base_full = Image.open('/tmp/cropped_pasted_mascot.png').convert('RGBA')
W, H = base_full.size
arr = np.array(base_full)

print(f"Base size: {W}x{H}")

# 2. Extract eyes mask in face region
dark = ((arr[:, :, 0] < 70) & (arr[:, :, 1] < 70) & (arr[:, :, 2] < 80) & (arr[:, :, 3] > 150)).astype(np.uint8)
dark_face = np.zeros_like(dark)
dark_face[350:600, 200:700] = dark[350:600, 200:700]

contours, _ = cv2.findContours(dark_face, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
eye_mask = np.zeros((H, W), dtype=np.uint8)

left_hull = None
right_hull = None

for c in contours:
    if cv2.contourArea(c) > 500:
        hull = cv2.convexHull(c)
        cv2.drawContours(eye_mask, [hull], -1, 255, -1)
        M = cv2.moments(hull)
        cx = int(M['m10'] / M['m00'])
        if cx < 450:
            left_hull = hull
        else:
            right_hull = hull

# Dilate 15px for smooth coverage
eye_mask_dilated = cv2.dilate(eye_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

# Inpaint
inpainted = cv2.inpaint(arr[:, :, :3], eye_mask_dilated, 11, cv2.INPAINT_TELEA)

# Sample skin and create ultra smooth skin patch
skin_col = np.array([252, 247, 253], dtype=np.uint8)
skin_layer = np.full_like(inpainted, skin_col)

feathered = cv2.GaussianBlur(eye_mask.astype(float), (25, 25), 9) / 255.0
final_skin_rgb = inpainted.astype(float) * (1.0 - feathered[:, :, None]) + skin_layer.astype(float) * feathered[:, :, None]

base_eyeless = Image.fromarray(np.dstack([np.clip(final_skin_rgb, 0, 255).astype(np.uint8), arr[:, :, 3]]))

# Extract eyes individually
# Left eye bbox: x=[244, 338], y=[392, 525]
l_box = (235, 385, 348, 535)
r_box = (485, 395, 602, 557)

left_eye_img = base_full.crop(l_box)
right_eye_img = base_full.crop(r_box)

# Extract floating petal: x=[0, 150], y=[200, 290]
petal_box = (0, 195, 155, 295)
petal_img = base_full.crop(petal_box)
# Erase petal from base_eyeless
base_no_petal_arr = np.array(base_eyeless)
base_no_petal_arr[195:295, 0:155] = [0, 0, 0, 0]
base_clean = Image.fromarray(base_no_petal_arr)

# Frame generation setup
NUM_FRAMES = 36
FPS = 12
os.makedirs("/tmp/mascot_v2_frames", exist_ok=True)

# Coordinates for closed eye smiles
lcx, lcy = (l_box[0] + l_box[2]) // 2, l_box[3] - 28
rcx, rcy = (r_box[0] + r_box[2]) // 2, r_box[3] - 28

for i in range(NUM_FRAMES):
    t = (i / NUM_FRAMES) * 2 * math.pi

    # Subtle organic breathing (squash & stretch)
    dy = int(math.sin(t) * 5)
    scale_x = 1.0 + 0.014 * math.cos(t)
    scale_y = 1.0 - 0.014 * math.cos(t)

    new_w = int(W * scale_x)
    new_h = int(H * scale_y)
    scaled_body = base_clean.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Frame canvas
    frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Center horizontally, anchor to bottom
    ox = (W - new_w) // 2
    oy = H - new_h + dy
    frame.paste(scaled_body, (ox, oy), scaled_body)

    # Floating petal animation (gentle floating drift & tilt)
    petal_dy = int(math.sin(t + 1.0) * 10)
    petal_dx = int(math.cos(t * 0.8) * 4)
    petal_angle = math.sin(t + 0.5) * 6.0
    rot_petal = petal_img.rotate(petal_angle, resample=Image.Resampling.BICUBIC, expand=True)
    # Paste petal
    p_x = petal_box[0] + petal_dx
    p_y = petal_box[1] + petal_dy
    frame.paste(rot_petal, (p_x, p_y), rot_petal)

    # Eye blinking animation logic
    # Blink between frames 18 and 24
    blink_prog = 0.0
    if 18 <= i <= 24:
        # 18: 0.35, 19: 0.75, 20: 1.0, 21: 1.0, 22: 0.75, 23: 0.35, 24: 0.0
        bp = (i - 18) / 6.0
        blink_prog = math.sin(bp * math.pi)

    eye_openness = max(0.0, 1.0 - blink_prog)

    # Position of eyes in transformed body
    cur_l_box = (
        ox + int(l_box[0] * scale_x),
        oy + int(l_box[1] * scale_y),
        ox + int(l_box[2] * scale_x),
        oy + int(l_box[3] * scale_y)
    )
    cur_r_box = (
        ox + int(r_box[0] * scale_x),
        oy + int(r_box[1] * scale_y),
        ox + int(r_box[2] * scale_x),
        oy + int(r_box[3] * scale_y)
    )

    if eye_openness > 0.15:
        # Scale eye vertically towards bottom
        l_w = cur_l_box[2] - cur_l_box[0]
        l_h = max(2, int((cur_l_box[3] - cur_l_box[1]) * eye_openness))
        r_w = cur_r_box[2] - cur_r_box[0]
        r_h = max(2, int((cur_r_box[3] - cur_r_box[1]) * eye_openness))

        scaled_l = left_eye_img.resize((l_w, l_h), Image.Resampling.LANCZOS)
        scaled_r = right_eye_img.resize((r_w, r_h), Image.Resampling.LANCZOS)

        frame.paste(scaled_l, (cur_l_box[0], cur_r_box[3] - l_h), scaled_l)
        frame.paste(scaled_r, (cur_r_box[0], cur_r_box[3] - r_h), scaled_r)

    # If blink is closed (blink_prog > 0.7), draw cute smiling happy arc
    if blink_prog > 0.65:
        arc_alpha = int(255 * min(1.0, (blink_prog - 0.65) / 0.3))
        # Draw on separate overlay with antialiasing
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw_ov = ImageDraw.Draw(overlay)
        arc_col = (26, 22, 51, arc_alpha)

        cur_lcx = ox + int(lcx * scale_x)
        cur_lcy = oy + int(lcy * scale_y)
        cur_rcx = ox + int(rcx * scale_x)
        cur_rcy = oy + int(rcy * scale_y)

        # Smooth smiling curve
        draw_ov.arc([cur_lcx - 42, cur_lcy - 18, cur_lcx + 42, cur_lcy + 22], start=200, end=340, fill=arc_col, width=7)
        draw_ov.arc([cur_rcx - 44, cur_rcy - 18, cur_rcx + 44, cur_rcy + 22], start=200, end=340, fill=arc_col, width=7)

        frame = Image.alpha_composite(frame, overlay)

    # Shimmer star glint (on left diamond star)
    sp_cx = ox + int(85 * scale_x)
    sp_cy = oy + int(415 * scale_y)
    sparkle_pulse = 0.5 + 0.5 * math.sin(t * 2)
    if sparkle_pulse > 0.4:
        glint_rad = int(8 * sparkle_pulse)
        draw_f = ImageDraw.Draw(frame)
        draw_f.ellipse([sp_cx - glint_rad, sp_cy - glint_rad, sp_cx + glint_rad, sp_cy + glint_rad], fill=(255, 255, 255, int(220 * sparkle_pulse)))

    # Save frame
    frame.save(f"/tmp/mascot_v2_frames/frame_{i:03d}.png")

out_gif = "/tmp/mochi_mascot_v2.gif"
cmd = [
    "ffmpeg", "-y",
    "-framerate", str(FPS),
    "-i", "/tmp/mascot_v2_frames/frame_%03d.png",
    "-vf", "split[s0][s1];[s0]palettegen=reserve_transparent=on:stats_mode=full[p];[s1][p]paletteuse=dither=none",
    out_gif
]
subprocess.run(cmd, check=True)
print(f"Generated {out_gif}, size: {os.path.getsize(out_gif)} bytes")
