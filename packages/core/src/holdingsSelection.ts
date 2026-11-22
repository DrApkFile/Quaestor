export function selectHoldingsNotes<T extends { amountWei: string }>(
  notes: readonly T[],
  threshold: bigint,
): { kind: 'SELECTED'; notes: T[] } | { kind: 'CONSOLIDATION_UNSUPPORTED' } {
  const ordered = [...notes]
    .filter((note) => BigInt(note.amountWei) > 0n)
    .sort((a, b) => (BigInt(a.amountWei) > BigInt(b.amountWei) ? -1 : 1));
  const selected: T[] = [];
  let total = 0n;
  for (const note of ordered.slice(0, 4)) {
    selected.push(note);
    total += BigInt(note.amountWei);
    if (total >= threshold) return { kind: 'SELECTED', notes: selected };
  }
  return { kind: 'CONSOLIDATION_UNSUPPORTED' };
}
