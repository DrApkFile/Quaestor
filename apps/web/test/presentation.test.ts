import { expect, it } from 'vitest';
import { statuses, reasons } from '../src/presentation.js';
import { errorMessages, errorMessage } from '../src/messages.js';
it('A12 unknown checks and unshared periods cannot acquire a green presentation', () => {
  expect(statuses.UNKNOWN[1]).toBe('unknown');
  expect(statuses.NOT_GRANTED[1]).toBe('neutral');
  for (const code of ['WRONG_CONTEXT', 'DUPLICATE_PAYMENT', 'MISMATCH', 'UNKNOWN_ROOT'])
    expect(reasons[code]).toBeTruthy();
  for (const code of Object.keys(errorMessages)) expect(errorMessage(new Error(code))).not.toContain(`${code} —`);
  expect(errorMessage(new Error('secret stack or JSON'))).not.toContain('secret stack');
});
it('A11 declining a window is calm cancellation while an expired window explains recovery', () => {
  expect(errorMessage(new Error('WINDOW_DECLINED'))).toBe('Cancelled. Nothing was sent.');
  expect(errorMessage(new Error('WINDOW_CLOSED'))).toContain('expired or lacks budget');
});
