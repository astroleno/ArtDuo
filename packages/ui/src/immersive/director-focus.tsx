import type { ReactNode } from "react";

import type { StagePlaybackProfile } from "./video-stage";

export interface DirectorFocusProps {
  profile: StagePlaybackProfile;
  children?: ReactNode;
}

function toPercent(value: number | undefined): string | undefined {
  return typeof value === "number" ? String(Math.round(value * 100)) : undefined;
}

export function DirectorFocus({ profile, children }: DirectorFocusProps) {
  const isDirectorFocus = profile.grade === "A" || profile.displayStrategy === "director-focus";

  return (
    <section
      className={`immersive-director-focus ${isDirectorFocus ? "is-director-focus" : "is-supporting-focus"}`}
      data-focus-radius={toPercent(profile.focusTarget?.radius)}
      data-focus-x={toPercent(profile.focusTarget?.x)}
      data-focus-y={toPercent(profile.focusTarget?.y)}
      data-grade={profile.grade}
      data-motion-profile={profile.motionProfile}
    >
      {children ? <div className="immersive-director-focus-content">{children}</div> : null}
    </section>
  );
}
