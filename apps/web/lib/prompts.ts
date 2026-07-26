export interface StarterPrompt {
  label: string;
  query: string;
}

export const DEFAULT_CURATION_PROMPT = "我想看一间安静的月光展厅";

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    label: "安静的月光",
    query: DEFAULT_CURATION_PROMPT,
  },
  {
    label: "春天的希望",
    query: "给我一条有春日光线和希望感的观展路线",
  },
  {
    label: "暗色谜面",
    query: "我想进入一间带有神秘感的暗色画廊",
  },
];
