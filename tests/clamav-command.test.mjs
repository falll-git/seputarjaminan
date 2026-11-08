import assert from 'node:assert/strict';
import test from 'node:test';
import {PassThrough} from 'node:stream';
import {clamAvInvocation,scanWithClamAv} from '../apps/worker/src/clamav-command.mjs';

function fakeExec(error,output,inputFailure=false) {
  return (_command,_args,options,callback)=>{
    assert.equal(options.windowsHide,true); assert.equal(options.shell,undefined);
    const stdin=new PassThrough();
    stdin.on('finish',()=>queueMicrotask(()=>{if(inputFailure) stdin.emit('error',new Error('EPIPE')); callback(error,output);}));
    return {stdin};
  };
}
test('scanner streams stdin without shell, volume or host filename',()=>{
  assert.deepEqual(clamAvInvocation({command:'clamdscan'}),{command:'clamdscan',args:['--stream','--no-summary','-']});
  assert.deepEqual(clamAvInvocation({command:'unused',dockerContainer:'sj-local-clamav'}),{command:'docker',args:['exec','-i','sj-local-clamav','clamdscan','--stream','--no-summary','-']});
  for(const dockerContainer of ['','--privileged','a b','x;whoami','../container']) assert.throws(()=>clamAvInvocation({dockerContainer}),/INVALID/);
});
test('only explicit OK is clean, detected malware is separate from transport failure',async()=>{
  const config={command:'clamdscan'}, bytes=Buffer.from('test');
  assert.equal(await scanWithClamAv(config,bytes,fakeExec(null,'stream: OK\n')),'CLEAN');
  assert.equal(await scanWithClamAv(config,bytes,fakeExec({code:1},'stream: Win.Test.EICAR_HDB-1 FOUND\n')),'INFECTED');
  for(const [error,output] of [[null,''],[null,'unknown'],[{code:1},''],[{code:2},'stream: ERROR\n'],[{code:'ENOENT'},''],[{killed:true},'stream: OK\n']]) {
    await assert.rejects(scanWithClamAv(config,bytes,fakeExec(error,output)),/SCANNER_UNAVAILABLE/);
  }
  await assert.rejects(scanWithClamAv(config,bytes,fakeExec(null,'stream: OK\n',true)),/SCANNER_UNAVAILABLE/);
});
