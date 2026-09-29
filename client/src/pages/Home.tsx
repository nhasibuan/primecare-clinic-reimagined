/**
 * Calm Clinical Editorial — an Indonesian Klinik Berkat Insani experience using verified
 * Kotabaru location details and carefully paraphrased public-facing clinic positioning.
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  HeartHandshake,
  Menu,
  Phone,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import AppointmentRequestDialog from "@/components/AppointmentRequestDialog";

const assets = {
  logo: "https://i.imgur.com/aIAPMx7.png",
  careMark: "/manus-storage/care-orbit-mark_3642fa2e.png",
  hero: "https://iili.io/ndJxdmv.md.png",
  motherChild: "https://i.imgur.com/2ejfunG.jpeg",
  dentalStudio: "https://i.imgur.com/uS0RNM0.jpeg",
  homecare: "https://i.imgur.com/O1fJpCK.jpeg",
  facilityStay: "https://i.imgur.com/7WEnaqE.jpeg",
  delivery: "/manus-storage/delivery-room_77732972.png",
  blueLight: "/manus-storage/blue-light_f1a96e26.png",
  dentalDigital: "/manus-storage/dental-digital_dee1ece8.webp",
  dentalSuite: "/manus-storage/dental-suite_18001d73.png",
};

const whatsappUrl = "https://wa.me/6285215862526";

const serviceTabs = [
  "Laboratorium",
  "Radiology",
  "Rehabilitasi Medik",
  "Optik",
];

const careCards = [
  {
    title: "Poli Kandungan",
    text: "Konsultasi kandungan bersama dr. Syaiful Aspiannur, Sp.OG, untuk pemeriksaan kehamilan, USG, serta pemantauan ibu dan janin.",
    image: assets.motherChild,
    tag: "Kandungan & USG",
  },
  {
    title: "Poli Umum",
    text: "Konsultasikan keluhan kesehatan sehari-hari bersama dr. Suriani dan dapatkan arahan untuk langkah berikutnya.",
    image: assets.facilityStay,
    tag: "Pelayanan umum",
  },
  {
    title: "Poli Gigi",
    text: "Sampaikan kebutuhan perawatan gigi Anda dan tanyakan pilihan pemeriksaan maupun tindak lanjut yang tersedia.",
    image: assets.homecare,
    tag: "Kesehatan gigi",
  },
  {
    title: "Poli Penyakit Dalam",
    text: "Hubungi Klinik Berkat Insani melalui WhatsApp untuk menanyakan layanan dan mengonfirmasi jadwal praktik terkini.",
    image: assets.dentalStudio,
    tag: "Penyakit Dalam",
  },
  {
    title: "Poli Bedah",
    text: "Dr. Uwais Sp.B. Senin - Minggu, Jam 09.00 - 21.00 WITA (Sesuai perjanjian).",
    image: assets.facilityStay,
    tag: "Bedah umum",
  },
];

const locations = [
  {
    name: "Lokasi klinik",
    detail: "Jl. Ahmad Yani KM. 296, Tegal Rejo\nKelumpang Hilir, Kotabaru, Kalimantan Selatan 72161",
    cta: "Buka peta",
    href: "https://www.google.com/maps/search/?api=1&query=-3.1828748,115.9820138",
  },
  {
    name: "Poli tersedia",
    detail: "Poli Umum, Poli Kandungan, dan Poli Gigi untuk kebutuhan kesehatan keluarga.",
    cta: "Lihat layanan",
    href: "#services",
  },
  {
    name: "Jadwal praktik",
    detail: "Jadwal dapat berubah. Konfirmasi terlebih dahulu melalui WhatsApp sebelum berkunjung.",
    cta: "Chat WhatsApp",
    href: whatsappUrl,
  },
];

const instagramPosts = [
  "https://www.instagram.com/p/DbklrsSzKPd/",
  "https://www.instagram.com/p/Db0AxbfTaPH/",
  "https://www.instagram.com/p/Db0CdwHzfBD/",
];

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

function InstagramEmbeds() {
  useEffect(() => {
    const processEmbeds = () => window.instgrm?.Embeds.process();
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-klinik-instagram-embed]");
    if (window.instgrm) {
      processEmbeds();
      return;
    }
    if (existingScript) {
      existingScript.addEventListener("load", processEmbeds, { once: true });
      return () => existingScript.removeEventListener("load", processEmbeds);
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    script.dataset.klinikInstagramEmbed = "true";
    script.addEventListener("load", processEmbeds, { once: true });
    document.body.appendChild(script);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {instagramPosts.map((permalink, index) => (
        <div key={permalink} className="min-w-0">
          <blockquote
            className="instagram-media m-0 w-full min-w-0 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_25px_rgba(23,48,71,.06)]"
            data-instgrm-permalink={permalink}
            data-instgrm-version="14"
            aria-label={`Posting Instagram Klinik Berkat Insani ${index + 1}`}
            style={{ maxWidth: 540, minWidth: 0, width: "100%" }}
          >
            <a href={permalink} target="_blank" rel="noreferrer">
              Lihat postingan Instagram Klinik Berkat Insani
            </a>
          </blockquote>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const labSlideshowRef = useRef<HTMLImageElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const { data: persistedClinic } = trpc.clinic.publicContent.useQuery(undefined, { staleTime: 60_000 });
  const activeWhatsappUrl = persistedClinic?.profile?.whatsappUrl ?? whatsappUrl;
  const activeCareCards = persistedClinic?.services.length
    ? persistedClinic.services.map(service => ({ title: service.name, text: service.summary, image: service.imageUrl, tag: "Layanan" }))
    : careCards;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("request") === "1") setAppointmentOpen(true);
  }, []);

  const [activeTab, setActiveTab] = useState(0);

  const tabContent: Record<number, { images: string[]; text: React.ReactNode }> = {
    0: {
      images: ["https://i.imgur.com/1UzBjsx.png", "https://i.imgur.com/SUTGKRV.png"],
      text: <>Klinik Berkat Insani menyediakan laboratorium hematologi, urine, kimia klinik imunoserologi, dan swab antigen.</>,
    },
    1: {
      images: ["https://i.imgur.com/aDOdWLV.png"],
      text: <>Klinik Berkat Insani dilengkapi dengan berbagai layanan yang siap melayani Anda selama 24 jam tanpa henti. Ada layanan Laboratorium yang melayani permintaan pemeriksaan dari internal maupun rujukan dari luar klinik. Ada Instalasi Gawat Darurat (IGD), yang siap melayani pasien dengan ketersediaan dokter IGD setiap saat.</>,
    },
    2: {
      images: ["https://i.imgur.com/cxHqzT0.png", "https://i.imgur.com/CMSPNVr.png"],
      text: <>Rawat Inap — layanan rawat inap dengan fasilitas kamar yang nyaman dan perawatan profesional selama masa pemulihan.</>,
    },
    3: {
      images: ["https://i.imgur.com/sO0pWoB.png"],
      text: <>Apotek — layanan obat dan konsultasi farmasi dengan staf apoteker yang berpengalaman.</>,
    },
  };

  const currentContent = tabContent[activeTab] ?? tabContent[0];

  useEffect(() => {
    const images = currentContent.images;
    if (!labSlideshowRef.current || images.length < 2) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % images.length;
      labSlideshowRef.current!.src = images[index];
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const reserve = () => {
    setAppointmentOpen(true);
  };

  const explore = (title: string, index: number) => {
    setActiveTab(index);
    toast("Informasi layanan", {
      description: `Halaman detail ${title} dapat dihubungkan setelah informasi layanan klinik dikonfirmasi.`,
    });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-white text-[#173047]">
      <header className="sticky top-0 z-50 border-b border-[#173047]/10 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[220px] max-w-[1400px] items-center justify-between px-5 lg:px-10">
          <a href="#top" className="flex items-center" aria-label="Klinik Berkat Insani home">
            <img src={assets.logo} alt="Klinik Berkat Insani" className="rounded-xl object-contain" style={{ height: "200px", width: "200px" }} />
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {[
              ["Beranda", "#top"],
              ["Alur layanan", "#care"],
              ["Layanan", "#services"],
              ["Persiapan kunjungan", "#visit"],
              ["Informasi", "#journal"],
              ["Lokasi", "#locations"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="nav-link text-[13px] font-semibold text-[#40566a] transition-colors hover:text-[#039CB7]"
              >
                {label}
              </a>
            ))}
          </nav>

          <button onClick={reserve} className="hidden items-center gap-2 rounded-full bg-[#039CB7] px-5 py-3 text-xs font-bold text-white shadow-[0_8px_22px_rgba(3,156,183,.25)] transition hover:-translate-y-0.5 hover:bg-[#007f98] active:scale-[.97] sm:flex">
            <CalendarDays size={15} />
            Ajukan kunjungan
          </button>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#173047]/10 text-[#173047] lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={19} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[#173047]/10 bg-white px-5 py-5 shadow-xl lg:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {[
                ["Beranda", "#top"],
                ["Alur layanan", "#care"],
                ["Layanan", "#services"],
                ["Persiapan kunjungan", "#visit"],
                ["Informasi", "#journal"],
                ["Lokasi", "#locations"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-bold text-[#173047] hover:bg-[#edf9fb]"
                >
                  {label}
                </a>
              ))}
            </nav>
            <button onClick={reserve} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#039CB7] px-5 py-3.5 text-sm font-bold text-white active:scale-[.97]">
              <CalendarDays size={16} /> Ajukan kunjungan
            </button>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative isolate min-h-[480px] overflow-hidden selection:bg-[#C8E6F5]" style={{background:"radial-gradient(120% 120% at 20% 10%, #E8F4FD 0%, #F5FBFF 35%, #FFFFFF 60%, #FFF8E7 100%)"}}>
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[70%] rounded-full blur-[90px] opacity-60" style={{background:"#D6EDFA"}} />
            <div className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[60%] rounded-full blur-[80px] opacity-50" style={{background:"#FFF1C9"}} />
          </div>
          <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 relative min-h-[480px] overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[70%] rounded-full blur-[90px] opacity-60" style={{background:"#D6EDFA"}} />
              <div className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[60%] rounded-full blur-[80px] opacity-50" style={{background:"#FFF1C9"}} />
            </div>
            <div className="relative w-full flex items-start min-h-[360px]">
              <div className="flex flex-col items-start justify-center w-[60%] py-14 sm:py-16">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#039CB7]/20 bg-white/65 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#007f98] backdrop-blur">
                  {persistedClinic?.profile?.tagline ?? "Klinik Berkat Insani · Kotabaru"}
                </div>
                <h1 className="font-display text-[clamp(2.4rem,4vw,3.5rem)] font-semibold leading-[1.05] tracking-[-.025em] text-[#173047] text-balance">
                  Perhatian yang hangat untuk kesehatan ibu, bayi, dan keluarga.
                </h1>
                <p className="mt-4 max-w-md text-[15px] leading-7 text-[#496273]">
                  Di Kelumpang Hilir, Kotabaru, Klinik Berkat Insani menghadirkan Poli Umum, Poli Kandungan, dan Poli Gigi dengan akses pendaftaran melalui WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </section>
          <style>{`
            @keyframes scroll-ltr {
              0% { transform: translateX(-50%); }
              100% { transform: translateX(0); }
            }
            @keyframes img-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .animate-scroll-left-to-right {
              animation: scroll-ltr 25s linear infinite;
            }
            @media (max-width: 640px) {
              .animate-scroll-left-to-right {
                animation-duration: 20s;
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .animate-scroll-left-to-right {
                animation-duration: 60s;
              }
            }
          `}</style>

        <div className="relative z-10 mx-auto -mt-9 max-w-[1328px] px-5 lg:-mt-11 lg:px-10">
          <div className="grid overflow-hidden rounded-[30px] bg-[#039CB7] text-white shadow-[0_18px_45px_rgba(3,156,183,.24)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              [HeartHandshake, "Melayani dengan kasih", "Pendekatan yang hangat untuk kebutuhan kesehatan keluarga"],
              [Stethoscope, "Tenaga Profesional", "Pemeriksaan kehamilan, USG, dan konsultasi kandungan"],
              [ShieldCheck, "Layanan Kesehatan", "Pilihan layanan untuk Laboratorium, Radiology, Rehabilitasi Medik, dan Optik"],
              [Clock3, "Konfirmasi jadwal", "Ajukan permintaan kunjungan atau gunakan WhatsApp sebagai alternatif"],
            ].map(([Icon, title, detail], i) => {
              const CareIcon = Icon as typeof HeartHandshake;
              return (
                <div key={title as string} className={`flex gap-3 px-5 py-6 sm:px-7 ${i > 0 ? "lg:border-l lg:border-white/20" : ""}`}>
                  <CareIcon className="mt-0.5 shrink-0" size={24} strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-extrabold leading-tight">{title as string}</p>
                    <p className="mt-1 text-xs leading-5 text-white/78">{detail as string}</p>
                  </div>
                </div>              );
            })}
          </div>
        </div>


        <section id="care" className="mx-auto max-w-[1400px] px-5 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[.9fr_2.1fr] lg:gap-20">
            <div>
              <p className="eyebrow">Layanan 24 Jam</p>
              <h2 className="mt-5 font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Pilih layanan yang sesuai, lalu siapkan kunjungan Anda.</h2>
              <p className="mt-6 max-w-sm text-[15px] leading-7 text-[#5c7180]">
                Sebelum datang, konfirmasi layanan dan jadwal melalui WhatsApp agar kebutuhan Anda dapat diarahkan dengan lebih tepat.
              </p>
            </div>
            <div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 border-b border-[#173047]/10 pb-4">
                {serviceTabs.map((tab, index) => (
                  <button key={tab} onClick={() => explore(tab, index)} className={`relative pb-2 text-sm font-bold ${index === activeTab ? "text-[#039CB7] after:absolute after:bottom-[-1px] after:left-0 after:h-0.5 after:w-full after:bg-[#039CB7]" : "text-[#78909e] hover:text-[#173047]"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative mt-7 flex gap-4 rounded-2xl border border-[#173047]/10 overflow-hidden">
                <div className="relative w-[55%] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#e6f6f8]/70 via-[#e6f6f8]/40 to-transparent" />
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[6%] bg-gradient-to-r from-white via-white/80 to-transparent" />
                <img
                  key={activeTab}
                  ref={labSlideshowRef}
                  src={currentContent.images[0]}
                  alt=""
                  className="w-full h-auto object-contain object-top"
                  style={{maxHeight:'300px', animation:'img-fade 0.5s ease-out forwards'}}
                  loading="eager"
                />

                </div>
                <p className="w-[45%] text-[17px] leading-8 text-[#506776] flex flex-col justify-center">
                  {currentContent.text}
                </p>
              </div>

            </div>
          </div>
        </section>

        <section id="services" className="bg-[#fbfaf5] py-24 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Informasi layanan</p>
                <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Ruang untuk membahas kebutuhan kesehatan dengan lebih nyaman.</h2>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {activeCareCards.map((card) => (
                <article key={card.title} className="group overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(23,48,71,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(23,48,71,.12)]">
                  <div className="relative h-56 overflow-hidden sm:h-60 xl:h-56">
                    <img src={card.image} alt="" className="h-full w-full object-contain object-center transition duration-500 group-hover:scale-[1.05]" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#007f98] backdrop-blur">{card.tag}</div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-2xl font-semibold leading-tight tracking-[-.025em] text-[#173047]">{card.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#607684]">{card.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="visit" className="mx-auto grid max-w-[1400px] gap-10 px-5 py-24 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-10 lg:py-32">
          <div className="relative">
            <div className="absolute -left-4 -top-4 h-28 w-28 rounded-full bg-[#d7f4f7]" />
            <img src={assets.homecare} alt="Tenaga kesehatan menyambut pasien dalam suasana yang nyaman" className="relative aspect-[1.2] w-full rounded-[32px] object-cover shadow-[0_24px_55px_rgba(23,48,71,.15)]" />
          </div>
          <div className="max-w-xl">
            <p className="eyebrow">Sebelum berkunjung</p>
            <h2 className="mt-5 font-display text-4xl font-semibold leading-[.98] tracking-[-.045em] text-[#173047] lg:text-5xl">Ajukan tanggal pilihan, lalu datang dengan informasi yang Anda perlukan.</h2>
            <p className="mt-7 text-[17px] leading-8 text-[#5c7180]">
              Ajukan layanan dan tanggal pilihan Anda melalui formulir singkat. Staf klinik akan menghubungi Anda untuk mengonfirmasi ketersediaan sebelum kunjungan.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {["Ajukan layanan dan tanggal pilihan", "Siapkan informasi keluhan", "Catat obat yang sedang digunakan", "Tanyakan langkah selanjutnya"].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[#f5fafb] p-4 text-sm font-bold leading-5 text-[#395568]">
                  <CheckCircle2 className="shrink-0 text-[#039CB7]" size={18} /> {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#039CB7] py-24 text-white lg:py-28">
          <div className="absolute right-[-8rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full border-[70px] border-white/10" />
          <div className="relative mx-auto grid max-w-[1400px] gap-12 px-5 lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-20 lg:px-10">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-white/70">Klinik Berkat Insani</p>
              <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[.96] tracking-[-.045em] lg:text-6xl">Kesehatan ibu dan bayi mendapat perhatian yang lebih dekat.</h2>
              <p className="mt-7 max-w-xl text-[17px] leading-8 text-white/80">
                Poli Kandungan bersama dr. Syaiful Aspiannur, Sp.OG diinformasikan menyediakan pemeriksaan kehamilan, USG, konsultasi kandungan, pemantauan ibu dan janin, serta konsultasi program hamil.
              </p>
            </div>
            <div className="relative">
              <img src={assets.facilityStay} alt="Ruang klinik yang bersih dan nyaman" className="aspect-[1.13] w-full rounded-[30px] object-cover shadow-[0_24px_50px_rgba(0,0,0,.18)]" />
              <div className="absolute -bottom-6 -left-4 max-w-[225px] rounded-2xl bg-white p-5 text-[#173047] shadow-[0_20px_40px_rgba(0,0,0,.14)] sm:-left-8">
                <p className="font-display text-xl font-semibold leading-tight">Datang dengan tenang.</p>
                <p className="mt-2 text-xs leading-5 text-[#607684]">Kami bantu arahkan langkah awal kunjungan Anda.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#eef8f8] py-24 lg:py-28">
          <div className="mx-auto max-w-[1100px] px-5 text-center lg:px-10">
            <p className="eyebrow">Alur kunjungan</p>
            <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Persiapan sederhana membantu proses konsultasi lebih terarah.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-[#5c7180]">Kunjungan dapat dimulai dari pendaftaran, dilanjutkan pemeriksaan awal dan konsultasi dokter, kemudian pengambilan obat sesuai proses klinik.</p>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ["Daftar lebih dulu", "Konfirmasi layanan dan jadwal melalui WhatsApp klinik."],
                ["Lanjutkan pemeriksaan", "Pemeriksaan awal membantu mengarahkan proses konsultasi."],
                ["Pahami tindak lanjut", "Ajukan pertanyaan sebelum melanjutkan ke proses berikutnya."],
              ].map(([title, copy], index) => (
                <div key={title} className="rounded-[24px] bg-white p-8 text-left shadow-[0_10px_25px_rgba(23,48,71,.06)]">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#d7f4f7] text-sm font-extrabold text-[#007f98]">0{index + 1}</div>
                  <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-.025em] text-[#173047]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#607684]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="journal" className="mx-auto max-w-[1400px] px-5 py-24 lg:px-10 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Informasi layanan</p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Kenali layanan yang dapat Anda tanyakan sebelum datang.</h2>
            </div>
          </div>
          <div className="mt-12">
            <InstagramEmbeds />
          </div>
        </section>
      </main>

      <footer id="locations" className="bg-[#007f98] text-white">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-16 lg:grid-cols-[1.05fr_2fr] lg:px-10 lg:py-20">
          <div>
            <img src={assets.logo} alt="Klinik Berkat Insani" className="h-24 w-24 rounded-2xl bg-white object-contain p-1.5" style={{height: '100px', width: '100px'}} />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/76">Klinik Berkat Insani melayani kebutuhan kesehatan keluarga di Kelumpang Hilir, Kotabaru. Konfirmasi layanan dan jadwal melalui WhatsApp sebelum berkunjung.</p>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-[#007f98] active:scale-[.97]">
              <Phone size={16} /> WhatsApp 0852-1586-2526
            </a>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {locations.map((location) => (
              <div key={location.name}>
                <p className="font-display text-xl font-semibold">{location.name}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-white/76">{location.detail}</p>
                <a href={location.href} target={location.href.startsWith("http") ? "_blank" : undefined} rel={location.href.startsWith("http") ? "noreferrer" : undefined} className="mt-5 inline-flex items-center gap-1 text-xs font-extrabold text-white transition hover:gap-2">{location.cta} <ArrowRight size={14} /></a>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-4 px-5 py-6 text-xs text-white/65 sm:flex-row lg:px-10">
            <p>Klinik Berkat Insani · Kelumpang Hilir, Kotabaru</p>
            <div className="flex gap-5"><a href="#top" className="hover:text-white">Beranda</a><a href="#care" className="hover:text-white">Alur layanan</a><a href="#locations" className="hover:text-white">Lokasi</a></div>
          </div>
        </div>
      </footer>

      <button onClick={reserve} aria-label="Tanya layanan" className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#039CB7] text-white shadow-[0_12px_28px_rgba(3,156,183,.38)] transition hover:-translate-y-1 hover:bg-[#007f98] active:scale-[.94]">
        <CalendarDays size={22} />
      </button>
      <AppointmentRequestDialog open={appointmentOpen} onOpenChange={setAppointmentOpen} services={activeCareCards.map(card => card.title)} whatsappUrl={activeWhatsappUrl} />
    </div>
  );
}
