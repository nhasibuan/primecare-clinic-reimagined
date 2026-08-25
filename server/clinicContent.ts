const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function normalizeAssetFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return normalized || "clinic-upload";
}

export function decodeMediaUpload(input: { fileName: string; mimeType: string; dataBase64: string }) {
  if (!ACCEPTED_MIME_TYPES.has(input.mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, and PDF uploads are allowed.");
  }

  const buffer = Buffer.from(input.dataBase64, "base64");
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be between 1 byte and 5 MB.");
  }

  return buffer;
}
