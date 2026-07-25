import { readFile } from "node:fs/promises";
import path from "node:path";

const readJpegDimensions = (buffer) => {
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker);

    if (isStartOfFrame) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }

    if (segmentLength < 2) {
      break;
    }

    offset += segmentLength + 2;
  }

  return null;
};

const readWebpDimensions = (buffer) => {
  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
};

/**
 * Read intrinsic dimensions without introducing an image-processing dependency.
 * Supported project formats intentionally match the formats accepted by the site.
 */
export const getImageDimensions = async (filePath) => {
  const buffer = await readFile(filePath);
  const extension = path.extname(filePath).toLowerCase();
  let dimensions = null;

  if (extension === ".png" && buffer.length >= 24) {
    dimensions = {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } else if (extension === ".gif" && buffer.length >= 10) {
    dimensions = {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  } else if (
    (extension === ".jpg" || extension === ".jpeg") &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8
  ) {
    dimensions = readJpegDimensions(buffer);
  } else if (
    extension === ".webp" &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    dimensions = readWebpDimensions(buffer);
  }

  if (!dimensions?.width || !dimensions?.height) {
    throw new Error(
      `Could not read dimensions for ${filePath}. Use PNG, GIF, JPEG, or WebP.`,
    );
  }

  return dimensions;
};
