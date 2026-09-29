/**
 * Media upload validation and normalisation utilities.
 *
 * Pure functions with no side-effects — safe to import in any layer
 * (router, service, test) without pulling in database or storage deps.
 */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * Sanitises a user-supplied file name so it is safe to use as a storage key.
 * Replaces any character that is not alphanumeric, dot, underscore or hyphen
 * with a hyphen and falls back to a generic name for empty inputs.
 */
export function normalizeAssetFileName(fileName: string): string {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized || "clinic-upload";
}

/**
 * Decodes a base64-encoded file upload after validating MIME type and size.
 *
 * @throws {Error} When the MIME type is not allowed or the file size is out of range.
 */
export function decodeMediaUpload(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}): Buffer {
  if (!ACCEPTED_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, and PDF uploads are allowed.");
  }

  const buffer = Buffer.from(input.dataBase64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be between 1 byte and 5 MB.");
  }

  return buffer;
}
