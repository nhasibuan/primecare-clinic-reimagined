import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { CalendarDays, MessageCircle, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type AppointmentRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: string[];
  whatsappUrl: string;
};

const initialForm = {
  fullName: "",
  contactNumber: "",
  service: "",
  preferredDate: "",
  note: "",
  consent: false,
  website: "",
};

export default function AppointmentRequestDialog({ open, onOpenChange, services, whatsappUrl }: AppointmentRequestDialogProps) {
  const [form, setForm] = useState(initialForm);
  const createRequest = trpc.appointments.create.useMutation({
    onSuccess: () => {
      setForm(initialForm);
      onOpenChange(false);
      toast.success("Permintaan kunjungan sudah dikirim.", {
        description: "Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan.",
      });
    },
    onError: error => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createRequest.mutate({ ...form, consent: true });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-[#fbfaf5] p-0 sm:max-w-[680px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#039CB7] text-white"><CalendarDays size={19} /></div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">Ajukan kunjungan</DialogTitle>
            <DialogDescription className="max-w-xl text-sm leading-6 text-white/75">Isi permintaan singkat ini untuk memilih layanan dan tanggal pilihan Anda. Ini bukan konfirmasi janji maupun layanan gawat darurat.</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Nama lengkap
              <input required value={form.fullName} onChange={e => setForm(current => ({ ...current, fullName: e.target.value }))} autoComplete="name" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Nomor WhatsApp / telepon
              <input required type="tel" value={form.contactNumber} onChange={e => setForm(current => ({ ...current, contactNumber: e.target.value }))} autoComplete="tel" className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Layanan yang ingin ditanyakan
              <select required value={form.service} onChange={e => setForm(current => ({ ...current, service: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10">
                <option value="" disabled>Pilih layanan</option>
                {services.map(service => <option key={service} value={service}>{service}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">Tanggal pilihan
              <input required type="date" min={today} value={form.preferredDate} onChange={e => setForm(current => ({ ...current, preferredDate: e.target.value }))} className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-bold text-[#395568]">Catatan untuk penjadwalan <span className="font-normal text-[#607684]">(opsional)</span>
            <textarea value={form.note} onChange={e => setForm(current => ({ ...current, note: e.target.value }))} maxLength={600} rows={3} placeholder="Contoh: lebih mudah dihubungi pada sore hari. Jangan sertakan diagnosis atau hasil pemeriksaan." className="resize-none rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10" />
          </label>

          <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
            <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setForm(current => ({ ...current, website: e.target.value }))} /></label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#eef8f8] p-4 text-sm leading-6 text-[#395568]">
            <input required type="checkbox" checked={form.consent} onChange={e => setForm(current => ({ ...current, consent: e.target.checked }))} className="mt-1 h-4 w-4 accent-[#039CB7]" />
            <span>Saya setuju Klinik Berkat Insani menggunakan data di atas untuk menanggapi permintaan kunjungan ini. Saya memahami bahwa permintaan ini bukan konfirmasi jadwal.</span>
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><ShieldCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />Untuk keadaan darurat, hubungi layanan darurat setempat atau fasilitas kesehatan terdekat. Jangan gunakan formulir untuk kondisi yang membutuhkan pertolongan segera.</div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-[#007f98] transition hover:text-[#039CB7]"><MessageCircle size={16} /> Gunakan WhatsApp sebagai alternatif</a>
            <button type="submit" disabled={createRequest.isPending || !form.consent} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#039CB7] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:cursor-not-allowed disabled:opacity-60">{createRequest.isPending ? "Mengirim..." : "Kirim permintaan"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
