import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { MediaService } from '../../src/media-service.js';

const institutionId=randomUUID(),installationId=randomUUID();
const payload={institution_id:institutionId,publication_id:null,source_media_id:randomUUID(),sha256:'a'.repeat(64),detected_mime:'image/png',size_bytes:128,width:10,height:10,purpose:'BPRS_PUBLIC_MARK',requested_ttl_seconds:300};
function setup(existing:any=null){
  const writes:any[]=[];
  const tx={
    $executeRaw:async()=>1,$queryRaw:async()=>[],
    mediaObject:{findUnique:async()=>existing,create:async({data}:any)=>{writes.push({create:data});return data},update:async({data}:any)=>{writes.push({update:data});return {...existing,...data}}},
    mediaUploadSession:{updateMany:async()=>({count:0}),create:async({data}:any)=>({id:randomUUID(),...data})},
  };
  const service=new MediaService({ingest:{$transaction:async(fn:any)=>fn(tx)}} as any,{}, {publicApiBaseUrl:'http://127.0.0.1:1',uploadSessionTtlSeconds:300,security:{mediaFileMaxBytes:1024,mediaTotalMaxBytes:10240},storage:{provider:'FILESYSTEM'}});
  return {service,writes};
}
test('new media origin comes from authenticated installation, not request data',async()=>{
  const {service,writes}=setup();
  await service.createUploadSession(payload,{institutionId,installationId},randomUUID());
  assert.equal(writes[0].create.originInstallationId,installationId);
});
test('missing installation fails before any media write',async()=>{
  const {service,writes}=setup();
  await assert.rejects(service.createUploadSession(payload,{institutionId,installationId:''},randomUUID()),(e:any)=>e.code==='INSTALLATION_REQUIRED');
  assert.equal(writes.length,0);
});
test('upload renewal cannot take over a different installation origin',async()=>{
  const {service,writes}=setup({originInstallationId:randomUUID()});
  await assert.rejects(service.createUploadSession(payload,{institutionId,installationId},randomUUID()),(e:any)=>e.code==='MEDIA_INSTALLATION_CONFLICT');
  assert.equal(writes.length,0);
});
test('legacy upload can renew without inventing its origin',async()=>{
  const {service,writes}=setup({id:randomUUID(),originInstallationId:null,state:'EXPIRED',sha256:payload.sha256,detectedMime:payload.detected_mime,sizeBytes:128n,sourcePublicationId:null,purpose:payload.purpose,width:10,height:10});
  await service.createUploadSession(payload,{institutionId,installationId},randomUUID());
  assert.deepEqual(writes,[{update:{state:'AWAITING_UPLOAD'}}]);
});
