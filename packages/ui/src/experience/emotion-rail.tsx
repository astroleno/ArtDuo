"use client";

import type { ExperienceStage } from "./types";

export function EmotionRail({ stages, activeStageId, availableStageIds, onSelect }: {
  stages: ExperienceStage[];
  activeStageId?: string;
  availableStageIds: string[];
  onSelect: (stageId: string) => void;
}) {
  const available = new Set(availableStageIds);
  return <nav aria-label="展览情绪阶段" className="experience-rail">
    <ol>
      {stages.map((stage, index) => {
        const active = stage.id === activeStageId;
        const hasWorks = available.has(stage.id);
        return <li key={stage.id} className={active ? "is-active" : ""}>
          <button
            aria-current={active ? "step" : undefined}
            aria-label={`${index + 1}. ${stage.label}${active ? "，当前阶段" : ""}`}
            disabled={!hasWorks}
            onClick={() => onSelect(stage.id)}
            type="button"
          >
            <span aria-hidden="true" className="experience-rail-dot" />
            <span className="experience-rail-label">{stage.label}</span>
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}
