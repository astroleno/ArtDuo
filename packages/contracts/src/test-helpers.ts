import { readFileSync } from "node:fs";
import path from "node:path";

export function loadFixture<T>(fileName: string): T {
  const filePath = path.resolve(process.cwd(), "fixtures", fileName);
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}
