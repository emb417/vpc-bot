import sharp from "sharp";
import logger from "./logger.js";

/**
 * Processes an image buffer to ensure it's a valid PNG and fits within Discord's 10MB limit.
 *
 * @param {Buffer} buffer - The raw image buffer.
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
export async function processImage(buffer) {
  try {
    const imageInstance = sharp(buffer);
    let processedBuffer = await imageInstance.png().toBuffer();

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (processedBuffer.length > MAX_SIZE) {
      logger.info(
        `Image size (${(processedBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds limit. Downsizing...`,
      );

      processedBuffer = await sharp(buffer)
        .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer();

      if (processedBuffer.length > MAX_SIZE) {
        logger.info(
          `Image still exceeds limit after resize. Further optimizing...`,
        );
        processedBuffer = await sharp(buffer)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
      }
    }

    return {
      buffer: processedBuffer,
      filename: "score.png",
    };
  } catch (err) {
    logger.error({ err }, "Error in processImage utility");
    return {
      buffer: buffer,
      filename: "score.png",
    };
  }
}
