import { it, expect } from 'vitest';
import { selectHoldingsNotes } from '../src/holdingsSelection.js';
it('T-HOLDINGS-D16 selects the largest covering notes and refuses coverage requiring more than four', () => {
  const notes = ['1', '2', '3', '4', '5'].map((amountWei) => ({ amountWei }));
  expect(selectHoldingsNotes(notes, 9n)).toEqual({ kind: 'SELECTED', notes: [{ amountWei: '5' }, { amountWei: '4' }] });
  expect(selectHoldingsNotes(notes, 15n)).toEqual({ kind: 'CONSOLIDATION_UNSUPPORTED' });
});
