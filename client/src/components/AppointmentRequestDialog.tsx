import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  MessageCircle,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  HOURS_12H,
  MINUTES,
  to24Hour,
  parseTimeToMinutes,
  getScheduleStatus,
  type ScheduleValidationResult,
} from "./clinicSchedule";

type AppointmentForm = {
  fullName: string;
  contactNumber: string;
  service: string;
  preferredDate: string;
  preferredHour: string;
  preferredMinute: string;
  preferredPeriod: "AM" | "PM";
  note: string;
  consent: boolean;
  website: string;
};

const initialForm: AppointmentForm = {
  fullName: "",
  contactNumber: "",
  service: "",
  preferredDate: "",
  preferredHour: "10",
  preferredMinute: "00",
  preferredPeriod: "AM" as const,
  note: "",
  consent: false,
  website: "",
};

type TurnstileWidget = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-api";
const TURNSTILE_ALWAYS_PASS_TEST_SITE_KEY = "1x00000000000000000000AA";

// ─── Graceful CAPTCHA degradation ──────────────────────────────────────────
//
// When VITE_TURNSTILE_SITE_KEY is not configured, the form would be fully
// blocked (no token possible → submit button disabled). Instead, we allow
// submission with a visible warning and rely on rate limiting + honeypot
// as the primary defense. The warning panel is clearly marked so staff
// reviewing requests know CAPTCHA was not verified.
//
// The warning panel only appears when:
//   - siteKey is missing/empty AND
//   - the CAPTCHA script failed to load (window.turnstile is undefined) AND
//   - this is not a DEV test-key scenario
function useCaptchaUnavailable(): boolean {
  const [unavailable, setUnavailable] = useState(false);
  const checkRef = useRef(false);

  useEffect(() => {
    if (checkRef.current) return;
    checkRef.current = true;

    const usesTestKey =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("captchaTestKey") === "1";
    const siteKey = usesTestKey
      ? TURNSTILE_ALWAYS_PASS_TEST_SITE_KEY
      : (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);

    if (!siteKey) {
      // No site key configured — CAPTCHA is unavailable
      setUnavailable(true);
      return;
    }

    // Site key exists — check if the Turnstile script loaded
    const checkLoad = () => {
      if (window.turnstile) {
        setUnavailable(false);
      } else {
        // Script loaded but window.turnstile not initialized — still unavailable
        setUnavailable(true);
      }
    };

    if (window.turnstile) {
      setUnavailable(false);
    } else {
      const existingScript = document.getElementById(
        TURNSTILE_SCRIPT_ID
      ) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => setTimeout(checkLoad, 100),
          { once: true }
        );
        setTimeout(checkLoad, 2000); // fallback timeout
      } else {
        setUnavailable(true);
      }
    }
  }, []);

  return unavailable;
}

function AppointmentCaptcha({
  onTokenChange,
}: {
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const usesTestKey =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("captchaTestKey") === "1";
  const siteKey = usesTestKey
    ? TURNSTILE_ALWAYS_PASS_TEST_SITE_KEY
    : (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined);
  const captchaUnavailable = useCaptchaUnavailable();

  useEffect(() => {
    if (!siteKey || !containerRef.current || captchaUnavailable) return;
    let disposed = false;

    const renderWidget = () => {
      if (
        disposed ||
        !containerRef.current ||
        !window.turnstile ||
        widgetIdRef.current
      )
        return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
        action: "appointment_request",
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(""),
        "error-callback": () => onTokenChange(""),
      });
    };

    const existingScript = document.getElementById(
      TURNSTILE_SCRIPT_ID
    ) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else if (existingScript) {
      existingScript.addEventListener("load", renderWidget, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile)
        window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [onTokenChange, siteKey, captchaUnavailable]);

  if (captchaUnavailable) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        <AlertTriangle className="mr-1.5 inline-block h-4 w-4 align-text-bottom text-amber-600" />
        <span>
          Verifikasi CAPTCHA tidak tersedia. Form akan menggunakan perlindungan
          frekuensi & honeypot.
        </span>
      </div>
    );
  }

  return <div ref={containerRef} aria-label="Verifikasi keamanan" />;
}

