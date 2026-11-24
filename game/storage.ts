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
