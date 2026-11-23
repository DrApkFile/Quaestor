import { expect, it } from 'vitest';
import { mergeImageReports } from '../../../scripts/m9-image-reports.js';
const first = {
  file: 'first.png',
  sha256: '0'.repeat(64),
  width: 390,
  height: 844,
  ocrFragments: 10,
  secretMatches: 0,
};
const second = { ...first, file: 'second.png' };
const part = (images: unknown[]) => ({ status: 'PASSED', method: 'OCR and DOM', limits: 'Known secrets', images });
it('T-NOPLAIN-IMAGES refuses partial duplicate stale failed and unreadable screenshot scans', () => {
  const expected = [first, second];
  expect(mergeImageReports([part([first]), part([second])], expected).images).toHaveLength(2);
  expect(() => mergeImageReports([part([first])], expected)).toThrow();
  expect(() => mergeImageReports([part([]), part([])], [])).toThrow('IMAGE_SCAN_INCOMPLETE_OR_CHANGED');
  expect(() => mergeImageReports([part([first]), part([first])], expected)).toThrow('IMAGE_SCAN_INCOMPLETE_OR_CHANGED');
  expect(() => mergeImageReports([part([{ ...first, sha256: '1'.repeat(64) }]), part([second])], expected)).toThrow(
    'IMAGE_SCAN_INCOMPLETE_OR_CHANGED',
  );
  expect(() => mergeImageReports([{ ...part([first, second]), status: 'FAILED' }], expected)).toThrow();
  expect(() => mergeImageReports([part([{ ...first, ocrFragments: 0 }, second])], expected)).toThrow();
  expect(() => mergeImageReports([part([{ ...first, secretMatches: 1 }, second])], expected)).toThrow();
});
