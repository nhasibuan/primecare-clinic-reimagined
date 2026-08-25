import { describe, expect, it } from "vitest";
import { decodeMediaUpload, normalizeAssetFileName } from "./clinicContent";

describe("clinic media upload validation", () => {
  it("normalizes an asset file name for storage keys", () => {
    expect(normalizeAssetFileName("Logo Klinik 2026!.png")).toBe("Logo-Klinik-2026-.png");
  });

  it("accepts a small PNG payload and rejects unsupported media types", () => {
    const payload = Buffer.from("clinic-image").toString("base64");
    expect(decodeMediaUpload({ fileName: "clinic.png", mimeType: "image/png", dataBase64: payload })).toBeInstanceOf(Buffer);
    expect(() => decodeMediaUpload({ fileName: "clinic.exe", mimeType: "application/x-msdownload", dataBase64: payload })).toThrow("Only JPG, PNG, WEBP, and PDF uploads are allowed.");
  });
});
