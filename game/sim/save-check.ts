class SaveMismatch extends Error {}

export type Fields = Record<string, unknown>;

export function fail(what: string): never {
  throw new SaveMismatch(what);
}

export function record(value: unknown, what: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {fail(`${what}: not an object`);}
  return value as Fields;
}

export function list(value: unknown, what: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) {fail(`${what}: not a list of at most ${String(max)}`);}
  return value as unknown[];
}

export interface Bounds { lo: number; hi: number }

const SCALE_CEILING = 1e60;

export const SCALED: Bounds = { lo: 0, hi: SCALE_CEILING };

export function num(value: unknown, what: string, bounds: Bounds): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < bounds.lo || value > bounds.hi) {fail(`${what}: bad number`);}
  return value;
}

export function int(value: unknown, what: string, bounds: Bounds): number {
  const v = num(value, what, bounds);
  if (!Number.isInteger(v)) {fail(`${what}: not an integer`);}
  return v;
}

export function flag(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') {fail(`${what}: not a boolean`);}
  return value;
}

export function oneOf<T extends string>(value: unknown, what: string, known: readonly T[]): T {
  const hit = known.find((k) => k === value);
  if (hit === undefined) {fail(`${what}: unknown "${String(value)}"`);}
  return hit;
}

export function knownKey(value: unknown, what: string, table: Readonly<Record<string, unknown>>): string {
  if (typeof value !== 'string' || !Object.keys(table).includes(value)) {fail(`${what}: unknown id "${String(value)}"`);}
  return value;
}

export function idList<T extends string>(value: unknown, what: string, known: readonly T[]): T[] {
  return list(value, what, known.length).map((v, i) => oneOf(v, `${what}[${String(i)}]`, known));
}
