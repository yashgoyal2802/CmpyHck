"""
One-off: strip a baked-in checkerboard "transparency preview" pattern out of
a sprite sheet, replacing it with real alpha transparency.

The source files (public/mascot/yash_*.webp) have no alpha channel - the
checker pattern is literal RGB pixels, not a transparent background shown
through a viewer's own checker backdrop.

Earlier attempts matched specific checker RGB tones directly (two light
fill tones, border-connected-component flood fill). That missed the
checker pattern's thin near-black grid-line strokes entirely - a
completely different, unmatched tone - which survived as visible noise.
Trying to also match "dark" pixels directly then risked eating the
character's own dark linework (hair, glasses, outline), since proximity
alone can't tell a grid line from an eyelash.

The robust signal instead: the checker pattern - fill tones *and* grid
lines alike - is purely grayscale (R≈G≈B) at every brightness, while the
illustrated character has real chroma even in its "dark" areas (hair and
outline read as a warm brown, not neutral gray, e.g. (31,22,20) in testing).
One unified low-chroma test cleanly separates background from character
with no separate pass needed - verified visually against the regressions
the two prior approaches produced.
"""

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label

CHROMA_TOLERANCE = 8


def dechecker(path_in: str, path_out: str) -> None:
    img = Image.open(path_in).convert("RGB")

    # The sign-in mascot addresses one cell of this 3x3 sheet via CSS
    # background-size:300% / background-position percentages, which assumes
    # the image divides into exact thirds. Neither source image's pixel
    # dimensions are evenly divisible by 3 (e.g. 1265x1243), so the browser
    # has to round sub-pixel cell boundaries - enough to let a sliver of the
    # adjacent row bleed through at certain sizes/zoom levels. Cropping to
    # the nearest-smaller multiple of 3 on each axis makes every cell
    # boundary land on a whole pixel, removing that rounding entirely.
    w, h = img.size
    exact_w, exact_h = w - (w % 3), h - (h % 3)
    if (exact_w, exact_h) != (w, h):
        img = img.crop((0, 0, exact_w, exact_h))

    arr = np.asarray(img).astype(np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    chroma = np.maximum(np.maximum(np.abs(r - g), np.abs(g - b)), np.abs(r - b))
    is_grayscale = chroma <= CHROMA_TOLERANCE

    # Connected-component label the grayscale mask; keep only components
    # that actually touch the image border (the real background), so a
    # stray grayscale patch fully enclosed inside the character (e.g. an
    # eye highlight) is never hollowed out. 8-connectivity (diagonals count)
    # rather than scipy's 4-connectivity default: a few cells' background
    # regions connect to the border only through a diagonal gap between
    # neighboring poses, and were otherwise wrongly treated as enclosed.
    labeled, num = label(is_grayscale, structure=np.ones((3, 3)))
    border_labels = set(labeled[0, :].tolist()) | set(labeled[-1, :].tolist())
    border_labels |= set(labeled[:, 0].tolist()) | set(labeled[:, -1].tolist())
    border_labels.discard(0)
    background_mask = np.isin(labeled, list(border_labels))

    # Hard 0/255 alpha from the mask alone gives a jagged, aliased cutout -
    # feather it with a small Gaussian blur so the edge reads as smooth at
    # the small render size this ships at. Blurred per-cell, not across the
    # whole sheet in one pass: the CSS sprite only ever shows one cell at a
    # time, so a blur that reaches across a cell boundary leaks a faint
    # ghost of the *adjacent* cell's content into this one's edge - visible
    # as a thin sliver above the head in whichever pose sits in the row
    # above. Blurring each cell against its own edges (not its neighbors')
    # keeps every cell's feathering fully self-contained.
    alpha_hard = np.where(background_mask, 0, 255).astype(np.float32)
    h, w = alpha_hard.shape
    cell_h, cell_w = h // 3, w // 3
    alpha = np.zeros_like(alpha_hard, dtype=np.uint8)
    for row in range(3):
        for col in range(3):
            y0, y1 = row * cell_h, (row + 1) * cell_h
            x0, x1 = col * cell_w, (col + 1) * cell_w
            cell_blurred = gaussian_filter(alpha_hard[y0:y1, x0:x1], sigma=1.2)
            alpha[y0:y1, x0:x1] = np.clip(cell_blurred, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(img), alpha])
    out = Image.fromarray(rgba, mode="RGBA")
    out.save(path_out, lossless=True)
    print(
        f"{path_in} -> {path_out}: removed {background_mask.sum()} / {arr.shape[0] * arr.shape[1]} px "
        f"({num} components found, {len(border_labels)} treated as background)"
    )


if __name__ == "__main__":
    for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
        dechecker(src, dst)
