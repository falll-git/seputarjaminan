// Explicit, read-only external source audit. No dotenv, database, storage or real fetch.
// OPS09 B01-B07 regressions use actual source with in-memory infrastructure.
// Passing is contract/service-double evidence, not a real cross-application E2E gate.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import * as sj from '../packages/contracts/src/index.mjs';
import { createControlMonitoringHandler, CONTROL_MONITORING_PATH } from '../apps/api/src/control-monitoring.ts';

const bankRoot = process.env.SJ_BOUNDARY_BANK_ROOT;
const controlRoot = process.env.SJ_BOUNDARY_CONTROL_ROOT;
assert.ok(bankRoot && controlRoot, 'Explicit read-only source roots required; never load application env files');
const bankPath = name => resolve(bankRoot, 'src/modules/seputar-jaminan', name);
const requirePure = createRequire(import.meta.url);
const bank = requirePure(bankPath('controlReview.contract.js'));
const vendorLoader = requirePure(bankPath('contracts.js'));
const vendor = await vendorLoader.getContracts();
test('COMPAT all vendored manifest files match current SJ contract bytes',()=>{
  const manifest=vendorLoader.verifyVendoredContract();
  assert.ok(Object.keys(manifest.files).length>0);
  for(const [file,expected] of Object.entries(manifest.files)){
    const content=readFileSync(new URL(`../packages/contracts/${file}`,import.meta.url));
    assert.equal(crypto.createHash('sha256').update(content).digest('hex'),expected,file);
  }
});
const control = await import(pathToFileURL(resolve(controlRoot, 'src/domain/control-review-contract.ts')).href);
const monitoring = await import(pathToFileURL(resolve(controlRoot, 'src/domain/monitoring-transport.ts')).href);
const institution = crypto.randomUUID(), publication = crypto.randomUUID(), contact = crypto.randomUUID(), media = crypto.randomUUID();
const at = '2026-09-17T00:00:00.000Z';
const payloads = {
  UPSERT_BPRS_PROFILE: {institution_id:institution, public_name:'BPRS Boundary Test',public_mark:media,short_description:'In-memory contract test only.',office_city_regency:'Kota Bandung',office_province:'Jawa Barat',profile_updated_at:at},
  HIDE_BPRS_PROFILE: {institution_id:institution,reason_code:'PROFILE_REMOVED',hidden_at:at},
  UPSERT_WHATSAPP_CONTACT: {institution_id:institution,whatsapp_contact_id:contact,phone_e164:'+628111111111',status:'VERIFIED',template_version:1,verified_at:at},
  REVOKE_WHATSAPP_CONTACT: {institution_id:institution,whatsapp_contact_id:contact,status:'REVOKED',reason_code:'CONTACT_REPLACED',revoked_at:at},
  UPSERT_PUBLICATION_SNAPSHOT: {institution_id:institution,publication_id:publication,reference_code:'SJ-AB12CD34',taxonomy_version:1,category:'BANGUNAN',subcategory:'RUMAH',title:'Boundary test asset',description:'Not a public fixture.',location:{city_regency:'Bandung',province:'Jawa Barat'},availability:'AVAILABLE',attributes:{land_area_m2:126,building_area_m2:148,floor_count:2,public_usage:'HUNIAN'},media:[{media_id:media,checksum:'a'.repeat(64),position:1,is_cover:true,alt_text:'Test'}],whatsapp_contact_id:contact,published_at:at,public_updated_at:at,availability_confirmed_at:at,next_confirmation_at:'2026-10-17T00:00:00.000Z'},
  UNPUBLISH_PUBLICATION: {institution_id:institution,publication_id:publication,reason_code:'NO_LONGER_AVAILABLE',unpublished_at:at},
  ARCHIVE_PUBLICATION: {institution_id:institution,publication_id:publication,archived_at:at},
  REVOKE_MEDIA: {institution_id:institution,media_id:media,reason_code:'CONTENT_REVIEW',revoked_at:at},
};
function eventFor(type) {
  const payload = structuredClone(payloads[type]);
  return {event_id:crypto.randomUUID(),schema_version:1,event_type:type,institution_id:institution,
    aggregate_id:type.includes('PROFILE') ? institution : type.includes('CONTACT') ? contact : type==='REVOKE_MEDIA' ? media : publication,
    aggregate_version:1,occurred_at:at,payload_checksum:vendor.payloadChecksum(payload),payload};
}

