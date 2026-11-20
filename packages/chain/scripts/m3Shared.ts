import { readFileSync, existsSync } from 'node:fs';
import { hexToBytes, encodeFunctionData, type Abi, type Address, type Hex } from 'viem';
import { z } from 'zod';
import type { SigningKeys } from '@quaestor/core';
import { executeOperation } from '../src/executor.js';
import { createGateway } from '../src/gateway.js';
import { paymentEvidence } from '../src/evidence.js';
import { hexSchema } from '../src/config.js';
import { m2Root, type M2Context } from './m2Context.js';
import { writePrivateJson } from '../src/storage.js';

export const publicDir = `${m2Root}/.accounts/m3/public`;
export const signingKeys = (context:M2Context):SigningKeys => ({signer:context.account.cosmos,
 classicalKey:{type:'eth_secp256k1',privateKey:hexToBytes(hexSchema.parse(context.account.privateKey)),publicKey:hexToBytes(hexSchema.parse(context.account.publicKey))},
 pqKey:{secretKey:context.account.pqc.secretKey}});
export const readJson = (path:string):unknown => JSON.parse(readFileSync(path,'utf8')) as unknown;
export function artifact<T>(path:string,schema:z.ZodType<T,z.ZodTypeDef,unknown>,create:()=>T):T {
 if(existsSync(path))return schema.parse(readJson(path));
 const value=schema.parse(create());writePrivateJson(path,value);return value;
}
export async function sendCall(context:M2Context,contract:Address,abi:Abi,id:string,name:string,args:readonly unknown[]) {
 const data=encodeFunctionData({abi,functionName:name,args});
 const outcome=await executeOperation(context.journal,{id,input:null,requestKey:JSON.stringify([contract,data]),
 build:()=>Promise.resolve({data,valueWei:'0',outputs:[],root:null,nullifier:null,feeWei:'0'})},createGateway(context.config,context.account,context.reader,context.poolAbi,contract));
 if(outcome.kind!=='LANDED')throw new Error(outcome.kind);
 return paymentEvidence(outcome.operation);
}
export function hex(value:string):Hex {return hexSchema.parse(value);}
