import {createHash} from 'node:crypto';

export const RECOVERY_PATH='/v1/internal/ruwang-control/sj-jobs/recovery';
export const JOB_STATES=['PENDING','PROCESSING','RETRY_WAIT','COMPLETED','DEAD_LETTER'] as const;
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function canonical(value:unknown):string {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';
  throw Error('INVALID_JSON');
}
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
type Common={contract_version:1;instance_id:string;audience:string;operator_id:string};
export type RecoveryRequest=Common&(
  {operation:'list';cursor:string|null;state:typeof JOB_STATES[number]|null}|
  {operation:'detail';job_id:string}|
  {operation:'retry';job_id:string;request_id:string;expected_revision:string;reason:string}|
  {operation:'receipt';request_id:string;request_digest:string});
export function validRequest(value:unknown):value is RecoveryRequest {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>,id=(key:string)=>typeof v[key]==='string'&&UUID.test(v[key] as string);
  const hash=(key:string)=>typeof v[key]==='string'&&/^[a-f0-9]{64}$/.test(v[key] as string);
  const keys=['contract_version','instance_id','audience','operator_id','operation',...(
    v.operation==='list'?['cursor','state']:v.operation==='detail'?['job_id']:v.operation==='receipt'?['request_id','request_digest']:
    v.operation==='retry'?['job_id','request_id','expected_revision','reason']:[])];
  if(Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k))||v.contract_version!==1||!id('instance_id')||!id('operator_id')||
    typeof v.audience!=='string'||v.audience.length<1||v.audience.length>150||/[\r\n]/.test(v.audience))return false;
  if(v.operation==='list')return (v.cursor===null||id('cursor'))&&(v.state===null||JOB_STATES.includes(v.state as typeof JOB_STATES[number]));
  if(v.operation==='detail')return id('job_id');
  if(v.operation==='receipt')return id('request_id')&&hash('request_digest');
  return v.operation==='retry'&&id('job_id')&&id('request_id')&&hash('expected_revision')&&typeof v.reason==='string'&&
    v.reason.trim().length>=5&&v.reason.length<=500&&![...v.reason].some(c=>c.charCodeAt(0)<32&&!['\t','\n','\r'].includes(c));
}
export type JobRow={id:string;institutionId:string|null;originInstallationId:string|null;jobType:string;state:string;attemptCount:number;
  availableAt:Date;createdAt:Date;updatedAt:Date;leaseUntil:Date|null;leaseToken:string|null;lastErrorCode:string|null};
export function jobRevision(row:JobRow){return digest({id:row.id,institution:row.institutionId,installation:row.originInstallationId,
  type:row.jobType,state:row.state,attempts:row.attemptCount,available_at:row.availableAt.toISOString(),updated_at:row.updatedAt.toISOString(),
  lease_until:row.leaseUntil?.toISOString()??null,lease_token:row.leaseToken,error:row.lastErrorCode});}
export function jobMetadata(row:JobRow) {
  const reason=!['PROCESS_MEDIA','REBUILD_PUBLICATION_PROJECTION','RECONCILE_MANIFEST'].includes(row.jobType)?'JOB_TYPE_UNSUPPORTED':
    row.state!=='DEAD_LETTER'?'JOB_NOT_RETRYABLE':row.leaseUntil||row.leaseToken?'JOB_OWNED':null;
  return {id:row.id,job_type:row.jobType,state:row.state,attempt_count:row.attemptCount,available_at:row.availableAt.toISOString(),
    created_at:row.createdAt.toISOString(),revision:jobRevision(row),retry:{allowed:reason===null,reason}};
}
