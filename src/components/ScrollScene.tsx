"use client";

import { useLocale } from "@/components/LocaleProvider";

import { useEffect, useRef } from "react";

type SceneKind = "invite" | "share" | "rsvp";


function easeBetween(progress: number, start: number, end: number) {
  const t = Math.min(1, Math.max(0, (progress - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function ScrollScene({ kind }: { kind: SceneKind }) {
  const { t } = useLocale();
  const REACTIONS = [t("rsvpYes"), t("sceneMaybe"), "+1"];
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    function render() {
      frame = 0;
      if (!element || motion.matches) return;

      const { top, height } = element.getBoundingClientRect();
      const viewport = window.innerHeight;
      const progress = (viewport * 0.93 - top) / (height * 0.38 + viewport * 0.62);
      const turn = easeBetween(progress, 0, 1);
      const bank = Math.sin(turn * Math.PI);
      const open = easeBetween(progress, 0.06, 0.51);
      const letter = easeBetween(progress, 0.44, 0.94);
      const flight = easeBetween(progress, 0.1, 0.98);
      const firstReaction = easeBetween(progress, 0.14, 0.63);

      element.style.setProperty("--pitch", `${16 - bank * 35 + turn * 4}deg`);
      element.style.setProperty("--yaw", `${-38 + turn * 57}deg`);
      element.style.setProperty("--flap", `${open * -175}deg`);
      element.style.setProperty("--flap-layer", open > 0.5 ? "1" : "4");
      element.style.setProperty("--lift", `${letter * -67}%`);
      element.style.setProperty("--flight-x", `${-26 + flight * 56}%`);
      element.style.setProperty("--flight-y", `${24 - flight * 57}%`);
      element.style.setProperty("--flight-roll", `${15 - bank * 48}deg`);
      element.style.setProperty("--trail", String(flight));
      element.style.setProperty("--first", `${firstReaction * 100}%`);
      element.style.setProperty("--first-roll", `${9 - firstReaction * 21}deg`);
      element.style.setProperty("--second", `${easeBetween(progress, 0.32, 0.8) * 100}%`);
      element.style.setProperty("--third", `${easeBetween(progress, 0.5, 1) * 100}%`);
      element.style.setProperty("--orbit", `${turn * 120}deg`);
    }

    function schedule() {
      if (motion.matches) {
        element?.removeAttribute("style");
      } else if (!frame) {
        frame = window.requestAnimationFrame(render);
      }
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div ref={scene} className="meet-scene__stage" aria-hidden="true">
      <div className="meet-scene__orbit" />
      {kind === "invite" && (
        <div className="scroll-invitation__model">
          <div className="scroll-invitation__back" />
          <div className="scroll-invitation__card">
            <span className="text-sm font-bold">{t("sceneDate")}</span>
            <strong className="h-display text-2xl sm:text-5xl">{t("seeYou")}</strong>
          </div>
          <div className="scroll-invitation__pocket" />
          <div className="scroll-invitation__flap" />
        </div>
      )}
      {kind === "share" && (
        <div className="meet-share">
          <div className="meet-share__trail" />
          <div className="meet-share__plane">
            <div className="meet-share__wing" />
            <div className="meet-share__wing" />
          </div>
        </div>
      )}
      {kind === "rsvp" && (
        <div className="meet-rsvp">
          {REACTIONS.map((reaction) => <div key={reaction} className="meet-rsvp__chip">{reaction}</div>)}
        </div>
      )}
    </div>
  );
}
