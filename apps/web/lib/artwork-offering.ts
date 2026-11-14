import type { AffectState } from "@artduo/contracts";
import type { WebArtwork } from "./release-catalog";

// What a work can offer a viewer, estimated from editorial tags, measured pixels
// and the reviewed image. It describes the artwork, never the visitor.
type Vector = [valence: number, arousal: number, tension: number, wonder: number, intimacy: number];

const TAG_STATE: Record<string, Vector> = {
  animated: [.7, .75, .25, .45, .4], attentive: [.5, .3, .2, .4, .45], awe: [.62, .62, .32, .88, .38],
  breezy: [.72, .45, .08, .45, .35], bright: [.78, .68, .2, .46, .24], calm: [.56, .18, .12, .26, .52],
  ceremonial: [.55, .5, .35, .6, .3], clinical: [.4, .3, .35, .2, .15], complex: [.5, .55, .45, .5, .4],
  contemplation: [.48, .24, .22, .42, .5], curious: [.6, .5, .2, .65, .4], desire: [.56, .58, .42, .48, .82],
  dramatic: [.38, .72, .72, .55, .3], formal: [.5, .3, .3, .35, .3], gentle: [.62, .2, .08, .3, .6],
  graceful: [.66, .32, .1, .45, .5], held: [.55, .2, .12, .28, .84], hope: [.72, .38, .16, .58, .48],
  intimate: [.52, .28, .22, .34, .86], joy: [.86, .66, .08, .46, .36], lively: [.78, .72, .15, .45, .4],
  "low-light": [.4, .18, .3, .46, .7], melancholy: [.32, .28, .48, .28, .58], mysterious: [.44, .48, .48, .7, .44],
  mystery: [.44, .48, .48, .7, .44], nocturnal: [.4, .2, .35, .55, .6], playful: [.82, .65, .08, .5, .5],
  quiet: [.52, .18, .12, .28, .62], reserved: [.48, .2, .2, .3, .4], restful: [.55, .16, .1, .2, .62],
  restrained: [.48, .2, .18, .3, .45], rich: [.6, .5, .25, .45, .5], serenity: [.58, .18, .1, .28, .54],
  serious: [.4, .3, .4, .3, .4], sheltered: [.56, .18, .1, .25, .75], solemn: [.35, .25, .45, .45, .4],
  spacious: [.58, .22, .1, .55, .3], spare: [.48, .15, .15, .35, .35], structured: [.5, .3, .25, .35, .3],
  tense: [.3, .66, .8, .4, .35], warm: [.7, .4, .1, .3, .62], wonder: [.68, .66, .28, .9, .36],
};
const NEUTRAL: Vector = [.5, .34, .24, .36, .5];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Number(clamp(value).toFixed(3));

function tagVector(artwork: WebArtwork): Vector | undefined {
  const known = [...new Set([...artwork.moodTags, ...artwork.emotionLabels].map((tag) => tag.trim().toLowerCase().replace(/[_\s]+/g, "-")))]
    .map((tag) => TAG_STATE[tag]).filter((value): value is Vector => Boolean(value));
  if (!known.length) return undefined;
  return known.reduce((sum, value) => sum.map((item, index) => item + value[index]! / known.length) as Vector, [0, 0, 0, 0, 0]);
}

export function artworkOffering(artwork: WebArtwork): AffectState {
  const [valence, arousal, tension, wonder, intimacy] = tagVector(artwork) ?? NEUTRAL;
  const state = { valence, arousal, tension, wonder, intimacy };
  const look = artwork.appearance;
  if (look) {
    // Pale paper is light without colour; only coloured light reads as brightness.
    const colourful = clamp(look.chroma / .15);
    state.valence += (look.meanLightness - .47) * .3 * colourful + (look.chroma - .12) * .6 - look.darkShare * .12;
    state.arousal += (look.chroma - .12) * .9 + (look.colorVariation - .22) * .2;
    state.tension += look.darkShare * .15 - (look.meanLightness - .47) * .08;
  }
  const evidence = artwork.visualEvidence;
  if (evidence) {
    const present = (subject: keyof typeof evidence.facts) => evidence.facts[subject] === "present";
    if (evidence.spatialFraming === "open") { state.wonder += .14; state.intimacy -= .08; }
    if (evidence.spatialFraming === "enclosed" || present("interior")) { state.intimacy += .14; state.wonder -= .06; }
    if (present("portrait") || present("people")) state.intimacy += .06;
    if (present("war") || present("death")) { state.tension += .3; state.valence -= .22; state.arousal += .1; }
    if (present("religion")) state.wonder += .06;
  }
  return { valence: round(state.valence), arousal: round(state.arousal), tension: round(state.tension), wonder: round(state.wonder), intimacy: round(state.intimacy) };
}

/** 1 means the work offers exactly what the stage asks for. Arousal and tension decide pacing, so they weigh more. */
export function stageFit(offered: AffectState, wanted: AffectState): number {
  const distance = Math.abs(offered.valence - wanted.valence) + Math.abs(offered.arousal - wanted.arousal) * 1.5
    + Math.abs(offered.tension - wanted.tension) * 1.5 + Math.abs(offered.wonder - wanted.wonder) + Math.abs(offered.intimacy - wanted.intimacy);
  return clamp(1 - distance / 3);
}
