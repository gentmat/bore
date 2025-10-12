#!/usr/bin/env python3
"""Generate placeholder icons for Tauri without external dependencies."""

from __future__ import annotations

import os
import struct
import zlib


def ensure_icons_dir() -> str:
    icons_dir = "icons"
    os.makedirs(icons_dir, exist_ok=True)
    return icons_dir


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    length = struct.pack(">I", len(data))
    crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
    return length + chunk_type + data + crc


def generate_png(size: int, color: tuple[int, int, int, int]) -> bytes:
    width = height = size
    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr_chunk = png_chunk(b"IHDR", ihdr)

    raw = bytearray()
    r, g, b, a = color
    for _ in range(height):
        raw.append(0)  # Filter type 0
        raw.extend([r, g, b, a] * width)

    idat_chunk = png_chunk(b"IDAT", zlib.compress(bytes(raw), level=9))
    iend_chunk = png_chunk(b"IEND", b"")
    return header + ihdr_chunk + idat_chunk + iend_chunk


def write_png(path: str, size: int) -> bytes:
    data = generate_png(size, (41, 128, 185, 255))
    with open(path, "wb") as file:
        file.write(data)
    print(f"Created {path}")
    return data


def write_ico(path: str, png_data: bytes) -> None:
    # ICO header
    header = struct.pack("<HHH", 0, 1, 1)
    width = 0  # 0 -> 256
    height = 0
    color_count = 0
    reserved = 0
    planes = 1
    bit_count = 32
    size = len(png_data)
    offset = 6 + 16  # header + entry length
    entry = struct.pack("<BBBBHHII", width, height, color_count, reserved, planes, bit_count, size, offset)
    with open(path, "wb") as file:
        file.write(header + entry + png_data)
    print(f"Created {path}")


def write_icns(path: str, png_data: bytes) -> None:
    chunk_type = b"ic07"  # 128x128 PNG icon
    chunk_size = 8 + len(png_data)  # type(4) + size(4) + data
    total_size = 8 + chunk_size
    with open(path, "wb") as file:
        file.write(b"icns" + struct.pack(">I", total_size))
        file.write(chunk_type + struct.pack(">I", chunk_size) + png_data)
    print(f"Created {path}")


def main() -> None:
    icons_dir = ensure_icons_dir()
    sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }

    png_cache: dict[str, bytes] = {}
    for filename, size in sizes.items():
        path = os.path.join(icons_dir, filename)
        png_cache[filename] = write_png(path, size)

    # ICO uses the largest icon (256x256)
    ico_png = png_cache.get("128x128@2x.png")
    if ico_png:
        write_ico(os.path.join(icons_dir, "icon.ico"), ico_png)

    # ICNS uses the 128x128 asset
    icns_png = png_cache.get("128x128.png")
    if icns_png:
        write_icns(os.path.join(icons_dir, "icon.icns"), icns_png)

    print("All icons created successfully.")


if __name__ == "__main__":
    main()
