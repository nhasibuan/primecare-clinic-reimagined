import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function QueueDisplay() {
  const { data, isLoading } = trpc.queue.display.useQuery(undefined, {
    refetchInterval: 3000, // Poll every 3 seconds for real-time updates
  });

  const marqueeRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-900 to-blue-950 text-white">
        <div className="text-2xl animate-pulse">Memuat Antrian...</div>
      </div>
    );
  }

  const { entries, activeNumber, settings } = data;
  const serving = entries.filter(e => e.status === "serving");
  const waiting = entries.filter(e => e.status === "waiting");
  const videoId = extractYouTubeId(settings.youtubeUrl);

  const formattedDate = currentTime.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white font-sans">
      {/* ── Top Section: Video + Active Queue Number ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: YouTube video */}
        <div className="flex w-3/5 flex-col p-4">
          <div className="mb-2 flex items-center gap-3">
            <img
              src="/favicon.ico"
              alt=""
              className="h-8 w-8"
              onError={e => (e.currentTarget.style.display = "none")}
            />
            <h1 className="text-xl font-bold tracking-wide text-blue-100">
              KLINIK BERKAT INSANI
            </h1>
            <span className="ml-auto text-sm text-blue-300">
              {formattedDate} — {formattedTime}
            </span>
          </div>
          <div className="flex-1 rounded-xl overflow-hidden bg-black/40 shadow-2xl">
            {videoId ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1`}
                title="Video Edukasi Kesehatan"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center text-blue-400 text-lg">
                <div className="text-center">
                  <svg
                    className="mx-auto mb-3 h-16 w-16 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                    />
                  </svg>
                  Video Edukasi Kesehatan
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Active queue number + queue lists */}
        <div className="flex w-2/5 flex-col p-4 pl-0">
          {/* Active Queue Number */}
          <div className="mb-4 rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-4 text-center shadow-2xl">
            <div className="text-sm font-semibold uppercase tracking-widest text-green-100">
              Nomor Antrean
            </div>
            <div
              className="text-8xl font-black leading-none tabular-nums text-white drop-shadow-lg"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {activeNumber > 0 ? String(activeNumber).padStart(3, "0") : "---"}
            </div>
          </div>

          {/* Serving Section */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-400" />
              <span className="text-sm font-bold uppercase tracking-wider text-green-300">
                Sedang Dilayani
              </span>
            </div>
            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
              {serving.length === 0 ? (
                <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-blue-300 italic">
                  Belum ada pasien dilayani
                </div>
              ) : (
                serving.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg bg-green-500/20 px-3 py-2 border border-green-500/30"
                  >
                    <span className="flex-shrink-0 rounded-md bg-green-500 px-2.5 py-1 text-lg font-black tabular-nums">
                      {String(entry.queueNumber).padStart(3, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">
                        {entry.patientName}
                      </div>
                      <div className="truncate text-xs text-green-200">
                        {entry.poli} — {entry.doctorName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Waiting Section */}
          <div className="flex-1 min-h-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
              <span className="text-sm font-bold uppercase tracking-wider text-yellow-300">
                Menunggu ({waiting.length})
              </span>
            </div>
            <div className="space-y-1 max-h-[30vh] overflow-y-auto pr-1">
              {waiting.length === 0 ? (
                <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-blue-300 italic">
                  Tidak ada pasien menunggu
                </div>
              ) : (
                waiting.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-1.5 border border-white/10"
                  >
                    <span className="flex-shrink-0 rounded-md bg-yellow-500/80 px-2 py-0.5 text-sm font-bold tabular-nums text-yellow-950">
                      {String(entry.queueNumber).padStart(3, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white/90">
                        {entry.patientName}
                      </div>
                      <div className="truncate text-xs text-blue-300">
                        {entry.poli} — {entry.doctorName}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: Running Text ── */}
      <div className="flex-shrink-0 border-t border-blue-700/50 bg-blue-950/80 py-2.5 overflow-hidden">
        <div
          ref={marqueeRef}
          className="animate-marquee whitespace-nowrap text-lg font-medium text-yellow-300"
        >
          <span className="mx-8">📢</span>
          {settings.runningText || "Selamat datang di Klinik Berkat Insani."}
          <span className="mx-16">•</span>
          {settings.runningText || "Selamat datang di Klinik Berkat Insani."}
          <span className="mx-16">•</span>
          {settings.runningText || "Selamat datang di Klinik Berkat Insani."}
        </div>
      </div>

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-200%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
