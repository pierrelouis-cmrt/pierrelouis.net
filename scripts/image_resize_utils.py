from __future__ import annotations

from pathlib import Path
from typing import Iterable, Iterator

from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True

EXTENSION_TO_FORMAT = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".gif": "GIF",
    ".webp": "WEBP",
}

SUPPORTED_EXTENSIONS = tuple(EXTENSION_TO_FORMAT.keys())


def iter_image_paths(directory: Path, *, recursive: bool = False, skip_dirs: Iterable[str] | None = None) -> Iterator[Path]:
    skip = {name.lower() for name in skip_dirs} if skip_dirs else set()

    if not recursive:
        for path in sorted(directory.iterdir()):
            if path.is_dir() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            yield path
        return

    for root, dirs, files in walk_clean(directory, skip=skip):
        base = Path(root)
        for filename in sorted(files):
            path = base / filename
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue
            yield path


def walk_clean(directory: Path, *, skip: set[str]) -> Iterator[tuple[str, list[str], list[str]]]:
    from os import walk

    for root, dirs, files in walk(directory):
        dirs[:] = [d for d in dirs if d.lower() not in skip]
        yield root, dirs, files


def calculate_scaled_size(
    width: int,
    height: int,
    *,
    target_height: int | None = None,
    target_width: int | None = None,
    shortest_side: int | None = None,
) -> tuple[int, int]:
    options = [target_height is not None, target_width is not None, shortest_side is not None]
    if sum(options) != 1:
        raise ValueError("Specify exactly one of target_height, target_width, or shortest_side.")

    if target_height is not None:
        target_height = int(target_height)
        if height <= target_height:
            return width, height
        ratio = target_height / height
        new_width = max(1, round(width * ratio))
        return new_width, target_height

    if target_width is not None:
        target_width = int(target_width)
        if width <= target_width:
            return width, height
        ratio = target_width / width
        new_height = max(1, round(height * ratio))
        return target_width, new_height

    # shortest_side is not None
    shortest_side = int(shortest_side)
    current_shortest = min(width, height)
    if current_shortest <= shortest_side:
        return width, height
    ratio = shortest_side / current_shortest
    new_width = max(1, round(width * ratio))
    new_height = max(1, round(height * ratio))
    return new_width, new_height


def prepare_for_saving(
    image: Image.Image,
    target_path: Path,
    *,
    source_format: str | None,
    target_format: str | None = None,
    webp_quality: int = 90,
) -> tuple[Image.Image, str, dict]:
    if target_format:
        image_format = target_format
    else:
        image_format = EXTENSION_TO_FORMAT.get(target_path.suffix.lower())
        if image_format is None:
            image_format = source_format

    if image_format is None:
        raise ValueError(f"Unsupported format for {target_path}")

    save_kwargs: dict = {}

    if image_format == "JPEG":
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        save_kwargs.update({"quality": 85, "optimize": True, "progressive": True})
    elif image_format == "WEBP":
        save_kwargs.update({"quality": webp_quality, "method": 6, "exact": False})

    return image, image_format, save_kwargs


def resize_and_save(
    image_path: Path,
    size: tuple[int, int],
    destination: Path,
    *,
    target_format: str | None = None,
    webp_quality: int = 90,
) -> None:
    with Image.open(image_path) as img:
        img.load()
        resized = img.copy() if (img.width, img.height) == size else img.resize(size, Image.LANCZOS)
        final_image, image_format, save_kwargs = prepare_for_saving(
            resized,
            destination,
            source_format=img.format,
            target_format=target_format,
            webp_quality=webp_quality,
        )
        final_image.save(destination, format=image_format, **save_kwargs)
