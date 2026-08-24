/**
 * Calm Clinical Editorial — an Indonesian Klinik Berkat Insani experience using verified
 * Kotabaru location details and carefully paraphrased public-facing clinic positioning.
 */
import { useState } from "react";
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
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { toast } from "sonner";

const assets = {
  logo: "/manus-storage/klinik-berkat-insani-logo_d6e42d2d.jpg",
  careMark: "/manus-storage/care-orbit-mark_3642fa2e.png",
  hero: "/manus-storage/clinic-hero-family_4a05f017.jpg",
  motherChild: "/manus-storage/mother-child-care_204ea094.jpg",
  dentalStudio: "/manus-storage/dental-studio_efab33ee.jpg",
  homecare: "/manus-storage/homecare-visit_252ccbea.jpg",
  facilityStay: "/manus-storage/facility-stay_e52bacd3.png",
  delivery: "/manus-storage/delivery-room_77732972.png",
  blueLight: "/manus-storage/blue-light_f1a96e26.png",
  dentalDigital: "/manus-storage/dental-digital_dee1ece8.webp",
  dentalSuite: "/manus-storage/dental-suite_18001d73.png",
};

const serviceTabs = [
  "Pendaftaran",
  "Pemeriksaan awal",
  "Konsultasi dokter",
  "Pengambilan obat",
];

