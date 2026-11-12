/** Ordena categorías y materiales por nombre y reasigna códigos, con respaldo y correspondencia anterior/nuevo. No inicia el servidor. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdirSync,statSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {formatMaterialCode} from '../src/lib/material-code';
import {categoryInfo,categoryLabel,compareInventoryMaterials} from '../src/lib/warehouse-reference';
assert(process.argv.includes('--apply'),'Requiere --apply para actualizar los códigos existentes.');
const url=new URL(process.env.DATABASE_URL!);
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Solo se permite la base local.');
mkdirSync('backups',{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=`backups/before-material-recode-${stamp}.dump`;
const dump=spawnSync('C:/Program Files/PostgreSQL/15/bin/pg_dump.exe',['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',decodeURIComponent(url.pathname.slice(1)),'-Fc','-f',backup],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},encoding:'utf8'});
assert.equal(dump.status,0,'Respaldo fallido. No se modificó ningún código.');
assert(statSync(backup).size>1000,'Respaldo vacío.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
try {
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtextextended('warehouse-material-code',0))");
  await client.query('lock table materials,employee_materials,material_requests,stock_movements,inventory_batches,inventory_allocations,purchases in exclusive mode');
  const actor=(await client.query("select u.id from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name='superadmin' and u.is_active limit 1")).rows[0];
  assert(actor,'Se requiere un SuperAdmin para dejar constancia en auditoría.');
  const {rows}=await client.query('select * from materials');
  rows.sort(compareInventoryMaterials);
  const holdings=(await client.query('select * from employee_materials order by id')).rows;
  const protectedTables=['material_requests','stock_movements','inventory_batches','inventory_allocations','purchases'];
  async function fingerprints(){
    const hashes:string[]=[];
    for(const table of protectedTables)hashes.push((await client.query(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'')) as hash from ${table} t`)).rows[0].hash);
    return hashes;
  }
  const beforeFingerprints=await fingerprints();
  const mapping=rows.map((m,index)=>({id:m.id,name:m.name,previous:m.code,previousCategory:m.category,category:categoryInfo(m.category)?categoryLabel(categoryInfo(m.category)!):m.category,code:formatMaterialCode(m.name,index+1)}));
  writeFileSync(`backups/material-code-mapping-${stamp}.json`,JSON.stringify({backup,mapping,holdings},null,2));
  // Primero libera los códigos originales para evitar colisiones con la restricción única.
  for(const row of mapping)await client.query('update materials set code=$2 where id=$1',[row.id,`RECODE-${randomUUID()}`]);
  for(const row of mapping)await client.query('update materials set code=$2,category=$3 where id=$1',[row.id,row.code,row.category]);
  for(const row of holdings){const category=categoryInfo(row.category);if(category)await client.query('update employee_materials set category=$2 where id=$1',[row.id,categoryLabel(category)]);}
  const after=(await client.query('select * from materials')).rows;
  for(const row of after){const old=rows.find(m=>m.id===row.id)!;assert.deepEqual({...row,code:old.code,category:old.category},old,'Solo cambia código y etiqueta de categoría');}
  const afterHoldings=(await client.query('select * from employee_materials order by id')).rows;
  assert.deepEqual(afterHoldings.map((row,i)=>({...row,category:holdings[i].category})),holdings);
  assert.deepEqual(await fingerprints(),beforeFingerprints,'Conserva PEPS, movimientos, compras y solicitudes');
  await client.query("insert into audit_logs(id,user_id,module,action,details,result) values($1,$2,'almacenes','alphabetical_inventory_recode',$3,'success')",[randomUUID(),actor.id,JSON.stringify({backup,mapping})]);
  const codes=(await client.query('select code,name from materials')).rows;
  assert.equal(new Set(codes.map(m=>m.code)).size,mapping.length);
  const numbers=codes.map(m=>Number(m.code.match(/\d+$/)![0])).sort((a,b)=>a-b);
  assert(numbers.every((n,i)=>n===i+1),'Los números deben ser consecutivos.');
  assert(codes.every(m=>m.code===formatMaterialCode(m.name,Number(m.code.match(/\d+$/)![0]))));
  await client.query('commit');
  console.log(JSON.stringify({updated:mapping.length,backup,mappingFile:`backups/material-code-mapping-${stamp}.json`,examples:mapping.slice(0,4)}));
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
