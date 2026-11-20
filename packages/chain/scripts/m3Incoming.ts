import { m2Context, m2Root } from './m2Context.js';
import { readRegistry } from '../src/tickets/kemRegistry.js';
import { createCard, saveCard, resolveCard } from '../src/tickets/card.js';
import { accountSecrets } from '../src/nativeError.js';
import { sealSecrets } from '../src/tickets/sealKeys.js';
import { openWindow } from '../src/window.js';
import { sealTicket } from '../src/tickets/ticket.js';
import { postTicket, scanMemos } from '../src/tickets/memoBoard.js';
import { receiveMemo } from '../src/tickets/receive.js';
import { createGateway } from '../src/gateway.js';
import { syncPoolTree } from '../src/tree.js';
import { paymentEvidence } from '../src/evidence.js';
import { zeroAddress, toHex, hexToBytes } from 'viem';
import { artifact } from './m3Shared.js';
import { z } from 'zod';

export async function incomingPayment() {
 const client=await m2Context('client','m3-client');const business=await m2Context('business','m3-incoming');
 const block=await client.reader.getBlockNumber({cacheTime:0});
 const registry=await readRegistry(client.config,client.account.cosmos,block);
 const card=createCard(client.account,client.sealKeys,new Date().toISOString().replace(/\.\d{3}Z$/,'Z'));
 saveCard(`${m2Root}/cards/${client.account.cosmos}.json`,card,[...accountSecrets(client.account),...sealSecrets(client.sealKeys)]);
 if(!registry.possessionProven)throw new Error('CARD_INVALID');
 const recipients=await Promise.all([resolveCard(client.config,`${m2Root}/cards/${business.account.cosmos}.json`,business.account.cosmos,block),
 resolveCard(client.config,`${m2Root}/cards/${client.account.cosmos}.json`,client.account.cosmos,block)]);
 const [payee,payer]=recipients;if(payee.kind!=='VERIFIED'||payer.kind!=='VERIFIED')throw new Error('CARD_INVALID');
 const window=await openWindow(client.config,client.account,3n,4_250_000n);
 const shield=await client.pool.shield('m3-client-shield',zeroAddress,2_000_000_000_000_000_000n);
 if(shield.kind!=='LANDED'||!shield.operation.prepared)throw new Error(shield.kind);
 const input=shield.operation.prepared.outputs[0];if(!input)throw new Error('NOTE_REQUIRED');
 const send=await client.pool.privateSend('m3-client-send',input.commitment,1_000_000_000_000_000_000n,'business');
 if(send.kind!=='LANDED'||!send.operation.prepared)throw new Error(send.kind);
 const note=send.operation.prepared.outputs.find(note=>note.owner==='business');if(!note)throw new Error('NOTE_REQUIRED');
 const sealed=await sealTicket({v:1,secret:note.secret,commitment:note.commitment,nullifier:note.nullifier,amountWei:note.amountWei,
 asset:note.asset,pool:client.config.pool,chainId:9800},[payee,payer]);
 const cached=artifact(`${m2Root}/.accounts/m3-client/ticket.json`,z.object({hex:z.string().regex(/^0x[\da-f]+$/).transform(value=>value as `0x${string}`)}).strict(),()=>({hex:toHex(sealed)}));
 const envelope=hexToBytes(cached.hex);
 const posted=await postTicket(client.journal,'m3-client-send',note.commitment,envelope,client.memoAbi,
 createGateway(client.config,client.account,client.reader,client.poolAbi,client.board.address));
 if(posted.kind!=='LANDED')throw new Error(posted.kind);
 const at=await business.reader.getBlockNumber({cacheTime:0});
 const memos=await scanMemos(business.reader,business.memoAbi,business.board,at);
 const memo=memos.find(memo=>memo.commitment===note.commitment);if(!memo)throw new Error('MEMO_REQUIRED');
 const tree=await syncPoolTree(business.reader,business.config,business.poolAbi,at);
 const opened=await receiveMemo(business.journal,memo,business.sealKeys,business.config.pool,at,async(leaf,nullifier,block)=>{
  const spent:unknown=await business.reader.readContract({address:business.config.pool,abi:business.poolAbi,functionName:'isSpent',args:[nullifier],blockNumber:block});
  if(typeof spent!=='boolean')throw new Error('SPEND_STATUS_INVALID');
  return {included:tree.tree.indexByCommitment.has(leaf.toLowerCase()),spent,root:tree.tree.root};
 });
 if(opened.kind!=='OPENED')throw new Error(opened.code);
 return {note, window:window.transaction,shield:paymentEvidence(shield.operation),send:paymentEvidence(send.operation),memo:paymentEvidence(posted.operation),open:opened};
}
