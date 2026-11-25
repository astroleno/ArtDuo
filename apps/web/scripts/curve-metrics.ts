import type { AffectState } from "@artduo/contracts";

export const CURVE_AXES = ["valence", "arousal", "tension", "wonder", "intimacy"] as const;
const SOURCES = ["rules", "flash"] as const;
const EPSILON = 1e-9;
export const MATERIAL_CHANGE = .10;
type Axis = typeof CURVE_AXES[number];
type Source = typeof SOURCES[number];
type Reading = Partial<AffectState>;

export interface CurveSlot {
  artworkId: string;
  stageIndex: number;
  target: AffectState;
  readings: Partial<Record<Source, Reading>>;
}
export interface CurveExhibition { id: string; requestedWorks: number; slots: CurveSlot[] }

const round = (value: number) => Number(value.toFixed(6));
const mean = (numbers: number[]) => numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
const measured = (slot: CurveSlot, source: Source, axis: Axis) => {
  const value = slot.readings[source]?.[axis];
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
};

function observationPairs(exhibitions: CurveExhibition[], axis: Axis, source?: Source) {
  return exhibitions.flatMap(({ id, slots }) => slots.slice(1).map((to, index) => {
    const from = slots[index]!;
    const left = source ? measured(from, source, axis) : from.target[axis];
    const right = source ? measured(to, source, axis) : to.target[axis];
    return {
      position: { exhibition: id, from: index + 1, to: index + 2, fromArtworkId: from.artworkId, toArtworkId: to.artworkId,
        fromStage: from.stageIndex, toStage: to.stageIndex },
      sameStage: from.stageIndex === to.stageIndex,
      targetDelta: to.target[axis] - from.target[axis],
      delta: left !== undefined && right !== undefined ? right - left : undefined,
    };
  }));
}
type Pair = ReturnType<typeof observationPairs>[number];

function changes(pairs: Pair[]) {
  const valid = pairs.flatMap(pair => pair.delta === undefined ? [] : [{ value: Math.abs(pair.delta), pair }])
    .sort((a, b) => a.value - b.value);
  const middle = Math.floor(valid.length / 2);
  const largest = valid.at(-1);
  const eligible = pairs.filter(pair => Math.abs(pair.targetDelta) + EPSILON >= MATERIAL_CHANGE);
  const directions = { eligible: eligible.length, valid: 0, missing: 0, same: 0, opposite: 0, flat: 0 };
  for (const { delta, targetDelta } of eligible) {
    if (delta === undefined) { directions.missing++; continue; }
    directions.valid++;
    if (Math.abs(delta) <= EPSILON) directions.flat++;
    else if (Math.sign(delta) === Math.sign(targetDelta)) directions.same++;
    else directions.opposite++;
  }
  return {
    pairs: pairs.length, valid: valid.length, missing: pairs.length - valid.length,
    absoluteDelta: valid.length ? {
      min: round(valid[0]!.value),
      median: round(valid.length % 2 ? valid[middle]!.value : (valid[middle - 1]!.value + valid[middle]!.value) / 2),
      p90: round(valid[Math.ceil(valid.length * .9) - 1]!.value),
      max: round(largest!.value),
      maxAt: largest!.pair.position,
    } : null,
    directions,
  };
}

function splitChanges(pairs: Pair[]) {
  return { all: changes(pairs), withinStage: changes(pairs.filter(pair => pair.sameStage)), acrossStage: changes(pairs.filter(pair => !pair.sameStage)) };
}

function errors(exhibitions: CurveExhibition[], axis: Axis, source: Source) {
  const routes = exhibitions.map(({ slots }) => {
    const error = (slot: CurveSlot) => {
      const reading = measured(slot, source, axis);
      return reading === undefined ? undefined : reading - slot.target[axis];
    };
    const valid = slots.flatMap(slot => {
      const value = error(slot);
      return value === undefined ? [] : [value];
    });
    const last = slots.at(-1);
    return { count: slots.length, valid, ending: last && error(last) };
  });
  const all = routes.flatMap(route => route.valid);
  const endings = routes.flatMap(route => route.ending === undefined ? [] : [route.ending]);
  const centeredSquares = routes.flatMap(({ valid }) => {
    if (valid.length < 2) return [];
    const offset = mean(valid);
    return valid.map(value => (value - offset) ** 2);
  });
  const endingEligible = routes.filter(route => route.count > 0).length;
  return {
    availableSlots: all.length, missingSlots: routes.reduce((sum, route) => sum + route.count, 0) - all.length,
    mae: all.length ? round(mean(all.map(Math.abs))) : null,
    centeredRmse: centeredSquares.length ? round(Math.sqrt(mean(centeredSquares))) : null,
    shapeSlots: centeredSquares.length, shapeExhibitions: routes.filter(route => route.valid.length >= 2).length,
    endingEligible, endingValid: endings.length, endingMissing: endingEligible - endings.length,
    endingMae: endings.length ? round(mean(endings.map(Math.abs))) : null,
    endingSignedError: endings.length ? round(mean(endings)) : null,
  };
}

