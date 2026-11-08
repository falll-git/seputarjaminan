import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,copyFileSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,realpathSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {childEnvironment} from '../scripts/local-environment.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
test('migration integrity accepts reviewed 19 and rejects changed historical/new SQL or an unreviewed addition',t=>{
  const base=realpathSync(tmpdir()),root=mkdtempSync(path.join(base,'sj-migration-integrity-'));
  t.after(()=>{assert.equal(path.dirname(realpathSync(root)),base);assert.match(path.basename(root),/^sj-migration-integrity-/);rmSync(root,{recursive:true});});
  mkdirSync(path.join(root,'scripts'));mkdirSync(path.join(root,'prisma'));
  cpSync(path.join(repo,'prisma/migrations'),path.join(root,'prisma/migrations'),{recursive:true});
  copyFileSync(path.join(repo,'scripts/check-migration-integrity.mjs'),path.join(root,'scripts/check.mjs'));
  const run=()=>spawnSync(process.execPath,[path.join(root,'scripts/check.mjs')],{cwd:root,env:childEnvironment('website',{}),encoding:'utf8',windowsHide:true,timeout:10000});
  const valid=run();assert.equal(valid.status,0);assert.match(valid.stdout,/19 migration/);
  for(const name of ['20260822085806_init_central','20260930180000_job_installation_provenance','20261001001000_control_recovery_receipts']){
    const file=path.join(root,'prisma/migrations',name,'migration.sql'),original=readFileSync(file);
    writeFileSync(file,Buffer.concat([original,Buffer.from('\n-- unreviewed test mutation\n')]));
    const rejected=run();assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/baseline immutable/);
    writeFileSync(file,original);
  }
  const addition=path.join(root,'prisma/migrations/20990101000000_unreviewed');mkdirSync(addition);writeFileSync(path.join(addition,'migration.sql'),'SELECT 1;');
  const rejected=run();assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Daftar migration berubah/);
});
