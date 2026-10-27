"use client";

import type { ExperienceStage } from "./types";

export function EmotionRail({ stages, activeStageId, availableStageIds, onSelect, compact = false }: {
  stages: ExperienceStage[];
  activeStageId?: string;
  availableStageIds: string[];
  onSelect: (stageId: string) => void;
  compact?: boolean;
}) {
  const available = new Set(availableStageIds);
  if (compact) {
    const point = (index: number) => ({ x: (index + .5) * 240 / stages.length, y: 39 - stages[index].intensity * 28 });
    return <nav aria-label="展览阶段概览" className="experience-rail experience-rail-compact">
      <svg aria-hidden="true" viewBox="0 0 240 46" preserveAspectRatio="none">
        <path d={stages.map((_, index) => { const { x, y } = point(index); return `${index ? "L" : "M"} ${x} ${y}`; }).join(" ")} />
        {stages.map((stage, index) => <circle key={stage.id} cx={point(index).x} cy={point(index).y} r={stage.id === activeStageId ? 3.5 : 2}
          className={stage.id === activeStageId ? "is-active" : ""} opacity={available.has(stage.id) ? 1 : .3} />)}
      </svg>
      <ol style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((stage) => <li key={stage.id}><button aria-current={stage.id === activeStageId ? "step" : undefined}
          aria-label={`${stage.label}${stage.id === activeStageId ? "，当前阶段" : ""}`} disabled={!available.has(stage.id)} onClick={() => onSelect(stage.id)} type="button">
          <span>{stage.label}</span>
        </button></li>)}
      </ol>
    </nav>;
  }
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
