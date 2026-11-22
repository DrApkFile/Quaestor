import { postBlob, publicRecordBytes, type BlobKind } from '@quaestor/chain/browser';
import { hexToBytes, type Hex } from 'viem';
import { BusinessRuntime, deployment, boardAbi } from './runtime.js';
export async function post(runtime: BusinessRuntime, id: string, kind: BlobKind, bytes: Uint8Array) {
  const result = await postBlob(
    runtime.journal,
    id,
    deployment.board.address,
    kind,
    bytes,
    boardAbi,
    runtime.gateway(deployment.board.address),
  );
  return runtime.requireResult(id, result);
}
export const jsonBytes = publicRecordBytes;
export const blobBytes = (hex: Hex) => hexToBytes(hex);
