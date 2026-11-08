import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,unlinkSync,rmSync,realpathSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const repo=fileURLToPath(new URL('../',import.meta.url));
const {load:loadYaml}=createRequire(import.meta.url)('js-yaml');

test('security repository audit installs the reviewed dependency before invoking its installed-consumer verification',()=>{
  const workflow=loadYaml(readFileSync(path.join(repo,'.github/workflows/security.yml'),'utf8'));
  const steps=workflow.jobs['repository-audit'].steps;
  const auditIndex=steps.findIndex(step=>/\bnpm run ci:repository:audit\b/u.test(step.run??''));
  assert.ok(auditIndex>=0,'Repository audit must remain enabled');
  assert.ok(steps.slice(0,auditIndex).some(step=>/^npm ci --ignore-scripts\s*$/u.test(step.run??'')),
    'A clean checkout must install fork and Next lint consumers before the repository audit, without invoking application postinstall');
});
function fixture(t){
  const base=realpathSync(os.tmpdir()),root=mkdtempSync(path.join(base,'sj-audit-'));
  t.after(()=>{assert.equal(path.dirname(realpathSync(root)),base); assert.ok(path.basename(root).startsWith('sj-audit-'));rmSync(root,{recursive:true});});
  execFileSync('git',['init','--quiet'],{cwd:root,windowsHide:true});
  mkdirSync(path.join(root,'.github/workflows'),{recursive:true});
  for(const name of ['quality','security']) copyFileSync(path.join(repo,`.github/workflows/${name}.yml`),path.join(root,`.github/workflows/${name}.yml`));
  writeFileSync(path.join(root,'retired.ts'),'export const retired = true;\n');
  execFileSync('git',['add','.'],{cwd:root,windowsHide:true});
  return {root,run:()=>spawnSync(process.execPath,[path.join(repo,'scripts/audit-repository.mjs')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:1024*1024})};
}
function auditRejected(result,reason){
  assert.equal(result.error,undefined,'Auditor must start and finish, not fail to spawn or time out');
  assert.equal(result.signal,null,'Auditor must not be interrupted');
  assert.equal(result.status,1,'Expected a deliberate auditor rejection');
  assert.match(result.stderr,reason,'The rejection must prove the intended policy, not an unrelated error');
}
test('audit accepts tracked deletion without restoring retired component',t=>{const {root,run}=fixture(t);unlinkSync(path.join(root,'retired.ts'));const result=run();assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,0);assert.match(result.stdout,/1 penghapusan tracked/u);});
test('audit still rejects untracked secret patterns',t=>{const {root,run}=fixture(t);writeFileSync(path.join(root,'leak.ts'),'export const key = "'+'ghp_'+'a'.repeat(35)+'";');auditRejected(run(),/leak\.ts: pola kredensial terlarang ditemukan/u);});
test('required workflow deletion still fails',t=>{const {root,run}=fixture(t);unlinkSync(path.join(root,'.github/workflows/quality.yml'));auditRejected(run(),/ENOENT[^\n]*\.github[\\/]workflows[\\/]quality\.yml/u);});
test('an arbitrary archive is not exempted from the candidate audit',t=>{const {root,run}=fixture(t);writeFileSync(path.join(root,'backup.tgz'),'not a reviewed package');auditRejected(run(),/backup\.tgz: file runtime\/sensitif tidak boleh dilacak Git/u);});
test('the reviewed archive name alone cannot bypass verification',t=>{
  const {root,run}=fixture(t);mkdirSync(path.join(root,'vendor/braces-depth-guard'),{recursive:true});mkdirSync(path.join(root,'scripts'));
  copyFileSync(path.join(repo,'scripts/verify-braces-fork.cjs'),path.join(root,'scripts/verify-braces-fork.cjs'));
  copyFileSync(path.join(repo,'vendor/braces-depth-guard/provenance.json'),path.join(root,'vendor/braces-depth-guard/provenance.json'));
  writeFileSync(path.join(root,'vendor/ruwang-braces-depth-guard-3.0.3-ruwang.depth.1.tgz'),'tampered');auditRejected(run(),/unreviewed archive/u);
});

test('negative audit oracle refuses spawn failure instead of treating it as policy rejection',()=>{assert.throws(()=>auditRejected({error:new Error('spawn failed'),signal:null,status:null,stderr:'policy'},/policy/u));});
test('negative audit oracle refuses interrupted or timed out auditor',()=>{assert.throws(()=>auditRejected({signal:'SIGTERM',status:null,stderr:'policy'},/policy/u));});
test('negative audit oracle refuses unrelated failure even with exit1',()=>{assert.throws(()=>auditRejected({signal:null,status:1,stderr:'Cannot find module'},/unreviewed archive/u));});