for (const type of Object.keys(payloads)) test(`COMPAT event ${type}: vendor sender to SJ receiver`, () => {
  const event=eventFor(type);
  assert.equal(vendor.validateIntegrationEvent(event).valid,true,JSON.stringify(vendor.validateIntegrationEvent(event).errors));
  assert.equal(sj.validateIntegrationEvent(event).valid,true);
  assert.equal(vendor.payloadChecksum(event.payload),sj.payloadChecksum(event.payload));
  for (const invalid of [{...event,aggregate_version:0},{...event,payload_checksum:'b'.repeat(64)},
    {...event,payload:{...event.payload,internal_notes:'must not cross boundary'}}]) {
    assert.equal(sj.validateIntegrationEvent(invalid).valid,false);
    assert.equal(vendor.validateIntegrationEvent(invalid).valid,false);
  }
});

const keys=crypto.generateKeyPairSync('ed25519');
const privatePem=keys.privateKey.export({type:'pkcs8',format:'pem'}).toString();
const publicPem=keys.publicKey.export({type:'spki',format:'pem'}).toString();
const settings={institution_id:institution,installation_id:crypto.randomUUID(),key_id:'ephemeral-test-key',central_base_url:'https://sj.invalid',sync_enabled:true,connection_state:'ACTIVE'};
const testEnv={SJ_INTEGRATION_PRIVATE_KEY:privatePem};
const target=requirePure(bankPath('outboxTarget.js'));
function worker(fetcher, prisma={}) {
  const sandboxModule={exports:{}};
  const allowed={
    'node:crypto':crypto,'../../config/prisma':prisma,'./contracts':{getContracts:async()=>vendor},
    './controlReview.contract':bank,'./controlReviewSnapshot.service':{SNAPSHOT_EVENT_TYPE:'CONTROL_REVIEW_SNAPSHOT'},
    './mediaStorage':{createMediaStorage:()=>{throw Error('Storage forbidden in boundary test');}},
    './seputarJaminan.service':{createOutbox:()=>{throw Error('Real outbox forbidden');}},
  };
  // Only inspected pure dependencies may escape the VM. Prisma is always a double.
  for(const name of ['deliveryEvidence','controlSnapshotTarget','outboxTarget','reconciliationResponse','mediaReadiness'])allowed['./'+name]=requirePure(bankPath(name+'.js'));
  allowed['./outboxTarget']={outboxTargetBlock:(row,active)=>target.outboxTargetBlock(row,active,testEnv)};
  const leaseModule={exports:{}};
  vm.runInNewContext(readFileSync(bankPath('outboxLease.js'),'utf8'),{
    module:leaseModule,exports:leaseModule.exports,process:{env:testEnv},Date,
    require:name=>{assert.ok(Object.hasOwn(allowed,name),`Unapproved lease dependency: ${name}`);return allowed[name];},
  },{filename:'read-only-bank-lease.cjs'});
  allowed['./outboxLease']=leaseModule.exports;
  vm.runInNewContext(readFileSync(bankPath('syncWorker.service.js'),'utf8')+'\nmodule.exports.boundaryDeliverOutbox = deliverOutbox; module.exports.boundaryReconciliation = processReconciliation;', {
    module:sandboxModule, exports:sandboxModule.exports, require:name=>{assert.ok(Object.hasOwn(allowed,name),`Unapproved dependency: ${name}`);return allowed[name];},
    process:{env:testEnv},fetch:fetcher,AbortSignal,Buffer,URL,Date,
  },{filename:'read-only-bank-worker.cjs'});
  return sandboxModule.exports;
}
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});

test('COMPAT actual bank transport signature, body digest and fresh nonce verify in SJ',async()=>{
  const seen=[];
  const adapter=worker(async(url,options)=>{seen.push({url,options});return jsonResponse({status:'APPLIED'});});
  const event=eventFor('UPSERT_PUBLICATION_SNAPSHOT');
  await adapter.signedRequest(settings,'POST','/v1/ingest/events',event);
  await adapter.signedRequest(settings,'POST','/v1/ingest/events',event);
  for(const {url,options} of seen){
    assert.equal(url,'https://sj.invalid/v1/ingest/events');
    const h=options.headers;
    assert.equal(h['X-SJ-Content-SHA256'],sj.createContentSha256(options.body));
    assert.equal(sj.verifyIntegrationMessage(sj.createSigningMessage({method:'POST',path:'/v1/ingest/events',timestamp:h['X-SJ-Timestamp'],nonce:h['X-SJ-Nonce'],contentSha256:h['X-SJ-Content-SHA256']}),h['X-SJ-Signature'],publicPem),true);
  }
  assert.equal(seen[0].options.body,seen[1].options.body);
  assert.notEqual(seen[0].options.headers['X-SJ-Nonce'],seen[1].options.headers['X-SJ-Nonce']);
});

