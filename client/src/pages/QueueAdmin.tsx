import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/lib/trpc";
import {
  Check,
  ExternalLink,
  FastForward,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Tv,
  UserPlus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function QueueAdmin() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  // ── Data ──
  const queueQuery = trpc.queue.list.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 5000,
  });
  const settingsQuery = trpc.queue.settings.useQuery(undefined, {
    enabled: isAdmin,
  });

  // ── Form states ──
  const [patientName, setPatientName] = useState("");
  const [poli, setPoli] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [runningText, setRunningText] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings into form when available
  useEffect(() => {
    if (settingsQuery.data && !settingsLoaded) {
      setRunningText(settingsQuery.data.runningText);
      setYoutubeUrl(settingsQuery.data.youtubeUrl);
      setSettingsLoaded(true);
    }
  }, [settingsQuery.data, settingsLoaded]);

  // ── Mutations ──
  const addMutation = trpc.queue.add.useMutation({
    onSuccess: data => {
      toast.success(`Nomor antrean ${data.queueNumber} ditambahkan.`);
      setPatientName("");
      setPoli("");
      setDoctorName("");
      utils.queue.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const callMutation = trpc.queue.callNext.useMutation({
    onSuccess: () => {
      toast.success("Pasien dipanggil.");
      utils.queue.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const completeMutation = trpc.queue.complete.useMutation({
    onSuccess: () => {
      toast.success("Pasien selesai dilayani.");
      utils.queue.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const skipMutation = trpc.queue.skip.useMutation({
    onSuccess: () => {
      toast.info("Pasien dilewati.");
      utils.queue.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const resetMutation = trpc.queue.reset.useMutation({
    onSuccess: () => {
      toast.success("Semua antrean hari ini direset.");
      utils.queue.list.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const settingsMutation = trpc.queue.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Pengaturan OSD diperbarui.");
      utils.queue.settings.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  // ── Loading / Auth guard ──
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold">Akses Ditolak</h2>
          <p className="mt-2 text-muted-foreground">
            Hanya administrator yang dapat mengakses halaman ini.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const entries = queueQuery.data ?? [];
  const serving = entries.filter(e => e.status === "serving");
  const waiting = entries.filter(e => e.status === "waiting");
  const done = entries.filter(
    e => e.status === "done" || e.status === "skipped"
  );

  const handleAdd = () => {
    if (!patientName.trim() || !poli.trim() || !doctorName.trim()) {
      toast.error("Lengkapi semua kolom untuk menambah antrean.");
      return;
    }
    addMutation.mutate({
      patientName: patientName.trim(),
      poli: poli.trim(),
      doctorName: doctorName.trim(),
    });
  };

  const handleSaveSettings = () => {
    settingsMutation.mutate({ runningText, youtubeUrl });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "waiting":
        return (
          <Badge
            variant="outline"
            className="border-yellow-500 text-yellow-600"
          >
            Menunggu
          </Badge>
        );
      case "serving":
        return <Badge className="bg-green-500 text-white">Dilayani</Badge>;
      case "done":
        return <Badge variant="secondary">Selesai</Badge>;
      case "skipped":
        return <Badge variant="destructive">Dilewati</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tv className="h-6 w-6" />
              Kontrol Antrian OSD
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola antrean pasien yang ditampilkan di layar OSD.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/osd" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Buka Layar OSD
              </a>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Yakin ingin mereset semua antrean hari ini?")) {
                  resetMutation.mutate();
                }
              }}
              disabled={resetMutation.isPending}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset Antrean
            </Button>
          </div>
        </div>

        {/* Add Queue Entry Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5" />
              Tambah Antrean Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Nama Pasien"
                value={patientName}
                onChange={e => setPatientName(e.target.value)}
                className="flex-1"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Input
                placeholder="Poli (cth: Poli Umum)"
                value={poli}
                onChange={e => setPoli(e.target.value)}
                className="flex-1"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Input
                placeholder="Nama Dokter"
                value={doctorName}
                onChange={e => setDoctorName(e.target.value)}
                className="flex-1"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <Button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="shrink-0"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Tambah
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Queue Lists */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Serving */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-500" />
                Sedang Dilayani ({serving.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {serving.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Belum ada pasien dilayani.
                </p>
              ) : (
                serving.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-green-500 text-lg font-black text-white">
                      {entry.queueNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {entry.patientName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.poli} — {entry.doctorName}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeMutation.mutate({ id: entry.id })}
                      disabled={completeMutation.isPending}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Selesai
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Waiting */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                Menunggu ({waiting.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {waiting.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Tidak ada pasien menunggu.
                </p>
              ) : (
                waiting.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-yellow-500 text-lg font-black text-yellow-950">
                      {entry.queueNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">
                        {entry.patientName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.poli} — {entry.doctorName}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => callMutation.mutate({ id: entry.id })}
                        disabled={callMutation.isPending}
                      >
                        <Phone className="mr-1 h-3.5 w-3.5" />
                        Panggil
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => skipMutation.mutate({ id: entry.id })}
                        disabled={skipMutation.isPending}
                      >
                        <FastForward className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Done / Skipped entries */}
        {done.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Riwayat Hari Ini ({done.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                {done.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 rounded-md border p-2 opacity-60"
                  >
                    <span className="text-sm font-bold tabular-nums">
                      #{entry.queueNumber}
                    </span>
                    <span className="truncate text-sm flex-1">
                      {entry.patientName}
                    </span>
                    {statusBadge(entry.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* OSD Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tv className="h-5 w-5" />
              Pengaturan Layar OSD
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Teks Berjalan (Running Text)
              </label>
              <Input
                placeholder="Teks pengumuman yang berjalan di bawah layar..."
                value={runningText}
                onChange={e => setRunningText(e.target.value)}
                className="mt-1"
                maxLength={1000}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {runningText.length}/1000 karakter
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">URL Video YouTube</label>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Video edukasi kesehatan yang diputar di layar OSD. Kosongkan
                untuk menonaktifkan.
              </p>
            </div>
            <Button
              onClick={handleSaveSettings}
              disabled={settingsMutation.isPending}
            >
              <Save className="mr-1.5 h-4 w-4" />
              Simpan Pengaturan
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
