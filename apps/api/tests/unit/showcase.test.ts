import assert from "node:assert/strict";
import test from "node:test";
import { PublicService } from "../../src/public-service.js";

function fixture(count: number) {
  const offsets: number[] = [], predicates: any[] = [];
  const rows = Array.from({length: count}, (_, n) => ({
    id: String(n), publicReferenceCode: `SJ-${String(n).padStart(8, "0")}`, title: `Asset ${n}`,
    category: "TANAH", subcategoryCode: "TANAH_KOSONG", cityRegency: "Bandung", province: "Jawa Barat", availability: "AVAILABLE",
    publicUpdatedAt: new Date(), institution: {publicSlug: "bprs-test"}, profile: {publicName: "BPRS test", publicMarkMediaId: "logo"},
    media: [{isCover: true, altText: "Tanah", mediaObject: {id: "photo", deliveryWidth: 960, deliveryHeight: 540}}],
  }));
  const tx = {publication: {
    count: async ({where}: any) => {predicates.push(where); return count;},
    findMany: async (q: any) => {predicates.push(q.where); if(q.select) {offsets.push(q.skip); assert.equal(q.take,1); return [rows[q.skip]];} return rows.filter(r=>q.where.id.in.includes(r.id));},
  }};
  const db = {publicRead: {$transaction: async (fn: any, options: any) => {assert.equal(options.isolationLevel,"RepeatableRead"); return fn(tx);}}};
  return {service: new PublicService(db as any, {}, "/v1/public/media"), offsets, predicates};
}
test("showcase samples the whole eligible population once, including older positions, using public card allowlist", async () => {
  const {service, offsets, predicates}=fixture(8);
  const result=await service.showcase({});
  assert.equal(result.items.length,8); assert.equal(result.next_cursor,null);
  assert.deepEqual([...offsets].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
  assert.equal(new Set(result.items.map(r=>r.reference_code)).size,8);
  assert.ok(result.items.every(r=>!("id" in r)&&!("whatsappContact" in r)&&!("state" in r)));
  for(const where of predicates){assert.equal(where.state,"PUBLISHED");assert.equal(where.availability,"AVAILABLE");assert.equal(where.institution.state,"ACTIVE");assert.equal(where.profile.state,"ACTIVE");assert.equal(where.whatsappContact.state,"VERIFIED");assert.equal(where.media.some.mediaObject.state,"READY");assert.ok(where.nextReconfirmationAt.gt instanceof Date);}
});
test("showcase is bounded and zero/single populations are honest",async()=>{
  for(const count of [0,1,2,1000]){const {service,offsets}=fixture(count);const result=await service.showcase({});assert.equal(result.items.length,Math.min(8,count));assert.equal(new Set(offsets).size,offsets.length);assert.ok(offsets.every(n=>n>=0&&n<count));}
});
test("showcase rejects filters/cursors instead of silently ignoring them",async()=>{
  const {service,offsets}=fixture(10);
  for(const q of [{limit:"100"},{cursor:"anything"},{category:"TANAH"}])await assert.rejects(service.showcase(q),(e:any)=>e.status===400);
  assert.equal(offsets.length,0);
});
