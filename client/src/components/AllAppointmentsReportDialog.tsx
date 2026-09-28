import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Totals = {
  total: number;
  new: number;
  contacted: number;
  closed: number;
  updatedToday: number;
};

type AllAppointmentsReportDialogProps = {
  requests: any[];
  totals: Totals;
  onOpenChange: (open: boolean) => void;
};

function statusBadge(status: string): React.ReactNode {
  const colorMap: Record<string, string> = {
    new: "#b45309",
    contacted: "#0369a1",
    closed: "#475569",
  };
  const bgMap: Record<string, string> = {
    new: "#fef3c7",
    contacted: "#e0f2fe",
    closed: "#f1f5f9",
  };
  const labelMap: Record<string, string> = {
    new: "Baru",
    contacted: "Dihubungi",
    closed: "Selesai",
  };
  const color = colorMap[status] || "#475569";
  const bg = bgMap[status] || "#f1f5f9";
  const label = labelMap[status] || status;
  return (
    <span
      className="inline-block rounded-full bg-transparent px-2 py-0.5 text-[12px] font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

function statusBadgeHtml(status: string): string {
  const colorMap: Record<string, string> = {
    new: "#b45309",
    contacted: "#0369a1",
    closed: "#475569",
  };
  const bgMap: Record<string, string> = {
    new: "#fef3c7",
    contacted: "#e0f2fe",
    closed: "#f1f5f9",
  };
  const labelMap: Record<string, string> = {
    new: "Baru",
    contacted: "Dihubungi",
    closed: "Selesai",
  };
  const color = colorMap[status] || "#475569";
  const bg = bgMap[status] || "#f1f5f9";
  const label = labelMap[status] || status;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:600;">${label}</span>`;
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(iso: Date): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AllAppointmentsReportDialog({
  requests,
  totals,
  onOpenChange,
}: AllAppointmentsReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState<"text" | "html" | null>(null);

  const copiedToasterId = "appointment-report-copy";

  const copyAsText = async () => {
    const lines = [
      "LAPORAN SELURUH PERMINTAAN KUNJUNGAN",
      "════════════════════════════════════",
      "",
      `Total: ${totals.total} permintaan`,
      `  - Baru:          ${totals.new}`,
      `  - Dihubungi:     ${totals.contacted}`,
      `  - Selesai:       ${totals.closed}`,
      "",
      "RINGKASAN TIAP PEMOHON:",
      "──────────────────────────────",
      "",
      ...requests.map(r => {
        const date = formatDate(r.preferredDate);
        const time = r.preferredTime ?? "—";
        return [
          `No. ${r.id}`,
          `Nama       : ${r.fullName}`,
          `Telepon    : ${r.contactNumber}`,
          `Layanan    : ${r.service}`,
          `Tanggal    : ${date}`,
          `Jam pilihan: ${time}${r.note ? `\nCatatan    : ${r.note}` : ""}`,
          `[${r.status.toUpperCase()}]`,
          "",
        ].join("\n");
      }),
      "...",
      "",
      `Diperbarui terakhir: ${formatDateTime(new Date())}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(lines);
      setCopiedFormat("text");
      toast.success("Tabel kunjungan disalin ke clipboard sebagai teks.", { id: copiedToasterId });
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      toast.error("Tidak dapat menyalin. Salin secara manual.", { id: copiedToasterId });
    }
  };

  const copyAsHtml = async () => {
    const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const totalsHtml = `
<h2>Laporan Seluruh Permintaan Kunjungan</h2>
<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:13px;">
  <tr>
    <td style="padding:4px 8px;border:1px solid #173047;color:#173047;">Total permintaan</td>
    <td style="padding:4px 8px;border:1px solid #173047;font-weight:bold;">${totals.total}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #173047;color:#173047;">Baru</td>
    <td style="padding:4px 8px;border:1px solid #173047;font-weight:bold;color:#b45309;">${totals.new}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #173047;color:#173047;">Dihubungi</td>
    <td style="padding:4px 8px;border:1px solid #173047;font-weight:bold;color:#0369a1;">${totals.contacted}</td>
  </tr>
  <tr>
    <td style="padding:4px 8px;border:1px solid #173047;color:#173047;">Selesai</td>
    <td style="padding:4px 8px;border:1px solid #173047;font-weight:bold;color:#475569;">${totals.closed}</td>
  </tr>
</table>
<hr style="border:0;border-top:1px solid #173047;margin:8px 0;">
<h3>Daftar per pemohon:</h3>
<table style="width:100%;border-collapse:collapse;font-family:monospace;font-size:13px;">
  <tr style="background:#eef8f8;">
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">No.</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Nama</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Telepon</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Layanan</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Tanggal</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Jam</th>
    <th style="padding:4px 8px;border:1px solid #173047;color:#0369a1;text-align:left;">Status</th>
  </tr>
  ${requests.map(r => `
  <tr>
    <td style="padding:4px 8px;border:1px solid #173047;">${r.id}</td>
    <td style="padding:4px 8px;border:1px solid #173047;font-weight:bold;">${escape(r.fullName)}</td>
    <td style="padding:4px 8px;border:1px solid #173047;">${r.contactNumber}</td>
    <td style="padding:4px 8px;border:1px solid #173047;">${r.service}</td>
    <td style="padding:4px 8px;border:1px solid #173047;">${formatDate(r.preferredDate)}</td>
    <td style="padding:4px 8px;border:1px solid #173047;">${r.preferredTime ?? "—"}</td>
    <td style="padding:4px 8px;border:1px solid #173047;">${statusBadgeHtml(r.status)}</td>
  </tr>
  `).join("")}
</table>
<p style="margin-top:12px;font-size:11px;color:#607684;">Diperbarui: ${formatDateTime(new Date())}</p>
`;

    try {
      await navigator.clipboard.writeText(totalsHtml);
      setCopiedFormat("html");
      toast.success("Laporan tabel disalin ke clipboard sebagai HTML.", { id: copiedToasterId });
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      toast.error("Tidak dapat menyalin. Salin secara manual.", { id: copiedToasterId });
    }
  };

  return (
    <Dialog open={Boolean(requests.length)} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-[#fbfaf5] p-0 sm:max-w-[720px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#039CB7]">
            <FileText size={19} />
          </div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">
              Laporan seluruh permintaan
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/75">
              Ringkasan semua permintaan kunjungan yang tersimpan di sistem.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          {/* Ringkasan totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-[#173047]/10 bg-white p-4">
            <div className="text-center">
              <p className="text-2xl font-display font-semibold text-[#173047]">{totals.total}</p>
              <p className="text-xs text-[#607684]">Total permintaan</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-semibold text-amber-700">{totals.new}</p>
              <p className="text-xs text-[#607684]">Baru</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-semibold text-[#039CB7]">{totals.contacted}</p>
              <p className="text-xs text-[#607684]">Dihubungi</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-display font-semibold text-slate-600">{totals.closed}</p>
              <p className="text-xs text-[#607684]">Selesai</p>
            </div>
          </div>

          {/* Tabel interaktif */}
          <div className="rounded-2xl border border-[#173047]/10 bg-white overflow-hidden">
            <div className="sticky top-0 bg-white border-b border-[#173047]/10 px-4 py-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#0369a1]">Data tabel kunjungan</p>
              <span className="text-[11px] text-[#607684]">{requests.length} baris</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#eef8f8] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">No.</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Nama</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Telepon</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Layanan</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Tanggal</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Jam pilihan</th>
                    <th className="px-4 py-2 text-left font-bold text-[#0369a1]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} className="border-t border-[#173047]/10">
                      <td className="px-4 py-2 font-bold text-[#173047]">{r.id}</td>
                      <td className="px-4 py-2 font-semibold text-[#173047]">{r.fullName}</td>
                      <td className="px-4 py-2 text-[#607684]">{r.contactNumber}</td>
                      <td className="px-4 py-2 text-[#395568]">{r.service}</td>
                      <td className="px-4 py-2 text-[#607684]">{formatDate(r.preferredDate)}</td>
                      <td className="px-4 py-2 text-[#607684]">{r.preferredTime ?? "—"}</td>
                      <td className="px-4 py-2">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aksi */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={copyAsText}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"
            >
              {copiedFormat === "text" ? (
                <><Check size={16} /> Tersalin (teks)</>
              ) : (
                <><Copy size={16} /> Salin sebagai teks</>
              )}
            </button>
            <button
              onClick={copyAsHtml}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"
            >
              {copiedFormat === "html" ? (
                <><Check size={16} /> Tersalin (HTML)</>
              ) : (
                <><Copy size={16} /> Salin sebagai HTML</>
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
