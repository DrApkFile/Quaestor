import { seal, open, parseEnvelope, isQoreSealError, type SealKeyPair } from '@qorechain/qoreseal';
import { openNotePoseidon } from '@gloamtrade/sdk';
import { z } from 'zod';
import { addressSchema, uintSchema } from '../config.js';
import type { VerifiedRecipient } from './card.js';
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(value => value as `0x${string}`);
export const ticketNoteSchema = z.object({
    v: z.literal(1), secret: bytes32, commitment: bytes32, nullifier: bytes32,
    amountWei: uintSchema.refine(value => BigInt(value) > 0n), asset: addressSchema,
    pool: addressSchema, chainId: z.literal(9800),
}).strict();
export type TicketNote = z.infer<typeof ticketNoteSchema>;
export const MAX_TICKET_BYTES = 8192;
export type TicketCode = 'TICKET_INVALID' | 'NOT_A_RECIPIENT' | 'DECRYPTION_FAILED';
export class TicketError extends Error {
    constructor(readonly code: TicketCode) { super(code); this.name = 'TicketError'; }
}
export function ticketAad(pool: string, commitment: string): Uint8Array {
    return new TextEncoder().encode(`9800|${pool.toLowerCase()}|${commitment.toLowerCase()}`);
}
export function canonicalNote(note: TicketNote): string {
    return JSON.stringify(Object.fromEntries(Object.entries(note).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
}
export function ticketMetadata(envelope: Uint8Array) {
    if (envelope.length === 0 || envelope.length > MAX_TICKET_BYTES)
        throw new TicketError('TICKET_INVALID');
    try {
        const parsed = parseEnvelope(envelope);
        if (parsed.mode !== 'hybrid' || !parsed.anonymous || parsed.entries.length !== 2)
            throw new TicketError('TICKET_INVALID');
        return { bytes: envelope.length, mode: parsed.mode, recipients: parsed.entries.length };
    }
    catch {
        throw new TicketError('TICKET_INVALID');
    }
}
async function requireValidNote(input: unknown): Promise<TicketNote> {
    const parsed = ticketNoteSchema.safeParse(input);
    if (!parsed.success)
        throw new TicketError('TICKET_INVALID');
    const note = parsed.data;
    try {
        const actual = await openNotePoseidon(note.secret, BigInt(note.amountWei), note.asset);
        if (actual.commitment.toLowerCase() !== note.commitment.toLowerCase() || actual.nullifier.toLowerCase() !== note.nullifier.toLowerCase()) {
            throw new TicketError('TICKET_INVALID');
        }
    }
    catch {
        throw new TicketError('TICKET_INVALID');
    }
    return note;
}
export async function sealTicket(input: unknown, recipients: readonly [
    VerifiedRecipient,
    VerifiedRecipient
], options: {
    mode: string;
    anonymous: boolean;
} = { mode: 'hybrid', anonymous: true }) {
    if (options.mode !== 'hybrid' || !options.anonymous || recipients.some(recipient => !recipient.recipient.x25519PublicKey)) {
        throw new TicketError('TICKET_INVALID');
    }
    if (recipients[0].block !== recipients[1].block || recipients[0].address === recipients[1].address)
        throw new TicketError('TICKET_INVALID');
    const note = await requireValidNote(input);
    const envelope = seal({ chainId: 'qorechain-diana', purpose: 'quaestor:ticket', mode: 'hybrid', anonymous: true,
        recipients: recipients.map(recipient => recipient.recipient), plaintext: new TextEncoder().encode(canonicalNote(note)), aad: ticketAad(note.pool, note.commitment) });
    ticketMetadata(envelope);
    return envelope;
}
export async function openTicket(envelope: Uint8Array, keys: SealKeyPair, pool: string, commitment: string): Promise<TicketNote> {
    ticketMetadata(envelope);
    let plaintext: Uint8Array;
    try {
        plaintext = open({ chainId: 'qorechain-diana', purpose: 'quaestor:ticket', envelope, keys, aad: ticketAad(pool, commitment) });
    }
    catch (error: unknown) {
        if (isQoreSealError(error, 'NOT_A_RECIPIENT'))
            throw new TicketError('NOT_A_RECIPIENT');
        if (isQoreSealError(error, 'DECRYPTION_FAILED'))
            throw new TicketError('DECRYPTION_FAILED');
        throw new TicketError('TICKET_INVALID');
    }
    let input: unknown;
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
        input = JSON.parse(text) as unknown;
    }
    catch {
        throw new TicketError('TICKET_INVALID');
    }
    const note = await requireValidNote(input);
    if (canonicalNote(note) !== text || note.pool.toLowerCase() !== pool.toLowerCase() || note.commitment.toLowerCase() !== commitment.toLowerCase()) {
        throw new TicketError('TICKET_INVALID');
    }
    return note;
}
