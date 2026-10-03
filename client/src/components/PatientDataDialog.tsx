import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { User, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PatientData = {
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  alamatLengkap: string;
  agama: string;
  email: string;
  instagramUrl: string;
};

type PatientDataDialogProps = {
  requestId: number;
  initialData: {
    nik?: string;
    tempatLahir?: string;
    tanggalLahir?: string;
    alamatLengkap?: string;
    agama?: string;
    email?: string;
    instagramUrl?: string;
  };
  onOpenChange: (open: boolean) => void;
};

export default function PatientDataDialog({
  requestId,
  initialData,
  onOpenChange,
}: PatientDataDialogProps) {
  const utils = trpc.useUtils();
  const updatePatientData = trpc.appointments.updatePatientData.useMutation({
    onSuccess: async () => {
      await utils.appointments.list.invalidate();
      toast.success("Data pasien tersimpan.");
      onOpenChange(false);
    },
    onError: error => toast.error(error.message),
  });

  const [form, setForm] = useState<PatientData>({
    nik: initialData.nik ?? "",
    tempatLahir: initialData.tempatLahir ?? "",
    tanggalLahir: initialData.tanggalLahir ?? "",
    alamatLengkap: initialData.alamatLengkap ?? "",
    agama: initialData.agama ?? "",
    email: initialData.email ?? "",
    instagramUrl: initialData.instagramUrl ?? "",
  });

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof PatientData, string>>
  >({});

  const updateField = (field: keyof PatientData, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    updatePatientData.mutate({
      id: requestId,
      nik: form.nik || undefined,
      tempatLahir: form.tempatLahir || undefined,
      tanggalLahir: form.tanggalLahir || undefined,
      alamatLengkap: form.alamatLengkap || undefined,
      agama: form.agama || undefined,
      email: form.email || undefined,
      instagramUrl: form.instagramUrl || undefined,
    });
  };

  return (
    <Dialog open={Boolean(requestId)} onOpenChange={onOpenChange}>
      <DialogContent className="border-0 bg-[#fbfaf5] p-0 sm:max-w-[560px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#039CB7]">
            <User size={19} />
          </div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">
              Data pasien
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-white/75">
              Lengkapi data identitas pasien. Data ini hanya untuk keperluan
              administrasi klinik.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              NIK
              <input
                value={form.nik}
                onChange={e => updateField("nik", e.target.value)}
                placeholder="Contoh: 1234567890123456"
                maxLength={30}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Tempat Lahir
              <input
                value={form.tempatLahir}
                onChange={e => updateField("tempatLahir", e.target.value)}
                placeholder="Contoh: Kotabaru"
                maxLength={100}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568] sm:col-span-2">
              Tanggal Lahir
              <input
                type="date"
                value={form.tanggalLahir}
                onChange={e => updateField("tanggalLahir", e.target.value)}
                maxLength={10}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
              {fieldErrors.tanggalLahir && (
                <p className="text-xs text-rose-700">
                  {fieldErrors.tanggalLahir}
                </p>
              )}
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568] sm:col-span-2">
              Alamat Lengkap
              <textarea
                value={form.alamatLengkap}
                onChange={e => updateField("alamatLengkap", e.target.value)}
                placeholder="Jalan, kelurahan/desa, kecamatan, kota/kabupaten, provinsi, kode pos"
                rows={3}
                maxLength={500}
                className="resize-y rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Agama
              <input
                value={form.agama}
                onChange={e => updateField("agama", e.target.value)}
                placeholder="Contoh: Islam, Kristen, Katolik, Hindu, Buddha, Khonghucu"
                maxLength={50}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Email
              <input
                type="email"
                value={form.email}
                onChange={e => updateField("email", e.target.value)}
                placeholder="contoh@email.com"
                maxLength={255}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568] sm:col-span-2">
              Alamat Instagram
              <input
                type="url"
                value={form.instagramUrl}
                onChange={e => updateField("instagramUrl", e.target.value)}
                placeholder="https://instagram.com/username atau @username"
                maxLength={255}
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm font-medium text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#007f98]"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={updatePatientData.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#039CB7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:opacity-60"
            >
              {updatePatientData.isPending ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} /> Simpan data
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
