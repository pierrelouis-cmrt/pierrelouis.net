#!/usr/bin/env python3
"""
Resize project screenshots:
1. Create 300px-tall WebP derivatives in projects/screenshots/lowres.
2. Downscale originals so their shortest side is at most 1000px and convert to WebP.
"""

import sys
from pathlib import Path

from PIL import Image
from image_resize_utils import calculate_scaled_size, iter_image_paths, resize_and_save

REPO_ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS_DIR = REPO_ROOT / "projects" / "screenshots"
LOWRES_HEIGHT = 300
HIRES_MIN_SIDE = 1000
WEBP_QUALITY = 90


def ensure_lowres_dir(base_dir: Path) -> Path:
    lowres_dir = base_dir / "lowres"
    lowres_dir.mkdir(parents=True, exist_ok=True)
    for entry in lowres_dir.iterdir():
        if entry.is_file():
            entry.unlink()
    return lowres_dir


def process_image(image_path: Path, lowres_dir: Path) -> Path:
    with Image.open(image_path) as img:
        img.load()
        lowres_size = calculate_scaled_size(img.width, img.height, target_height=LOWRES_HEIGHT)
        target_size = calculate_scaled_size(img.width, img.height, shortest_side=HIRES_MIN_SIDE)

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
    if not SCREENSHOTS_DIR.exists():
        print(f"Expected directory {SCREENSHOTS_DIR} does not exist.", file=sys.stderr)
        return 1

    lowres_dir = ensure_lowres_dir(SCREENSHOTS_DIR)
    image_paths = list(iter_image_paths(SCREENSHOTS_DIR))

    if not image_paths:
        print("No source images found.")
        return 0

    for image_path in image_paths:
        new_path = process_image(image_path, lowres_dir)
        print(f"Processed {new_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
