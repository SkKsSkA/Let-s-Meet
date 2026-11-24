"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function EventCardGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!grid.current || !("IntersectionObserver" in window)) return;
    const cards = Array.from(grid.current.children);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      visible.forEach(({ target }, index) => {
        const card = target as HTMLElement;
        card.style.setProperty("--entry-delay", index * 65 + "ms");
        card.classList.add("event-card-enter");
        observer.unobserve(card);
      });
    });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return <ul ref={grid} className="event-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</ul>;
}
