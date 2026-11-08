import assert from 'node:assert/strict';
import { randomUUID, generateKeyPairSync, randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import pino from 'pino';
import request from 'supertest';
import { createContentSha256, createSigningMessage, INTEGRATION_HEADERS as H, signIntegrationMessage, payloadChecksum, PUBLICATION_CATEGORIES } from '@seputarjaminan/contracts';
import { FilesystemStorageAdapter } from '@seputarjaminan/storage';
import { createApp } from '../../src/app.ts';
import { createDatabaseClients } from '../../src/database.ts';
import { OpsService } from '../../src/ops-service.ts';
import { RedisFixedWindowRateLimiter } from '../../src/rate-limit.ts';
import { createWorkerDatabase } from '../../../worker/src/database.ts';
import { CentralWorker } from '../../../worker/src/worker.ts';
import { createMalwareScanner } from '../../../worker/src/malware-scanner.ts';
import { verifyDisposableDatabase } from './disposable-target.ts';
import { verifyRealLocalServices } from './real-local-services.ts';
import { assetWhatsappHref } from '../../../../app/lib/public-whatsapp.ts';

// Deliberately separate from TEST_SAFE CI tests: this suite requires verified
// local Redis/ClamAV/storage and real scoped PostgreSQL roles. No SQL business
// status updates, fallback fixtures, network WhatsApp requests or global cleanup.
export async function verifyCentralServices({ owner, urls, apiOrigin, websiteOrigin, check, verifyHtml, retain }) {
  await verifyDisposableDatabase(owner);
  const services = await verifyRealLocalServices(owner);
  assert.ok(services, 'Real scanner and owned storage are mandatory');
  const db = createDatabaseClients({registryDatabaseUrl:urls.registry,ingestDatabaseUrl:urls.ingest,publicDatabaseUrl:urls.public,opsDatabaseUrl:urls.ops});
  const workerDb = createWorkerDatabase(urls.worker);
  const storage = new FilesystemStorageAdapter({root:services.storageBase});
  const scanner = createMalwareScanner({mode:'CLAMAV',command:'clamdscan',dockerContainer:services.dockerContainer});
  let logs = '';
  const logger = pino({level:'info'}, new Writable({write(chunk, _encoding, done) { logs += chunk.toString(); done(); }}));
  const limiter = new RedisFixedWindowRateLimiter(services.redisUrl);
  const worker = new CentralWorker(workerDb,storage,scanner,logger,10485760);
  const config = {nodeEnv:'development',publicApiBaseUrl:apiOrigin,publicMediaBaseUrl:apiOrigin+'/v1/public/media',uploadSessionTtlSeconds:300,storage:{provider:'FILESYSTEM'},security:{eventBodyMaxBytes:262144,signatureToleranceSeconds:300,nonceTtlSeconds:600,mediaFileMaxBytes:10485760,mediaTotalMaxBytes:52428800,opsEncryptionKeyBase64:randomBytes(32).toString('base64'),opsSessionSecret:randomBytes(32).toString('hex')},rateLimit:{ingestPerMinute:60,publicPerMinute:600,opsAuthPerMinute:10},flags:{ingest:true,mediaUpload:true,publicSite:true}};
  const app = createApp({config,databases:db,storage,ingestLimiter:limiter,publicLimiter:limiter,logger});
  const server = app.listen(Number(new URL(apiOrigin).port),'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const ops = new OpsService(db), institutions = [], assets = [];
  const principal = {id:randomUUID(),email:randomUUID()+'@example.invalid',displayName:'OPS08 isolated audit',sessionId:randomUUID()};
  const secrets = [config.security.opsEncryptionKeyBase64,config.security.opsSessionSecret,...Object.values(urls),services.redisUrl];
  const canary = 'SJPRIVATE'+randomBytes(8).toString('hex');
  const now = () => new Date().toISOString(), pause = ms=>new Promise(r=>setTimeout(r,ms));
  const assertPrivate = value => {
    const text = typeof value==='string'?value:JSON.stringify(value);
    for(const token of [canary,services.storageBase,...secrets]) assert.ok(!text.includes(token),'Private sentinel/credential must not escape');
    assert.doesNotMatch(text,/"(?:legal_name_internal|original_object_key|delivery_object_key|password_hash|source_contact_id|source_publication_id|private_key|installation_id|nonce_hash)"\s*:/);
  };
  async function send(inst,method,path,body) {
    await pause(Math.max(0,1100-(Date.now()-(inst.last||0)))); inst.last=Date.now();
    const text=body===undefined?'':JSON.stringify(body),timestamp=now(),nonce=randomUUID(),digest=createContentSha256(text);
    const signature=signIntegrationMessage(createSigningMessage({method,path,timestamp,nonce,contentSha256:digest}),inst.keys.privateKey);
    secrets.push(signature);
    const r=request(server)[method.toLowerCase()](path).set({'Content-Type':'application/json',[H.institutionId]:inst.id,[H.keyId]:inst.keyId,[H.timestamp]:timestamp,[H.nonce]:nonce,[H.contentSha256]:digest,[H.signature]:signature});
    return body===undefined?r:r.send(text);
  }
  const envelope=(inst,type,id,payload,version=1)=>({event_id:randomUUID(),schema_version:1,event_type:type,institution_id:inst.id,aggregate_id:id,aggregate_version:version,occurred_at:now(),payload_checksum:payloadChecksum(payload),payload});
  async function event(inst,type,id,payload,version=1,expected=200) {
    const r=await send(inst,'POST','/v1/ingest/events',envelope(inst,type,id,payload,version));
    assert.equal(r.status,expected,`Ingest ${type}: ${r.body.code||r.status}`);assertPrivate(r.body);return r.body;
  }
  async function drain() { for(let n=0;n<100;n++) if(!await worker.runOnce()) return; throw Error('Queue did not drain'); }
  async function publicGet(path,expected=200) { const r=await request(server).get(path);assert.equal(r.status,expected,`Public ${path}: ${r.status}`);if(!r.headers['content-type']?.includes('image/'))assertPrivate(r.body);return r; }
  async function upload(inst,publicationId=null,portrait=false) {
    const width=portrait?480:960,height=portrait?720:540;
    const bytes=await sharp({create:{width,height,channels:3,background:'#CBD6BF'}}).png().toBuffer();
    const r=await send(inst,'POST','/v1/media/upload-sessions',{institution_id:inst.id,publication_id:publicationId,source_media_id:randomUUID(),sha256:createContentSha256(bytes),detected_mime:'image/png',size_bytes:bytes.length,width,height,purpose:publicationId?'PUBLICATION_IMAGE':'BPRS_PUBLIC_MARK',requested_ttl_seconds:300});
    assert.equal(r.status,201,`Upload session: ${r.body.code}`);const session=r.body;
    secrets.push(...Object.values(session.headers));
    await publicGet('/v1/public/media/'+session.media_id,404);
    assert.equal((await request(server).put(new URL(session.upload_url).pathname).set(session.headers).send(bytes)).status,204);
    assert.equal((await send(inst,'POST',`/v1/media/upload-sessions/${session.upload_session_id}/complete`,{media_id:session.media_id})).status,202);
    await drain();
    const status=await send(inst,'GET',`/v1/media/${session.media_id}/status`);
    assert.equal(status.status,200);assert.equal(status.body.state??status.body.status,'READY');
    return {id:session.media_id,checksum:createContentSha256(bytes),session};
  }
  async function visible(asset,expected) {
    await publicGet('/v1/public/assets/'+asset.snapshot.reference_code,expected?200:404);
    const list=await publicGet('/v1/public/assets?institution='+asset.inst.slug+'&q=OPS08');
    assert.equal(list.body.items.some(i=>i.reference_code===asset.snapshot.reference_code),expected);
    const showcase=await publicGet('/v1/public/showcase');
    assert.equal(showcase.headers['cache-control'],'no-store');
    if(!expected)assert.ok(!showcase.body.items.some(i=>i.reference_code===asset.snapshot.reference_code),'Ineligible asset must not return through showcase');
    await publicGet('/v1/public/media/'+asset.photos[0].id,expected?200:404);
  }
  async function publish(asset) { await event(asset.inst,'UPSERT_PUBLICATION_SNAPSHOT',asset.id,asset.snapshot,++asset.version); await drain(); }
  async function unpublish(asset) {await event(asset.inst,'UNPUBLISH_PUBLICATION',asset.id,{publication_id:asset.id,institution_id:asset.inst.id,reason_code:'OPS08_TEST',unpublished_at:now()},++asset.version);await drain();}
  try {
    await check('actual five runtime roles are scoped, not owner/superuser/BYPASSRLS',async()=>{
      for(const client of [db.registry,db.ingest,db.publicRead,db.ops,workerDb]){const [r]=await client.$queryRaw`SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`;assert.equal(r.rolsuper,false);assert.equal(r.rolbypassrls,false);}
    });
    await check('real ClamAV clean probe and EICAR rejection, no TEST_SAFE',async()=>{
      await scanner.verifyReady();
      const probe=Buffer.from(['X5O!P%@AP[4\\PZX54(P^)7CC)7}$','EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join(''));
      await assert.rejects(scanner.scan(probe),e=>e.code==='MALWARE_DETECTED');
    });
    // Bootstrap an unusable audit principal, not a bank administrator/login.
    await owner.query("INSERT INTO ops_users(id,email_normalized,display_name,password_hash,state,created_at,updated_at) VALUES($1,$2,'OPS08 no-login audit principal','not-a-login-hash','REVOKED',now(),now())",[principal.id,principal.email]);
    await check('two institutions onboarded by ops service, distinct signing keys and contacts',async()=>{
      for(let n=0;n<2;n++){
        const keys=generateKeyPairSync('ed25519'),keyId=randomUUID(),slug='ops08-'+randomUUID();
        const r=await ops.onboard({legal_name_internal:canary+'LEGAL'+n,public_slug:slug,installation_name:canary+'INSTALL'+n,public_key:keys.publicKey.export({type:'spki',format:'pem'}).toString(),key_id:keyId},principal,randomUUID());
        institutions.push({id:r.subject_id,keys,keyId,slug,contact:randomUUID(),phone:'+62811111008'+n,pv:1,cv:1});
      }
      await retain({principal:principal.id,institutions:institutions.map(i=>({id:i.id,slug:i.slug}))});
    });
    await check('logo upload to real READY, signed public profile and verified contact',async()=>{
      for(const [n,inst] of institutions.entries()){
        inst.logo=await upload(inst,null,n===1);
        inst.profile={institution_id:inst.id,public_name:'OPS08 BPRS Uji '+(n+1),public_mark:inst.logo.id,short_description:'Data tes integrasi terisolasi, bukan penawaran nyata.',office_city_regency:n?'Bandung':'Semarang',office_province:n?'Jawa Barat':'Jawa Tengah',profile_updated_at:now()};
        await event(inst,'UPSERT_BPRS_PROFILE',inst.id,inst.profile);
        inst.contactPayload={whatsapp_contact_id:inst.contact,institution_id:inst.id,phone_e164:inst.phone,status:'VERIFIED',template_version:1,verified_at:now()};
        await event(inst,'UPSERT_WHATSAPP_CONTACT',inst.contact,inst.contactPayload);
      }
    });
    const attrs={TANAH:{land_area_m2:175,contour:'DATAR'},BANGUNAN:{building_area_m2:80},MESIN_PERALATAN:{model_or_type:'Mesin uji',public_condition:'BAIK'},KENDARAAN:{brand:'Merek uji',model_or_type:'Model uji',mileage_km:0,public_condition:'BAIK'}};
    await check('eight publications, four categories each tenant, real photo processing and search projection',async()=>{
      for(const inst of institutions)for(const [category,attributes] of Object.entries(attrs)){
        const id=randomUUID(),photos=[await upload(inst,id,category==='BANGUNAN')];
        if(category==='KENDARAAN')photos.push(await upload(inst,id,true));
        const snapshot={publication_id:id,reference_code:'SJ-'+randomUUID().replaceAll('-','').slice(0,8).toUpperCase(),institution_id:inst.id,taxonomy_version:1,category,subcategory:PUBLICATION_CATEGORIES[category][0],title:'OPS08 '+category+' aset uji '+inst.slug.slice(-6),description:'Hanya untuk pembuktian integrasi lokal. Bukan publikasi operasional.',location:{city_regency:inst.profile.office_city_regency,province:inst.profile.office_province},availability:'AVAILABLE',attributes,media:photos.map((p,n)=>({media_id:p.id,checksum:p.checksum,position:n+1,is_cover:n===0,alt_text:'Foto tes '+(n+1)})),whatsapp_contact_id:inst.contact,published_at:now(),public_updated_at:now(),availability_confirmed_at:now()};
        snapshot.next_confirmation_at=new Date(Date.parse(snapshot.availability_confirmed_at)+30*86400000).toISOString();
        const asset={inst,id,photos,snapshot,version:0};assets.push(asset);await publish(asset);await visible(asset,true);
      }
      await retain({assets:assets.map(a=>({id:a.id,reference:a.snapshot.reference_code,institution:a.inst.id}))});
    });
    await check('public showcase samples all eight eligible assets without duplication or internal fields',async()=>{
      const r=await publicGet('/v1/public/showcase');
      assert.equal(r.body.next_cursor,null);
      assert.deepEqual(r.body.items.map(i=>i.reference_code).sort(),assets.map(a=>a.snapshot.reference_code).sort());
      for(const item of r.body.items)assert.deepEqual(Object.keys(item).sort(),['reference_code','title','category','subcategory','location','cover','institution','availability','photo_count','public_updated_at','summary_attributes'].sort());
      for(const query of ['limit=1','cursor=invalid','category=TANAH'])await publicGet('/v1/public/showcase?'+query,400);
    });
    await check('public DTO exact allowlist, category attributes, zero mileage, gallery, configured WhatsApp',async()=>{
      const cardKeys=['reference_code','title','category','subcategory','location','cover','institution','availability','photo_count','public_updated_at','summary_attributes'];
      const exact=(object,keys)=>assert.deepEqual(Object.keys(object).sort(),[...keys].sort());
      for(const asset of assets){
        const r=await publicGet('/v1/public/assets/'+asset.snapshot.reference_code),d=r.body;
        exact(d,[...cardKeys,'description','attributes','media','whatsapp_url']);exact(d.location,['city_regency','province']);exact(d.institution,['public_slug','public_name','public_mark_url']);exact(d.cover,['url','width','height','alt_text']);
        assert.deepEqual(d.attributes,asset.snapshot.attributes);assert.equal(d.photo_count,asset.photos.length);for(const m of d.media)exact(m,['url','width','height','alt_text']);
        const wa=new URL(d.whatsapp_url);assert.equal(wa.origin,'https://wa.me');assert.equal(wa.pathname,'/'+asset.inst.phone.slice(1));assert.ok(wa.searchParams.get('text').includes(asset.snapshot.reference_code));
        const publicWa=new URL(assetWhatsappHref(d.whatsapp_url,d.title,d.reference_code,websiteOrigin));
        assert.equal(publicWa.pathname,wa.pathname);assert.ok(publicWa.searchParams.get('text').includes(websiteOrigin+'/aset/'));assert.ok(!publicWa.searchParams.get('text').includes(apiOrigin));
        if(d.category==='KENDARAAN')assert.equal(d.summary_attributes.mileage_km,0);
        for(const photo of asset.photos)for(const variant of ['main','card','thumb']){const media=await publicGet('/v1/public/media/'+photo.id+'?variant='+variant);assert.match(media.headers['content-type'],/image\/webp/);assert.match(media.headers['cache-control'],/no-store/);}
      }
      const list=await publicGet('/v1/public/assets?q=OPS08');exact(list.body,['items','next_cursor']);for(const card of list.body.items)exact(card,cardKeys);assert.equal(list.body.items.length,8);
    });
    await check('combined filters, case-normalized province, bounded deterministic pagination and no invented total',async()=>{
      const inst=institutions[0];const combined=await publicGet('/v1/public/assets?category=KENDARAAN&institution='+inst.slug+'&province=jawa%20tengah&q=OPS08');assert.equal(combined.body.items.length,1);
      for(const sort of ['NEWEST','OLDEST']){let cursor=null;const seen=[];do{const r=await publicGet('/v1/public/assets?q=OPS08&limit=3&sort='+sort+(cursor?'&cursor='+encodeURIComponent(cursor):''));seen.push(...r.body.items.map(i=>i.reference_code));cursor=r.body.next_cursor;assert.ok(seen.length<=8);}while(cursor);assert.equal(seen.length,8);assert.equal(new Set(seen).size,8);}
      const dir=await publicGet('/v1/public/institutions?q=OPS08');assert.equal(dir.body.items.length,2);assert.ok(dir.body.items.every(i=>i.published_asset_count===4));
      const institutionKeys=['public_slug','public_name','public_mark_url','short_description','office_city_regency','office_province','published_asset_count'].sort();
      for(const row of dir.body.items){assert.deepEqual(Object.keys(row).sort(),institutionKeys);const profile=await publicGet('/v1/public/institutions/'+row.public_slug);assert.deepEqual(Object.keys(profile.body).sort(),institutionKeys);}
      const taxonomy=await publicGet('/v1/public/taxonomy');assert.deepEqual(taxonomy.body.categories,PUBLICATION_CATEGORIES);
      const first=await publicGet('/v1/public/institutions?q=OPS08&limit=1');assert.ok(first.body.next_cursor);const next=await publicGet('/v1/public/institutions?q=OPS08&limit=1&cursor='+encodeURIComponent(first.body.next_cursor));assert.equal(next.body.items.length,1);assert.notEqual(first.body.items[0].public_slug,next.body.items[0].public_slug);
      for(const query of ['category=INVALID','cursor=not-valid','sort=PRICE','limit=0','q[x]=private'])await publicGet('/v1/public/assets?'+query,400);
      assert.equal((await publicGet('/v1/public/assets?q=definitely-no-match-ops08')).body.items.length,0);
    });
    await check('normal production Next HTML and media proxy contain public data, no internal canaries',async()=>{await verifyHtml({apiOrigin,websiteOrigin,institutions,assets,assertPrivate});});
    await check('signed tenant cannot read/complete another tenant media or reuse foreign contact/photo/logo',async()=>{
      const [a,b]=institutions,own=assets[0],foreign=assets.find(x=>x.inst===b);
      assert.equal((await send(b,'GET','/v1/media/'+own.photos[0].id+'/status')).status,404);
      assert.equal((await send(b,'POST','/v1/media/upload-sessions/'+own.photos[0].session.upload_session_id+'/complete',{media_id:own.photos[0].id})).status,404);
      for(const changes of [{whatsapp_contact_id:b.contact},{media:[{...own.snapshot.media[0],media_id:foreign.photos[0].id}]},{media:[{...own.snapshot.media[0],media_id:a.logo.id}]}])await event(a,'UPSERT_PUBLICATION_SNAPSHOT',own.id,{...own.snapshot,...changes},own.version+1,409);
      await event(a,'UPSERT_BPRS_PROFILE',a.id,{...a.profile,public_mark:b.logo.id},a.pv+1,409);await visible(own,true);await visible(foreign,true);
    });
    await check('private endpoints, original media and sensitive malformed input do not leak',async()=>{
      const photo=assets[0].photos[0];await publicGet('/v1/media/'+photo.id+'/status',401);await publicGet('/v1/ops/health',401);
      for(const path of ['/v1/ops/quarantines','/v1/ops/jobs/'+randomUUID()+'/retry'])assert.equal((await send(institutions[0],'POST',path,{reason_code:canary})).status,401);
      await publicGet('/v1/public/media/'+photo.id+'?variant=original',400);await publicGet('/institutions/'+institutions[0].id+'/media/'+photo.id+'/original',404);
      const bad=await request(server).post('/v1/ingest/events').set('Content-Type','application/json').set('Authorization','Bearer '+canary).set('X-Private',canary).send('{"password":"'+canary+'",');assert.equal(bad.status,400);assert.equal(bad.body.code,'JSON_INVALID');assert.equal(bad.body.retryable,false);assertPrivate(bad.body);
      const query=await request(server).get('/v1/public/assets?password='+canary);assert.equal(query.status,400);assertPrivate(query.body);assertPrivate(logs);
    });
    const a=institutions[0],other=assets.find(x=>x.inst!==a),own=assets.filter(x=>x.inst===a);
    await check('hidden profile blocks assets/search/logo; second tenant remains public',async()=>{
      await event(a,'HIDE_BPRS_PROFILE',a.id,{institution_id:a.id,reason_code:'OPS08_TEST',hidden_at:now()},++a.pv);for(const asset of own)await visible(asset,false);await publicGet('/v1/public/institutions/'+a.slug,404);await publicGet('/v1/public/media/'+a.logo.id,404);await visible(other,true);
      await event(a,'UPSERT_BPRS_PROFILE',a.id,a.profile,++a.pv);for(const asset of own)await visible(asset,true);
    });
    await check('suspended institution blocks signed and public paths without affecting second tenant',async()=>{
      await ops.setInstitutionState(a.id,'SUSPENDED',{reason_code:'OPS08_TEST'},principal,randomUUID());for(const asset of own)await visible(asset,false);await publicGet('/v1/public/media/'+a.logo.id,404);assert.equal((await send(a,'GET','/v1/media/'+a.logo.id+'/status')).status,401);await visible(other,true);await ops.setInstitutionState(a.id,'ACTIVE',{},principal,randomUUID());
    });
    await check('publication quarantine excludes JSON, search and already accessed media',async()=>{
      const row=(await owner.query('SELECT id FROM publications WHERE source_publication_id=$1',[own[0].id])).rows[0];const q=await ops.quarantine({institution_id:a.id,subject_type:'PUBLICATION',subject_id:row.id,reason_code:'OPS08_TEST'},principal,randomUUID());await visible(own[0],false);await visible(other,true);await ops.resolveQuarantine(q.subject_id,principal,randomUUID());await visible(own[0],true);
    });
    await check('profile quarantine blocks profile/logo and all its assets, with tenant isolation',async()=>{
      const row=(await owner.query('SELECT id FROM bprs_profiles WHERE institution_id=$1',[a.id])).rows[0];const q=await ops.quarantine({institution_id:a.id,subject_type:'PROFILE',subject_id:row.id,reason_code:'OPS08_TEST'},principal,randomUUID());
      await publicGet('/v1/public/institutions/'+a.slug,404);await publicGet('/v1/public/media/'+a.logo.id,404);for(const asset of own)await visible(asset,false);await visible(other,true);await ops.resolveQuarantine(q.subject_id,principal,randomUUID());for(const asset of own)await visible(asset,true);
    });
    await check('media quarantine and revoke invalidate cached API/proxy URL; resolution cannot resurrect',async()=>{
      const asset=own[0],photo=asset.photos[0];const q=await ops.quarantine({institution_id:a.id,subject_type:'MEDIA',subject_id:photo.id,reason_code:'OPS08_TEST'},principal,randomUUID());await visible(asset,false);
      await event(a,'REVOKE_MEDIA',photo.id,{institution_id:a.id,media_id:photo.id,reason_code:'OPS08_TEST',revoked_at:now()});await ops.resolveQuarantine(q.subject_id,principal,randomUUID());await visible(asset,false);
      const proxy=await fetch(websiteOrigin+'/media/'+photo.id);assert.equal(proxy.status,404);assert.match(proxy.headers.get('cache-control'),/no-store/);assertPrivate(await proxy.text());await visible(other,true);
    });
    await check('contact revoke withdraws all assets; verification alone never republishes',async()=>{
      await event(a,'REVOKE_WHATSAPP_CONTACT',a.contact,{whatsapp_contact_id:a.contact,institution_id:a.id,status:'REVOKED',reason_code:'OPS08_TEST',revoked_at:now()},++a.cv);for(const asset of own)await visible(asset,false);await visible(other,true);
      await event(a,'UPSERT_WHATSAPP_CONTACT',a.contact,a.contactPayload,++a.cv);for(const asset of own)await visible(asset,false);await publish(own[1]);await visible(own[1],true);
    });
    await check('confirmation expires naturally, no SQL state manipulation; search/detail/media deny immediately',async()=>{
      const asset=own[1],deadline=Date.now()+6500;asset.snapshot.availability_confirmed_at=new Date(deadline-30*86400000).toISOString();asset.snapshot.next_confirmation_at=new Date(deadline).toISOString();await publish(asset);await visible(asset,true);await pause(Math.max(0,deadline-Date.now()+50));await visible(asset,false);await visible(other,true);
    });
    await check('unpublish and archive withdraw second tenant; archive preserves rows',async()=>{
      for(const asset of assets.filter(x=>x.inst!==a)){await unpublish(asset);await visible(asset,false);await event(asset.inst,'ARCHIVE_PUBLICATION',asset.id,{institution_id:asset.inst.id,publication_id:asset.id,archived_at:now()},++asset.version);assert.equal((await owner.query('SELECT state FROM publications WHERE source_publication_id=$1',[asset.id])).rows[0].state,'ARCHIVED');}
      await drain();assert.equal((await publicGet('/v1/public/assets?q=OPS08')).body.items.length,0);
    });
    await check('revoked public mark cannot be served from API or website proxy after prior access',async()=>{
      await event(a,'REVOKE_MEDIA',a.logo.id,{institution_id:a.id,media_id:a.logo.id,reason_code:'OPS08_TEST',revoked_at:now()});await publicGet('/v1/public/media/'+a.logo.id,404);
      const proxy=await fetch(websiteOrigin+'/media/'+a.logo.id);assert.equal(proxy.status,404);assert.match(proxy.headers.get('cache-control'),/no-store/);assertPrivate(await proxy.text());
    });
    await check('all real worker jobs completed, no false success or unfinished queue; logs contain no payload/secrets',async()=>{
      const jobs=(await owner.query("SELECT state,count(*)::int n FROM central_jobs WHERE institution_id=ANY($1::uuid[]) GROUP BY state",[institutions.map(i=>i.id)])).rows;
      assert.ok(jobs.length>0);assert.ok(jobs.every(r=>r.state==='COMPLETED'));assertPrivate(logs);await retain({jobs,logRecords:logs.trim().split('\n').length});
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));await limiter.disconnect();await db.disconnect();await workerDb.$disconnect();
  }
}
