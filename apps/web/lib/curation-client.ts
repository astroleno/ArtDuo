import type { CreateCurationRequest, CurationSession } from "@artduo/contracts";

export async function createCurationSessionClient(input: CreateCurationRequest): Promise<CurationSession> {
  const now = new Date().toISOString();
  return {
    id: `web-session-${input.releaseVersion}-${input.exhibitionSnapshot.length}`,
    status: "pending",
    releaseVersion: input.releaseVersion,
    sourceVersions: input.sourceVersions,
    unitIds: input.exhibitionSnapshot.map((unit) => unit.unitId),
    ownership: {
      token: "web-session-token",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  };
}
