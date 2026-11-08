import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Explicit local-only target file; never consume DATABASE_URL or root dotenv.
const targetFile = process.env.SJ_OPS02_TARGET_FILE;
assert.ok(targetFile, 'SJ_OPS02_TARGET_FILE is mandatory; no runtime URL fallback');
const target = JSON.parse(readFileSync(targetFile));
assert.match(target.database, /^sj_ops02_[0-9]{8}(?:_fresh)?$/);
assert.match(target.container, /^sj-ops02-pg-[0-9]{8}$/);
assert.equal(target.port, 55482);
assert.match(target.marker, /^[a-f0-9]{48}$/);
const info = JSON.parse(execFileSync('docker', ['inspect', target.container], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'], windowsHide: true }))[0];
assert.equal(info.Config.Labels['sj.ops02.marker'], target.marker);
assert.equal(info.State.Running, true);
assert.equal(info.Mounts.length, 1);
assert.equal(info.Mounts[0].Name, target.volume);
assert.deepEqual(info.HostConfig.PortBindings['5432/tcp'], [{HostIp:'127.0.0.1',HostPort:String(target.port)}]);
const report = { target: {database:target.database,port:target.port,container:target.container}, checks:[], plans:[] };
const clients = {};
function quote(s) { assert.match(s,/^[a-z_][a-z0-9_]*$/); return `"${s}"`; }
async function check(name, fn) {
  try { const detail=await fn(); report.checks.push({name,pass:true,...(detail ? {detail} : {})}); console.log(`PASS ${name}`); }
  catch(error) { report.checks.push({name,pass:false,code:error.code || error.name,actualCode:error.actual?.code,operator:error.operator,case:error.testCase}); console.log(`FAIL ${name} (${error.code || error.name}, ${error.actual?.code||''}, ${error.testCase||''})`); }
}
async function rejected(client, sql, params, code) {
  await client.query('SAVEPOINT negative_case');
  try { await assert.rejects(client.query(sql,params), error=>error.code===code); }
  finally { await client.query('ROLLBACK TO SAVEPOINT negative_case'); await client.query('RELEASE SAVEPOINT negative_case'); }
}
async function transaction(client, fn, tenant) {
  await client.query('BEGIN');
  try { if(tenant) await client.query("SELECT set_config('app.current_institution_id',$1,true)",[tenant]); await fn(); }
  finally { await client.query('ROLLBACK'); }
}
try {
  for (const [scope,value] of Object.entries(target.urls)) {
    const url=new URL(value);
    assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,String(target.port)); assert.equal(url.pathname,`/${target.database}`);
    assert.equal(url.search,'');
    const client=new pg.Client({connectionString:value,connectionTimeoutMillis:5000,options:'-c statement_timeout=20000 -c lock_timeout=3000'});
    await client.connect(); clients[scope]=client;
    assert.equal((await client.query('SELECT current_database() AS db')).rows[0].db,target.database);
    assert.equal((await client.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker,`OPS02:${target.marker}`);
  }
  const owner=clients.owner;
  assert.equal((await owner.query('SELECT system_identifier::text id FROM pg_control_system()')).rows[0].id,target.systemIdentifier);
  const count=(await owner.query('SELECT count(*)::int n FROM institutions')).rows[0].n;
  if(count===0) {
    await owner.query('BEGIN');
    try { await owner.query(readFileSync(new URL('../tests/fixtures/ops02-database.sql',import.meta.url),'utf8')); await owner.query('COMMIT'); }
    catch(error) { await owner.query('ROLLBACK'); throw error; }
  }
  assert.equal((await owner.query('SELECT count(*)::int n FROM institutions')).rows[0].n,200);
  assert.equal((await owner.query('SELECT count(*)::int n FROM publications')).rows[0].n,10000);
  const [a,b]=(await owner.query("SELECT id FROM institutions WHERE public_slug IN ('ops02-bank-001','ops02-bank-002') ORDER BY public_slug")).rows.map(r=>r.id);
  const ids={};
  for(const [name,id] of [['a',a],['b',b]]) {
    ids[name]=(await owner.query(`SELECT i.id institution, k.key_id key, k.installation_id installation, b.id profile, b.public_mark_media_id media,
      p.id publication,p.whatsapp_contact_id contact FROM institutions i JOIN institution_keys k ON k.institution_id=i.id
      JOIN bprs_profiles b ON b.institution_id=i.id JOIN publications p ON p.institution_id=i.id
      WHERE i.id=$1 AND p.title LIKE 'lahan langka%'`,[id])).rows[0];
  }
  await check('all runtime roles nonprivileged, single membership, no ownership/schema-create or role escalation',async()=>{
    for(const scope of ['registry','ingest','public','ops','worker']) {
      const c=clients[scope];
      const r=(await c.query("SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=current_user")).rows[0];
      assert.ok(Object.values(r).every(v=>v===false));
      const memberships=(await c.query("SELECT r.rolname FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE u.rolname=current_user")).rows;
      assert.deepEqual(memberships.map(r=>r.rolname),[`sj_${scope}`]);
      const effective=(await c.query("SELECT rolname FROM pg_roles WHERE pg_has_role(current_user,oid,'MEMBER') ORDER BY rolname")).rows.map(r=>r.rolname);
      assert.deepEqual(effective,[`sj_ci_${scope}`,`sj_${scope}`].sort());
      const group=(await c.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=$1',[`sj_${scope}`])).rows[0];
      assert.ok(Object.values(group).every(v=>v===false));
      assert.equal((await c.query("SELECT count(*)::int n FROM pg_class WHERE relnamespace='public'::regnamespace AND pg_has_role(current_user,relowner,'MEMBER')")).rows[0].n,0);
      assert.equal((await c.query("SELECT has_schema_privilege(current_user,'public','CREATE') c")).rows[0].c,false);
      await transaction(c,async()=>{await rejected(c,'SET ROLE ops02_owner',[], '42501');});
    }
  });
  await check('all business tables FORCE RLS; only migration owner owns schema objects',async()=>{
    const rows=(await owner.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname<>'_prisma_migrations'")).rows;
    assert.equal(rows.length,28); assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity&&r.owner==='ops02_owner'));
    report.tables=rows;
  });
  for(const scope of ['registry','ingest']) {
    await check(`${scope}: no tenant context exposes zero private rows`,async()=>{
      assert.equal((await clients[scope].query('SELECT count(*)::int n FROM institutions')).rows[0].n,0);
      assert.equal((await clients[scope].query('SELECT count(*)::int n FROM institution_keys')).rows[0].n,0);
    });
    await check(`${scope}: A/B context reads only its institution and transaction rollback clears context`,async()=>{
      for(const id of [a,b]) await transaction(clients[scope],async()=>{
        assert.deepEqual((await clients[scope].query('SELECT id FROM institutions')).rows.map(r=>r.id),[id]);
        assert.equal((await clients[scope].query('SELECT count(*)::int n FROM institution_keys WHERE institution_id<>$1',[id])).rows[0].n,0);
      },id);
      assert.equal((await clients[scope].query('SELECT count(*)::int n FROM institutions')).rows[0].n,0);
    });
  }
  await check('registry rejects writes and tables outside authentication scope',()=>transaction(clients.registry,async()=>{
    for(const table of ['publications','media_objects','ops_users','central_jobs','public_search_documents']) await rejected(clients.registry,`SELECT * FROM ${quote(table)}`,[],'42501');
    await rejected(clients.registry,'UPDATE institutions SET updated_at=now() WHERE id=$1',[a],'42501');
  },a));
  await check('ingest rejects cross-tenant INSERT and cannot UPDATE/DELETE tenant B',()=>transaction(clients.ingest,async()=>{
    await rejected(clients.ingest,`INSERT INTO aggregate_cursors(id,institution_id,aggregate_type,aggregate_id,aggregate_version,expected_state,payload_checksum,updated_at) VALUES(gen_random_uuid(),$1,'PUBLICATION',gen_random_uuid(),1,'PUBLISHED',repeat('a',64),now())`,[b],'42501');
    assert.equal((await clients.ingest.query('UPDATE publications SET title=title WHERE institution_id=$1',[b])).rowCount,0);
    assert.equal((await clients.ingest.query('DELETE FROM land_details WHERE institution_id=$1',[b])).rowCount,0);
    assert.equal((await clients.ingest.query('UPDATE publications SET title=title WHERE id=$1',[ids.a.publication])).rowCount,1);
  },a));
  await check('ingest without tenant cannot insert or update business data',()=>transaction(clients.ingest,async()=>{
    await rejected(clients.ingest,`INSERT INTO aggregate_cursors(id,institution_id,aggregate_type,aggregate_id,aggregate_version,expected_state,payload_checksum,updated_at) VALUES(gen_random_uuid(),$1,'PUBLICATION',gen_random_uuid(),1,'PUBLISHED',repeat('a',64),now())`,[a],'42501');
    assert.equal((await clients.ingest.query('UPDATE publications SET title=title')).rowCount,0);
  }));
  await check('public rejects INSERT/UPDATE/DELETE and private table reads despite tenant context',()=>transaction(clients.public,async()=>{
    for(const statement of ['INSERT INTO publications(id) VALUES(gen_random_uuid())','UPDATE publications SET title=title','DELETE FROM publications','SELECT * FROM institution_keys','SELECT * FROM ops_users','SELECT * FROM ingest_events']) await rejected(clients.public,statement,[],'42501');
  },a));
  await check('public sees only allowed state/availability/reconfirmation rows',async()=>{
    const actual=(await clients.public.query('SELECT count(*)::int n FROM publications')).rows[0].n;
    const expected=(await owner.query("SELECT count(*)::int n FROM publications WHERE state='PUBLISHED' AND availability='AVAILABLE' AND next_reconfirmation_at>CURRENT_TIMESTAMP")).rows[0].n;
    assert.equal(actual,expected); assert.ok(actual>0&&actual<10000);
  });
  await check('ops and worker central access works without tenant, still respects grants',async()=>{
    for(const scope of ['ops','worker']) await transaction(clients[scope],async()=>{
      assert.equal((await clients[scope].query('SELECT count(*)::int n FROM publications')).rows[0].n,10000);
      assert.equal((await clients[scope].query('UPDATE publications SET title=title WHERE id=$1',[ids.b.publication])).rowCount,1);
      await rejected(clients[scope],'DELETE FROM publications',[],'42501');
    });
    await transaction(clients.worker,async()=>{await rejected(clients.worker,'SELECT public_key FROM institution_keys',[],'42501'); assert.equal((await clients.worker.query('SELECT key_id,institution_id FROM institution_keys')).rowCount,200);});
  });
  await check('public/registry grants contain only SELECT and runtime has no dangerous table privileges',async()=>{
    const grants=(await owner.query("SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee LIKE 'sj_%' ORDER BY grantee,table_name,privilege_type")).rows;
    assert.ok(grants.length>0);
    assert.ok(grants.filter(r=>['sj_public','sj_registry'].includes(r.grantee)).every(r=>r.privilege_type==='SELECT'));
    assert.ok(grants.every(r=>!['TRUNCATE','TRIGGER','REFERENCES'].includes(r.privilege_type)));
    report.grants=grants;
  });
  const foreignKeys=(await owner.query("SELECT conname,conrelid::regclass::text AS child,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace ORDER BY conname")).rows;
  report.foreignKeys=foreignKeys;
  report.indexes=(await owner.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows;
  report.enums=(await owner.query("SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typnamespace='public'::regnamespace ORDER BY t.typname,e.enumsortorder")).rows;
  report.constraints=(await owner.query("SELECT conname,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")).rows;
  await check('all constraints validated, required cover predicate and enum values installed',async()=>{
    assert.ok(report.constraints.every(c=>c.convalidated));
    assert.match(report.indexes.find(i=>i.indexname==='publication_media_one_cover').indexdef,/UNIQUE.*WHERE \(is_cover = true\)/);
    assert.deepEqual(report.enums.filter(e=>e.typname==='media_state').map(e=>e.enumlabel),['AWAITING_UPLOAD','UPLOADED','PROCESSING','READY','REJECTED','REVOKED','EXPIRED','QUARANTINED']);
    assert.equal(foreignKeys.filter(f=>f.definition.startsWith('FOREIGN KEY (institution_id,')).length,15);
  });
  const crossCases=[
    ['institution_keys','installation_id','installation','key_id','key'],
    ['bprs_profiles','public_mark_media_id','media','id','profile'],
    ['publications','profile_id','profile','id','publication'],['publications','whatsapp_contact_id','contact','id','publication'],
    ['publication_media','media_object_id','media','publication_id','publication'],
    ['publication_media','publication_id','publication','publication_id','publication'],
    ['media_upload_sessions','media_object_id','media','institution_id','institution'],
    ['ingest_events','installation_id','installation','institution_id','institution'],['ingest_events','key_id','key','institution_id','institution'],
    ['reconciliation_runs','installation_id','installation','institution_id','institution'],
    ['land_details','publication_id','publication','publication_id','publication'],
    ['public_search_documents','publication_id','publication','publication_id','publication'],
  ];
  for(const [table,column,value,where,source] of crossCases) await check(`composite FK rejects ${table}.${column} referencing another institution`,()=>transaction(owner,async()=>{
    // Avoid unique-key collision hiding the FK result when replacing a publication PK.
    if(column==='publication_id') {
      await owner.query(`DELETE FROM ${quote(table)} WHERE publication_id=$1`,[ids.b.publication]);
    }
    await rejected(owner,`UPDATE ${quote(table)} SET ${quote(column)}=$1 WHERE ${quote(where)}=$2`,[ids.b[value],ids.a[source]],'23503');
  }));
  for(const [table,values] of [['building_details','building_area_m2'],['machine_details','model_or_type,public_condition'],['vehicle_details','brand,model_or_type,public_condition']]) {
    await check(`composite FK rejects ${table} cross-tenant detail`,()=>transaction(owner,async()=>{
      const literal=table==='building_details'?'100':table==='machine_details'?"'fixture','BAIK'":"'fixture','fixture','BAIK'";
      await rejected(owner,`INSERT INTO ${quote(table)}(institution_id,publication_id,${values}) VALUES($1,$2,${literal})`,[a,ids.b.publication],'23503');
    }));
  }
  await check('cover maximum one, ordering and same-tenant media constraints',()=>transaction(clients.ingest,async()=>{
    const second=(await owner.query("SELECT id FROM media_objects WHERE institution_id=$1 AND id<>$2",[a,ids.a.media])).rows[0].id;
    await rejected(clients.ingest,"INSERT INTO publication_media(institution_id,publication_id,media_object_id,sort_order,is_cover,alt_text) VALUES($1,$2,$3,1,true,'test')",[a,ids.a.publication,second],'23505');
    await rejected(clients.ingest,"INSERT INTO publication_media(institution_id,publication_id,media_object_id,sort_order,is_cover,alt_text) VALUES($1,$2,$3,0,false,'test')",[a,ids.a.publication,second],'23505');
    assert.equal((await clients.ingest.query("INSERT INTO publication_media(institution_id,publication_id,media_object_id,sort_order,is_cover,alt_text) VALUES($1,$2,$3,1,false,'test')",[a,ids.a.publication,second])).rowCount,1);
  },a));
  await check('reference/source uniqueness, enum and validation checks reject invalid values',()=>transaction(owner,async()=>{
    await rejected(owner,'UPDATE publications SET public_reference_code=(SELECT public_reference_code FROM publications WHERE id=$1) WHERE id=$2',[ids.b.publication,ids.a.publication],'23505');
    await rejected(owner,"UPDATE publications SET category='NOT_A_CATEGORY' WHERE id=$1",[ids.a.publication],'22P02');
    await rejected(owner,"UPDATE publications SET public_reference_code='bad' WHERE id=$1",[ids.a.publication],'23514');
    await rejected(owner,'UPDATE publications SET next_reconfirmation_at=last_confirmed_at WHERE id=$1',[ids.a.publication],'23514');
    await rejected(owner,"UPDATE whatsapp_contacts SET phone_e164='bad' WHERE id=$1",[ids.a.contact],'23514');
    await rejected(owner,'UPDATE media_objects SET size_bytes=0 WHERE id=$1',[ids.a.media],'23514');
    await rejected(owner,'UPDATE media_objects SET delivery_width=NULL WHERE id=$1',[ids.a.media],'23514');
    await rejected(owner,'UPDATE publications SET source_publication_id=(SELECT source_publication_id FROM publications WHERE institution_id=$1 AND id<>$2 LIMIT 1) WHERE id=$2',[a,ids.a.publication],'23505');
  }));
  await check('row_security off cannot bypass FORCE RLS for registry or ingest',async()=>{
    for(const scope of ['registry','ingest']) await transaction(clients[scope],async()=>{
      await clients[scope].query('SET LOCAL row_security=off');
      await rejected(clients[scope],'SELECT * FROM institutions',[],'42501');
    },a);
  });
  await check('tenant context clears after COMMIT; ingest cannot transfer row to tenant B',async()=>{
    const c=clients.ingest;
    await c.query('BEGIN'); await c.query("SELECT set_config('app.current_institution_id',$1,true)",[a]);
    await c.query('COMMIT');
    assert.equal((await c.query('SELECT count(*)::int n FROM publications')).rows[0].n,0);
    await transaction(c,async()=>{await rejected(c,'UPDATE publications SET institution_id=$1 WHERE id=$2',[b,ids.a.publication],'42501');},a);
  });
  await check('incomplete delivery metadata rejected even before READY',()=>transaction(clients.worker,async()=>{
    await rejected(clients.worker,"UPDATE media_objects SET state='PROCESSING',delivery_width=NULL WHERE id=$1",[ids.a.media],'23514');
  }));
  await check('128 delivery-null combinations: PROCESSING all-or-none; READY requires all six',()=>transaction(clients.worker,async()=>{
    const fields=['delivery_object_key','delivery_mime','delivery_sha256','delivery_size_bytes','delivery_width','delivery_height'];
    const values=['ops02/never-read','image/webp','a'.repeat(64),100,400,300];
    for(const state of ['PROCESSING','READY']) for(let mask=0;mask<64;mask++){
      const params=fields.map((_f,i)=>mask&(1<<i)?values[i]:null);
      const sql=`UPDATE media_objects SET state=$7,${fields.map((f,i)=>`${quote(f)}=$${i+1}`).join(',')} WHERE id=$8`;
      try {
        if(mask===63||(state==='PROCESSING'&&mask===0))assert.equal((await clients.worker.query(sql,[...params,state,ids.a.media])).rowCount,1);
        else await rejected(clients.worker,sql,[...params,state,ids.a.media],'23514');
      } catch(error) {error.testCase=`${state}-${mask}`;throw error;}
    }
  }));
  // Prisma captures and explains its real PublicService query shapes separately.
  for(const table of ['institutions','bprs_profiles','whatsapp_contacts','publications','publication_media','media_objects','public_search_documents','central_jobs','land_details']) await owner.query(`ANALYZE ${quote(table)}`);
  report.dataset={institutions:200,publications:10000,media:400,jobs:4000,searchDocuments:10000};
} catch(error) {
  report.fatal={code:error.code||error.name,constraint:error.constraint}; console.log(`FATAL ${report.fatal.code} ${error.constraint||''}`); process.exitCode=1;
} finally {
  await Promise.all(Object.values(clients).map(c=>c.end()));
  const suffix=target.database.endsWith('_fresh')?'-fresh':'';
  writeFileSync(fileURLToPath(new URL(`../work/ops-02/database-results${suffix}.json`,import.meta.url)),JSON.stringify(report,null,2));
  if(report.checks.some(c=>!c.pass)) process.exitCode=1;
  console.log(JSON.stringify({pass:report.checks.filter(c=>c.pass).length,fail:report.checks.filter(c=>!c.pass).length,fatal:Boolean(report.fatal)}));
}
