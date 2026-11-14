"use client";

export type ExperienceWaitTier = "normal" | "long-wait" | "retry";

/**
 * The one frame shown from submission until the preface text arrives. It uses
 * the preface's layout, so each hand-off changes content in place: the
 * visitor's sentence holds the heading position, a breathing line holds the
 * position of the entrance button.
 */
export function ExperienceWaitingFrame({ query, tier, returnHref, retryHref, arriving = false }: {
  query: string; tier: ExperienceWaitTier; returnHref: string; retryHref?: string; arriving?: boolean;
}) {
  const sentence = query.trim();
  return <section aria-busy="true" aria-live="polite" className={`experience-waiting${arriving ? " is-arriving" : ""}`}>
    <div className="experience-waiting-copy">
      <p className="experience-eyebrow">{sentence ? "正在为这句话挑选作品" : "正在为你挑选作品"}</p>
      {sentence ? <h1 className="experience-waiting-echo">“{sentence}”</h1> : null}
      <div aria-hidden="true" className="experience-waiting-line" />
      {tier !== "normal" ? <p className="experience-waiting-note" role="status">
        还在为这句话挑选作品，可以稍候，或<a href={returnHref}>返回修改</a>
        {tier === "retry" && retryHref !== undefined ? <>，也可以<a href={retryHref}>重试准备</a></> : null}。
      </p> : null}
    </div>
  </section>;
}
