import { existsSync } from 'node:fs';
import { artifactSchema, sealEntry, type EpochKey, type EntryArtifact } from '@quaestor/core';
import type { Hex } from 'viem';
import type { StoredNote } from '../src/journal.js';
import { writePrivateJson } from '../src/storage.js';
import { receiptProof } from './m3Receipt.js';
import { publicDir, readJson, signingKeys } from './m3Shared.js';
import type { M2Context } from './m2Context.js';

export async function prepareEntry(context:M2Context,note:StoredNote,book:Hex,period:string,index:number,prev:Hex,direction:'IN'|'OUT',counterparty:string,key:EpochKey):Promise<EntryArtifact> {
 const path=`${publicDir}/entry-${period}-${String(index)}.json`;
 if(existsSync(path))return artifactSchema.parse(readJson(path));
 const receipt=await receiptProof(context,note,book,period,index);
 const sealed=sealEntry({v:1,book,period,index,prevEntrySha3:prev,direction,asset:note.asset,amount:note.amountWei,
 paymentCommitment:note.commitment,counterparty:{address:counterparty,name:direction==='IN'?'Client (demo)':'Supplier1 (demo)'},
 purpose:'Private payment (demo)',category:'operations',notes:'Demo-scale period ledger entry',receipt},key,signingKeys(context),context.config.pool);
 writePrivateJson(path,sealed);return sealed;
}
