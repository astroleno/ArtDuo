export type ExperienceDefaultView = "classic" | "experience";

export function readExperienceDefaultView(value = process.env.ARTDUO_EXPERIENCE_DEFAULT): ExperienceDefaultView {
  return value === "experience" ? "experience" : "classic";
}

export function resolveExperienceView(requested: string | undefined, defaultView = readExperienceDefaultView()): ExperienceDefaultView {
  if (requested === "experience" || requested === "classic") return requested;
  return defaultView;
}
