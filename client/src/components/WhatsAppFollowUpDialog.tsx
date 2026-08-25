import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAppointmentFollowUpMessage, buildWhatsAppFollowUpUrl, type AppointmentFollowUpDetails } from "../../../shared/appointmentFollowUp";
import { getWhatsAppDraftMetrics, MAX_WHATSAPP_DRAFT_LENGTH, RECOMMENDED_WHATSAPP_DRAFT_LENGTH } from "../../../shared/whatsappMessageMetrics";
import { Clipboard, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type WhatsAppFollowUpDialogProps = {
  request: (AppointmentFollowUpDetails & { id: number }) | null;
  signatureTemplate: string;
  onOpenChange: (open: boolean) => void;
  onRecordActivity: (activity: { appointmentRequestId: number; messageStatus: "draft_copied" | "whatsapp_opened"; finalDraftLength: number }) => void;
};

export default function WhatsAppFollowUpDialog({ request, signatureTemplate, onOpenChange, onRecordActivity }: WhatsAppFollowUpDialogProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage(request ? buildAppointmentFollowUpMessage(request, signatureTemplate) : "");
  }, [request, signatureTemplate]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      if (request) onRecordActivity({ appointmentRequestId: request.id, messageStatus: "draft_copied", finalDraftLength: getWhatsAppDraftMetrics(message).characterCount });
      toast.success("Draf pesan disalin.");
    } catch {
      toast.error("Pesan tidak dapat disalin. Silakan salin secara manual.");
    }
  };

  const openWhatsApp = () => {
    if (!request) return;
    onRecordActivity({ appointmentRequestId: request.id, messageStatus: "whatsapp_opened", finalDraftLength: getWhatsAppDraftMetrics(message).characterCount });
    window.open(buildWhatsAppFollowUpUrl(request, message), "_blank", "noopener,noreferrer");
  };

  const metrics = getWhatsAppDraftMetrics(message);
  const metricStyles = metrics.tone === "comfortable" ? "bg-[#eaf9fb] text-[#007f98]" : metrics.tone === "caution" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800";

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-[#fbfaf5] p-0 sm:max-w-[640px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#039CB7]"><MessageCircle size={19} /></div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">Tindak lanjut WhatsApp</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/75">Tinjau atau ubah draf di bawah sebelum membuka WhatsApp. Pesan tidak dikirim secara otomatis.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <div className="rounded-2xl bg-[#eef8f8] px-4 py-3 text-sm leading-6 text-[#395568]"><ShieldCheck className="mr-2 inline-block h-4 w-4 align-text-bottom text-[#007f98]" />Draf hanya menggunakan nama, layanan, tanggal pilihan, dan template tanda tangan klinik. Catatan bebas pemohon tidak disertakan.</div>
          <label className="grid gap-2 text-sm font-bold text-[#395568]">Draf pesan yang dapat diedit
            <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={MAX_WHATSAPP_DRAFT_LENGTH} rows={7} className="resize-y rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#173047]/10 bg-white px-4 py-3 text-xs font-semibold text-[#607684]"><span>{metrics.characterCount.toLocaleString("id-ID")} / {MAX_WHATSAPP_DRAFT_LENGTH.toLocaleString("id-ID")} karakter</span><span className={`rounded-full px-3 py-1 ${metricStyles}`}>{metrics.label}</span></div>
          <p className="-mt-2 text-xs leading-5 text-[#607684]">{metrics.description}</p>
          <section aria-label="Pratinjau pesan WhatsApp" className="rounded-2xl border border-[#173047]/10 bg-white p-4">
            <div className="flex items-center justify-between gap-4"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#007f98]">Pratinjau WhatsApp</p><span className="text-[11px] font-semibold text-[#607684]">Target ringkas: ≤ {RECOMMENDED_WHATSAPP_DRAFT_LENGTH} karakter</span></div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#173047]">{message || "Draf pesan akan muncul di sini."}</p>
          </section>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button onClick={copyMessage} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"><Clipboard size={16} /> Salin pesan</button>
            <button onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1eb75a]"><ExternalLink size={16} /> Buka WhatsApp</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
