import { z } from 'zod';
const uint = z.string().regex(/^(0|[1-9]\d*)$/);
const sequence = z.object({ account_number: uint, sequence: uint }).passthrough();
const response = z.object({ account: z.union([z.object({ base_account: sequence }).passthrough(), sequence]) }).passthrough();
export async function accountSequence(rest: string, address: string): Promise<{
    accountNumber: bigint;
    sequence: bigint;
}> {
    const res = await fetch(`${rest}/cosmos/auth/v1beta1/accounts/${address}`);
    if (!res.ok)
        throw new Error('ACCOUNT_QUERY_FAILED');
    const raw: unknown = await res.json();
    const result = response.safeParse(raw);
    if (!result.success)
        throw new Error('ACCOUNT_RESPONSE_INVALID');
    const account = result.data.account;
    const value = sequence.parse('base_account' in account ? account.base_account : account);
    return { accountNumber: BigInt(value.account_number), sequence: BigInt(value.sequence) };
}