function TimePickerField({
  hour,
  minute,
  period,
  onHourChange,
  onMinuteChange,
  onPeriodChange,
}: {
  hour: string;
  minute: string;
  period: "AM" | "PM";
  onHourChange: (v: string) => void;
  onMinuteChange: (v: string) => void;
  onPeriodChange: (p: "AM" | "PM") => void;
}) {
  return (
    <div className="flex gap-3">
      {/* Hour select */}
      <div className="w-[5rem]">
        <select
          value={hour}
          onChange={e => onHourChange(e.target.value)}
          className="rounded-xl border border-[#173047]/15 bg-white px-3 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
        >
          {HOURS_12H.map(h => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>
      {/* Minute select */}
      <div className="w-[5rem]">
        <select
          value={minute}
          onChange={e => onMinuteChange(e.target.value)}
          className="rounded-xl border border-[#173047]/15 bg-white px-3 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
        >
          {MINUTES.map(m => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {/* Period radio buttons */}
      <div className="flex gap-1">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#173047]/15 bg-white px-3 py-3 text-sm text-[#173047] transition hover:border-[#039CB7] has-[:checked]:border-[#039CB7] has-[:checked]:bg-[#eef8f8]">
          <input
            type="radio"
            name="timePeriod"
            value="AM"
            checked={period === "AM"}
            onChange={() => onPeriodChange("AM")}
            className="h-4 w-4 accent-[#039CB7]"
          />
          AM
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#173047]/15 bg-white px-3 py-3 text-sm text-[#173047] transition hover:border-[#039CB7] has-[:checked]:border-[#039CB7] has-[:checked]:bg-[#eef8f8]">
          <input
            type="radio"
            name="timePeriod"
            value="PM"
            checked={period === "PM"}
            onChange={() => onPeriodChange("PM")}
            className="h-4 w-4 accent-[#039CB7]"
          />
          PM
        </label>
      </div>
    </div>
  );
}

export default function AppointmentRequestDialog({
  open,
  onOpenChange,
  services,
  whatsappUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: string[];
  whatsappUrl: string;
}) {
  const isDevelopmentFallbackQa =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("captchaQaE2E") === "1";

  // Fetch schedule from server instead of using hardcoded client-side copy
  const { data: serverSchedule } = trpc.schedule.getSchedule.useQuery(
    undefined,
    {
      staleTime: 60 * 60 * 1000, // 1 hour — schedule changes are rare
      retry: false,
    }
  );

  // Fetch CAPTCHA enablement status from server
  const { data: captchaEnabledData } = trpc.captcha.getEnabled.useQuery(
    undefined,
    {
      staleTime: 60 * 60 * 1000,
      retry: false,
    }
  );
  const captchaEnabled = captchaEnabledData ?? true;

  const [form, setForm] = useState<AppointmentForm>(initialForm);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [timeValidation, setTimeValidation] =
    useState<ScheduleValidationResult | null>(null);
  const captchaPanelRef = useRef<HTMLDivElement>(null);
  const fallbackQaHasRunRef = useRef(false);

  const createRequest = trpc.appointments.create.useMutation({
    onSuccess: () => {
      setForm(initialForm);
      setCaptchaToken("");
      setCaptchaVersion(current => current + 1);
      setTimeValidation(null);
      if (isDevelopmentFallbackQa) return;
      onOpenChange(false);
      toast.success("Permintaan kunjungan sudah dikirim.", {
        description:
          "Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan.",
      });
    },
    onError: error => {
      setCaptchaToken("");
      setCaptchaVersion(current => current + 1);
      toast.error(error.message);
    },
  });

  const handleCaptchaToken = useCallback(
    (token: string) => setCaptchaToken(token),
    []
  );

  // Validate time against server-fetched schedule whenever form changes
  useEffect(() => {
    if (!serverSchedule) return;
    const result = getScheduleStatus(
      serverSchedule,
      form.service,
      form.preferredDate,
      form.preferredHour,
      form.preferredMinute,
      form.preferredPeriod
    );
    setTimeValidation(result);
  }, [
    serverSchedule,
    form.service,
    form.preferredDate,
    form.preferredHour,
    form.preferredMinute,
    form.preferredPeriod,
  ]);

  useEffect(() => {
    if (!open || !isDevelopmentFallbackQa || fallbackQaHasRunRef.current)
      return;
    fallbackQaHasRunRef.current = true;
    const qaRequest = {
      fullName: "QA CAPTCHA Browser Fallback",
      contactNumber: "+628****2526",
      service: "Poli Umum",
      preferredDate: "2026-08-26",
      preferredHour: "10",
      preferredMinute: "00",
      preferredPeriod: "AM" as const,
      consent: true as const,
      note: "",
      website: "",
      captchaToken: "test-token",
    };
    setForm(qaRequest);
    void (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await createRequest.mutateAsync(
            qaRequest as Parameters<typeof createRequest.mutateAsync>[0]
          );
        } catch {
          // The fourth real endpoint response activates the ordinary fallback handler above.
        }
      }
    })();
  }, [createRequest, isDevelopmentFallbackQa, open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createRequest.mutate({
      ...form,
      consent: true,
      captchaToken: captchaToken || undefined,
    } as Parameters<typeof createRequest.mutate>[0]);
  };

  const today = new Date().toISOString().slice(0, 10);

  // Bug fix: require explicit valid === true, not just !== false
  // When CAPTCHA is disabled server-side, skip the token requirement
  const isFormValid =
    form.fullName.trim().length >= 2 &&
    form.contactNumber.trim().length >= 8 &&
    form.service !== "" &&
    form.preferredDate !== "" &&
    timeValidation !== null &&
    timeValidation.valid === true &&
    form.consent &&
    (captchaEnabled ? captchaToken.length > 0 : true);

  const captchaUnavailable = useCaptchaUnavailable();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 bg-[#fbfaf5] p-0 sm:max-w-[680px]">
        <div className="bg-[#173047] px-6 py-7 text-white sm:px-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#039CB7] text-white">
            <CalendarDays size={19} />
          </div>
          <DialogHeader className="mt-5 text-left">
            <DialogTitle className="font-display text-3xl font-semibold tracking-[-.035em] text-white">
              Ajukan kunjungan
            </DialogTitle>
            <DialogDescription className="max-w-xl text-sm leading-6 text-white/75">
              Isi formulir di bawah untuk memilih layanan, tanggal, dan jam
              pilihan Anda.{" "}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Nama lengkap
              <input
                required
                value={form.fullName}
                onChange={e =>
                  setForm(current => ({ ...current, fullName: e.target.value }))
                }
                autoComplete="name"
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Nomor WhatsApp / telepon
              <input
                required
                type="tel"
                value={form.contactNumber}
                onChange={e =>
                  setForm(current => ({
                    ...current,
                    contactNumber: e.target.value,
                  }))
                }
                autoComplete="tel"
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Layanan yang ingin ditanyakan
              <select
                required
                value={form.service}
                onChange={e =>
                  setForm(current => ({ ...current, service: e.target.value }))
                }
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              >
                <option value="" disabled>
                  Pilih layanan
                </option>
                {services.map(service => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-[#395568]">
              Tanggal pilihan
              <input
                required
                type="date"
                min={today}
                value={form.preferredDate}
                onChange={e =>
                  setForm(current => ({
                    ...current,
                    preferredDate: e.target.value,
                  }))
                }
                className="rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
              />
            </label>
          </div>

          {/* Jam pilihan field */}
          <label className="grid gap-2 text-sm font-bold text-[#395568]">
            Jam pilihan
            <div className="flex flex-wrap items-center gap-3">
              <TimePickerField
                hour={form.preferredHour}
                minute={form.preferredMinute}
                period={form.preferredPeriod}
                onHourChange={v =>
                  setForm(current => ({ ...current, preferredHour: v }))
                }
                onMinuteChange={v =>
                  setForm(current => ({ ...current, preferredMinute: v }))
                }
                onPeriodChange={p =>
                  setForm(current => ({ ...current, preferredPeriod: p }))
                }
              />
              {timeValidation?.open && (
                <span className="text-xs text-[#607684]">
                  (Buka {timeValidation.open.start}–{timeValidation.open.end}
                  {timeValidation.open.note
                    ? ` — ${timeValidation.open.note}`
                    : ""}
                  )
                </span>
              )}
            </div>
            {timeValidation?.message && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800">
                <AlertCircle className="mt-0.5 shrink-0 h-4 w-4 text-rose-500" />
                <span>{timeValidation.message}</span>
              </div>
            )}
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#395568]">
            Keluhan
            <textarea
              value={form.note}
              onChange={e =>
                setForm(current => ({ ...current, note: e.target.value }))
              }
              maxLength={600}
              rows={3}
              placeholder="Sakit gigi"
              className="resize-none rounded-xl border border-[#173047]/15 bg-white px-4 py-3 text-sm leading-6 text-[#173047] outline-none transition focus:border-[#039CB7] focus:ring-4 focus:ring-[#039CB7]/10"
            />
          </label>

          <div
            className="absolute left-[-10000px] h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            <label>
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={e =>
                  setForm(current => ({ ...current, website: e.target.value }))
                }
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#eef8f8] p-4 text-sm leading-6 text-[#395568]">
            <input
              required
              type="checkbox"
              checked={form.consent}
              onChange={e =>
                setForm(current => ({ ...current, consent: e.target.checked }))
              }
              className="mt-1 h-4 w-4 accent-[#039CB7]"
            />
            <span>
              Saya setuju Klinik Berkat Insani menggunakan data di atas untuk
              menanggapi pengajuan kunjungan. Saya memahami bahwa pengajuan
              tersebut bukan konfirmasi jadwal.
            </span>
          </label>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            <ShieldCheck className="mr-2 inline-block h-4 w-4 align-text-bottom" />
            Untuk keadaan darurat, hubungi layanan darurat setempat atau
            fasilitas kesehatan terdekat. Jangan gunakan formulir untuk kondisi
            yang membutuhkan pertolongan segera.
          </div>

          {/* CAPTCHA panel — only rendered when enabled server-side */}
          {captchaEnabled && (
            <div
              ref={captchaPanelRef}
              className="rounded-2xl border border-[#039CB7]/25 bg-[#eef8f8] p-4"
              role="status"
            >
              <p className="mb-3 text-sm font-bold text-[#173047]">
                Verifikasi keamanan
              </p>
              <p className="mb-4 text-sm leading-6 text-[#395568]">
                Selesaikan verifikasi singkat ini untuk melindungi formulir dari
                pengiriman otomatis. Token verifikasi tidak disimpan bersama
                permintaan kunjungan.
              </p>
              <AppointmentCaptcha
                key={captchaVersion}
                onTokenChange={handleCaptchaToken}
              />
            </div>
          )}

          {/* Warning when CAPTCHA is disabled server-side */}
          {!captchaEnabled && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0 h-4 w-4 text-amber-600" />
              <span>Pengajuan kunjungan Anda akan ditinjau oleh staf.</span>
            </div>
          )}

          {/* Warning when CAPTCHA widget fails to load but is enabled */}
          {captchaEnabled && captchaUnavailable && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <AlertTriangle className="mt-0.5 shrink-0 h-4 w-4 text-amber-600" />
              <span>
                CAPTCHA tidak tersedia. Form menggunakan perlindungan frekuensi
                & honeypot. Permintaan Anda akan ditinjau oleh staf.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#007f98] transition hover:text-[#039CB7]"
            >
              <MessageCircle size={16} /> Gunakan WhatsApp sebagai alternatif
            </a>
            <button
              type="submit"
              disabled={
                createRequest.isPending ||
                !isFormValid ||
                (captchaEnabled && !captchaToken)
              }
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#039CB7] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#007f98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createRequest.isPending ? "Mengirim..." : "Kirim permintaan"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
