const LEGACY_KEY = 'retrovibe.ember-quest.best';
const BEST_KEY = 'retrovibe.ember-quest.best.v2';

export interface BestRecord { score: number; depth: number; act: number }

const NO_BEST: BestRecord = { score: 0, depth: 1, act: 1 };

const count = (value: unknown, floor: number): number =>
  (typeof value === 'number' && Number.isFinite(value) && value >= floor ? Math.floor(value) : floor);

function parseRecord(raw: string): BestRecord {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {return NO_BEST;}
  const r = data as Partial<Record<keyof BestRecord, unknown>>;
  return { score: count(r.score, 0), depth: count(r.depth, 1), act: count(r.act, 1) };
}

function legacyRecord(): BestRecord {
  const score = Number(localStorage.getItem(LEGACY_KEY) ?? 0);
  return { ...NO_BEST, score: Number.isFinite(score) && score > 0 ? Math.floor(score) : 0 };
}

export function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    return raw === null ? legacyRecord() : parseRecord(raw);
  } catch {
    return NO_BEST;
  }
}

export function storeBest(best: BestRecord): boolean {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
    return true;
  } catch {
    return false;
  }
}

const RUN_KEY = 'retrovibe.ember-quest.run.v1';
const STAMP_KEY = 'retrovibe.ember-quest.run.stamp';

export interface RunStamp { id: string; writes: number }

export const sameStamp = (a: RunStamp | null, b: RunStamp | null): boolean =>
  a === b || (a !== null && b !== null && a.id === b.id && a.writes === b.writes);

export const isRunKey = (key: string | null): boolean => key === null || key === RUN_KEY || key === STAMP_KEY;

export function newStamp(): RunStamp {
  return { id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000000).toString(36)}`, writes: 0 };
}

function parseStamp(raw: string): RunStamp | null {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) {return null;}
  const s = data as Partial<Record<keyof RunStamp, unknown>>;
  return typeof s.id === 'string' && typeof s.writes === 'number' && Number.isFinite(s.writes) ? { id: s.id, writes: s.writes } : null;
}

export function storeRun(text: string, stamp: RunStamp): boolean {
  try {
    localStorage.setItem(STAMP_KEY, JSON.stringify(stamp));
    localStorage.setItem(RUN_KEY, text);
    return true;
  } catch {
    return false;
  }
}

interface StoredRun { text: string; stamp: RunStamp | null }

export function loadStoredRun(): StoredRun | null {
  try {
    const text = localStorage.getItem(RUN_KEY);
    if (text === null) {return null;}
    const raw = localStorage.getItem(STAMP_KEY);
    return { text, stamp: raw === null ? null : parseStamp(raw) };
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(STAMP_KEY);
  } catch {
    return;
  }
}
