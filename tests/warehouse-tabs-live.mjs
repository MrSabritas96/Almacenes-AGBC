import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { io } from 'socket.io-client';

const base='http://localhost:3000';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname),'Solo base local.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const jar=new Map();
const cookie=()=>Array.from(jar,([k,v])=>`${k}=${v}`).join('; ');
function capture(res){for(const c of res.headers.getSetCookie()){const first=c.split(';')[0];const i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1));}}
const tabs=[];const sessions=[];const sockets=[];const materialId=`live-${randomUUID()}`;
let requestId,personId;
async function action(name,args){
  const manifest=JSON.parse(readFileSync('.next/dev/server/server-reference-manifest.json','utf8'));
  const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert(id,`Acción ${name} disponible`);
  const res=await fetch(`${base}/${name==='openWarehouseTab'?'activos':name==='submitPublicRequest'?'solicitar-material':'dashboard'}`,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Origin:base,...(name==='submitPublicRequest'?{}:{Cookie:cookie()}),'Next-Action':id},body:JSON.stringify(args)});
  capture(res);
  const body=await res.text();
  assert.equal(res.status,200,`${name}: ${body.match(/"message":"[^"]+"/)?.[0] ?? res.statusText}`);
  const line=body.split('\n').map(l=>l.slice(l.indexOf(':')+1)).find(l=>l.startsWith('{')&&(/^\{"(?:tabId|ok|items)":/.test(l)));
  assert(line,`Respuesta inesperada de ${name}: ${body.slice(-300)}`);
  return JSON.parse(line);
}
function connect(tabId){return io(base,{path:'/socket.io',auth:{tabId},extraHeaders:{Cookie:cookie(),Origin:base},transports:['websocket'],reconnection:false});}
function event(socket,name,timeout=5000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(name,done);reject(new Error(`Falta evento ${name}`));},timeout);function done(value){clearTimeout(timer);resolve(value);}socket.once(name,done);});}
try {
  await fetch(`${base}/login`);await fetch(`${base}/solicitar-material`);
  for(let i=0;i<2;i++){
    const email=process.env.SEED_ADMIN_EMAIL;
    const password=process.env.SEED_ADMIN_PASSWORD;
    const res=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie()},body:JSON.stringify({email,password})});
    assert.equal(res.status,200);capture(res);const login=await res.json();sessions.push(login.token);
    const loginPage=await fetch(`${base}/login`,{headers:{Cookie:cookie()},redirect:'manual'});
    assert(loginPage.headers.get('location')==='/activos/dashboard'||(await loginPage.text()).includes('NEXT_REDIRECT;replace;/activos/dashboard;307;'));
    const activos=await fetch(`${base}/activos`,{headers:{Cookie:cookie()},redirect:'manual'});
    assert.equal(activos.status,200);
    assert((await activos.text()).includes('Módulos de SIBA'),'Activos usa la misma sesión');
    const tab=await action('openWarehouseTab',[]);assert.equal(typeof tab.tabId,'string',JSON.stringify(Object.keys(tab)));tabs.push(tab.tabId);
    const reopened=await action('openWarehouseTab',[tab.tabId]);
    assert.equal(reopened.tabId,tab.tabId,'Alternar módulos conserva la sesión de la pestaña');
    await fetch(`${base}/dashboard?tab=${tab.tabId}`,{headers:{Cookie:cookie()}});
  }
  assert.notEqual(sessions[0],sessions[1],'Cada ingreso genera una sesión independiente.');
  for(let i=0;i<tabs.length;i++){
    const html=await (await fetch(`${base}/dashboard?tab=${tabs[i]}`,{headers:{Cookie:cookie()}})).text();
    assert(html.replaceAll('\\"','"').includes(`"role":"superadmin"`),`Cada pestaña conserva su rol tras recargar (superadmin): ${JSON.stringify(html.match(/.{0,10}role.{0,40}/g)?.slice(0,5))}; cookies=${Array.from(jar.keys()).join(',')}`);
  }
  const managerFeed=await action('getWarehouseNotifications',[tabs[1]]);assert(Array.isArray(managerFeed.items));
  const invalid=connect(randomUUID());sockets.push(invalid);await event(invalid,'connect_error');assert(!invalid.connected,'No permite otra pestaña sin su cookie');
  const manager=connect(tabs[1]);sockets.push(manager);await event(manager,'connect');
  const warehouse=(await pool.query('select warehouse_id from staff_profiles where user_id=(select user_id from sessions where token=$1)',[sessions[1]])).rows[0].warehouse_id;
  await pool.query("insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location) values($1,$2,$1,$1,'Prueba','Unidad',3,1,'Prueba temporal')",[materialId,warehouse]);
  await pool.query("insert into inventory_batches(material_id,quantity,remaining,unit_cost,source) values($1,3,3,0,'Prueba temporal')",[materialId]);
  const received=event(manager,'warehouse:changed');const started=Date.now();
  const requested=await action('submitPublicRequest',[{name:'Persona de prueba en vivo',document:'LIVE'+randomUUID().replaceAll('-','').slice(0,16),regional:'La Paz',position:'Prueba',department:'Prueba',phone:'',warehouseId:warehouse,materialId,quantity:3,purpose:`Solicitud temporal ${materialId}`,priority:'normal',neededOn:'2099-01-01',submissionKey:randomUUID()}]);
  assert.equal(requested.ok,true);await received;assert(Date.now()-started<5000,'Aviso inmediato, sin esperar al sondeo');
  const inserted=(await pool.query('select id,person_id from material_requests where material_id=$1',[materialId])).rows[0];requestId=inserted.id;personId=inserted.person_id;
  assert((await action('getWarehouseNotifications',[tabs[1]])).items.some(n=>n.entity_id===requestId&&n.kind==='request_new'),'El aviso nuevo está disponible para la campana');
  const stockEvent=event(manager,'warehouse:changed');
  assert.equal((await action('warehouseAction',[{type:'review',id:requestId,status:'approved',response:'Prueba de reserva',deliveryOn:'2099-01-01',deliveryPlace:'Prueba temporal'},tabs[1]])).ok,true);
  await stockEvent;
  assert((await action('getWarehouseNotifications',[tabs[1]])).items.some(n=>n.entity_id===materialId&&n.kind==='stock_out'),'Aviso inmediato de agotamiento tras reservar');
  assert.equal((await action('closeWarehouseTab',[tabs[0]])).ok,true);
  assert(Array.isArray((await action('getWarehouseNotifications',[tabs[1]])).items),'Cerrar una sesión conserva la otra');
  const closed=await (await fetch(`${base}/dashboard?tab=${tabs[0]}`,{headers:{Cookie:cookie()}})).text();
  assert(!closed.replaceAll('\\"','"').includes('"viewer":'),'La pestaña cerrada no hereda otra cuenta');
  console.log('OK: dos sesiones independientes del mismo administrador, cierre independiente, socket autenticado y solicitud pública sin cuenta notificada en menos de 5 segundos.');
} finally {
  for(const s of sockets)s.disconnect();
  await pool.query('delete from notificaciones where entity_id=$1 or entity_id in (select id from material_requests where material_id=$1)',[materialId]);
  await pool.query('delete from audit_logs where entity_id=$1 or entity_id=$2 or details::text like $3',[materialId,requestId??'',`%${materialId}%`]);
  await pool.query('delete from stock_movements where material_id=$1',[materialId]);
  await pool.query('delete from material_requests where material_id=$1',[materialId]);
  await pool.query('delete from materials where id=$1',[materialId]);
  if(personId)await pool.query('delete from warehouse_people where id=$1',[personId]);
  await pool.query('delete from sessions where token=any($1::text[])',[sessions]);
  await pool.end();
}
