// Anonymous, opt-in counters. This module stays on the server.
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRootFromCwd, runtimeDirectories } from "../../api/src/runtime/environment";
import {
  CURATION_DEGRADATIONS, EXPERIENCE_BUCKETS_MS, EXPERIENCE_OUTCOMES, EXPERIENCE_PHASES, SERVER_EXPERIENCE_PHASES, experienceDurationBucket,
  type CurationDegradation, type ExperienceOutcome, type ExperiencePhase,
} from "./experience-observability-contract";
import { recordExperienceTiming } from "./experience-analytics";

const DAY_MS = 86_400_000;
const RETAIN_DAYS = 14;
const SNAPSHOT_FILE = /^(\d{4}-\d{2}-\d{2})\.[a-f0-9-]{36}\.json$/u;
const dayOf = (time: number) => new Date(time).toISOString().slice(0, 10);
const retainedFrom = (now: number) => dayOf(now - (RETAIN_DAYS - 1) * DAY_MS);
const emptyHistogram = () => Array<number>(EXPERIENCE_BUCKETS_MS.length).fill(0);
const add = (count = 0, delta = 1) => Math.min(Number.MAX_SAFE_INTEGER, count + delta);

interface DaySnapshot {
  schemaVersion: 1;
  day: string;
  outcomes: Partial<Record<ExperienceOutcome, number>>;
  reasons: Partial<Record<CurationDegradation, number>>;
  durations: Partial<Record<ExperiencePhase, number[]>>;
}

const emptyDay = (day: string): DaySnapshot => ({ schemaVersion: 1, day, outcomes: {}, reasons: {}, durations: {} });

export class ExperienceObservabilityStore {
  private readonly writer = randomUUID();
  private readonly days = new Map<string, DaySnapshot>();
  private readonly dirty = new Set<string>();
  private scheduled?: Promise<void>;
  private cleanedDay?: string;

  constructor(private readonly directory: string, private readonly now = Date.now) {}

  outcome(outcome: ExperienceOutcome) {
    if (!EXPERIENCE_OUTCOMES.includes(outcome)) return;
    this.update(snapshot => { snapshot.outcomes[outcome] = add(snapshot.outcomes[outcome]); });
  }

  finishFresh(success: boolean, reasons: readonly string[], empty = false) {
    this.update(snapshot => {
      const outcome = success ? "fresh-succeeded" : "fresh-failed";
      snapshot.outcomes[outcome] = add(snapshot.outcomes[outcome]);
      const known = CURATION_DEGRADATIONS.filter(reason => reasons.includes(reason));
      if (success && known.length) snapshot.outcomes["fresh-degraded"] = add(snapshot.outcomes["fresh-degraded"]);
      if (success && empty) snapshot.outcomes["fresh-empty"] = add(snapshot.outcomes["fresh-empty"]);
      for (const reason of known) snapshot.reasons[reason] = add(snapshot.reasons[reason]);
    });
  }

  duration(phase: ExperiencePhase, bucket: number) {
    if (!EXPERIENCE_PHASES.includes(phase) || !Number.isInteger(bucket) || bucket < 0 || bucket >= EXPERIENCE_BUCKETS_MS.length) return;
    this.update(snapshot => {
      const histogram = snapshot.durations[phase] ??= emptyHistogram();
      histogram[bucket] = add(histogram[bucket]);
    });
  }

  async flush() {
    while (this.scheduled) await this.scheduled;
  }

  private update(change: (snapshot: DaySnapshot) => void) {
    const now = this.now(), day = dayOf(now), oldest = retainedFrom(now);
    for (const previous of this.days.keys()) if (previous < oldest) {
      this.days.delete(previous);
      this.dirty.delete(previous);
    }
    const snapshot = this.days.get(day) ?? emptyDay(day);
    this.days.set(day, snapshot);
    change(snapshot);
    this.dirty.add(day);
    this.schedule();
  }

  private schedule() {
    this.scheduled ??= new Promise<void>(resolve => { setTimeout(resolve, 40); }).then(() => this.drain()).finally(() => {
      this.scheduled = undefined;
      if (this.dirty.size) this.schedule();
    });
  }

  private async drain() {
    for (const day of [...this.dirty]) {
      this.dirty.delete(day);
      const snapshot = this.days.get(day);
      if (!snapshot) continue;
      const bytes = JSON.stringify(snapshot) + "\n";
      const file = path.join(this.directory, `${day}.${this.writer}.json`);
      const temp = file + ".tmp";
      try {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        if (!(await lstat(this.directory)).isDirectory()) continue;
        await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
        await rename(temp, file);
        const now = this.now(), today = dayOf(now);
        if (this.cleanedDay !== today) {
          const cutoff = retainedFrom(now);
          for (const name of await readdir(this.directory)) {
            const date = SNAPSHOT_FILE.exec(name)?.[1] ?? SNAPSHOT_FILE.exec(name.replace(/\.tmp$/u, ""))?.[1];
            if (date && date < cutoff) await rm(path.join(this.directory, name), { force: true });
          }
          this.cleanedDay = today;
        }
      } catch {
        // A later sample retries the cumulative count. Storage failures never
        // reject a curation or cause a retry loop for an unavailable volume.
        await rm(temp, { force: true }).catch(() => undefined);
      }
    }
  }
}

