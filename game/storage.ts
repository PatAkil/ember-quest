const BEST_KEY = 'retrovibe.ember-quest.best';

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function storeBest(best: number): boolean {
  try {
    localStorage.setItem(BEST_KEY, String(best));
    return true;
  } catch {
    return false;
  }
}
