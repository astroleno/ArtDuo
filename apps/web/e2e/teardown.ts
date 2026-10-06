import { cleanupExperienceFixtures } from "../scripts/experience-e2e-fixtures.mjs";

export default function teardown() {
  cleanupExperienceFixtures();
}