test('COMPAT Control commands/ACK and signatures agree with bank; SJ ACK is a different protocol',()=>{
  for(const kind of ['publication','profile','contact','change_request']){
    for(const decision of kind==='change_request'?['approve','request_revision','reject']:['approve','request_revision']){
      const command={contract_version:1,command_id:crypto.randomUUID(),instance_id:institution,actor_subject:`ruwang-control:${crypto.randomUUID()}`,audience:'test-bank',resource:{kind,id:publication},decision,contributor_subjects:['ruwang:user-test'],expected_version:0,expected_checksum:'a'.repeat(64),issued_at:at,expires_at:'2026-09-17T00:05:00.000Z',...(kind==='change_request'||decision==='request_revision'?{reason:'Contract test'}:{})};
      assert.equal(control.reviewCommandSchema.safeParse(command).success,true);
      assert.equal(bank.validateCommand(command).valid,true);
      assert.equal(control.payloadDigest(command),bank.payloadDigest(command));
      const input={method:'POST',path:'/internal/command',timestamp:at,nonce:crypto.randomUUID(),contentSha256:control.payloadDigest(command)};
      assert.equal(control.createTransportSigningMessage(input),bank.signingMessage(input));
      assert.equal(bank.verifyTransport(bank.signingMessage(input),control.signTransport(control.createTransportSigningMessage(input),privatePem),publicPem),true);
      const ack={contract_version:1,acknowledgment_id:crypto.randomUUID(),command_id:command.command_id,command_digest:control.payloadDigest(command),instance_id:institution,resource:command.resource,status:'APPLIED',result_code:'APPLIED',observed_version:1,observed_checksum:'a'.repeat(64),processed_at:at};
      assert.equal(bank.validateAcknowledgment(ack),true);
      assert.equal(control.reviewAcknowledgmentSchema.safeParse(ack).success,true);
    }
  }
  const sjAck={event_id:crypto.randomUUID(),status:'APPLIED',active_aggregate_version:1,acknowledged_at:at};
  assert.equal(bank.validateAcknowledgment(sjAck),false);
  assert.equal(control.reviewAcknowledgmentSchema.safeParse(sjAck).success,false);
  const input={method:'POST',path:'/v1/ingest/events',timestamp:at,nonce:crypto.randomUUID(),contentSha256:'a'.repeat(64)};
  assert.equal(sj.verifyIntegrationMessage(sj.createSigningMessage(input),control.signTransport(control.createTransportSigningMessage(input),privatePem),publicPem),false);
});

test('REGRESSION B01: malformed successful transport responses fail closed',async()=>{
  for(const body of ['not json','null','[]']){
    const adapter=worker(async()=>new Response(body,{status:200}));
    await assert.rejects(adapter.signedRequest(settings,'POST','/v1/ingest/events',eventFor('ARCHIVE_PUBLICATION')),e=>e.code==='CENTRAL_RESPONSE_INVALID');
  }
});

function deliveryHarness(reply,{owns=true,renew=true,activeSettings=settings}={}) {
  const writes=[];
  const client=Object.fromEntries(['sj_sync_attempts','sj_sync_outbox','sj_control_change_requests','sj_publications','sj_integration_settings'].map(name=>[name,Object.fromEntries(['create','update','updateMany'].map(method=>[method,async args=>{writes.push({name,method,args});return {count:1};}]))]));
  client.$queryRaw=async()=>owns?[{id:'owned'}]:[];
  const event=eventFor('UPSERT_PUBLICATION_SNAPSHOT');
  const row={id:crypto.randomUUID(),event_id:event.event_id,schema_version:1,event_type:event.event_type,aggregate_type:'PUBLICATION',aggregate_id:publication,aggregate_version:1,created_at:new Date(at),payload_checksum:event.payload_checksum,payload_json:event.payload,attempt_count:1,locked_by:'test-lease',target_binding_json:target.captureTarget(event.event_type,settings,testEnv)};
  let requests=0;
  const adapter=worker(async(_url,options)=>{requests++;return jsonResponse(reply(JSON.parse(options.body)));},{
    $transaction:async callback=>callback(client),$executeRaw:async()=>renew?1:0,
    sj_integration_settings:{findFirst:async()=>activeSettings},
  });
  return {writes,row,adapter,send:()=>adapter.boundaryDeliverOutbox(row,settings),requests:()=>requests};
}
const ack=(event,changes={})=>({request_id:crypto.randomUUID(),event_id:event.event_id,status:'APPLIED',active_aggregate_version:event.aggregate_version,acknowledged_at:new Date().toISOString(),...changes});

