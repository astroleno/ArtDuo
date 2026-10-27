import { realpathSync, statSync } from "node:fs";

function revision(files: readonly string[]): string {
  return JSON.stringify(files.map((file) => {
    try {
      const stat = statSync(file, { bigint: true });
      return [file, realpathSync.native(file), stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].map(String);
    } catch { return [file, "unavailable"]; }
  }));
}

/** Cache validated local data, never a caller's mutable copy or a stale file identity. */
export class FileRevisionCache<T> {
  private entries = new Map<string, { files: string[]; revision: string; value: T }>();
  constructor(private readonly capacity = 2) {}

  read(key: string, dependencies: () => string[], load: () => T): T {
    const cached = this.entries.get(key);
    if (cached && revision(cached.files) === cached.revision) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return structuredClone(cached.value);
    }
    this.entries.delete(key);
    const files = [...new Set(dependencies())];
    const before = revision(files);
    const value = load();
    // A concurrent edit must not turn a mixed read into a reusable snapshot.
    if (revision(files) === before) {
      this.entries.set(key, { files, revision: before, value: structuredClone(value) });
      while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
    }
    return value;
  }
}