const runtime = globalThis as typeof globalThis & { artduoExperienceObservability?: Map<string, ExperienceObservabilityStore> };

export function experienceObservabilityDirectory(rootDir = projectRootFromCwd(), environment = process.env): string | undefined {
  if (environment.ARTDUO_OBSERVABILITY !== "1" || !environment.ARTDUO_STATE_DIR?.trim()) return undefined;
  try { return path.join(runtimeDirectories(rootDir, environment).state, "experience-observability"); }
  catch { return undefined; }
}

export function experienceObservability(rootDir?: string): ExperienceObservabilityStore | undefined {
  const directory = experienceObservabilityDirectory(rootDir);
  if (!directory) return undefined;
  const stores = runtime.artduoExperienceObservability ??= new Map();
  const store = stores.get(directory) ?? new ExperienceObservabilityStore(directory);
  stores.set(directory, store);
  return store;
}

export function observeExperienceDuration(phase: ExperiencePhase, durationMs: number, rootDir?: string) {
  const bucket = experienceDurationBucket(durationMs);
  if (bucket !== undefined) experienceObservability(rootDir)?.duration(phase, bucket);
}

export function recordServerExperienceTiming(phase: typeof SERVER_EXPERIENCE_PHASES[number], durationMs: number, releaseVersion: string, rootDir?: string) {
  recordExperienceTiming(phase, durationMs, releaseVersion);
  observeExperienceDuration(phase, durationMs, rootDir);
}

function validateCounts(value: unknown, keys: readonly string[], valid: (entry: unknown) => boolean) {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([key, entry]) => keys.includes(key) && valid(entry));
}

function parseSnapshot(value: unknown, day: string): DaySnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as Partial<DaySnapshot>;
  const count = (entry: unknown) => Number.isSafeInteger(entry) && (entry as number) >= 0;
  if (Object.keys(snapshot).length !== 5 || snapshot.schemaVersion !== 1 || snapshot.day !== day
    || !validateCounts(snapshot.outcomes, EXPERIENCE_OUTCOMES, count) || !validateCounts(snapshot.reasons, CURATION_DEGRADATIONS, count)
    || !validateCounts(snapshot.durations, EXPERIENCE_PHASES, row => Array.isArray(row) && row.length === EXPERIENCE_BUCKETS_MS.length && row.every(count))) return undefined;
  return snapshot as DaySnapshot;
}

function summarizeHistogram(counts: number[]) {
  const n = counts.reduce((sum, count) => add(sum, count), 0);
  const bound = (percentile: number) => {
    if (!n) return null;
    let total = 0;
    const index = counts.findIndex(count => (total = add(total, count)) >= Math.ceil(n * percentile));
    return { lowerMs: index === 0 ? 0 : EXPERIENCE_BUCKETS_MS[index - 1], upperMs: EXPERIENCE_BUCKETS_MS[index] };
  };
  return { n, counts, p50: bound(.5), p90: bound(.9) };
}

export async function readExperienceObservability(directory: string, now = Date.now()) {
  const today = dayOf(now), oldest = retainedFrom(now), totals = emptyDay(today);
  const days = new Map<string, DaySnapshot>();
  let invalidSnapshots = 0;
  const names = await lstat(directory).then(stat => stat.isDirectory() ? readdir(directory, { withFileTypes: true }) : []).catch(error => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  for (const file of names) {
    if (!file.isFile()) continue;
    const name = file.name;
    const day = SNAPSHOT_FILE.exec(name)?.[1];
    if (!day || day < oldest || day > today) continue;
    try {
      const source = parseSnapshot(JSON.parse(await readFile(path.join(directory, name), "utf8")), day);
      if (!source) { invalidSnapshots++; continue; }
      const daily = days.get(day) ?? emptyDay(day);
      days.set(day, daily);
      for (const target of [daily, totals]) {
        for (const key of EXPERIENCE_OUTCOMES) if (source.outcomes[key]) target.outcomes[key] = add(target.outcomes[key], source.outcomes[key]);
        for (const key of CURATION_DEGRADATIONS) if (source.reasons[key]) target.reasons[key] = add(target.reasons[key], source.reasons[key]);
        for (const phase of EXPERIENCE_PHASES) {
          const counts = source.durations[phase];
          if (!counts) continue;
          const accumulated = target.durations[phase] ??= emptyHistogram();
          counts.forEach((count, index) => { accumulated[index] = add(accumulated[index], count); });
        }
      }
    } catch { invalidSnapshots++; }
  }
  const report = ({ outcomes, reasons, durations }: DaySnapshot) => {
    const numerator = outcomes["fresh-degraded"] ?? 0, denominator = outcomes["fresh-succeeded"] ?? 0;
    return { outcomes, reasons, freshDegradation: { numerator, denominator, value: denominator ? numerator / denominator : null },
      timings: Object.fromEntries(EXPERIENCE_PHASES.map(phase => [phase, summarizeHistogram(durations[phase] ?? emptyHistogram())])) };
  };
  return { schemaVersion: 1, fromDay: oldest, throughDay: today, invalidSnapshots, bucketUpperBoundsMs: EXPERIENCE_BUCKETS_MS,
    totals: report(totals), days: [...days.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([day, counts]) => ({ day, ...report(counts) })) };
}
