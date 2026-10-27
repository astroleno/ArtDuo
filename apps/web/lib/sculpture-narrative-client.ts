import { appPath } from "@artduo/contracts";
import type { SculptureNarrator } from "@artduo/ui";

export const requestSculptureNarrative: SculptureNarrator = async (id, query, signal) => {
  const response = await fetch(appPath("/api/sculptures/narrative"), { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, query: query.slice(0, 512) }) });
  if (!response.ok) throw new Error("Sculpture narrative unavailable");
  const value = await response.json();
  if (typeof value.text !== "string" || value.text.length > 220 || !["grounded", "fallback"].includes(value.source)) throw new Error("Invalid sculpture narrative");
  return { text: value.text, source: value.source };
};
