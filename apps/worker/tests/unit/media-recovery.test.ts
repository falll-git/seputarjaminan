import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import pino from 'pino';
import {FilesystemStorageAdapter} from '@seputarjaminan/storage';
import {CentralWorker} from '../../src/worker.js';
import {MediaValidationError} from '../../src/image-processing.js';

async function fixture(context: any) {
 const root=await mkdtemp(path.join(os.tmpdir(),'sj-worker-recovery-'));
 context.after(()=>rm(root,{recursive:true,force:true}));
 const storage=new FilesystemStorageAdapter({root});
 const bytes=await sharp({create:{width:80,height:60,channels:3,background:'#668877'}}).png().toBuffer();
 const media:any={id:'media',institutionId:'test',state:'PROCESSING',logicalObjectKey:'institutions/test/temporary/media/source',sha256:createHash('sha256').update(bytes).digest('hex'),detectedMime:'image/png',width:80,height:60,sizeBytes:BigInt(bytes.length)};
 await storage.putObject(media.logicalObjectKey,bytes);
 let attempt=0;const jobs:any[]=[];
 const transaction:any={mediaObject:{findFirst:async()=>({...media}),updateMany:async({where,data}:any)=>{
  if(where.state&&where.state!==media.state)return {count:0};Object.assign(media,data);return {count:1};
 }},$executeRaw:async()=>1,$queryRaw:async()=>[{id:'job'}],centralJob:{update:async({data}:any)=>jobs.push(data)}};
 const database:any={$executeRaw:async()=>1,$transaction:async(fn:any)=>fn(transaction),$queryRaw:async()=>[{id:'job',institution_id:'test',job_type:'PROCESS_MEDIA',payload:{media_id:'media'},attempt_count:++attempt,lease_token:'owner'}]};
 const scanner:any={scan:async()=>undefined};
 const worker=new CentralWorker(database,storage,scanner,pino({level:'silent'}),10485760);
 return {storage,media,jobs,scanner,worker};
}

test('derivative write failure retries from preserved original, never false READY',async context=>{
 const f=await fixture(context);const put=f.storage.putObject.bind(f.storage);let fail=true;
 f.storage.putObject=async(...args)=>{if(fail){fail=false;throw Object.assign(new Error('injected storage failure'),{code:'EIO'});}return put(...args);};
 await f.worker.runOnce();assert.equal(f.media.state,'PROCESSING');assert.equal(f.jobs.at(-1).state,'RETRY_WAIT');
 assert.equal(await f.storage.objectExists('institutions/test/media/media/original'),true);
 await f.worker.runOnce();assert.equal(f.media.state,'READY');assert.equal(f.jobs.at(-1).state,'COMPLETED');
 assert.equal(await f.storage.objectExists(f.media.deliveryObjectKey),true);
});

test('concurrent revoke cannot be overwritten by a finishing worker',async context=>{
 const f=await fixture(context);f.scanner.scan=async()=>{f.media.state='REVOKED';};
 await f.worker.runOnce();assert.equal(f.media.state,'REVOKED');assert.equal(f.media.deliveryObjectKey,undefined);
});

test('concurrent quarantine keeps a retryable job rather than silently completing',async context=>{
 const f=await fixture(context);f.scanner.scan=async()=>{f.media.state='QUARANTINED';};
 await f.worker.runOnce();assert.equal(f.media.state,'QUARANTINED');assert.equal(f.jobs.at(-1).state,'RETRY_WAIT');
});

test('scanner outage is retryable and never records CLEAN or READY',async context=>{
 const f=await fixture(context);f.scanner.scan=async()=>{throw new Error('Scanner temporarily unavailable');};
 await f.worker.runOnce();assert.equal(f.media.state,'PROCESSING');assert.equal(f.media.scanResult,undefined);
 assert.equal(f.jobs.at(-1).state,'RETRY_WAIT');assert.equal(f.jobs.at(-1).lastErrorCode,'WORKER_TEMPORARY_FAILURE');
 assert.equal(await f.storage.objectExists(f.media.logicalObjectKey),true);
});

test('malware rejection cannot overwrite a concurrent revoke',async context=>{
 const f=await fixture(context);f.scanner.scan=async()=>{f.media.state='REVOKED';throw new MediaValidationError('MALWARE_DETECTED','test detection');};
 await f.worker.runOnce();assert.equal(f.media.state,'REVOKED');assert.equal(f.media.scanResult,undefined);assert.equal(f.media.deliveryObjectKey,undefined);
});

test('cleanup of rejected media keeps original bytes and only removes expired sessions',async()=>{
 let deletedOriginal=false,removedSessions=false;
 const tx:any={$executeRaw:async()=>0,$queryRaw:async()=>[{id:'media'}],mediaObject:{findFirst:async()=>({id:'media',state:'REJECTED',logicalObjectKey:'institutions/test/media/media/original'}),updateMany:async()=>({count:0})},mediaUploadSession:{deleteMany:async()=>{removedSessions=true;}}};
 const db:any={$transaction:async(fn:any)=>fn(tx),publication:{findMany:async()=>[]},requestNonce:{deleteMany:async()=>({count:0})},mediaUploadSession:{findMany:async()=>[{institutionId:'test',mediaObjectId:'media'}]}};
 const storage:any={objectExists:async()=>true,deleteTemporaryObject:async()=>{deletedOriginal=true;}};
 await new CentralWorker(db,storage,{} as any,pino({level:'silent'}),10485760).maintenance();assert.equal(deletedOriginal,false);assert.equal(removedSessions,true);
});

test('maintenance rechecks renewed sessions under object lock before deleting bytes',async()=>{
 let deleted=0,expired=0,locked=false;
 const tx:any={
  $executeRaw:async()=>0,
  $queryRaw:async()=>{locked=true;return [];},
  mediaObject:{findFirst:async({where}:any)=>{
   assert.equal(locked,true);assert.ok(where.uploadSessions.none.expiresAt.gte instanceof Date);
   return null; // renewed since the stale candidate was enumerated
  },updateMany:async()=>{expired++;return {count:1};}},
  mediaUploadSession:{deleteMany:async()=>{deleted++;}},
 };
 const database:any={publication:{findMany:async()=>[]},requestNonce:{deleteMany:async()=>({count:0})},mediaUploadSession:{findMany:async({where}:any)=>{
  assert.ok(where.mediaObject.uploadSessions.none.expiresAt.gte instanceof Date);
  return [{institutionId:'test',mediaObjectId:'media'}];
 }},$transaction:async(fn:any)=>fn(tx)};
 const storage:any={objectExists:async()=>true,deleteTemporaryObject:async()=>{deleted++;}};
 await new CentralWorker(database,storage,{} as any,pino({level:'silent'}),10485760).maintenance();
 assert.equal(locked,true);assert.equal(deleted,0);assert.equal(expired,0);
});
