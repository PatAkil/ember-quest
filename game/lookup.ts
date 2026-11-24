export { at, pickOneIndex } from './sim';

export const noop = (): void => undefined;

export function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`missing ${what}`);
  }
  return value;
}