test('REGRESSION B01: empty, wrong-event, wrong-version and extra-field ACK never complete an event',async()=>{
  for(const reply of [()=>({}),e=>ack(e,{event_id:crypto.randomUUID()}),e=>ack(e,{active_aggregate_version:2}),e=>ack(e,{unexpected:true})]){
    const h=deliveryHarness(reply);
    await assert.rejects(h.send(),e=>e.code==='CENTRAL_ACK_INVALID');
    assert.equal(h.writes.length,0);
  }
});
test('REGRESSION B01: valid ACK records delivery with exact-version publication guards, not public visibility',async()=>{
  const h=deliveryHarness(e=>ack(e));await h.send();
  assert.equal(h.writes.find(w=>w.name==='sj_sync_outbox').args.data.state,'ACKNOWLEDGED');
  const publicationWrites=h.writes.filter(w=>w.name==='sj_publications');
  assert.equal(publicationWrites.length,2);
  for(const w of publicationWrites){assert.equal(w.method,'updateMany');assert.equal(w.args.where.aggregate_version,1);}
  assert.equal(publicationWrites[1].args.where.state,'APPROVED');
  assert.equal(publicationWrites[1].args.data.state,'PUBLISHED');
  assert.ok(h.writes.every(w=>!Object.hasOwn(w.args.data,'public_visible')));
  const lifecycle=h.writes.find(w=>w.name==='sj_control_change_requests');
  assert.equal(lifecycle.args.where.sync_event_id,h.row.event_id);
  assert.equal(lifecycle.args.where.state,'APPLIED');
});
test('REGRESSION B02: obsolete duplicate is receipted without marking the newer publication delivered/published',async()=>{
  const h=deliveryHarness(e=>ack(e,{status:'DUPLICATE',active_aggregate_version:2}));
  await h.send();
  assert.equal(h.writes.find(w=>w.name==='sj_sync_outbox').args.data.state,'ACKNOWLEDGED');
  assert.equal(h.writes.filter(w=>w.name==='sj_publications').length,0);
});
test('REGRESSION B03: lost lease fences both transmission and late completion',async()=>{
  for(const options of [{renew:false},{owns:false}]){
    const h=deliveryHarness(e=>ack(e),options);await h.send();
    assert.equal(h.writes.length,0);
    assert.equal(h.requests(),options.renew===false?0:1);
  }
});
test('REGRESSION B03: actual recovery releases expired leases before ordered SKIP LOCKED claim',async()=>{
  const queries=[],writes=[];
  const expired={id:crypto.randomUUID(),event_id:crypto.randomUUID(),attempt_count:1};
  const client={
    $queryRaw:async(strings)=>{queries.push(strings.join('?'));return [expired];},
    sj_sync_attempts:{createMany:async a=>writes.push(a)},
    sj_sync_outbox:{update:async a=>writes.push(a)},
  };
  const adapter=worker(()=>{throw Error('Network forbidden');},{
    $transaction:async callback=>callback(client),
    $queryRaw:async strings=>{queries.push(strings.join('?'));return [];},
  });
  await adapter.claimOutbox('boundary-worker',1);
  assert.match(queries[0],/state='SENDING'/);
  assert.match(queries[0],/locked_at <= clock_timestamp/);
  assert.match(queries[0],/FOR UPDATE SKIP LOCKED/);
  assert.equal(writes[0].skipDuplicates,true);
  assert.equal(writes[1].data.state,'RETRYING');
  assert.equal(writes[1].data.locked_by,null);
  assert.match(queries[1],/earlier.aggregate_version<current.aggregate_version/);
  assert.match(queries[1],/earlier.state<>'ACKNOWLEDGED'/);
  assert.match(queries[1],/FOR UPDATE SKIP LOCKED/);
  // Actual SQL/service-double regression, not a PostgreSQL concurrency test.
});
test('REGRESSION target binding: changed destination or institution rejected before network/write',async()=>{
  for(const patch of [{central_base_url:'https://other.invalid'},{institution_id:crypto.randomUUID()},{installation_id:crypto.randomUUID()}]){
    const h=deliveryHarness(e=>ack(e),{activeSettings:{...settings,...patch}});
    await assert.rejects(h.send(),e=>e.code==='OUTBOX_TARGET_CHANGED');
    assert.equal(h.requests(),0);assert.equal(h.writes.length,0);
  }
});
test('REGRESSION B04: quarantine/revoked/expired/rejected media cannot stay PROCESSING or revive revoked media',async()=>{
  for(const status of ['QUARANTINED','REVOKED','EXPIRED','REJECTED','READY']){
    const writes=[],id=crypto.randomUUID();
    const adapter=worker(async()=>jsonResponse({request_id:crypto.randomUUID(),media_id:media,status,rejection_code:status==='READY'?null:'CONTENT_REVIEW',checked_at:new Date().toISOString()}),{
      sj_media_assets:{updateMany:async args=>{writes.push(args);return {count:0};}},
    });
    assert.equal(await adapter.uploadMedia({id,central_media_id:media,state:'PROCESSING'},settings),true);
    assert.equal(writes.length,1);
    assert.equal(writes[0].where.revoked_at,null);
    assert.equal(writes[0].where.central_media_id,media);
    assert.equal(writes[0].where.state,'PROCESSING');
    assert.equal(writes[0].data.state,status==='READY'?'READY':'REJECTED');
  }
});
test('REGRESSION B05: explicit nonretryable overrides HTTP 503; retryable/transient errors remain retryable',async()=>{
  for(const [body,status,retryable] of [[{code:'INGEST_DISABLED',retryable:false},503,false],[{code:'TEMPORARY',retryable:true},503,true],[{},503,true],[{retryable:true},409,false]]){
    const adapter=worker(async()=>jsonResponse(body,status));
    await assert.rejects(adapter.signedRequest(settings,'POST','/v1/ingest/events',{}),error=>error.retryable===retryable);
  }
});
test('REGRESSION B01 media session: invalid successful response cannot persist central IDs or read/upload bytes',async()=>{
  const writes=[],requests=[];
  const adapter=worker(async url=>{requests.push(url);return jsonResponse({});},{
    sj_media_assets:{updateMany:async args=>{writes.push(args);return {count:1};}},
  });
  await assert.rejects(adapter.uploadMedia({id:crypto.randomUUID(),purpose:'BPRS_PUBLIC_MARK',state:'UPLOADED',size_bytes:100,updated_at:new Date(),sha256:'a'.repeat(64)},settings),e=>e.code==='CENTRAL_MEDIA_SESSION_INVALID');
  assert.equal(requests.length,1);
  assert.equal(writes.length,1); // Only the original upload reservation, recoverable after timeout.
  assert.equal(writes[0].data.state,'UPLOAD_PENDING');
  assert.equal(writes.some(w=>Object.hasOwn(w.data,'central_media_id')),false);
});
test('REGRESSION B06: reconciliation rejects incomplete/misbound reports and accepts only complete matching evidence',async()=>{
  const runId=crypto.randomUUID(),manifest={items:[]};
  for(const [body,expected] of [
    [{status:'COMPLETED'},'FAILED'],
    [{request_id:'test',run_id:crypto.randomUUID(),status:'COMPLETED',count_checked:0,count_mismatch:0,mismatches:[]},'FAILED'],
    [{request_id:'test',run_id:runId,status:'COMPLETED',count_checked:0,count_mismatch:0,mismatches:[]},'MATCHED'],
  ]){
    const updates=[];
    const adapter=worker(async()=>jsonResponse(body),{sj_reconciliation_runs:{
      findFirst:async()=>({id:crypto.randomUUID(),state:'RUNNING',safe_report_json:{central_run_id:runId,manifest}}),
      update:async value=>updates.push(value),
    }});
    await adapter.boundaryReconciliation(settings);
    assert.equal(updates[0].data.state,expected);
    if(expected==='FAILED'){assert.equal(updates[0].data.count_checked,undefined);assert.equal(updates[0].data.safe_report_json.error_code,'RECONCILIATION_RESPONSE_INVALID');}
    else assert.equal(updates[0].data.count_checked,0);
  }
});

