export const RECOMMENDED_WHATSAPP_DRAFT_LENGTH = 500;
export const MAX_WHATSAPP_DRAFT_LENGTH = 1000;

export function getWhatsAppDraftMetrics(message: string) {
  const characterCount = Array.from(message).length;
  if (characterCount <= RECOMMENDED_WHATSAPP_DRAFT_LENGTH) {
    return {
      characterCount,
      tone: "comfortable" as const,
      label: "Ringkas dan mudah dibaca",
      description: `Ideal hingga ${RECOMMENDED_WHATSAPP_DRAFT_LENGTH} karakter untuk tindak lanjut singkat.`,
    };
  }
  if (characterCount <= 750) {
    return {
      characterCount,
      tone: "caution" as const,
      label: "Mulai panjang",
      description: "Periksa kembali agar detail jadwal tetap mudah dipahami.",
    };
  }
  return {
    characterCount,
    tone: "warning" as const,
    label: "Pertimbangkan untuk mempersingkat",
    description: `Batasi hingga ${MAX_WHATSAPP_DRAFT_LENGTH} karakter agar pesan tetap terarah.`,
  };
}
