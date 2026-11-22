export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`index ${index} out of range for length ${items.length}`);
  }
  return item;
}

export const noop = (): void => undefined;

export const pickOneIndex = (rng: () => number, length: number): number => Math.floor(rng() * length);

export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`missing ${what}`);
  }
  return value;
}
