import {randomUUID,sign,verify} from 'node:crypto';
import type {RequestHandler} from 'express';
import type {ApiServerConfig} from '@seputarjaminan/config/server';
import type {DatabaseClients} from './database.js';
import {withInstitution} from './database.js';
import type {MonitoringRuntime} from './monitoring-runtime.js';
import {ApiError} from './errors.js';
import {RECOVERY_PATH,UUID,canonical,digest,validRequest,jobRevision,jobMetadata,type RecoveryRequest} from './control-recovery-contract.js';

const message=(timestamp:string,nonce:string,sum:string)=>['RUWANG-CONTROL-V1','POST',RECOVERY_PATH,timestamp,nonce,sum].join('\n');
type Binding=ApiServerConfig['controlRecovery']['bindings'][number];
type Receipt={request_digest:string;binding_digest:string;operator_id:string;control_instance_id:string;result_json:unknown};
const failure=(code:string,status=409)=>new ApiError(status,code,'Pemulihan pekerjaan belum dapat dilakukan.');

export async function recoverCentralJob(databases:DatabaseClients,binding:Binding,lookup:RecoveryRequest) {
  return withInstitution(databases.ingest,binding.institutionId,async tx=>{
    const installation=await tx.institutionInstallation.findFirst({where:{id:binding.installationId,institutionId:binding.institutionId,
      state:'ACTIVE',institution:{state:'ACTIVE'}},select:{id:true}});
    if(!installation)throw failure('RECOVERY_INSTALLATION_INACTIVE',403);
    const scope={institutionId:binding.institutionId,originInstallationId:binding.installationId};
    const bindingDigest=digest(binding);
    if(lookup.operation==='list'){
      const rows=await tx.centralJob.findMany({where:{...scope,...(lookup.state?{state:lookup.state}:{}),...(lookup.cursor?{id:{gt:lookup.cursor}}:{})},orderBy:{id:'asc'},take:26});
      return {kind:'list',items:rows.slice(0,25).map(jobMetadata),next_cursor:rows.length>25?rows[24].id:null,scope:'BOUND_INSTALLATION',total:null};
    }
    if(lookup.operation==='detail'){
      const row=await tx.centralJob.findFirst({where:{...scope,id:lookup.job_id}});
      if(!row)throw failure('RECOVERY_JOB_NOT_FOUND',404);
      return {kind:'detail',item:jobMetadata(row)};
    }
    if(lookup.operation==='retry')await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`sj:control-recovery:${lookup.request_id}`},0))`;
    const receipts=await tx.$queryRaw<Receipt[]>`SELECT request_digest,binding_digest,operator_id::text,control_instance_id::text,result_json
      FROM control_recovery_receipts WHERE request_id=${lookup.request_id}::uuid AND installation_id=${binding.installationId}::uuid`;
    const requestDigest=lookup.operation==='retry'?digest(lookup):lookup.request_digest;
    if(receipts.length){const old=receipts[0];
      if(old.request_digest!==requestDigest||old.binding_digest!==bindingDigest||old.operator_id!==lookup.operator_id||old.control_instance_id!==lookup.instance_id)throw failure('RECOVERY_RECEIPT_CONFLICT');
      return {kind:'receipt',state:'RECORDED',result:old.result_json};
    }
    if(lookup.operation==='receipt')return {kind:'receipt',state:'NOT_RECORDED',result:null};
    const locked=await tx.$queryRaw<{id:string}[]>`SELECT id FROM central_jobs WHERE id=${lookup.job_id}::uuid
      AND institution_id=${binding.institutionId}::uuid AND origin_installation_id=${binding.installationId}::uuid FOR UPDATE`;
    if(!locked.length)throw failure('RECOVERY_JOB_NOT_FOUND',404);
    const row=await tx.centralJob.findFirst({where:{...scope,id:lookup.job_id}});
    if(!row||jobRevision(row)!==lookup.expected_revision||!jobMetadata(row).retry.allowed)throw failure('RECOVERY_JOB_CHANGED');
    const now=new Date();
    const updated=await tx.centralJob.updateMany({where:{...scope,id:row.id,state:'DEAD_LETTER',updatedAt:row.updatedAt,leaseToken:null,leaseUntil:null},
      data:{state:'PENDING',availableAt:now,leaseUntil:null,leaseToken:null,attemptCount:0,lastErrorCode:null,updatedAt:now}});
    if(updated.count!==1)throw failure('RECOVERY_JOB_CHANGED');
    // Same retry semantics as OpsService, but separate immutable integration
    // audit. Never clear revoked/quarantine/content state or fabricate an ACK.
    const result={request_id:lookup.request_id,request_digest:requestDigest,job_id:row.id,state:'SCHEDULED',
      scheduled_at:now.toISOString(),previous_revision:lookup.expected_revision};
    await tx.$executeRaw`INSERT INTO control_recovery_receipts(request_id,institution_id,installation_id,control_instance_id,
      operator_id,job_id,binding_digest,request_digest,previous_attempt_count,reason,result_json)
      VALUES(${lookup.request_id}::uuid,${binding.institutionId}::uuid,${binding.installationId}::uuid,${lookup.instance_id}::uuid,
        ${lookup.operator_id}::uuid,${row.id}::uuid,${bindingDigest},${requestDigest},${row.attemptCount},${lookup.reason.trim()},${JSON.stringify(result)}::jsonb)`;
    return {kind:'receipt',state:'RECORDED',result};
  });
}

export function createControlRecoveryHandler(input:{config:Pick<ApiServerConfig,'flags'|'controlRecovery'|'security'>;databases:DatabaseClients;runtime?:MonitoringRuntime}):RequestHandler {
  return async(request,response,next)=>{
    try{
      const settings=input.config.controlRecovery;
      if(!input.config.flags.controlRecovery)throw failure('CONTROL_RECOVERY_DISABLED',503);
      if(!settings?.audience||!settings.responsePrivateKey||!settings.responseKeyId||!input.runtime)throw failure('CONTROL_RECOVERY_NOT_CONFIGURED',503);
      if(request.originalUrl!==RECOVERY_PATH||!request.is('application/json')||!request.rawBody||request.rawBody.length>4096||!validRequest(request.body))throw failure('RECOVERY_INPUT_INVALID',422);
      const lookup=request.body as RecoveryRequest;
      const binding=settings.bindings.find(b=>b.instanceId===lookup.instance_id);
      const timestamp=request.get('x-rc-timestamp')??'',nonce=request.get('x-rc-nonce')??'',sum=request.get('x-rc-content-sha256')??'';
      let verified=false;
      if(binding){try{verified=verify(null,Buffer.from(message(timestamp,nonce,sum)),binding.publicKey,Buffer.from(request.get('x-rc-signature')??'','base64url'));}catch{ /* rejected below */ }}
      if(!binding||lookup.audience!==settings.audience||request.get('x-rc-instance-id')!==binding.instanceId||request.get('x-rc-key-id')!==binding.keyId||
        !UUID.test(nonce)||sum!==digest(lookup)||!Number.isFinite(Date.parse(timestamp))||Math.abs(Date.now()-Date.parse(timestamp))>input.config.security.signatureToleranceSeconds*1000||!verified)throw failure('CONTROL_RECOVERY_REJECTED',401);
      if(!await input.runtime.reserveNonce(`sj:control-recovery:${binding.instanceId}:${binding.keyId}:${nonce}`,input.config.security.nonceTtlSeconds))throw failure('CONTROL_RECOVERY_REPLAYED');
      const value=await recoverCentralJob(input.databases,binding,lookup);
      const body={contract_version:1,instance_id:binding.instanceId,institution_id:binding.institutionId,installation_id:binding.installationId,
        operator_id:lookup.operator_id,request_nonce:nonce,request_digest:sum,checked_at:new Date().toISOString(),value};
      const ackTime=new Date().toISOString(),ackNonce=randomUUID(),ackDigest=digest(body);
      response.set({'content-type':'application/json','cache-control':'no-store','x-rc-ack-key-id':settings.responseKeyId,
        'x-rc-ack-timestamp':ackTime,'x-rc-ack-nonce':ackNonce,'x-rc-ack-content-sha256':ackDigest,
        'x-rc-ack-signature':sign(null,Buffer.from(message(ackTime,ackNonce,ackDigest)),settings.responsePrivateKey).toString('base64url')});
      response.status(200).send(canonical(body));
    }catch(error){next(error);}
  };
}