function controlServer(file, exposed, fetcher=()=>{throw Error('Network forbidden');}) {
  const deny=()=>{throw Error('External infrastructure forbidden');};
  const sandboxModule={exports:{}};
  const allowed={
    'node:fs/promises':{readFile:deny},
    '@/src/domain/control-review-contract':control,
    '@/src/domain/authorization':{authorize:deny},
    '@/src/domain/review':{validateDecision:deny},
    '@/src/server/review-guards':{currentDecisionPrincipal:deny,lockReviewAggregate:deny,requireCurrentSnapshot:deny},
    '@/src/domain/review-snapshot':{reviewSnapshotEnvelopeSchema:{parse:deny}},
    '@/src/lib/env':{getRuntimeConfig:deny},
    '@/src/server/database':{query:deny,withTransaction:deny},
    '@/src/server/errors':{AuthorizationError:Error,ConflictError:Error,IntegrationUnavailableError:Error,RequestValidationError:Error},
  };
  const source=readFileSync(resolve(controlRoot,'src/server',file),'utf8')+`\nexport { ${exposed} as boundaryFunction };`;
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{module:sandboxModule,exports:sandboxModule.exports,require:name=>{assert.ok(Object.hasOwn(allowed,name),`Unapproved dependency: ${name}`);return allowed[name];},fetch:fetcher,URL,AbortController,setTimeout,clearTimeout,Date,Buffer},{filename:`read-only-control-${file}`});
  return sandboxModule.exports.boundaryFunction;
}

