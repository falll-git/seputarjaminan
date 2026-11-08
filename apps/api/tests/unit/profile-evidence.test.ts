import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicService} from '../../src/public-service.js';

test('public profile exposes only safe version evidence and configured website URL',async()=>{
  const db={publicRead:{institution:{findFirst:async()=>({publicSlug:'bank-uji',legalNameInternal:'PRIVATE',_count:{publications:0},profile:{sourceVersion:7,sourceProfileId:'PRIVATE',payloadChecksum:'PRIVATE',publicName:'Bank Uji',publicMarkMediaId:'logo',shortDescription:'Profil publik',officeCityRegency:'Bandung',officeProvince:'Jawa Barat'}})}}};
  const service=new PublicService(db as any,{},'https://media.example/v1/public/media','https://catalog.example');
  const result=await service.getInstitution('bank-uji');
  assert.equal(result.public_profile_version,7);
  assert.equal(result.public_page_url,'https://catalog.example/bprs/bank-uji');
  assert.equal(result.published_asset_count,0);
  assert.deepEqual(Object.keys(result).sort(),['public_slug','public_name','public_mark_url','short_description','office_city_regency','office_province','published_asset_count','public_profile_version','public_page_url'].sort());
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal((await new PublicService(db as any,{},'https://api.example/v1/public/media').getInstitution('bank-uji')).public_page_url,null);
});
test('asset detail identifies applied event and canonical page without internal data',async()=>{
  const publication={publicReferenceCode:'SJ-ABCDEFGH',aggregateVersion:9,title:'Aset publik',description:'Deskripsi',category:'KENDARAAN',subcategoryCode:'MOBIL',availability:'AVAILABLE',cityRegency:'Bandung',province:'Jawa Barat',publicUpdatedAt:new Date('2026-09-23T00:00:00Z'),
    institution:{publicSlug:'bank-uji'},profile:{publicName:'Bank Uji',publicMarkMediaId:'logo'},whatsappContact:{phoneE164:'+6281234567890'},
    media:[{isCover:true,altText:'Aset publik',mediaObject:{id:'photo',deliveryWidth:480,deliveryHeight:320}}],vehicleDetail:{brand:'Merek',modelOrType:'Model',mileageKm:0,publicCondition:'BAIK'},payloadChecksum:'PRIVATE',sourcePublicationId:'PRIVATE'};
  let where:unknown;
  const db={publicRead:{publication:{findFirst:async(args:any)=>{where=args.where;return publication;}}}};
  const service=new PublicService(db as any,{},'https://media.example/v1/public/media','https://catalog.example');
  const result=await service.getAsset('SJ-ABCDEFGH');
  assert.equal(result.public_asset_version,9);assert.equal(result.public_page_url,'https://catalog.example/aset/SJ-ABCDEFGH');
  assert.equal(result.attributes.mileage_km,0);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.deepEqual(Object.keys(result).sort(),['reference_code','title','category','subcategory','location','cover','institution','availability','photo_count','public_updated_at','summary_attributes','public_asset_version','public_page_url','description','attributes','media','whatsapp_url'].sort());
  assert.equal((where as any).state,'PUBLISHED');assert.equal((where as any).whatsappContact.state,'VERIFIED');
  assert.equal((await new PublicService(db as any,{},'https://api.example/v1/public/media').getAsset('SJ-ABCDEFGH')).public_page_url,null);
});
