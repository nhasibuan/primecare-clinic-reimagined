import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function CaptchaAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const { data: captchaEnabled, isLoading: captchaLoading } = trpc.captcha.getEnabled.useQuery(
    undefined,
    { enabled: isAdmin },
  );

  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (captchaEnabled !== undefined) {
      setLocalEnabled(captchaEnabled);
    }
  }, [captchaEnabled]);

  const toggleCaptchaMutation = trpc.admin.toggleCaptcha.useMutation({
    onSuccess: async () => {
      await utils.captcha.getEnabled.invalidate();
      await utils.clinic.adminContent.invalidate();
      setLocalEnabled(toggleCaptchaMutation.data?.enabled ?? true);
      toast.success(toggleCaptchaMutation.data?.enabled ? "CAPTCHA diaktifkan." : "CAPTCHA dinonaktifkan.");
    },
    onError: error => toast.error(error.message),
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="animate-spin text-[#039CB7]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 pb-12 text-[#173047]">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-5 rounded-[28px] bg-[#173047] px-7 py-8 text-white shadow-[0_18px_44px_rgba(23,48,71,.18)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#84e2ec]">Klinik Berkat Insani</p>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.04em]">Keamanan CAPTCHA</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              Kelola status verifikasi Cloudflare Turnstile untuk formulir permintaan kunjungan.
            </p>
          </div>
          <a href="/admin" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2.5 text-sm font-bold transition hover:bg-white hover:text-[#173047]">
            &larr; Kembali ke Ruang kelola konten
          </a>
        </header>

        {!isAdmin ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-7 text-amber-900">
            <h2 className="font-display text-2xl font-semibold">Akses administrator diperlukan</h2>
            <p className="mt-2 text-sm leading-6">Masuk dengan akun pemilik proyek untuk mengelola pengaturan CAPTCHA.</p>
          </div>
        ) : captchaLoading ? (
          <div className="grid min-h-64 place-items-center rounded-3xl border border-[#173047]/10 bg-white">
            <Loader2 className="animate-spin text-[#039CB7]" />
          </div>
        ) : (
          <section className="rounded-[28px] border border-[#173047]/10 bg-white p-6 shadow-[0_12px_30px_rgba(23,48,71,.05)] sm:p-8">
            {/* Judul + deskripsi */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Keamanan formulir</p>
                <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.035em]">
                  Verifikasi CAPTCHA
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#607684]">
                  Ketika CAPTCHA aktif, pengunjung harus menyelesaikan verifikasi Cloudflare Turnstile
                  sebelum mengirim permintaan kunjungan. Nonaktifkan hanya jika CAPTCHA tidak tersedia —
                  form akan menggunakan perlindungan frekuensi &amp; honeypot.
                </p>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#173047]">
                Administrator
              </span>
            </div>

            {/* Status & tombol */}
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button
                onClick={() => toggleCaptchaMutation.mutate({ enabled: true })}
                disabled={toggleCaptchaMutation.isPending || localEnabled === true}
                className="inline-flex items-center gap-2 rounded-full bg-[#039CB7] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                Aktifkan CAPTCHA
              </button>
              <button
                onClick={() => toggleCaptchaMutation.mutate({ enabled: false })}
                disabled={toggleCaptchaMutation.isPending || localEnabled === false}
                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
              >
                <ShieldOff size={16} />
                Nonaktifkan CAPTCHA
              </button>
              {localEnabled === false && (
                <p className="text-xs text-rose-700">
                  CAPTCHA sedang nonaktif. Form menggunakan perlindungan frekuensi &amp; honeypot.
                  Permintaan akan ditinjau oleh staf.
                </p>
              )}
              {localEnabled === true && (
                <p className="text-xs text-[#007f98]">
                  CAPTCHA aktif. Pengunjung harus menyelesaikan verifikasi sebelum mengirim.
                </p>
              )}
            </div>

            {/* Error */}
            {toggleCaptchaMutation.isError && (
              <p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                Gagal mengubah pengaturan: {toggleCaptchaMutation.error.message}
              </p>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
