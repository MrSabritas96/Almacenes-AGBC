/** Prueba local: fichas sin cuentas, aprobación/entrega y aislamiento por almacén. Limpia solo sus fixtures. */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { pool } from "../src/db";
import { receiveMaterialRequest, requestCatalog } from "../src/lib/material-intake";
import { lookupMaterialRequests, loadPublicRequestReceipt } from "../src/lib/request-status";

const base=process.env.TEST_APP_URL??'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL!).hostname));
const prefix=`intake-${randomUUID()}`;
const w1=`${prefix}-w1`,w2=`${prefix}-w2`,m1=`${prefix}-m1`,m2=`${prefix}-m2`,a1=`${prefix}-a1`,a2=`${prefix}-a2`;
const extraMaterial=`${prefix}-extra`;
const password=randomUUID(),document=`QA${Date.now()}`;
let actionId='',receiptId='';
const input={name:'Persona de prueba temporal',document,regional:'La Paz',position:'Pruebas',department:'Pruebas',phone:'',warehouseId:w1,materialId:m1,quantity:3,purpose:'Prueba aislada del formulario público',priority:'normal',neededOn:'2099-01-01',submissionKey:randomUUID()};
async function login(id:string){
  const r=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:`${id}@example.test`,password})});
  assert.equal(r.status,200,await r.clone().text());
  return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
}
async function action(cookie:string,command:unknown,id=actionId){
  const r=await fetch(`${base}/dashboard`,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Origin:base,Cookie:cookie,'Next-Action':id},body:JSON.stringify([command])});
  const body=await r.text();assert.equal(r.status,200,body.slice(0,200));
  const result=body.split('\n').map(line=>line.slice(line.indexOf(':')+1)).find(line=>line.startsWith('{')&&line.includes('"ok":'));
  assert(result,body.slice(0,500));return JSON.parse(result);
}
async function main(){
try{
  await pool.query('insert into warehouses(id,name,location) values($1,$2,$2),($3,$4,$4)',[w1,'Prueba aislada 1',w2,'Prueba aislada 2']);
  for(const [id,w] of [[a1,w1],[a2,w2]]){
    await pool.query('insert into users(id,name,email) values($1,$2,$3)',[id,'Administración de prueba',`${id}@example.test`]);
    await pool.query("insert into accounts(id,user_id,account_id,provider_id,password) values($1,$2,$2,'credential',$3)",[`${id}-credential`,id,await hashPassword(password)]);
    await pool.query("insert into user_roles(user_id,role_id) select $1,id from roles where name='admin_almacenes'",[id]);
    await pool.query('insert into staff_profiles(user_id,warehouse_id) values($1,$2)',[id,w]);
  }
  for(const [id,w] of [[m1,w1],[m2,w2]]){
    await pool.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$1,'Material de prueba','Prueba','unidad',10,1,'Prueba')",[id,w]);
    await pool.query("insert into inventory_batches(material_id,quantity,remaining,unit_cost,source) values($1,10,10,0,'Apertura fixture QA')",[id]);
  }
  const accountsBefore=(await pool.query('select (select count(*) from users) users,(select count(*) from accounts) accounts')).rows[0];
  const first=await receiveMaterialRequest(input);assert(first.ok,JSON.stringify(first));
  assert.match(first.reference,/^SOL-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,'Comprobante corto y legible');
  const duplicate=await receiveMaterialRequest(input);assert(duplicate.ok);assert.equal(duplicate.reference,first.reference);
  const again=await receiveMaterialRequest({...input,name:'No debe sobrescribir la ficha',document:document.toLowerCase(),submissionKey:randomUUID(),quantity:1});assert(again.ok,JSON.stringify(again));
  const otherRequest=await receiveMaterialRequest({...input,warehouseId:w2,materialId:m2,document:'OTH'+randomUUID().replaceAll('-','').slice(0,16),submissionKey:randomUUID()});assert(otherRequest.ok);
  const initialStatus=await lookupMaterialRequests({document:` ${document.toLowerCase()} `,reference:first.reference});assert(initialStatus.ok);assert.equal(initialStatus.requests.length,1);
  assert(initialStatus.requests.every(r=>r.status==='pending'&&r.reference!==otherRequest.reference),'Consulta limitada al CI exacto');
  const publicReceipt=await loadPublicRequestReceipt({document,reference:first.reference});assert(publicReceipt.ok);assert.equal(publicReceipt.data.reference,first.reference);assert.equal(publicReceipt.data.requester.document,document);assert.equal(publicReceipt.data.requester.name,input.name);assert.equal(publicReceipt.data.purpose,input.purpose);assert.equal(publicReceipt.data.material,'Material de prueba');assert.equal(publicReceipt.data.quantity,3);assert(!('phone' in publicReceipt.data.requester));
  assert(!(await loadPublicRequestReceipt({document,reference:otherRequest.reference})).ok,'No descarga un comprobante de otro CI');
  const normalized=await lookupMaterialRequests({document,reference:first.reference.toLowerCase().replaceAll('-',' ')});assert(normalized.ok);assert.equal(normalized.requests[0]?.reference,first.reference,'Acepta minúsculas y espacios en comprobantes nuevos');
  const allowed=['group_reference','authorized_quantity','reference','material','quantity','unit','status','warehouse','created_at','needed_on','delivery_on','delivery_place','response','delivered_at'];
  assert(initialStatus.requests.every(r=>Object.keys(r).every(k=>allowed.includes(k))),'No devuelve stock, nombre, ficha, teléfono ni motivo privado');
  const emptyStatus=await lookupMaterialRequests({document:'NOREGISTRADO'+document,reference:first.reference});assert(emptyStatus.ok);assert.equal(emptyStatus.requests.length,0);
  const wrongReference=await lookupMaterialRequests({document,reference:otherRequest.reference});assert(wrongReference.ok);assert.equal(wrongReference.requests.length,0,'CI correcto no permite consultar un comprobante ajeno');
  const history=await lookupMaterialRequests({document:` ${document.toLowerCase()} `});assert(history.ok);
  assert.deepEqual(new Set(history.requests.map(r=>r.reference)),new Set([first.reference,again.reference]),'El CI reúne todas las solicitudes propias sin comprobante');
  const blankReference=await lookupMaterialRequests({document,reference:'   '});assert(blankReference.ok);assert.equal(blankReference.requests.length,2);
  assert(history.requests.every(r=>r.reference!==otherRequest.reference),'No incluye solicitudes de otro CI');
  assert(history.requests.every(r=>Object.keys(r).every(k=>allowed.includes(k))),'Historial público sin datos de la ficha');
  assert(!(await loadPublicRequestReceipt({document})).ok,'Descarga un comprobante solo después de seleccionarlo');
  const historyPerson=(await pool.query('select id from warehouse_people where warehouse_id=$1 and document=$2',[w1,document])).rows[0];
  const historyIds=Array.from({length:21},()=>randomUUID());
  await pool.query("insert into material_requests(id,person_id,material_id,quantity,purpose,needed_on) select unnest($1::text[]),$2,$3,1,'Historial de prueba','2099-01-01'",[historyIds,historyPerson.id,m1]);
  const fullHistory=await lookupMaterialRequests({document});assert(fullHistory.ok);assert.equal(fullHistory.requests.length,23,'El historial no se trunca a 20 solicitudes');
  await pool.query('delete from material_requests where id=any($1::text[])',[historyIds]);
  await pool.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$1,'Material adicional','Prueba','unidad',0,0,'Prueba')",[extraMaterial,w1]);
  const grouped=await receiveMaterialRequest({...input,submissionKey:randomUUID(),lines:[{materialId:m1,quantity:2},{materialId:extraMaterial,quantity:1}]});
  assert(grouped.ok,JSON.stringify(grouped));
  const groupedStatus=await lookupMaterialRequests({document,reference:grouped.reference});
  assert(groupedStatus.ok);
  assert.deepEqual(groupedStatus.requests.map(r=>r.group_reference),[grouped.reference,grouped.reference]);
  assert.deepEqual(new Set(groupedStatus.requests.map(r=>r.material)),new Set(['Material de prueba','Material adicional']));
  const groupedHistory=await lookupMaterialRequests({document});
  assert(groupedHistory.ok);
  assert.deepEqual(new Set(groupedHistory.requests.map(r=>r.group_reference||r.reference)),new Set([first.reference,again.reference,grouped.reference]));
  const groupedReceipt=await loadPublicRequestReceipt({document,reference:grouped.reference});
  assert(groupedReceipt.ok);
  assert.equal(groupedReceipt.data.items?.length,2);
  assert(!(await lookupMaterialRequests({document:"' OR 1=1 --",reference:first.reference})).ok,'CI inválido rechazado');
  async function checkStatus(reference:string,status:string){const result=await lookupMaterialRequests({document,reference});assert(result.ok);const row=result.requests.find(r=>r.reference===reference);assert(row);assert.equal(row.status,status);return row;}
  const person=(await pool.query('select * from warehouse_people where warehouse_id=$1 and document=$2',[w1,document])).rows[0];
  assert(person);assert.equal(person.name,input.name);
  const catalog=await requestCatalog();
  assert.deepEqual(catalog.people.find(p=>p.id===person.id),{id:person.id,warehouse_id:w1,name:input.name,document,position:input.position,department:input.department,phone:input.phone,regional:input.regional},'El selector incluye los datos necesarios para autocompletar');
  assert(catalog.materials.every(m=>!('stock' in m)&&!('minimum' in m)),'El catálogo sigue ocultando existencias');
  await pool.query('update warehouse_people set is_active=false where id=$1',[person.id]);
  assert(!(await requestCatalog()).people.some(p=>p.id===person.id),'No sugiere empleados inactivos');
  await pool.query('update warehouse_people set is_active=true where id=$1',[person.id]);
  const legacyReference='legacy'+randomUUID().replaceAll('-','').slice(0,18);
  await pool.query("insert into material_requests(id,person_id,material_id,quantity,purpose,needed_on) values($1,$2,$3,1,'Comprobante anterior de prueba','2099-01-01')",[legacyReference,person.id,m1]);
  const legacy=await lookupMaterialRequests({document,reference:legacyReference});assert(legacy.ok);assert.equal(legacy.requests[0]?.reference,legacyReference,'Los comprobantes anteriores siguen vigentes');
  assert.equal((await pool.query('select count(*)::int n from warehouse_people where warehouse_id=$1',[w1])).rows[0].n,1);
  assert.deepEqual((await pool.query('select (select count(*) from users) users,(select count(*) from accounts) accounts')).rows[0],accountsBefore,'El formulario no crea usuarios ni credenciales');
  assert.equal((await pool.query('select stock from materials where id=$1',[m1])).rows[0].stock,10,'Un pedido pendiente no descuenta stock');
  assert(!(await receiveMaterialRequest({...input,materialId:m2,submissionKey:randomUUID()})).ok,'Material de otro almacén rechazado');
  assert(!(await receiveMaterialRequest({...input,quantity:-1,submissionKey:randomUUID()})).ok,'Cantidad inválida rechazada');
  await pool.query('update warehouses set requests_enabled=false where id=$1',[w1]);
  const closedCatalog=await requestCatalog();assert(!closedCatalog.people.some(p=>p.warehouse_id===w1),'Un almacén cerrado no publica su directorio');
  assert(!(await receiveMaterialRequest({...input,submissionKey:randomUUID()})).ok,'Cierre de formulario aplicado en servidor');
  await pool.query('update warehouses set requests_enabled=true where id=$1',[w1]);
  const c1=await login(a1),c2=await login(a2);
  const dashboard=await fetch(`${base}/dashboard`,{headers:{Cookie:c1}});assert((await dashboard.text()).includes(document));
  const other=await fetch(`${base}/dashboard`,{headers:{Cookie:c2}});assert(!(await other.text()).includes(document),'Historial privado aislado por almacén');
  assert.equal((await fetch(`${base}/consultar-solicitud`)).status,200,'Consulta accesible sin cuenta');
  const manifest=JSON.parse(readFileSync(existsSync('.next/dev/server/server-reference-manifest.json')?'.next/dev/server/server-reference-manifest.json':'.next/server/server-reference-manifest.json','utf8'));
  for(const [id,value] of Object.entries(manifest.node) as [string,{exportedName?:string}][]){if(value.exportedName==='warehouseAction')actionId=id;if(value.exportedName==='getDeliveryReceipt')receiptId=id;}
  assert(actionId&&receiptId,'Acciones administrativas compiladas');
  const materialInput={type:'material',warehouseId:w1,name:`${prefix}-auto`,category:'Prueba',unit:'Unidad',stock:0,minimum:2,location:'Prueba',reason:'Alta con código automático'};
  const generated=await Promise.all([action(c1,materialInput),action(c2,{...materialInput,warehouseId:w2})]);
  assert(generated.every(result=>result.ok),JSON.stringify(generated));
  const automatic=(await pool.query('select id,code,warehouse_id from materials where name=$1',[materialInput.name])).rows;
  assert.equal(automatic.length,2);assert.equal(new Set(automatic.map(m=>m.code)).size,2,'Altas simultáneas en distintos almacenes tienen códigos únicos');
  for(const material of automatic)assert.match(material.code,/^[A-Z]{1,3}-\d{4,}$/);
  const editable=automatic.find(m=>m.warehouse_id===w1);assert(editable);
  assert((await action(c1,{...materialInput,id:editable.id,name:`${prefix}-edited`,code:'NO-DEBE-CAMBIAR'})).ok);
  assert.equal((await pool.query('select code from materials where id=$1',[editable.id])).rows[0].code,editable.code,'Editar conserva el código incluso ante un código enviado por otro cliente');
  const lookupId=(Object.entries(manifest.node) as [string,{exportedName?:string}][]).find(([,v])=>v.exportedName==='consultMaterialRequests')?.[0];assert(lookupId);
  const publicStatus=await action('',{document,reference:first.reference},lookupId);assert(publicStatus.ok);assert.equal(publicStatus.requests.length,1,'La consulta por CI y comprobante funciona sin cookie de sesión');
  const publicReceiptId=(Object.entries(manifest.node) as [string,{exportedName?:string}][]).find(([,v])=>v.exportedName==='getPublicRequestReceipt')?.[0];assert(publicReceiptId);
  const receiptData=await action('',{document,reference:first.reference},publicReceiptId);assert(receiptData.ok);assert.equal(receiptData.data.requester.document,document,'Descarga permitida con CI y comprobante, sin sesión administrativa');
  assert(!(await action('',{document:'NOREGISTRADO'+document,reference:first.reference},publicReceiptId)).ok,'Otro CI no accede a datos del comprobante');
  const profile={type:'person',id:person.id,warehouseId:w1,name:'Persona verificada por administración',document,regional:'La Paz',position:'Pruebas',department:'Pruebas',phone:''};
  assert((await action(c1,profile)).ok,'La administradora corrige la ficha sin crear cuenta');
  assert(!(await action(c2,{...profile,warehouseId:w2})).ok,'Otra administradora no modifica la ficha');
  assert((await action(c1,{...profile,id:undefined,document:'MANUAL'+document})).ok,'Registro manual de ficha sin contraseña');
  assert.deepEqual((await pool.query('select (select count(*) from users) users,(select count(*) from accounts) accounts')).rows[0],accountsBefore,'Registrar fichas manualmente tampoco crea credenciales');
  assert(!(await action(c2,{type:'review',id:first.reference,status:'approved',response:'Prueba',deliveryOn:'2099-01-01'})).ok,'Otra administradora no procesa esta solicitud');
  const approvals=await Promise.all([1,2].map(()=>action(c1,{type:'review',id:first.reference,status:'approved',response:'Prueba',deliveryOn:'2099-01-01'})));
  assert.equal((await pool.query('select delivery_place from material_requests where id=$1',[first.reference])).rows[0].delivery_place,'Prueba aislada 1','La aprobación sin campo de lugar usa el almacén correspondiente');
  assert.equal(approvals.filter(result=>result.ok).length,1,'Una sola reserva ante aprobaciones concurrentes');
  const accepted=await checkStatus(first.reference,'approved');assert.equal(accepted.delivery_on,'2099-01-01');assert.equal(accepted.delivery_place,'Prueba aislada 1');assert.equal(accepted.response,'Prueba');
  assert((await action(c1,{type:'review',id:again.reference,status:'waiting',response:'Esperar reposición'})).ok);
  await checkStatus(again.reference,'waiting');
  assert((await action(c1,{type:'review',id:again.reference,status:'denied',response:'Pedido de prueba rechazado'})).ok);
  await checkStatus(again.reference,'denied');
  assert.equal((await pool.query('select stock from materials where id=$1',[m1])).rows[0].stock,7);
  assert(!(await action(c1,{type:'review',id:first.reference,status:'delivered',response:''})).ok,'La entrega exige verificar CI');
  assert((await action(c1,{type:'review',id:first.reference,status:'delivered',identityConfirmed:'on',response:'CI verificado'})).ok);
  assert((await checkStatus(first.reference,'delivered')).delivered_at);
  const receipt=await action(c1,first.reference,receiptId);assert(receipt.ok);assert.equal(receipt.data.recipient.document,document);assert.equal(receipt.data.recipient.name,'Persona verificada por administración');
  assert((await action(c1,{type:'employee_material',userId:person.id,name:'Material previo',category:'Prueba',unit:'unidad',quantity:2,serial:'',condition:'Bueno',location:'Prueba',recordedOn:'2026-01-01',notes:'',reason:'Registro de prueba'})).ok);
  assert(!(await action(c2,{type:'employee_material',userId:person.id,name:'No permitido',category:'Prueba',unit:'unidad',quantity:1,serial:'',condition:'Bueno',location:'Prueba',recordedOn:'2026-01-01',notes:'',reason:'Prueba'})).ok);
  assert((await action(c1,{type:'delivery_correct',id:first.reference,userId:person.id,quantity:2,reason:'Prueba de corrección'})).ok);
  assert.equal((await pool.query('select stock from materials where id=$1',[m1])).rows[0].stock,8);
  assert((await action(c1,{type:'delivery_void',id:first.reference,reason:'Limpieza de prueba de anulación'})).ok);
  await checkStatus(first.reference,'cancelled');
  assert.deepEqual((await pool.query('select (select count(*) from users) users,(select count(*) from accounts) accounts')).rows[0],accountsBefore,'Consultar estados no crea usuarios ni credenciales');
  assert.equal((await pool.query('select stock from materials where id=$1',[m1])).rows[0].stock,10);
  console.log('OK: solicitud sin cuenta, CI sin duplicados, reintento idempotente, cierre, stock, consulta pública por CI y comprobante sin datos ajenos, todos los estados, entrega con CI, acta, materiales previos y aislamiento por almacén.');
}finally{
  // Solo identificadores de fixtures de esta ejecución.
  await pool.query("delete from notificaciones where warehouse_id=any($1) or user_id=any($2)",[[w1,w2],[a1,a2]]);
  await pool.query("delete from audit_logs where user_id=any($1) or entity_id in(select id from material_requests where material_id=any($2))",[[a1,a2],[m1,m2,extraMaterial]]);
  await pool.query('delete from employee_materials where warehouse_id=any($1)',[[w1,w2]]);
  await pool.query('delete from stock_movements where material_id in(select id from materials where warehouse_id=any($1))',[[w1,w2]]);
  await pool.query('delete from material_requests where material_id=any($1)',[[m1,m2,extraMaterial]]);
  await pool.query('delete from warehouse_people where warehouse_id=any($1)',[[w1,w2]]);
  await pool.query('delete from materials where warehouse_id=any($1)',[[w1,w2]]);
  await pool.query('delete from staff_profiles where user_id=any($1)',[[a1,a2]]);
  await pool.query('delete from users where id=any($1)',[[a1,a2]]);
  await pool.query('delete from warehouses where id=any($1)',[[w1,w2]]);
  await pool.end();
}

}
main().catch(error=>{console.error(error);process.exitCode=1;});
