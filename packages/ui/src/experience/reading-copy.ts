/** Presentation-only cleanup; preserve the immutable source attribution. */
export function displaySourceCredit(value: string | undefined): string | undefined {
  if (!value) return value;
  for (const separator of value.matchAll(/[.;。；]\s+|\n+/gu)) {
    const left = value.slice(0, separator.index).trim().replace(/[.;。；]+$/u, "");
    const right = value.slice(separator.index! + separator[0].length).trim().replace(/[.;。；]+$/u, "");
    if (left && left === right) return left;
  }
  return value;
}

export function sameReadingText(left: string | undefined, right: string | undefined): boolean {
  const normalize = (text?: string) => text?.normalize("NFKC").replace(/\s+/gu, " ").trim().replace(/[。.!！?？]+$/u, "");
  return Boolean(left?.trim() && right?.trim() && normalize(left) === normalize(right));
}