function summarize(exhibitions: CurveExhibition[]) {
  const slots = exhibitions.flatMap(exhibition => exhibition.slots);
  return {
    exhibitions: exhibitions.length, requestedWorks: exhibitions.reduce((sum, exhibition) => sum + exhibition.requestedWorks, 0),
    slots: slots.length, distinctWorks: new Set(slots.map(slot => slot.artworkId)).size,
    shortExhibitions: exhibitions.filter(exhibition => exhibition.slots.length < exhibition.requestedWorks).length,
    axes: Object.fromEntries(CURVE_AXES.map(axis => [axis, {
      target: splitChanges(observationPairs(exhibitions, axis)),
      ...Object.fromEntries(SOURCES.map(source => [source, {
        errors: errors(exhibitions, axis, source),
        adjacency: splitChanges(observationPairs(exhibitions, axis, source)),
      }])),
    }])) as Record<Axis, { target: ReturnType<typeof splitChanges> } & Record<Source, {
      errors: ReturnType<typeof errors>; adjacency: ReturnType<typeof splitChanges>;
    }>>,
  };
}

/** Shapes are centered per exhibition, then pooled over their measured slots. */
export function measureCurves(exhibitions: CurveExhibition[]) {
  return {
    summary: summarize(exhibitions),
    exhibitions: exhibitions.map(exhibition => ({ id: exhibition.id, ...summarize([exhibition]) })),
  };
}

function pairedKeys<T>(left: T[], right: T[], key: (value: T) => string) {
  const leftByKey = new Map(left.map(value => [key(value), value])), rightByKey = new Map(right.map(value => [key(value), value]));
  return {
    paired: left.flatMap(value => {
      const match = rightByKey.get(key(value));
      return match ? [[value, match] as const] : [];
    }),
    removed: left.filter(value => !rightByKey.has(key(value))),
    added: right.filter(value => !leftByKey.has(key(value))),
  };
}

/** Compare the same exhibition, route position and stage boundaries without joining disjoint slots. */
export function compareCurvePositions(baseline: CurveExhibition[], candidate: CurveExhibition[]) {
  const key = ({ position }: Pair) => JSON.stringify([position.exhibition, position.from, position.to, position.fromStage, position.toStage]);
  const edges = pairedKeys(observationPairs(baseline, "arousal"), observationPairs(candidate, "arousal"), key);
  const slots = (routes: CurveExhibition[]) => routes.flatMap(({ id, slots }) => slots.map((slot, index) =>
    ({ exhibition: id, position: index + 1, stageIndex: slot.stageIndex, artworkId: slot.artworkId })));
  const positions = pairedKeys(slots(baseline), slots(candidate), item => JSON.stringify([item.exhibition, item.position, item.stageIndex]));
  return {
    positions: { comparable: positions.paired.length, removed: positions.removed, added: positions.added },
    adjacent: { comparable: edges.paired.length, removed: edges.removed.map(row => row.position), added: edges.added.map(row => row.position) },
    axes: Object.fromEntries(CURVE_AXES.map(axis => [axis, Object.fromEntries(SOURCES.map(source => {
      const compared = pairedKeys(observationPairs(baseline, axis, source), observationPairs(candidate, axis, source), key);
      const comparable = compared.paired.filter(([left, right]) => left.delta !== undefined && right.delta !== undefined);
      return [source, {
        missing: { baseline: compared.paired.filter(([left]) => left.delta === undefined).length,
          candidate: compared.paired.filter(([, right]) => right.delta === undefined).length, either: compared.paired.length - comparable.length },
        baseline: splitChanges(comparable.map(([row]) => row)), candidate: splitChanges(comparable.map(([, row]) => row)),
      }];
    }))])),
  };
}
