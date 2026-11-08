import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {childEnvironment} from '../scripts/local-environment.mjs';
const entry=fileURLToPath(new URL('../scripts/verify-ops02-database.mjs',import.meta.url));
function run(extra={}) {
  return spawnSync(process.execPath,[entry],{env:{...childEnvironment('website',{}),...extra},encoding:'utf8',timeout:10000});
}
test('DB verifier refuses implicit runtime DATABASE_URL without explicit OPS02 target',()=>{
  const result=run({DATABASE_URL:'postgresql://unused:never-connect@127.0.0.1:5432/seputarjaminan_ci'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/SJ_OPS02_TARGET_FILE is mandatory/);
  assert.doesNotMatch(result.stderr,/never-connect/);
});
test('DB verifier rejects existing workflow name, non-OPS container and wrong port before connection',t=>{
  const base=realpathSync(os.tmpdir());const dir=mkdtempSync(path.join(base,'sj-ops02-guard-'));
  t.after(()=>{const resolved=realpathSync(dir);assert.equal(path.dirname(resolved),base);assert.ok(path.basename(resolved).startsWith('sj-ops02-guard-'));rmSync(resolved,{recursive:true});});
  const safeShape={database:'sj_ops02_20260915',container:'sj-ops02-pg-20260915',port:55482,marker:'a'.repeat(48)};
  for(const override of [{database:'seputarjaminan_ci'},{container:'sj-local-preview-pg-20260824-01'},{port:5432},{marker:'invalid'}]){
    const file=path.join(dir,'target.json');writeFileSync(file,JSON.stringify({...safeShape,...override}));
    const result=run({SJ_OPS02_TARGET_FILE:file});assert.notEqual(result.status,0);assert.match(result.stderr,/AssertionError/);
    assert.doesNotMatch(result.stdout,/PASS|FATAL|FAIL/);
  }
});
