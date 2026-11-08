import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,generateKeyPairSync,sign,verify} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../../src/app.js';
import {AllowAllRateLimiter} from '../../src/rate-limit.js';
import {RECOVERY_PATH,canonical,digest,validRequest,jobRevision,jobMetadata} from '../../src/control-recovery-contract.js';

const id=randomUUID,pair=generateKeyPairSync('ed25519'),responsePair=generateKeyPairSync('ed25519');
const binding={instanceId:id(),institutionId:id(),installationId:id(),keyId:'control-jobs',publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString()};
const common={contract_version:1,instance_id:binding.instanceId,audience:'sj-jobs-test',operator_id:id()};
const row={id:id(),institutionId:binding.institutionId,originInstallationId:binding.installationId,jobType:'PROCESS_MEDIA',state:'DEAD_LETTER',
  attemptCount:0,availableAt:new Date(),createdAt:new Date(),updatedAt:new Date(),leaseUntil:null,leaseToken:null,lastErrorCode:'PRIVATE_ERROR_DETAIL'};
const msg=(t:string,n:string,d:string)=>['RUWANG-CONTROL-V1','POST',RECOVERY_PATH,t,n,d].join('\n');
function fixture(enabled=true){
  let calls=0;const used=new Set();
  const tx={$executeRaw:async()=>{calls++;},institutionInstallation:{findFirst:async()=>({id:binding.installationId})},
    centralJob:{findMany:async(args:any)=>{assert.equal(args.where.institutionId,binding.institutionId);assert.equal(args.where.originInstallationId,binding.installationId);assert.deepEqual(args.orderBy,{id:'asc'});assert.equal(args.take,26);return [row];}}};
  const config={nodeEnv:'test',flags:{controlRecovery:enabled},controlRecovery:{bindings:[binding],audience:common.audience,
    responseKeyId:'sj-jobs-response',responsePrivateKey:responsePair.privateKey.export({type:'pkcs8',format:'pem'}).toString()},
    security:{eventBodyMaxBytes:262144,signatureToleranceSeconds:300,nonceTtlSeconds:600},rateLimit:{},storage:{provider:'FILESYSTEM'}};
  const app=createApp({config,databases:{ingest:{$transaction:async(fn:any)=>fn(tx)}} as any,storage:{},
    ingestLimiter:new AllowAllRateLimiter(),publicLimiter:new AllowAllRateLimiter(),monitoringRuntime:{
      async reserveNonce(n){if(used.has(n))return false;used.add(n);return true;},async readWorkerHeartbeat(){return null;},async disconnect(){}}});
  const post=(body:unknown,options:{nonce?:string;timestamp?:string;key?:string;signature?:string;instance?:string}={})=>{
    const timestamp=options.timestamp??new Date().toISOString(),nonce=options.nonce??id(),sum=digest(body);
    return request(app).post(RECOVERY_PATH).set({'content-type':'application/json','x-rc-instance-id':options.instance??binding.instanceId,
      'x-rc-key-id':options.key??binding.keyId,'x-rc-timestamp':timestamp,'x-rc-nonce':nonce,'x-rc-content-sha256':sum,
      'x-rc-signature':options.signature??sign(null,Buffer.from(msg(timestamp,nonce,sum)),pair.privateKey).toString('base64url')}).send(canonical(body));
  };
  return {post,calls:()=>calls};
}
test('job recovery strict request vocabulary rejects unknown fields, cursors, reasons and statuses',()=>{
  for(const extra of [{operation:'list',cursor:null,state:null},{operation:'detail',job_id:id()},
    {operation:'retry',job_id:id(),request_id:id(),expected_revision:'a'.repeat(64),reason:'Scanner kembali tersedia'},
    {operation:'receipt',request_id:id(),request_digest:'a'.repeat(64)}]){
    assert.equal(validRequest({...common,...extra}),true);assert.equal(validRequest({...common,...extra,payload:{}}),false);
  }
  for(const extra of [{operation:'list',cursor:'bad',state:null},{operation:'list',cursor:null,state:'FAILED'},
    {operation:'retry',job_id:id(),request_id:id(),expected_revision:'a'.repeat(64),reason:' '},{operation:'approve'}])assert.equal(validRequest({...common,...extra}),false);
});
test('job metadata preserves zero, omits payload/errors and fences unsupported, owned or nonterminal jobs',()=>{
  const value=jobMetadata(row);assert.equal(value.attempt_count,0);assert.equal(value.retry.allowed,true);
  assert.equal('lastErrorCode' in value,false);assert.equal('payload' in value,false);
  for(const changed of [{state:'PROCESSING'},{leaseToken:id()},{leaseUntil:new Date()},{jobType:'UNKNOWN'}])assert.equal(jobMetadata({...row,...changed}).retry.allowed,false);
  assert.notEqual(jobRevision(row),jobRevision({...row,attemptCount:1}));
  assert.notEqual(jobRevision(row),jobRevision({...row,originInstallationId:id()}));
});
test('disabled, wrong signature/key/instance/time and replay rejected before database',async()=>{
  const body={...common,operation:'list',cursor:null,state:null};
  const off=fixture(false);assert.equal((await off.post(body)).status,503);assert.equal(off.calls(),0);
  for(const options of [{key:'other'},{instance:id()},{signature:'invalid'},{timestamp:new Date(0).toISOString()}]){
    const f=fixture();assert.equal((await f.post(body,options)).status,401);assert.equal(f.calls(),0);
  }
  const f=fixture(),nonce=id();assert.equal((await f.post(body,{nonce})).status,200);const count=f.calls();
  assert.equal((await f.post(body,{nonce})).status,409);assert.equal(f.calls(),count);
});
test('signed response binds request/operator and exposes only scoped job metadata, not ingest ACK or public proof',async()=>{
  const f=fixture(),body={...common,operation:'list',cursor:null,state:'DEAD_LETTER'},nonce=id(),r=await f.post(body,{nonce});
  assert.equal(r.status,200);assert.equal(r.body.request_nonce,nonce);assert.equal(r.body.request_digest,digest(body));assert.equal(r.body.operator_id,common.operator_id);
  assert.equal(r.body.value.scope,'BOUND_INSTALLATION');assert.equal(r.body.value.total,null);assert.equal(r.body.value.items[0].state,'DEAD_LETTER');
  assert.equal(r.headers['x-rc-ack-content-sha256'],digest(r.body));
  assert.equal(verify(null,Buffer.from(msg(r.headers['x-rc-ack-timestamp'],r.headers['x-rc-ack-nonce'],digest(r.body))),responsePair.publicKey,Buffer.from(r.headers['x-rc-ack-signature'],'base64url')),true);
  assert.equal(JSON.stringify(r.body).includes('PRIVATE_ERROR_DETAIL'),false);
});
