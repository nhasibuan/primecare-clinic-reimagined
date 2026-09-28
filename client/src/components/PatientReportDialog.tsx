import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PatientReportData = {
  nik?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  alamatLengkap?: string;
  agama?: string;
  email?: string;
  instagramUrl?: string;
};

type PatientReportDialogProps = {
  requestId: number;
  fullName: string;
  service: string;
  preferredDate: string;
  preferredTime?: string;
  data: PatientReportData;
  onOpenChange: (open: boolean) => void;
};

function fieldRow(label: string, value: string | undefined): React.ReactNode {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="min-w-[110px] shrink-0">{label}</span>
      <span className="text-sm leading-6 text-[#173047]">{value}</span>
    </div>
  );
}

export default function PatientReportDialog({
  requestId,
  fullName,
  service,
  preferredDate,
  preferredTime,
  data,
  onOpenChange,
}: PatientReportDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const lines = [
      `LAPORAN PEMOHON KLINIK`,
      `────────────────────`,
      ``,
      `No. Permintaan: ${requestId}`,
      `Nama: ${fullName}`,
      `Layanan: ${service}`,
      `Tanggal pilihan: ${new Date(`${preferredDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}${preferredTime ? ` (${preferredTime})` : ""}`,
      `Status: ${requestId % 2 === 0 ? "Dihubungi" : "Baru"}`,
      ``,
      `DATA IDENTITAS:`,
      `NIK: ${data.nik ?? "—"}`,
      `Tempat Lahir: ${data.tempatLahir ?? "—"}`,
      `Tanggal Lahir: ${data.tanggalLahir ?? "—"}`,
      `Alamat: ${data.alamatLengkap ?? "—"}`,
      `Agama: ${data.agama ?? "—"}`,
      `Email: ${data.email ?? "—"}`,
      `Instagram: ${data.instagramUrl ?? "—"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      toast.success("Laporan disalin ke clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tidak dapat menyalin. Salin secara manual.");
    }
  };

  const isComplete =
    data.nik &&
    data.tempatLahir &&
    data.tanggalLahir &&
    data.alamatLengkap &&
    data.agama &&
    data.email &&
    data.instagramUrl;

  return (
    <Dialog open={Boolean(requestId)} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-[#fbfaf5] p-0 sm:max-w-[520px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#039CB7]">
            <FileText size={19} />
          </div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">
              Laporan pasien
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/75">
              Ringkasan data pemohon untuk keperluan administrasi klinik.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          {/* Info dasar */}
          <div className="rounded-2xl border border-[#173047]/10 bg-[#eef8f8] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-[#173047]">{fullName}</p>
                <p className="mt-1 text-xs text-[#607684]">
                  {service} · {new Date(`${preferredDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  {preferredTime ? ` · Jam pilihan: ${preferredTime}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isComplete
                  ? "bg-[#039CB7]/15 text-[#039CB7]"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {isComplete ? "Lengkap" : "Belum lengkap"}
              </span>
            </div>
          </div>

          {/* Data identitas */}
          <div className="rounded-2xl border border-[#173047]/10 bg-white p-4">
            <p className="sticky top-0 mb-3 grid grid-cols-[auto_1fr] gap-3 font-display text-sm font-semibold tracking-wide uppercase text-[#039CB7]">
              <span>Data identitas</span>
              <span></span>
            </p>

            {fieldRow("NIK", data.nik)}
            {fieldRow("Tempat Lahir", data.tempatLahir)}
            {fieldRow("Tanggal Lahir", data.tanggalLahir)}
            {fieldRow("Alamat Lengkap", data.alamatLengkap)}
            {fieldRow("Agama", data.agama)}
            {fieldRow("Email", data.email)}
            {fieldRow("Instagram", data.instagramUrl)}

            {!isComplete && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 shrink-0 h-4 w-4 text-amber-600" />
                <span>Beberapa data belum lengkap. Klik &quot;Lengkapi data&quot; untuk mengisi.</span>
              </div>
            )}
          </div>

          {/* Aksi */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={handleCopy}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"
            >
              {copied ? (
                <><CheckCircle2 size={16} /> Tersalin</>
              ) : (
                <><Copy size={16} /> Salin laporan</>
              )}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"
            >
              Tutup
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
