import { serverMessages } from "@/lib/i18n/server";
import Link from "next/link";
import { KindCards } from "@/components/KindCards";
import { ScrollScene } from "@/components/ScrollScene";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  const t = serverMessages();
  const STEPS = [
    {
      scene: "invite",
      title: t("describeEvent"),
      text: t("describeStep"),
    },
    {
      scene: "share",
      title: t("shareLink"),
      text: t("shareStep"),
    },
    {
      scene: "rsvp",
      title: t("trackReplies"),
      text: t("trackStep"),
    },
  ] as const;
  return (
    <div className="relative overflow-clip">
      {/* Декоративные цветные формы по краям, за контентом */}
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 top-28 h-56 w-56 rounded-full bg-pink" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-[430px] h-36 w-36 rounded-full bg-mint" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-[900px] h-28 w-28 rounded-full bg-sun" />
      <div aria-hidden="true" className="pointer-events-none absolute left-[46%] top-6 h-6 w-6 rounded-full bg-sun" />

      <div className="relative z-10">
        <SiteHeader />
        <main>
          <section className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-5 pb-16 pt-8 sm:px-8">
            <div className="min-w-0 flex-1 basis-[420px]">
              <p className="inline-block rounded-full border-2 border-ink bg-mint px-4 py-2 text-sm font-bold text-ink">
                {t("heroBadge")}
              </p>
              <h1 className="h-display mt-6 text-[clamp(2.7rem,7vw,5rem)] leading-[1.04]">
                {t("heroTitle")} <span className="text-sun">{t("heroAccent")}</span>
              </h1>
              <p className="mt-6 max-w-xl text-xl text-white/90 sm:text-2xl">
                {t("heroDescription")}
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <Link href="/new" className="btn-sun btn-big">
                  {t("agentCTA")}
                </Link>
                <Link href="/e/demo" className="btn-mint btn-big">
                  {t("viewExample")}
                </Link>
              </div>
            </div>

            <div className="relative flex min-h-[500px] flex-1 basis-[340px] items-center justify-center">
              <div
                aria-hidden="true"
                className="invite-sticker absolute right-[6%] top-2 z-10 flex h-28 w-28 rotate-[10deg] items-center justify-center rounded-full border-2 border-ink bg-sun text-center font-display text-sm font-extrabold leading-tight text-ink"
              >
                RSVP
                <br />{t("oneClick")}
              </div>
              <div className="invite-preview w-[320px] -rotate-3 overflow-hidden rounded-[28px] border-2 border-ink bg-sky text-ink shadow-pop-lg">
                <div className="flex h-36 flex-col justify-end border-b-2 border-ink bg-coral p-5">
                  <div className="h-display text-2xl leading-tight">{t("sampleGreeting")}</div>
                </div>
                <div className="flex flex-col gap-3 p-5 font-semibold">
                  <span>{t("sampleDate")}</span>
                  <span>{t("sampleLocation")}</span>
                  <span>{t("sampleDress")}</span>
                  <div className="mt-1 flex gap-2.5">
                    <span className="flex-1 rounded-full border-2 border-ink bg-sun py-3 text-center font-bold">{t("rsvpYes")}</span>
                    <span className="flex-1 rounded-full border-2 border-ink bg-pink py-3 text-center font-bold">{t("rsvpNo")}</span>
                  </div>
                  <span className="text-sm font-medium">{t("sampleReplies")}</span>
                </div>
              </div>
            </div>
          </section>

          <section id="how" className="mx-auto max-w-7xl scroll-mt-4 px-5 pb-16 sm:px-8">
            <h2 className="h-display mb-8 text-[clamp(2.35rem,5.5vw,4.25rem)] leading-[1.05]">{t("threeSteps")}</h2>
            <div className="grid gap-6 sm:gap-10">
              {STEPS.map(({ scene, title, text }) => (
                <article key={scene} className="meet-scene" data-scene={scene}>
                  <div className="meet-scene__copy">
                    <h3 className="h-display text-[clamp(2rem,4.3vw,3.65rem)] leading-[1.06]">{title}</h3>
                    <p className="mt-4 max-w-sm text-lg font-medium sm:text-xl">{text}</p>
                  </div>
                  <ScrollScene kind={scene} />
                </article>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
            <h2 className="h-display text-3xl">{t("anyEvent")}</h2>
            <p className="mb-8 mt-3 max-w-xl text-lg text-white/90">
              {t("occasionsDescription")}
            </p>
            <KindCards />
          </section>

          <section className="mx-auto max-w-6xl px-5 pb-12 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-[36px] border-2 border-ink bg-sun p-8 text-ink shadow-pop-lg sm:p-12">
              <div className="h-display basis-[320px] text-3xl leading-tight">{t("readyToMeet")}</div>
              <Link href="/new" className="rounded-full border-2 border-ink bg-ink px-8 py-4 text-lg font-bold text-white">
                {t("createEvent")}
              </Link>
            </div>
          </section>
        </main>
        <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 px-5 pb-10 text-sm font-medium text-white/80 sm:px-8">
          <span>© 2026 Let&apos;s meet!</span>
        </footer>
      </div>
    </div>
  );
}
