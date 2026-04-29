export function assertWithinBudget(input: { estimatedTokens: number; maxTokens: number }): void {
  if (input.estimatedTokens > input.maxTokens) {
    throw new Error("Budget exceeded");
  }
}
