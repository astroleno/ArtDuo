import type { ReactNode } from "react";

export type StageGrade = "A" | "B" | "C";
export type StageDisplayStrategy = "static-frame" | "motion-frame" | "director-focus";
export type StageTransitionIntensity = "soft" | "moderate" | "dramatic";

export interface StageFocusTarget {
  x: number;
  y: number;
  radius?: number;
}

export interface StagePlaybackProfile {
  artworkId: string;
  grade: StageGrade;
  motionProfile: string;
  displayStrategy: StageDisplayStrategy;
  transitionIntensity: StageTransitionIntensity;
  usesDynamicMedia: boolean;
  mediaUrl?: string;
  posterUrl?: string;
  focusTarget?: StageFocusTarget;
}

export interface VideoStageProps {
  title: string;
  imageUrl: string;
  profile: StagePlaybackProfile;
  children?: ReactNode;
}

export function VideoStage({ title, imageUrl, profile, children }: VideoStageProps) {
  const mediaUrl = profile.mediaUrl ?? imageUrl;

  return (
    <figure
      className={`immersive-video-stage is-${profile.displayStrategy}`}
      data-grade={profile.grade}
      data-motion-profile={profile.motionProfile}
    >
      {profile.usesDynamicMedia ? (
        <video
          aria-label={`${title} motion media`}
          autoPlay
          loop
          muted
          playsInline
          poster={profile.posterUrl ?? imageUrl}
        >
          <source src={mediaUrl} />
        </video>
      ) : (
        <img alt={`${title} artwork`} src={mediaUrl} />
      )}
      {children ? <div className="immersive-video-stage-nav">{children}</div> : null}
    </figure>
  );
}
