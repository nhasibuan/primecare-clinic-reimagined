import { describe, expect, it } from "vitest";
import { getWhatsAppDraftMetrics, MAX_WHATSAPP_DRAFT_LENGTH } from "../shared/whatsappMessageMetrics";

describe("WhatsApp draft message metrics", () => {
  it("counts Unicode characters accurately and labels short messages as comfortable", () => {
    const metrics = getWhatsAppDraftMetrics("Halo 👋");
    expect(metrics.characterCount).toBe(6);
    expect(metrics.tone).toBe("comfortable");
  });

  it("flags long but allowed messages with clear shortening guidance", () => {
    const metrics = getWhatsAppDraftMetrics("a".repeat(MAX_WHATSAPP_DRAFT_LENGTH));
    expect(metrics.tone).toBe("warning");
    expect(metrics.description).toContain("1000");
  });
});
