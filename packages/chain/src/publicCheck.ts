import type { Hex } from 'viem';
import { fetchBlob } from './blobs.js';
import { readBook, type BooksConfig } from './booksReader.js';
import { ownerKey, recordCipher, type BlobContext } from './blobReader.js';
export async function publicCheck(context: BlobContext & { books: BooksConfig }, book: Hex) {
  const snapshot = await readBook(context.client, context.books, book);
  const pq = await ownerKey(context, snapshot);
  const rawPresence = async (sha3: Hex, kind: 'entry' | 'grant') => {
    const value = await fetchBlob(context.client, context.board, sha3, snapshot.block, kind);
    return value.kind === 'FOUND' ? 'VERIFIED' : value.kind;
  };
  const recordPresence = async (kind: 'opening' | 'close', sha3: Hex) => {
    try {
      const ref = await recordCipher(context, snapshot, kind, sha3, pq);
      return {
        status: 'VERIFIED' as const,
        ciphertextSha3: ref.ciphertextSha3,
        legacy: ref.legacy !== null,
        plaintextAnchorVerified: false,
      };
    } catch (error: unknown) {
      return {
        status:
          error instanceof Error && error.message === 'TAMPERED'
            ? ('TAMPERED' as const)
            : ('BLOB_UNAVAILABLE' as const),
        ciphertextSha3: null,
        legacy: context.legacyBooks[book] !== undefined,
        plaintextAnchorVerified: false,
      };
    }
  };
  const entries = [];
  for (const entry of snapshot.entries)
    entries.push({ ...entry, block: entry.block.toString(), status: await rawPresence(entry.blobSha3, 'entry') });
  const grants = [];
  for (const grant of snapshot.grants)
    grants.push({ ...grant, block: grant.block.toString(), status: await rawPresence(grant.sha3, 'grant') });
  const periods = [];
  for (const period of snapshot.periods)
    periods.push({
      ...period,
      closeBlock: period.closeBlock?.toString() ?? null,
      closeBlob: period.closed ? await recordPresence('close', period.closeSha3) : null,
    });
  return {
    book,
    owner: snapshot.owner,
    readBlock: snapshot.block.toString(),
    openingSha3: snapshot.openingSha3,
    opening: await recordPresence('opening', snapshot.openingSha3),
    entries,
    grants,
    periods,
    decrypted: false as const,
  };
}
