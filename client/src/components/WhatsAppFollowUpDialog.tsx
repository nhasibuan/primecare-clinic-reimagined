import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildAppointmentFollowUpMessage, buildWhatsAppFollowUpUrl, type AppointmentFollowUpDetails } from "../../../shared/appointmentFollowUp";
import { Clipboard, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type WhatsAppFollowUpDialogProps = {
  request: AppointmentFollowUpDetails | null;
  signatureTemplate: string;
  onOpenChange: (open: boolean) => void;
};

export default function WhatsAppFollowUpDialog({ request, signatureTemplate, onOpenChange }: WhatsAppFollowUpDialogProps) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMessage(request ? buildAppointmentFollowUpMessage(request, signatureTemplate) : "");
  }, [request, signatureTemplate]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Draf pesan disalin.");
    } catch {
      toast.error("Pesan tidak dapat disalin. Silakan salin secara manual.");
    }
  };

  const openWhatsApp = () => {
    if (!request) return;
    window.open(buildWhatsAppFollowUpUrl(request, message), "_blank", "noopener,noreferrer");
  };

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
            <textarea value={message} onChange={event => setMessage(event.target.value)} rows={7} className="resize-y rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button onClick={copyMessage} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"><Clipboard size={16} /> Salin pesan</button>
            <button onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1eb75a]"><ExternalLink size={16} /> Buka WhatsApp</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
