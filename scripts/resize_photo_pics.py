#!/usr/bin/env python3
"""
Resize photo galleries:
1. Create 500px-wide WebP derivatives inside a sibling lowres/ directory for every album.
2. Downscale originals so their shortest side is at most 1000px and convert them to WebP.
"""

import sys
from functools import lru_cache
from pathlib import Path

from PIL import Image

from image_resize_utils import calculate_scaled_size, iter_image_paths, resize_and_save

REPO_ROOT = Path(__file__).resolve().parents[1]
PHOTOS_ROOT = REPO_ROOT / "photos" / "pics"
LOWRES_DIRNAME = "lowres"
LOWRES_WIDTH = 300
HIRES_MIN_SIDE = 1000
WEBP_QUALITY = 90


@lru_cache(maxsize=None)
def get_lowres_dir(parent_dir: Path) -> Path:
    lowres_dir = parent_dir / LOWRES_DIRNAME
    lowres_dir.mkdir(parents=True, exist_ok=True)
    for entry in lowres_dir.iterdir():
        if entry.is_file():
            entry.unlink()
    return lowres_dir


def process_image(image_path: Path) -> Path:
    with Image.open(image_path) as img:
        img.load()
        lowres_size = calculate_scaled_size(img.width, img.height, target_width=LOWRES_WIDTH)
        target_size = calculate_scaled_size(img.width, img.height, shortest_side=HIRES_MIN_SIDE)

    lowres_dir = get_lowres_dir(image_path.parent)
    lowres_path = lowres_dir / f"{image_path.stem}.webp"
    resize_and_save(
        image_path,
        lowres_size,
        lowres_path,
        target_format="WEBP",
        webp_quality=WEBP_QUALITY,
    )

    dest_path = image_path.with_suffix(".webp")
    resize_and_save(
        image_path,
        target_size,
        dest_path,
        target_format="WEBP",
        webp_quality=WEBP_QUALITY,
    )

    if dest_path != image_path and image_path.exists():
        image_path.unlink()

    return dest_path


def main() -> int:
    if not PHOTOS_ROOT.exists():
        print(f"Expected directory {PHOTOS_ROOT} does not exist.", file=sys.stderr)
        return 1

    image_paths = list(iter_image_paths(PHOTOS_ROOT, recursive=True, skip_dirs=(LOWRES_DIRNAME,)))

    if not image_paths:
        print("No source images found.")
        return 0

    for image_path in image_paths:
        new_path = process_image(image_path)
        print(f"Processed {new_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
