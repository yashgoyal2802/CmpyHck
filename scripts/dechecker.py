"""
One-off: strip a baked-in checkerboard "transparency preview" pattern out of
a sprite sheet, replacing it with real alpha transparency.

The source files (public/mascot/yash_*.webp) have no alpha channel - the
checker pattern is literal RGB pixels, not a transparent background shown
through a viewer's own checker backdrop. This flood-fills the connected
checker region (starting from pixels that match either checker tone, grown
via 4-connectivity) to alpha=0, leaving the character - including any
enclosed near-white pixels like eye highlights, which aren't connected to
the outer background - fully opaque.
"""

import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, gaussian_filter

CHECKER_A = np.array([254, 254, 254])
CHECKER_B = np.array([217, 217, 220])
TOLERANCE = 14


def dechecker(path_in: str, path_out: str) -> None:
    img = Image.open(path_in).convert("RGB")
    arr = np.asarray(img).astype(np.int16)

    dist_a = np.abs(arr - CHECKER_A).max(axis=-1)
    dist_b = np.abs(arr - CHECKER_B).max(axis=-1)
    is_checker_color = (dist_a <= TOLERANCE) | (dist_b <= TOLERANCE)

    # Connected-component label the checker-colored mask; keep only
    # components that actually touch the image border (the real background),
    # so a stray checker-toned patch inside the character's clothing isn't
    # also hollowed out.
    labeled, num = label(is_checker_color)
    border_labels = set(labeled[0, :].tolist()) | set(labeled[-1, :].tolist())
    border_labels |= set(labeled[:, 0].tolist()) | set(labeled[:, -1].tolist())
    border_labels.discard(0)

    background_mask = np.isin(labeled, list(border_labels))

    # Hard 0/255 alpha from the mask alone gives a jagged, aliased cutout -
    # feather it with a small Gaussian blur so the edge reads as smooth at
    # the small render size this ships at.
    alpha_hard = np.where(background_mask, 0, 255).astype(np.float32)
    alpha = np.clip(gaussian_filter(alpha_hard, sigma=1.2), 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(img), alpha])
    out = Image.fromarray(rgba, mode="RGBA")
    out.save(path_out, lossless=True)
    print(f"{path_in} -> {path_out}: removed {background_mask.sum()} / {arr.shape[0]*arr.shape[1]} px ({num} components found, {len(border_labels)} treated as background)")


if __name__ == "__main__":
    for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
        dechecker(src, dst)