test('COMPAT actual Control ACK verifier accepts bank signature and rejects wrong identity/digest/time/signature',async()=>{
  const verifyAck=controlServer('review-adapter.ts','verifyAcknowledgment');
  const now=new Date(),commandId=crypto.randomUUID(),commandDigest='a'.repeat(64),resource={kind:'publication',id:publication};
  const acknowledgment={contract_version:1,acknowledgment_id:crypto.randomUUID(),command_id:commandId,command_digest:commandDigest,instance_id:institution,resource,status:'APPLIED',result_code:'DECISION_APPLIED',observed_version:1,observed_checksum:'b'.repeat(64),processed_at:now.toISOString()};
  function input(body=acknowledgment, stamp=now.toISOString()) {
    const digest=bank.payloadDigest(body),nonce=crypto.randomUUID(),h=bank.headerNames;
    const signature=bank.signTransport(bank.signingMessage({method:'POST',path:'/api/v1/internal/ruwang-control/sj-review/commands',timestamp:stamp,nonce,contentSha256:digest}),privatePem);
    return {response:new Response(bank.canonicalJson(body),{headers:{[h.acknowledgmentKeyId]:'bank-test',[h.acknowledgmentTimestamp]:stamp,[h.acknowledgmentNonce]:nonce,[h.acknowledgmentContentSha256]:digest,[h.acknowledgmentSignature]:signature}}),bodyText:bank.canonicalJson(body),instance:{id:institution,bank_ack_key_id:'bank-test',bank_ack_public_key:publicPem},command:{id:commandId,request_digest:commandDigest,request_payload:{resource,decision:'approve',expected_version:0,expected_checksum:'b'.repeat(64)}},now};
  }
  assert.equal((await verifyAck(input())).status,'APPLIED');
  for(const change of [{result_code:'APPLIED'},{observed_version:2}])await assert.rejects(verifyAck(input({...acknowledgment,...change})),/BANK_ACK_RESULT_INVALID/);
  for(const change of [{command_id:crypto.randomUUID()},{instance_id:crypto.randomUUID()},{command_digest:'c'.repeat(64)},{resource:{kind:'profile',id:publication}}])await assert.rejects(verifyAck(input({...acknowledgment,...change})),/BANK_ACK_SCOPE_INVALID/);
  await assert.rejects(verifyAck(input(acknowledgment,new Date(now.getTime()-301000).toISOString())),/BANK_ACK_EXPIRED/);
  const tampered=input();tampered.response.headers.set(bank.headerNames.acknowledgmentSignature,'invalid');
  await assert.rejects(verifyAck(tampered),/BANK_ACK_SIGNATURE_INVALID/);
  await assert.rejects(verifyAck(input({event_id:crypto.randomUUID(),status:'APPLIED',active_aggregate_version:1})),/BANK_ACK_INVALID/);
});

