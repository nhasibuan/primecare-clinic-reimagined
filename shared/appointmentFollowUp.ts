export type AppointmentFollowUpDetails = {
  fullName: string;
  contactNumber: string;
  service: string;
  preferredDate: string;
};

export function normalizeWhatsAppNumber(contactNumber: string) {
  const digits = contactNumber.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export function formatPreferredAppointmentDate(preferredDate: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${preferredDate}T00:00:00Z`));
}

export function buildAppointmentFollowUpMessage(request: AppointmentFollowUpDetails, signatureTemplate = "") {
  const date = formatPreferredAppointmentDate(request.preferredDate);
  const body = `Halo ${request.fullName}, terima kasih telah mengajukan permintaan kunjungan ke Klinik Berkat Insani untuk layanan ${request.service} pada ${date}. Kami ingin membantu mengonfirmasi ketersediaan jadwal Anda. Mohon balas pesan ini untuk melanjutkan. Terima kasih.`;
  const signature = signatureTemplate.trim();
  return signature ? `${body}\n\n${signature}` : body;
}

export function buildWhatsAppFollowUpUrl(request: AppointmentFollowUpDetails, message: string) {
  return `https://wa.me/${normalizeWhatsAppNumber(request.contactNumber)}?text=${encodeURIComponent(message)}`;
}
