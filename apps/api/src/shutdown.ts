import type { Server } from 'node:http';

// One shutdown owner; await in-flight HTTP, then all resource cleanup. A broken
// dependency cannot hold termination forever or turn partial cleanup into exit 0.
export function createShutdown({server,cleanup,exit,onError,deadlineMs=30000}: {
  server: Pick<Server,'close'|'closeAllConnections'>;
  cleanup: Array<()=>Promise<unknown>>;
  exit: (code:number)=>void;
  onError: ()=>void;
  deadlineMs?: number;
}) {
  let pending: Promise<void>|undefined;
  let finished=false;
  return () => {
    if(pending)return pending;
    pending=new Promise<void>(resolve=>{
      const timer=setTimeout(()=>{finished=true;onError();server.closeAllConnections();exit(1);resolve();},deadlineMs);
      timer.unref();
      server.close(async error=>{
        const results=await Promise.allSettled(cleanup.map(fn=>Promise.resolve().then(fn)));
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        const failed=Boolean(error)||results.some(result=>result.status==='rejected');
        if(failed)onError();
        exit(failed?1:0);resolve();
      });
    });
    return pending;
  };
}
