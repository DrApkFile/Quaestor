export function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('REQUIRED_VALUE_MISSING');
  return value;
}