test('REGRESSION B07: retired Control visibility does not turn decision/ACK into public claims',async()=>{
  // User decision 2026-10-05 retired this capability; do not restore the old HTTP probe.
  const {reviewSummarySchema}=await import(pathToFileURL(resolve(controlRoot,'src/domain/review-read-contract.ts')).href);
  for(const key of ['publicEvidence','publicObservation','publicVisibility'])assert.equal(Object.hasOwn(reviewSummarySchema.shape,key),false);
  for(const file of ['src/server/reviews.ts','components/reviews/review-detail.tsx','components/reviews/review-list.tsx']){
    assert.doesNotMatch(readFileSync(resolve(controlRoot,file),'utf8'),/publicVisibility|publicEvidence|publicObservation|Pemeriksaan publik terakhir|Tampil saat dicek/);
  }
  const migration=readFileSync(resolve(controlRoot,'migrations/0016_retire_identity_and_public_observation.sql'),'utf8');
  assert.match(migration,/SET SCHEMA control_audit_archive/);
  assert.doesNotMatch(migration,/DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('COMPAT actual SJ signed monitoring response accepted by actual Control verifier; rejects replay/tamper',async()=>{
  const now=new Date(), seen=new Set(),responseHeaders={};
  let body,status,error;
  const handler=createControlMonitoringHandler({
    config:{nodeEnv:'test',flags:{controlMonitoring:true},security:{nonceTtlSeconds:600,signatureToleranceSeconds:300},controlMonitoring:{instanceId:institution,keyId:'control-test',publicKey:publicPem,responseKeyId:'sj-test',responsePrivateKey:privatePem,audience:'test',frontendUrl:'http://127.0.0.1:4310',probeTimeoutMs:100,workerHeartbeatKey:'test'}},
    databases:{registry:{$queryRaw:async()=>[{value:1}]},ops:{centralJob:{groupBy:async()=>[{state:'PENDING',_count:{_all:2}}]}}},
    runtime:{reserveNonce:async key=>{if(seen.has(key))return false;seen.add(key);return true;},readWorkerHeartbeat:async()=>JSON.stringify({version:1,instance_id:institution,status:'PROCESSING_CAPABLE',observed_at:now.toISOString()})},
    fetcher:async()=>new Response('<html></html>'),now:()=>now,
  });
  const nonce=crypto.randomUUID(),digest=control.sha256Hex(''),timestamp=now.toISOString();
  const signature=control.signTransport(control.createTransportSigningMessage({method:'GET',path:CONTROL_MONITORING_PATH,timestamp,nonce,contentSha256:digest}),privatePem);
  const headers={'x-rc-instance-id':institution,'x-rc-key-id':'control-test','x-rc-audience':'test','x-rc-timestamp':timestamp,'x-rc-nonce':nonce,'x-rc-content-sha256':digest,'x-rc-signature':signature};
  const request={get:key=>headers[key]};
  const response={set:values=>Object.assign(responseHeaders,values),status:value=>{status=value;return response;},send:value=>{body=value;}};
  await handler(request,response,e=>{error=e;});
  assert.equal(error,undefined);assert.equal(status,200);
  const input={response:new Response(body,{status,headers:responseHeaders}),bodyText:body,source:{instanceId:institution,sourceKind:'sj_central',responseKeyId:'sj-test',responsePublicKey:publicPem},path:CONTROL_MONITORING_PATH,now};
  const verified=monitoring.verifyMonitoringSnapshotResponse(input);
  assert.equal(verified.snapshot.services.find(s=>s.key==='worker').status,'healthy');
  assert.equal(verified.snapshot.queues[0].depth,2);
  assert.throws(()=>monitoring.verifyMonitoringSnapshotResponse({...input,bodyText:body.replace('"depth":2','"depth":3')}));
  assert.throws(()=>monitoring.verifyMonitoringSnapshotResponse({...input,source:{...input.source,instanceId:crypto.randomUUID()}}));
  assert.throws(()=>monitoring.verifyMonitoringSnapshotResponse({...input,now:new Date(now.getTime()+301000)}));
  await handler(request,response,e=>{error=e;});
  assert.equal(error.code,'CONTROL_MONITORING_REPLAYED');
});
