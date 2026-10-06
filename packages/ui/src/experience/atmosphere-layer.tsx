"use client";

export function AtmosphereLayer({ tone = "warm", reducedMotion = false }: { tone?: string; reducedMotion?: boolean }) {
  return <div aria-hidden="true" className={`experience-atmosphere tone-${tone}`} data-reduced-motion={reducedMotion}>
    <span className="experience-atmosphere-beam" />
    {!reducedMotion ? <span className="experience-atmosphere-dust" /> : null}
  </div>;
}