const careCards = [
  {
    title: "Kesehatan ibu & bayi",
    text: "Perhatian yang hangat untuk kebutuhan kesehatan ibu dan bayi, dengan informasi yang lebih mudah dipahami keluarga.",
    image: assets.motherChild,
    tag: "Ibu & bayi",
  },
  {
    title: "Konsultasi kesehatan",
    text: "Sampaikan kebutuhan Anda, lalu lanjutkan dengan arahan yang sesuai dari tenaga kesehatan.",
    image: assets.facilityStay,
    tag: "Konsultasi",
  },
  {
    title: "Pemeriksaan awal",
    text: "Tahap awal untuk membantu mengarahkan kebutuhan pemeriksaan sebelum konsultasi dokter.",
    image: assets.homecare,
    tag: "Alur kunjungan",
  },
  {
    title: "Informasi obat",
    text: "Setelah pemeriksaan, pasien dapat memperoleh informasi lanjutan mengenai proses pengambilan obat.",
    image: assets.dentalStudio,
    tag: "Tindak lanjut",
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
    name: "Alur layanan",
    detail: "Pendaftaran, pemeriksaan awal, konsultasi dokter, dan pengambilan obat.",
    cta: "Lihat alur",
    href: "#care",
  },
  {
    name: "Info terbaru",
    detail: "Ikuti kabar dan edukasi kesehatan dari Klinik Berkat Insani melalui Instagram resmi.",
    cta: "Buka Instagram",
    href: "https://www.instagram.com/klinikberkatinsani/",
  },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  const reserve = () => {
    toast.success("Informasi layanan", {
      description: "Hubungi Klinik Berkat Insani untuk mengonfirmasi layanan dan jadwal yang tersedia.",
    });
  };

  const explore = (title: string) => {
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
            Tanya layanan
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
              <CalendarDays size={16} /> Tanya layanan
            </button>
          </div>
        )}
      </header>

      <main id="top">
        <section className="relative isolate min-h-[620px] overflow-hidden bg-[#e6f6f8] lg:min-h-[650px]">
          <img src={assets.hero} alt="Keluarga dalam suasana konsultasi kesehatan yang hangat" className="absolute inset-0 h-full w-full object-cover object-[67%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#e6f6f8] via-[#e6f6f8]/95 via-38% to-transparent" />
          <div className="absolute bottom-10 right-[9%] hidden h-28 w-28 rounded-full border border-[#039CB7]/25 bg-white/35 p-5 backdrop-blur-sm lg:block">
            <img src={assets.careMark} alt="" className="h-full w-full object-contain opacity-75" />
          </div>
          <div className="relative mx-auto flex min-h-[620px] max-w-[1400px] items-center px-5 py-20 lg:min-h-[650px] lg:px-10">
            <div className="max-w-xl animate-[fade-up_.75s_var(--ease-out)_both]">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#039CB7]/20 bg-white/65 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#007f98] backdrop-blur">
                <Sparkles size={14} /> Klinik Berkat Insani · Kotabaru
              </div>
              <h1 className="max-w-[610px] font-display text-[clamp(3rem,5vw,5.55rem)] font-semibold leading-[.94] tracking-[-.05em] text-[#173047]">
                Perhatian yang hangat untuk kesehatan ibu, bayi, dan keluarga.
              </h1>
              <p className="mt-7 max-w-md text-[17px] leading-8 text-[#496273]">
                Klinik Berkat Insani hadir di Kelumpang Hilir, Kotabaru, untuk membantu Anda memahami setiap langkah kunjungan dengan lebih tenang.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <button onClick={reserve} className="group inline-flex items-center gap-3 rounded-full bg-[#039CB7] px-6 py-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(3,156,183,.28)] transition hover:-translate-y-0.5 hover:bg-[#007f98] active:scale-[.97]">
                  Tanya layanan klinik <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <a href="#care" className="inline-flex items-center gap-2 rounded-full border border-[#173047]/15 bg-white/55 px-6 py-4 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#039CB7]">
                  Lihat alur kunjungan <ChevronRight size={17} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <div className="relative z-10 mx-auto -mt-9 max-w-[1328px] px-5 lg:-mt-11 lg:px-10">
          <div className="grid overflow-hidden rounded-[30px] bg-[#039CB7] text-white shadow-[0_18px_45px_rgba(3,156,183,.24)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              [HeartHandshake, "Melayani dengan kasih", "Sambutan yang hangat untuk kebutuhan kesehatan keluarga"],
              [Stethoscope, "Pemeriksaan terarah", "Dimulai dari pemeriksaan awal sebelum konsultasi"],
              [ShieldCheck, "Konsultasi dokter", "Sampaikan keluhan dan kebutuhan Anda dengan jelas"],
              [Clock3, "Informasi obat", "Langkah lanjutan setelah proses pemeriksaan"],
            ].map(([Icon, title, detail], i) => {
              const CareIcon = Icon as typeof HeartHandshake;
              return (
                <div key={title as string} className={`flex gap-3 px-5 py-6 sm:px-7 ${i > 0 ? "lg:border-l lg:border-white/20" : ""}`}>
                  <CareIcon className="mt-0.5 shrink-0" size={24} strokeWidth={1.8} />
                  <div>
                    <p className="text-sm font-extrabold leading-tight">{title as string}</p>
                    <p className="mt-1 text-xs leading-5 text-white/78">{detail as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <section id="care" className="mx-auto max-w-[1400px] px-5 py-24 lg:px-10 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-[.9fr_2.1fr] lg:gap-20">
            <div>
              <p className="eyebrow">Alur layanan</p>
              <span className="section-rule" />
              <h2 className="mt-5 font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Datang, periksa, konsultasi, lalu lanjutkan dengan lebih jelas.</h2>
              <p className="mt-6 max-w-sm text-[15px] leading-7 text-[#5c7180]">
                Kami merangkum langkah kunjungan yang diinformasikan secara publik agar Anda dapat menyiapkan kebutuhan sebelum datang.
              </p>
            </div>
            <div>
              <div className="flex flex-wrap gap-x-6 gap-y-3 border-b border-[#173047]/10 pb-4">
                {serviceTabs.map((tab, index) => (
                  <button key={tab} onClick={() => explore(tab)} className={`relative pb-2 text-sm font-bold ${index === 0 ? "text-[#039CB7] after:absolute after:bottom-[-17px] after:left-0 after:h-0.5 after:w-full after:bg-[#039CB7]" : "text-[#78909e] hover:text-[#173047]"}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <p className="mt-7 max-w-3xl text-[17px] leading-8 text-[#506776]">
                Kunjungan dapat dimulai dari pendaftaran, dilanjutkan dengan pemeriksaan awal dan konsultasi dokter, kemudian pengambilan obat sesuai proses yang ditetapkan klinik.
              </p>
              <button onClick={() => explore("alur layanan")} className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#039CB7] transition hover:gap-3">
                Pelajari alur layanan <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        <section id="services" className="bg-[#fbfaf5] py-24 lg:py-28">
          <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Informasi layanan</p>
                <span className="section-rule" />
                <h2 className="mt-4 max-w-xl font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Ruang untuk membahas kebutuhan kesehatan dengan lebih nyaman.</h2>
              </div>
              <button onClick={() => explore("All care paths")} className="inline-flex items-center gap-2 rounded-full border border-[#173047]/15 px-5 py-3 text-sm font-bold text-[#173047] transition hover:border-[#039CB7] hover:text-[#039CB7]">
                Tanyakan pilihan layanan <ArrowRight size={16} />
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {careCards.map((card, index) => (
                <article key={card.title} className={`group overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_rgba(23,48,71,.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(23,48,71,.12)] ${index === 1 ? "xl:mt-10" : ""}`}>
                  <div className="relative aspect-[1.35] overflow-hidden">
                    <img src={card.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#007f98] backdrop-blur">{card.tag}</div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-display text-2xl font-semibold leading-tight tracking-[-.025em] text-[#173047]">{card.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#607684]">{card.text}</p>
                    <button onClick={() => explore(card.title)} className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#039CB7] transition hover:gap-3">
                      Tanya informasi <ArrowRight size={16} />
                    </button>
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
            <p className="eyebrow">Persiapan kunjungan</p>
            <span className="section-rule" />
            <h2 className="mt-5 font-display text-4xl font-semibold leading-[.98] tracking-[-.045em] text-[#173047] lg:text-5xl">Datang dengan informasi yang Anda perlukan.</h2>
            <p className="mt-7 text-[17px] leading-8 text-[#5c7180]">
              Catat keluhan utama, obat yang sedang digunakan, dan pertanyaan yang ingin Anda ajukan. Persiapan sederhana dapat membantu percakapan saat konsultasi menjadi lebih terarah.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {["Siapkan informasi keluhan", "Catat obat yang sedang digunakan", "Sampaikan riwayat yang relevan", "Tanyakan langkah selanjutnya"].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-[#f5fafb] p-4 text-sm font-bold leading-5 text-[#395568]">
                  <CheckCircle2 className="shrink-0 text-[#039CB7]" size={18} /> {item}
                </div>
              ))}
            </div>
            <button onClick={reserve} className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#173047] px-6 py-4 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#244861] active:scale-[.97]">
              Tanyakan sebelum berkunjung <ArrowRight size={17} />
            </button>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#039CB7] py-24 text-white lg:py-28">
          <div className="absolute right-[-8rem] top-[-12rem] h-[32rem] w-[32rem] rounded-full border-[70px] border-white/10" />
          <div className="relative mx-auto grid max-w-[1400px] gap-12 px-5 lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-20 lg:px-10">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-white/70">Klinik Berkat Insani</p>
              <span className="section-rule section-rule--light" />
              <h2 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[.96] tracking-[-.045em] lg:text-6xl">Layanan kesehatan yang dimulai dengan kepedulian.</h2>
              <p className="mt-7 max-w-xl text-[17px] leading-8 text-white/80">
                Kami mengutamakan komunikasi yang jelas sejak pendaftaran, pemeriksaan awal, konsultasi dokter, hingga proses pengambilan obat.
              </p>
              <button onClick={() => explore("informasi Klinik Berkat Insani")} className="mt-9 inline-flex items-center gap-3 rounded-full bg-white px-6 py-4 text-sm font-extrabold text-[#007f98] transition hover:-translate-y-0.5 hover:bg-[#eafdff] active:scale-[.97]">
                Tanyakan informasi layanan <ArrowRight size={17} />
              </button>
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
            <p className="eyebrow">Melayani dengan kasih</p>
            <span className="section-rule" />
            <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Informasi yang jelas membantu kunjungan terasa lebih terarah.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-[#5c7180]">Kami merangkum proses yang diinformasikan secara publik agar Anda dapat mempersiapkan pertanyaan dan kebutuhan sebelum konsultasi.</p>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ["Mulai dari pendaftaran", "Sampaikan kebutuhan kunjungan Anda sejak tahap pertama."],
                ["Lanjutkan pemeriksaan", "Pemeriksaan awal membantu mengarahkan proses konsultasi."],
                ["Pahami tindak lanjut", "Ajukan pertanyaan bila Anda memerlukan penjelasan berikutnya."],
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
              <p className="eyebrow">Informasi kunjungan</p>
              <span className="section-rule" />
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[.98] tracking-[-.04em] text-[#173047] lg:text-5xl">Hal sederhana yang dapat disiapkan sebelum konsultasi.</h2>
            </div>
            <button onClick={() => explore("informasi kunjungan")} className="inline-flex items-center gap-2 text-sm font-extrabold text-[#039CB7] transition hover:gap-3">Tanya informasi <ArrowRight size={16} /></button>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-12">
            <article className="group grid overflow-hidden rounded-[30px] bg-[#f3faf8] lg:col-span-7 sm:grid-cols-[1.04fr_.96fr]">
              <div className="min-h-[300px] overflow-hidden">
                <img src={assets.motherChild} alt="Ibu dan anak dalam suasana konsultasi yang hangat" className="h-full w-full object-cover object-[62%_center] transition duration-500 group-hover:scale-[1.04]" />
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-8 lg:p-10">
                <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#039CB7]">Untuk ibu & bayi</p>
                <h3 className="mt-3 font-display text-3xl font-semibold leading-[1.03] tracking-[-.035em] text-[#173047]">Catat kebutuhan yang ingin dibahas saat datang bersama buah hati.</h3>
                <p className="mt-4 text-sm leading-6 text-[#607684]">Tuliskan keluhan, perubahan yang diperhatikan, serta pertanyaan yang ingin Anda sampaikan saat konsultasi.</p>
                <button onClick={() => explore("persiapan konsultasi ibu dan bayi")} className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[#039CB7] transition hover:gap-3">Lihat persiapan <ArrowRight size={16} /></button>
              </div>
            </article>
            <div className="grid gap-6 lg:col-span-5">
              <article className="group grid min-h-[220px] overflow-hidden rounded-[30px] bg-[#fbfaf5] sm:grid-cols-[.95fr_1.05fr]">
                <div className="relative overflow-hidden">
                  <img src={assets.facilityStay} alt="Suasana klinik yang bersih dan nyaman" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-[#173047]/10" />
                </div>
                <div className="p-7">
                  <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#039CB7]">Sebelum berkunjung</p>
                  <h3 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-.025em] text-[#173047]">Apa yang dapat membantu proses konsultasi?</h3>
                  <button onClick={() => explore("persiapan kunjungan")} className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#173047] transition hover:text-[#039CB7]">Baca panduannya <ArrowRight size={15} /></button>
                </div>
              </article>
              <article className="relative overflow-hidden rounded-[30px] bg-[#173047] p-8 text-white sm:p-9">
                <img src={assets.careMark} alt="" className="absolute -bottom-9 -right-6 h-44 w-44 opacity-15 brightness-0 invert" />
                <p className="relative text-[10px] font-extrabold uppercase tracking-[.15em] text-[#84e2ec]">Daftar pertanyaan</p>
                <div className="relative mt-4 flex flex-wrap items-end justify-between gap-6">
                  <h3 className="max-w-sm font-display text-3xl font-semibold leading-[1.02] tracking-[-.035em]">Tanyakan langkah berikutnya setelah konsultasi.</h3>
                  <button onClick={() => explore("daftar pertanyaan")} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#039CB7] text-white transition hover:scale-105 active:scale-[.95]" aria-label="Buka daftar pertanyaan"><ArrowRight size={18} /></button>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer id="locations" className="bg-[#007f98] text-white">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-16 lg:grid-cols-[1.05fr_2fr] lg:px-10 lg:py-20">
          <div>
            <img src={assets.logo} alt="Klinik Berkat Insani" className="h-24 w-24 rounded-2xl bg-white object-contain p-1.5" style={{height: '100px', width: '100px'}} />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/76">Klinik Berkat Insani menyediakan informasi layanan kesehatan untuk masyarakat di Kelumpang Hilir, Kotabaru. Kami menyusun halaman ini dari informasi publik yang dapat ditinjau.</p>
            <button onClick={reserve} className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-[#007f98] active:scale-[.97]">
              <Phone size={16} /> Tanya layanan
            </button>
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
    </div>
  );
}
