import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { parseConfig } from '../src/config.js';
import { resolveCard } from '../src/tickets/card.js';
import { payM2 } from '../scripts/m2Pay.js';
import type { M2Context } from '../scripts/m2Context.js';
import type { M2Evidence } from '../scripts/m2Evidence.js';
vi.mock('../src/tickets/card.js', () => ({ resolveCard: vi.fn() }));
it('T-REG refuses an invalid recipient card before reserving a note, proving or sending payment', () => {
    return Promise.resolve().then(async () => {
        vi.mocked(resolveCard).mockResolvedValue({ kind: 'CARD_INVALID' });
        const read = vi.fn();
        const privateSend = vi.fn();
        const config = parseConfig(JSON.parse(readFileSync(new URL('../../../config/diana.json', import.meta.url), 'utf8')) as unknown);
        const context = { config, account: { cosmos: 'qor1payer' },
            reader: { getBlockNumber: () => Promise.resolve().then(() => 42n) }, journal: { read }, pool: { privateSend } } as unknown as M2Context;
        await expect(payM2(context, 'qor1payee', {} as M2Evidence, vi.fn())).rejects.toThrow('CARD_INVALID');
        expect(resolveCard).toHaveBeenCalledTimes(2);
        expect(resolveCard).toHaveBeenCalledWith(config, expect.any(String), 'qor1payee', 42n);
        expect(read).not.toHaveBeenCalled();
        expect(privateSend).not.toHaveBeenCalled();
    });
});
