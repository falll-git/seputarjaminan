import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {createShutdown} from '../../src/shutdown.js';

test('shutdown drains an actual request before closing dependencies and is idempotent',async()=>{
  let release!:()=>void;
  let entered!:()=>void;
  const arrived=new Promise<void>(resolve=>{entered=resolve;});
  const server=createServer((_req,res)=>{release=()=>res.end('done');entered();});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address() as {port:number};
  const response=fetch(`http://127.0.0.1:${address.port}`).then(r=>r.text());
  await arrived;
  const cleaned:string[]=[],exits:number[]=[];
  const stop=createShutdown({server,cleanup:[async()=>{cleaned.push('db');},async()=>{cleaned.push('redis');}],exit:code=>{exits.push(code);},onError:()=>assert.fail('Unexpected cleanup failure')});
  const first=stop();assert.equal(stop(),first);assert.equal(cleaned.length,0);
  release();assert.equal(await response,'done');await first;
  assert.deepEqual(cleaned,['db','redis']);assert.deepEqual(exits,[0]);
});

test('cleanup failure still closes other resources and exits nonzero',async()=>{
  const server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  let other=false,code=-1,errors=0;
  await createShutdown({server,cleanup:[async()=>{throw Error('private detail');},async()=>{other=true;}],exit:c=>{code=c;},onError:()=>{errors++;}})();
  assert.equal(other,true);assert.equal(code,1);assert.equal(errors,1);
});

test('wedged cleanup is bounded by deadline without false successful exit',async()=>{
  const server=createServer();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  const keepAlive=setInterval(()=>{},1000);
  let code=-1;
  try{await createShutdown({server,cleanup:[()=>new Promise(()=>{})],exit:c=>{code=c;},onError:()=>{},deadlineMs:20})();assert.equal(code,1);}
  finally{clearInterval(keepAlive);}
});
