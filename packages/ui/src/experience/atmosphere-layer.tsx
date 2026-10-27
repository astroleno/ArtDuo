"use client";

export function AtmosphereLayer({ tone = "warm", reducedMotion = false }: { tone?: string; reducedMotion?: boolean }) {
  return <div aria-hidden="true" className={`experience-atmosphere tone-${tone}`} data-reduced-motion={reducedMotion}>
    <span className="experience-atmosphere-beam" />
    <span className="experience-atmosphere-pool" />
    <span className="experience-atmosphere-floor" />
    {!reducedMotion ? <span className="experience-atmosphere-dust" /> : null}
  </div>;
}
