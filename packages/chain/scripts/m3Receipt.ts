import { buildReceiptWitness } from '@gloamtrade/sdk';
import { groth16 } from 'snarkjs';
import { receiptContext, receiptSchema } from '@quaestor/core';
import type { Hex } from 'viem';
import type { StoredNote } from '../src/journal.js';
import { syncPoolTree, requireNotePath } from '../src/tree.js';
import { m2Root, type M2Context } from './m2Context.js';

export async function receiptProof(context:M2Context,note:StoredNote,book:Hex,period:string,index:number) {
 const block=await context.reader.getBlockNumber({cacheTime:0});
 const tree=await syncPoolTree(context.reader,context.config,context.poolAbi,block);
 const path=await requireNotePath(tree.tree,note.commitment);
 const witness=await buildReceiptWitness({secretHex:note.secret,amount:BigInt(note.amountWei),asset:note.asset,path,reveal:true,
 context:receiptContext(book,period,index,context.config.pool)});
 if(witness.blocker!==null)throw new Error('RECEIPT_WITNESS_FAILED');
 const proof=await groth16.fullProve(witness.circomInput,`${m2Root}/apps/web/public/circuits/receipt.wasm`,
  `${m2Root}/apps/web/public/circuits/receipt_final.zkey`,undefined,undefined,{singleThread:true});
 return receiptSchema.parse(proof);
}
