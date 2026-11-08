import type { DatabaseClients } from './database.js';
import { withInstitution } from './database.js';
import { ApiError } from './errors.js';
import { visibilityWhere } from './public-service.js';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Lookup={event_id:string;aggregate_id:string;aggregate_version:number;payload_checksum:string;request_nonce:string};
export function validateDeliveryLookup(value:unknown):value is Lookup {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===5 && ['event_id','aggregate_id','request_nonce'].every(k=>typeof v[k]==='string'&&uuid.test(v[k] as string))
    && Number.isSafeInteger(v.aggregate_version)&&Number(v.aggregate_version)>0
    && typeof v.payload_checksum==='string'&&/^[a-f0-9]{64}$/.test(v.payload_checksum);
}

// Private, installation-scoped evidence of the projection used by public reads.
// It is NOT itself proof that a browser fetched the public website successfully.
export async function readDeliveryEvidence(databases:DatabaseClients,value:unknown,
  auth:{institutionId:string;installationId:string;keyId:string},now=new Date()) {
  if(!validateDeliveryLookup(value))throw new ApiError(422,'DELIVERY_LOOKUP_INVALID','Permintaan bukti versi tidak valid.');
  return withInstitution(databases.ingest,auth.institutionId,async tx=>{
    const event=await tx.ingestEvent.findFirst({where:{eventId:value.event_id,institutionId:auth.institutionId,
      installationId:auth.installationId,keyId:auth.keyId,aggregateId:value.aggregate_id,
      aggregateVersion:value.aggregate_version,payloadChecksum:value.payload_checksum,state:'APPLIED'}});
    if(!event)throw new ApiError(404,'DELIVERY_EVIDENCE_NOT_FOUND','Bukti pengiriman tidak tersedia.');
    const base={contract_version:1,request_nonce:value.request_nonce,checked_at:now.toISOString(),
      institution_id:auth.institutionId,installation_id:auth.installationId,event_id:event.eventId,
      aggregate_id:event.aggregateId,aggregate_version:event.aggregateVersion,payload_checksum:event.payloadChecksum};
    if(!['PUBLICATION','BPRS_PROFILE'].includes(event.aggregateType))return {...base,projection:null,reason:'NOT_A_PUBLIC_PAGE'};
    const projection=event.aggregateType==='PUBLICATION'
      ? await tx.publication.findFirst({where:{institutionId:auth.institutionId,sourcePublicationId:event.aggregateId},
          select:{id:true,aggregateVersion:true,payloadChecksum:true,publicReferenceCode:true}})
      : await tx.bprsProfile.findFirst({where:{institutionId:auth.institutionId,sourceProfileId:event.aggregateId},
          select:{id:true,sourceVersion:true,payloadChecksum:true}});
    if(!projection)return {...base,projection:null,reason:'PROJECTION_NOT_FOUND'};
    const version='aggregateVersion' in projection?projection.aggregateVersion:projection.sourceVersion;
    const applied=await tx.ingestEvent.findFirst({where:{institutionId:auth.institutionId,installationId:auth.installationId,
      aggregateId:event.aggregateId,aggregateType:event.aggregateType,aggregateVersion:version,payloadChecksum:projection.payloadChecksum,state:'APPLIED'},
      select:{eventId:true,installationId:true}});
    if(!applied)return {...base,projection:null,reason:'PROJECTION_LINEAGE_NOT_PROVEN'};
    const visible=event.aggregateType==='PUBLICATION'
      ? Boolean(await tx.publication.findFirst({where:{id:projection.id,...visibilityWhere(now)},select:{id:true}}))
      : Boolean(await tx.bprsProfile.findFirst({where:{id:projection.id,state:'ACTIVE',institution:{state:'ACTIVE'}},select:{id:true}}));
    return {...base,reason:null,projection:{event_id:applied.eventId,version,payload_checksum:projection.payloadChecksum,
      visible,scope:'PUBLIC_READ_PREDICATE',reference_code:'publicReferenceCode' in projection?projection.publicReferenceCode:null}};
  },{isolationLevel:'RepeatableRead'});
}
