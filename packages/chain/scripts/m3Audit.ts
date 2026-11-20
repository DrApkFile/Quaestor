import { z } from 'zod';
import { parseAddress } from '@qorechain/qoresign';
import { open, isQoreSealError } from '@qorechain/qoreseal';
import { hexToBytes, toBytes } from 'viem';
import { artifactSchema, grantSchema, closeSchema, signatureSchema, hex32, periodId, contractPeriod, hashRecord,
 openGrant, verifyArtifact, openEntry, requireEntryChain, requireSignature } from '@quaestor/core';
import { m2Context, m2Root } from './m2Context.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { addressSchema } from '../src/config.js';
import { loadPoolAbi } from '../src/abi.js';
import { readJson, publicDir } from './m3Shared.js';

export const manifestSchema=z.object({book:hex32,contract:addressSchema,pool:addressSchema,business:z.string(),periodA:periodId,periodB:periodId,
 entriesA:z.array(artifactSchema),entriesB:z.array(artifactSchema),grantA:grantSchema,selfB:grantSchema,
 closeA:z.object({record:closeSchema,signature:signatureSchema}).strict()}).strict();
export async function auditM3() {
 const context=await m2Context('auditor','m3-auditor');
 const manifest=manifestSchema.parse(readJson(`${publicDir}/manifest.json`));
 const abi=loadPoolAbi(`${m2Root}/contracts/out/Books.sol/Books.json`);
 const block=await context.reader.getBlockNumber({cacheTime:0});
 const registry=await readRegistry(context.config,manifest.business,block);
 const read=(name:string,args:readonly unknown[])=>context.reader.readContract({address:manifest.contract,abi,functionName:name,args,blockNumber:block});
 const owner=addressSchema.parse(await read('books',[manifest.book]));
 if(owner.toLowerCase()!==parseAddress(manifest.business).hex.toLowerCase())throw new Error('BOOK_OWNER_MISMATCH');
 const period=z.tuple([z.bigint(),hex32,z.boolean(),hex32]).parse(await read('periods',[manifest.book,contractPeriod(manifest.periodA)]));
 if(!period[2]||period[0]!==BigInt(manifest.entriesA.length))throw new Error('PERIOD_NOT_CLOSED');
 if(await read('grants',[manifest.book,contractPeriod(manifest.periodA),context.account.evm])!==hashRecord(manifest.grantA))throw new Error('GRANT_ANCHOR_MISMATCH');
 const key=openGrant(manifest.grantA,manifest.book,manifest.periodA,context.account.cosmos,context.sealKeys,manifest.business,registry.pqPublicKey);
 requireEntryChain(manifest.entriesA,Number(period[0]));
 for(const artifact of manifest.entriesA) {
  const anchor=z.tuple([hex32,hex32]).parse(await read('entryAnchors',[manifest.book,contractPeriod(manifest.periodA),BigInt(artifact.index)]));
  if(anchor[1]!==artifact.prevEntrySha3)throw new Error('CHAIN_BROKEN');
  verifyArtifact(artifact,anchor[0],manifest.business,registry.pqPublicKey);
  openEntry(artifact,key,manifest.pool);
 }
 if(manifest.closeA.record.book!==manifest.book||manifest.closeA.record.period!==manifest.periodA||manifest.closeA.record.entryCount!==manifest.entriesA.length||period[1]!==manifest.closeA.record.lastEntrySha3||period[3]!==hashRecord(manifest.closeA.record))throw new Error('CLOSE_ANCHOR_MISMATCH');
 requireSignature(hashRecord(manifest.closeA.record),manifest.closeA.signature,manifest.business,registry.pqPublicKey);
 const b=z.tuple([z.bigint(),hex32,z.boolean(),hex32]).parse(await read('periods',[manifest.book,contractPeriod(manifest.periodB)]));
 if(b[0]<1n)throw new Error('PERIOD_B_ENTRY_REQUIRED');
 const absent=await read('grants',[manifest.book,contractPeriod(manifest.periodB),context.account.evm]);
 if(absent!==`0x${'00'.repeat(32)}`)throw new Error('PERIOD_B_GRANTED');
 let refusal:string|null=null;
 try {open({chainId:'qorechain-diana',purpose:`quaestor:${manifest.book}:period-key`,keys:context.sealKeys,
 envelope:hexToBytes(manifest.selfB.envelope),aad:toBytes(`${manifest.book}|${manifest.periodB}|${manifest.business}`)});}
 catch(error:unknown){if(isQoreSealError(error))refusal=error.code;}
 if(refusal!=='DECRYPTION_FAILED')throw new Error('PERIOD_B_GRANTED');
 return {pid:process.pid,loadedAccounts:['auditor'],book:manifest.book,block:block.toString(),periodA:{grantOpened:true,
 decryptedEntries:manifest.entriesA.length,anchorHashesVerified:manifest.entriesA.length,signaturesVerified:manifest.entriesA.length,chainVerified:true,closeVerified:true},
 periodB:{code:'NOT_GRANTED',entryCount:b[0].toString(),auditorGrantAbsent:true,cryptoRefusal:refusal}};
}
