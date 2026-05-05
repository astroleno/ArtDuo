import type { ArtworkGrade, ArtworkGradeLabel, CurationGradeProfile, DisplayMode } from "@artduo/contracts";

export interface GradeArtworkInput {
  artworkId: string;
  score?: number;
  rank?: number;
  preferredGrade?: ArtworkGrade;
}

const GRADE_LABELS_BY_GRADE: Record<ArtworkGrade, ArtworkGradeLabel> = {
  A: "director-focus",
  B: "emotional-pillar",
  C: "ambient-bridge",
};

const DISPLAY_STRATEGY_BY_GRADE: Record<ArtworkGrade, DisplayMode> = {
  A: "director-focus",
  B: "motion-frame",
  C: "static-frame",
};

function normalizeScore(score: number | undefined): number {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return 0;
  }

  return Math.max(0, Math.min(1, score));
}

function assignGrade(index: number, total: number): ArtworkGrade {
  if (total <= 0) {
    return "C";
  }

  const aLimit = Math.max(1, Math.ceil(total * 0.2));
  const bLimit = Math.max(aLimit + 1, Math.ceil(total * 0.6));

  if (index < aLimit) {
    return "A";
  }

  return index < bLimit ? "B" : "C";
}

export function gradeArtworks(input: GradeArtworkInput[]): CurationGradeProfile[] {
  return input
    .map((item, inputIndex) => ({
      ...item,
      inputIndex,
      score: normalizeScore(item.score),
      rank: item.rank ?? inputIndex + 1,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.artworkId.localeCompare(right.artworkId);
    })
    .map((item, index, sorted) => {
      const grade = item.preferredGrade ?? assignGrade(index, sorted.length);
      const reasons = [
        item.preferredGrade ? "explicit-grade" : `rank-bucket-${grade.toLowerCase()}`,
        item.score > 0 ? "scored-candidate" : "unscored-candidate",
      ];

      return {
        artworkId: item.artworkId,
        grade,
        gradeLabel: GRADE_LABELS_BY_GRADE[grade],
        displayStrategy: DISPLAY_STRATEGY_BY_GRADE[grade],
        rank: index + 1,
        score: item.score,
        reasons,
      };
    });
}
