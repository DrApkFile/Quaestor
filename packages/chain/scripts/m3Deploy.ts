import { encodeDeployData } from 'viem';
import { z } from 'zod';
import { m2Context, m2Root } from './m2Context.js';
import { readJson } from './m3Shared.js';
import { loadPoolAbi } from '../src/abi.js';
import { hexSchema, addressSchema } from '../src/config.js';
import { openWindow } from '../src/window.js';
import { executeOperation } from '../src/executor.js';
import { createGateway } from '../src/gateway.js';
import { paymentEvidence } from '../src/evidence.js';

export async function deployBooks() {
 const context=await m2Context('deployer','m3');
 const path=`${m2Root}/contracts/out/Books.sol/Books.json`;
 const source=z.object({bytecode:z.object({object:hexSchema}).passthrough()}).passthrough().parse(readJson(path));
 const abi=loadPoolAbi(path);const data=encodeDeployData({abi,bytecode:source.bytecode.object});
 const window=await openWindow(context.config,context.account,1n,750_000n);
 const result=await executeOperation(context.journal,{id:'m3-deploy-books',input:null,requestKey:data,
 build:()=>Promise.resolve({data,valueWei:'0',outputs:[],root:null,nullifier:null,feeWei:'0'})},
 createGateway(context.config,context.account,context.reader,context.poolAbi,null));
 if(result.kind!=='LANDED'||!result.operation.hash)throw new Error(result.kind);
 const receipt=await context.reader.getTransactionReceipt({hash:result.operation.hash});
 return {address:addressSchema.parse(receipt.contractAddress),transaction:paymentEvidence(result.operation),window:window.transaction};
}
