import os
import math
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageDraw

def main():
    # 1. Load the original uncropped user upload
    src_path = '/home/jewboy420/.gemini/antigravity-cli/brain/e936d087-372e-4a84-9c7d-524595ab7fc6/.user_uploaded/uploaded_media_1791786332748.png'
    orig = Image.open(src_path).convert('RGBA')
    
    # Bounding box of complete artwork (100% intact, no lines cut, all clouds and marks preserved)
    xmin, xmax, ymin, ymax = 463, 1520, 100, 801
    art_raw = orig.crop((xmin, ymin, xmax + 1, ymax + 1))
    W_art, H_art = art_raw.size # (1058, 702)
    print(f"Artwork dimensions: {W_art}x{H_art}")
    
    arr_art = np.array(art_raw)
    
    # 2. Extract dark eyes region for smooth inpainting
    dark = ((arr_art[:, :, 0] < 70) & (arr_art[:, :, 1] < 70) & (arr_art[:, :, 2] < 80) & (arr_art[:, :, 3] > 150)).astype(np.uint8)
    dark_face = np.zeros_like(dark)
    dark_face[350:600, 200:700] = dark[350:600, 200:700]
    
    contours, _ = cv2.findContours(dark_face, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    eye_mask = np.zeros(arr_art.shape[:2], dtype=np.uint8)
    for c in contours:
        if cv2.contourArea(c) > 500:
            hull = cv2.convexHull(c)
            cv2.drawContours(eye_mask, [hull], -1, 255, -1)
            
    # Dilate 14px for seamless coverage
    eye_mask_dilated = cv2.dilate(eye_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    
    # Inpaint face
    inpainted = cv2.inpaint(arr_art[:, :, :3], eye_mask_dilated, 9, cv2.INPAINT_TELEA)
    
    # Smooth skin blend with exact lavender-white skin tone #FCF7FD
    skin_col = np.array([252, 247, 253], dtype=np.uint8)
    feathered = cv2.GaussianBlur(eye_mask.astype(float), (21, 21), 7) / 255.0
    final_skin_rgb = inpainted.astype(float) * (1.0 - feathered[:, :, None]) + skin_col.astype(float) * feathered[:, :, None]
    eyeless_arr = np.dstack([np.clip(final_skin_rgb, 0, 255).astype(np.uint8), arr_art[:, :, 3]])
    art_eyeless = Image.fromarray(eyeless_arr)
    
    # Eye bounding boxes and cropped eyes
    # Left eye: bbox=(244, 392, 95, 134) -> baseline y=526
    l_box = (244, 392, 339, 526)
    left_eye_img = art_raw.crop(l_box)
    
    # Right eye: bbox=(493, 405, 100, 143) -> baseline y=548
    r_box = (493, 405, 593, 548)
    right_eye_img = art_raw.crop(r_box)
    
    # Star center in art
    star_cx, star_cy = 83, 424
    
    # 3. Canvas setup with generous transparent safety margins
    # Total Canvas: 1200 x 844
    W_canvas = 1200
    H_canvas = 844
    
    # Center anchor at bottom of mascot
    anchor_x = W_canvas // 2          # 600
    anchor_y = H_canvas - 70          # 774
    
    NUM_FRAMES = 36
    FPS = 12
    frames_dir = '/tmp/perfect_mascot_frames'
    os.makedirs(frames_dir, exist_ok=True)
    
    print(f"Generating {NUM_FRAMES} frames...")
    
    for i in range(NUM_FRAMES):
        t = (i / NUM_FRAMES) * 2 * math.pi
        
        # Smooth organic breathing curve
        # squash/stretch ±1.0% (subtle, soft, organic)
        scale_x = 1.0 + 0.010 * math.cos(t)
        scale_y = 1.0 - 0.010 * math.cos(t)
        dy = int(round(3.0 * math.sin(t)))
        
        # Calculate eye openness for blink
        # Blink between frames 18 and 24
        blink_prog = 0.0
        if 18 <= i <= 24:
            bp = (i - 18) / 6.0
            blink_prog = math.sin(bp * math.pi)
            
        eye_openness = max(0.0, 1.0 - blink_prog)
        
        # Create base art for this frame (eyeless or with eyes)
        if eye_openness > 0.95:
            # Completely open: use 100% original raw art
            art_frame = art_raw.copy()
        else:
            # Blinking state: composite eyes onto eyeless art
            art_frame = art_eyeless.copy()
            
            if eye_openness > 0.15:
                # Scaled eye heights
                lh = max(2, int(round((l_box[3] - l_box[1]) * eye_openness)))
                rh = max(2, int(round((r_box[3] - r_box[1]) * eye_openness)))
                
                scaled_l = left_eye_img.resize((l_box[2] - l_box[0], lh), Image.Resampling.LANCZOS)
                scaled_r = right_eye_img.resize((r_box[2] - r_box[0], rh), Image.Resampling.LANCZOS)
                
                art_frame.paste(scaled_l, (l_box[0], l_box[3] - lh), scaled_l)
                art_frame.paste(scaled_r, (r_box[0], r_box[3] - rh), scaled_r)
                
            # If eyes are closed (blink_prog > 0.6), draw smiling kawaii arcs
            if blink_prog > 0.55:
                arc_alpha = int(255 * min(1.0, (blink_prog - 0.55) / 0.35))
                overlay_arc = Image.new("RGBA", (W_art, H_art), (0, 0, 0, 0))
                draw_arc = ImageDraw.Draw(overlay_arc)
                arc_col = (26, 22, 51, arc_alpha)
                
                # Left arc: center at (291, 508), width 76, height 36
                lcx, lcy = 291, 508
                draw_arc.arc([lcx - 38, lcy - 14, lcx + 38, lcy + 22], start=200, end=340, fill=arc_col, width=8)
                
                # Right arc: center at (542, 528), width 80, height 36
                rcx, rcy = 542, 528
                draw_arc.arc([rcx - 40, rcy - 14, rcx + 40, rcy + 22], start=200, end=340, fill=arc_col, width=8)
                
                # Smooth rounded caps at endpoints
                for cx_val, cy_val, rx_val, ry_val in [(lcx, lcy + 4, 38, 18), (rcx, rcy + 4, 40, 18)]:
                    for angle_deg in [200, 340]:
                        rad = math.radians(angle_deg)
                        px = int(cx_val + rx_val * math.cos(rad))
                        py = int(cy_val + ry_val * math.sin(rad))
                        draw_arc.ellipse([px - 4, py - 4, px + 4, py + 4], fill=arc_col)
                        
                art_frame = Image.alpha_composite(art_frame, overlay_arc)
                
        # Diamond star glint shimmer (frames 6 to 14)
        if 6 <= i <= 14:
            star_prog = math.sin(((i - 6) / 8.0) * math.pi)
            if star_prog > 0.1:
                glint_overlay = Image.new("RGBA", (W_art, H_art), (0, 0, 0, 0))
                draw_g = ImageDraw.Draw(glint_overlay)
                alpha_g = int(240 * star_prog)
                radius_g = int(7 * star_prog)
                draw_g.ellipse([star_cx - radius_g, star_cy - radius_g, star_cx + radius_g, star_cy + radius_g], fill=(255, 255, 255, alpha_g))
                # Four small sparkle rays
                ray_len = int(14 * star_prog)
                draw_g.line([star_cx - ray_len, star_cy, star_cx + ray_len, star_cy], fill=(255, 255, 255, alpha_g), width=2)
                draw_g.line([star_cx, star_cy - ray_len, star_cx, star_cy + ray_len], fill=(255, 255, 255, alpha_g), width=2)
                art_frame = Image.alpha_composite(art_frame, glint_overlay)
                
        # Scale whole intact artwork with high-quality Lanczos resampling
        scaled_w = int(round(W_art * scale_x))
        scaled_h = int(round(H_art * scale_y))
        scaled_art = art_frame.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        
        # Position on canvas
        # Anchor bottom at (anchor_x, anchor_y + dy)
        ox = anchor_x - scaled_w // 2
        oy = anchor_y - scaled_h + dy
        
        # Construct canvas frame
        canvas = Image.new("RGBA", (W_canvas, H_canvas), (0, 0, 0, 0))
        canvas.paste(scaled_art, (ox, oy), scaled_art)
        
        # Save frame
        canvas.save(f"{frames_dir}/frame_{i:03d}.png")
        
    print("All frames generated. Verifying border safety margins...")
    # Verify that NO pixels ever touch within 50px of any border!
    min_top_gap = 999
    min_bottom_gap = 999
    min_left_gap = 999
    min_right_gap = 999
    
    for i in range(NUM_FRAMES):
        f = Image.open(f"{frames_dir}/frame_{i:03d}.png")
        arr = np.array(f)
        ys, xs = np.where(arr[:, :, 3] > 10)
        top_gap = ys.min()
        bottom_gap = H_canvas - 1 - ys.max()
        left_gap = xs.min()
        right_gap = W_canvas - 1 - xs.max()
        
        min_top_gap = min(min_top_gap, top_gap)
        min_bottom_gap = min(min_bottom_gap, bottom_gap)
        min_left_gap = min(min_left_gap, left_gap)
        min_right_gap = min(min_right_gap, right_gap)
        
    print(f"Safety margins: top={min_top_gap}px, bottom={min_bottom_gap}px, left={min_left_gap}px, right={min_right_gap}px")
    assert min_top_gap > 40, f"Top gap too small: {min_top_gap}"
    assert min_bottom_gap > 40, f"Bottom gap too small: {min_bottom_gap}"
    assert min_left_gap > 40, f"Left gap too small: {min_left_gap}"
    assert min_right_gap > 40, f"Right gap too small: {min_right_gap}"
    print("Border check passed: 100% of frames have >40px safety margin on all 4 borders!")

    # Encode GIF using ffmpeg
    out_gif = "/tmp/perfect_mochi_mascot.gif"
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", f"{frames_dir}/frame_%03d.png",
        "-vf", "split[s0][s1];[s0]palettegen=reserve_transparent=on:stats_mode=full[p];[s1][p]paletteuse=dither=none",
        out_gif
    ]
    subprocess.run(cmd, check=True)
    size_mb = os.path.getsize(out_gif) / (1024 * 1024)
    print(f"Successfully generated {out_gif} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    main()
