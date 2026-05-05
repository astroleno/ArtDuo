import type {
  ArtworkGrade,
  FocusTarget,
  MotionPlaybackProfile,
  MotionProfile,
  TransitionIntensity,
} from "@artduo/contracts";

export interface BuildMotionProfileInput {
  artworkId: string;
  grade: ArtworkGrade;
  imageUrl: string;
  hasMotionAsset: boolean;
  motionProfile?: MotionProfile;
  videoUrlMain?: string;
  videoUrlVertical?: string;
  videoUrlCloseup?: string;
  videoPosterUrl?: string;
  focusTarget?: FocusTarget;
}

function chooseVideoUrl(input: BuildMotionProfileInput): string | undefined {
  if (input.grade === "A") {
    return input.videoUrlCloseup ?? input.videoUrlMain ?? input.videoUrlVertical;
  }

  return input.videoUrlMain ?? input.videoUrlVertical ?? input.videoUrlCloseup;
}

function fallbackMotionProfile(grade: ArtworkGrade, usesDynamicMedia: boolean): MotionProfile {
  if (grade === "A") {
    return usesDynamicMedia ? "push-in" : "push-in";
  }

  if (grade === "B") {
    return usesDynamicMedia ? "parallax" : "ambient-loop";
  }

  return "static";
}

function transitionIntensityForGrade(grade: ArtworkGrade): TransitionIntensity {
  if (grade === "A") {
    return "dramatic";
  }

  return grade === "B" ? "moderate" : "soft";
}

export function buildMotionProfile(input: BuildMotionProfileInput): MotionPlaybackProfile {
  const videoUrl = input.hasMotionAsset ? chooseVideoUrl(input) : undefined;
  const usesDynamicMedia = Boolean(videoUrl);

  return {
    artworkId: input.artworkId,
    grade: input.grade,
    motionProfile: input.motionProfile ?? fallbackMotionProfile(input.grade, usesDynamicMedia),
    displayStrategy: input.grade === "A" ? "director-focus" : usesDynamicMedia ? "motion-frame" : "static-frame",
    transitionIntensity: transitionIntensityForGrade(input.grade),
    usesDynamicMedia,
    mediaUrl: videoUrl ?? input.imageUrl,
    posterUrl: input.videoPosterUrl ?? input.imageUrl,
    focusTarget: input.focusTarget,
  };
}
