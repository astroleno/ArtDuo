import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseArtworkAgentCapsule,
  parseGrowthForm,
  parseUserAffectAgent,
} from "./affective-agent";

const affectState = {
  valence: 0.42,
  arousal: 0.28,
  tension: 0.32,
  wonder: 0.36,
  intimacy: 0.74,
};

const signal = (value: string, kind = "emotion") => ({
  kind,
  value,
  confidence: 0.8,
});

function buildUserAgentFixture() {
  return {
    sourceText: "不要太明亮，想要暗红和深木色",
    languageHints: ["zh"],
    desires: [signal("quiet"), signal("held")],
    resistances: [signal("bright", "resistance")],
    memoryHints: [{ value: "bedtime", confidence: 0.7 }],
    visualConstraints: [
      { value: "burgundy", polarity: "prefer", severity: "soft", confidence: 0.85 },
      { value: "bright", polarity: "avoid", severity: "hard", confidence: 0.9 },
    ],
    spatialNeeds: [{ value: "close", confidence: 0.62 }],
    temporalShape: {
      arc: "settle",
      pace: "slow",
      stages: [
        { label: "start", signals: [signal("quiet")] },
        { label: "middle", signals: [signal("intimate")] },
        { label: "end", signals: [signal("restful")] },
      ],
      peakCount: 1,
    },
    currentState: affectState,
    desiredState: { ...affectState, valence: 0.54 },
    confidence: 0.82,
  };
}

function buildCapsuleFixture() {
  return {
    artworkId: "art-1",
    identity: {
      title: "Night Room",
      artistDisplayName: "Example Artist",
      yearLabel: "1890",
    },
    canOffer: [signal("serenity")],
    boundaries: [signal("bright", "resistance")],
    aesthetics: [{ value: "burgundy", kind: "color", evidenceIds: ["ev-color"], confidence: 0.88 }],
    sceneAffinity: [{ value: "gallery_interior", kind: "scene", evidenceIds: ["ev-scene"] }],
    motionAffinity: [{ value: "static", kind: "motion", evidenceIds: ["ev-motion"] }],
    evidence: [
      { id: "ev-color", sourceRef: "art-1", fieldPath: "metadata.colorTags", value: "burgundy" },
      { id: "ev-scene", sourceRef: "art-1", fieldPath: "presentation.sceneAffinity.sceneTypes" },
      { id: "ev-motion", sourceRef: "art-1", fieldPath: "presentation.motionProfile", value: "static" },
    ],
    confidence: 0.86,
  };
}

function buildGrowthFormFixture() {
  return {
    id: "growth-1",
    sourceText: "先安静，再惊叹，最后回到平静",
    stages: [
      {
        id: "stage-1",
        label: "Opening",
        role: "threshold",
        signals: [signal("serenity")],
        valence: 0.44,
        arousal: 0.22,
        tension: 0.2,
        wonder: 0.25,
        intimacy: 0.58,
        intensity: 0.32,
        sceneIntent: "quiet threshold",
        transitionIntent: "fade",
        artworkIds: ["art-1"],
      },
      {
        id: "stage-2",
        label: "Turn",
        role: "turn",
        signals: [signal("wonder")],
        valence: 0.62,
        arousal: 0.68,
        tension: 0.42,
        wonder: 0.86,
        intimacy: 0.52,
        intensity: 0.72,
        sceneIntent: "awe peak",
        transitionIntent: "push",
        artworkIds: ["art-2"],
      },
      {
        id: "stage-3",
        label: "Return",
        role: "afterglow",
        signals: [signal("calm")],
        valence: 0.52,
        arousal: 0.26,
        tension: 0.16,
        wonder: 0.4,
        intimacy: 0.64,
        intensity: 0.36,
        sceneIntent: "calm return",
        transitionIntent: "return",
        artworkIds: ["art-3"],
      },
    ],
    rules: [
      { id: "rule-bright", signal: "bright", severity: "hard", action: "reject", reason: "user resisted brightness" },
      { id: "rule-burgundy", signal: "burgundy", severity: "soft", action: "prefer", reason: "user requested burgundy" },
      { id: "rule-log", signal: "trace", severity: "diagnostic", action: "diagnose", reason: "keep negotiation visible" },
    ],
    supportingArtworkIds: ["art-1", "art-2", "art-3"],
    rejectedArtworkIds: ["art-4"],
    trace: [{ id: "trace-1", step: "rule", message: "Rejected bright candidate", artworkId: "art-4", signal: "bright" }],
  };
}

test("user affect agent parser accepts canonical desires and resistances", () => {
  const parsed = parseUserAffectAgent(buildUserAgentFixture());

  assert.deepEqual(parsed.desires.map((entry) => entry.value), ["quiet", "held"]);
  assert.deepEqual(parsed.resistances.map((entry) => entry.value), ["bright"]);
});

test("artwork agent capsule evidence requires at least one source ref", () => {
  const parsed = parseArtworkAgentCapsule(buildCapsuleFixture());

  assert.equal(parsed.evidence[0]?.sourceRef, "art-1");
  assert.throws(
    () => parseArtworkAgentCapsule({ ...buildCapsuleFixture(), evidence: [] }),
    /expected at least one source ref/,
  );
});

test("growth form parser enforces normalized stage numbers", () => {
  const parsed = parseGrowthForm(buildGrowthFormFixture());

  assert.equal(parsed.stages[1]?.wonder, 0.86);
  assert.throws(
    () => parseGrowthForm({
      ...buildGrowthFormFixture(),
      stages: [
        { ...buildGrowthFormFixture().stages[0], valence: 1.2 },
        buildGrowthFormFixture().stages[1],
        buildGrowthFormFixture().stages[2],
      ],
    }),
    /expected number between 0 and 1/,
  );
});

test("growth form parser accepts 3 to 5 stages", () => {
  const fixture = buildGrowthFormFixture();

  assert.equal(parseGrowthForm(fixture).stages.length, 3);
  assert.throws(
    () => parseGrowthForm({ ...fixture, stages: fixture.stages.slice(0, 2) }),
    /expected 3 to 5 stages/,
  );
});

test("growth form rules preserve severity", () => {
  const parsed = parseGrowthForm(buildGrowthFormFixture());

  assert.deepEqual(parsed.rules.map((rule) => rule.severity), ["hard", "soft", "diagnostic"]);
});
