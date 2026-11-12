/** Reemplaza únicamente ejemplos vacíos y sin historial; no elimina personas ni operaciones. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {ITEM_CATEGORIES,categoryLabel} from '../src/lib/warehouse-reference';
import {formatMaterialCode} from '../src/lib/material-code';

assert(process.argv.includes('--apply'),'Requiere --apply para reemplazar los ejemplos locales.');
const url=new URL(process.env.DATABASE_URL!);
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Solo se permite la base local.');
const description='Ejemplo de catálogo. Completar presentación y características al registrar la compra.';
const desired=ITEM_CATEGORIES.flatMap(category=>category.examples.map(name=>({name,category:categoryLabel(category)})));
assert.equal(new Set(desired.map(m=>m.name)).size,desired.length,'Los ejemplos deben ser únicos.');
mkdirSync('backups',{recursive:true});
const backup=`backups/before-office-transport-examples-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;
const dump=spawnSync('C:/Program Files/PostgreSQL/15/bin/pg_dump.exe',['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',decodeURIComponent(url.pathname.slice(1)),'-Fc','-f',backup],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},encoding:'utf8'});
assert.equal(dump.status,0,'Respaldo fallido; no se modificó la base.');
assert(statSync(backup).size>1000,'Respaldo vacío.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
try{
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtextextended('warehouse-material-code',0))");
  await client.query('lock table materials,material_requests,stock_movements,purchases,employee_materials in exclusive mode');
  const actor=(await client.query("select u.id from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name='superadmin' and u.is_active limit 1")).rows[0];
  assert(actor,'Se requiere un SuperAdmin para registrar la auditoría.');
  const warehouse=(await client.query("select id from warehouses order by case when id='agbc-central' then 0 else 1 end,name limit 1")).rows[0];
  assert(warehouse,'No existe almacén.');
  const before=(await client.query('select * from materials order by code')).rows;
  const candidates=(await client.query(`select m.* from materials m where m.description=$1 and m.stock=0 and m.unit_cost=0 and m.minimum=0 and not m.archived and m.invoice_description='' and m.location='Por asignar'
    and not exists(select 1 from material_requests r where r.material_id=m.id)
    and not exists(select 1 from stock_movements s where s.material_id=m.id)
    and not exists(select 1 from purchases p where p.material_id=m.id)
    and not exists(select 1 from employee_materials e where e.warehouse_id=m.warehouse_id and e.name=m.name)`,[description])).rows;
  const ids=candidates.map(m=>m.id);
  const protectedRows=before.filter(m=>!ids.includes(m.id));
  let sequence=protectedRows.reduce((max,m)=>Math.max(max,Number(m.code.match(/\d+$/)?.[0]??0)),0);
  const replacements=desired.filter(m=>!protectedRows.some(p=>p.warehouse_id===warehouse.id&&p.name===m.name&&p.category===m.category)).map(m=>({...m,code:formatMaterialCode(m.name,++sequence)}));
  if(candidates.length===replacements.length&&replacements.every(m=>candidates.some(p=>p.warehouse_id===warehouse.id&&p.code===m.code&&p.name===m.name&&p.category===m.category))){
    await client.query('rollback');
    console.log(JSON.stringify({unchanged:true,examples:replacements.length,backup}));
  }else{
    await client.query('delete from materials where id=any($1::text[])',[ids]);
    for(const row of replacements)await client.query('insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location,description) values($1,$2,$3,$4,$5,$6,0,0,$7,$8)',[randomUUID(),warehouse.id,row.code,row.name,row.category,'unidad','Por asignar',description]);
    const after=(await client.query('select * from materials where id=any($1::text[]) order by code',[protectedRows.map(m=>m.id)])).rows;
    assert.deepEqual(after,protectedRows,'Los registros ajenos al reemplazo deben permanecer intactos.');
    assert.equal((await client.query('select count(*)::int n from materials')).rows[0].n,protectedRows.length+replacements.length);
    await client.query("insert into audit_logs(id,user_id,module,action,details,result) values($1,$2,'almacenes','office_transport_examples',$3,'success')",[randomUUID(),actor.id,JSON.stringify({backup,removed:ids.length,inserted:replacements.length,preserved:protectedRows.length,categories:ITEM_CATEGORIES.filter(c=>c.examples.length).length})]);
    await client.query('commit');
    console.log(JSON.stringify({removed:ids.length,inserted:replacements.length,preserved:protectedRows.length,backup}));
  }
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
