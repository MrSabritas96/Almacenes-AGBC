/** Actualiza únicamente etiquetas de categorías, con respaldo completo y correspondencia anterior/nuevo. No inicia el servidor. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdirSync,statSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {ITEM_CATEGORIES,categoryLabel,categoryAliases} from '../src/lib/warehouse-reference';
assert(process.argv.includes('--apply'),'Requiere --apply para actualizar las categorías existentes.');
const url=new URL(process.env.DATABASE_URL!);
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Solo se permite la base local.');
mkdirSync('backups',{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=`backups/before-category-recode-${stamp}.dump`;
const dump=spawnSync('C:/Program Files/PostgreSQL/15/bin/pg_dump.exe',['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',decodeURIComponent(url.pathname.slice(1)),'-Fc','-f',backup],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},encoding:'utf8'});
assert.equal(dump.status,0,'Respaldo fallido. No se modificó ningún código.');
assert(statSync(backup).size>1000,'Respaldo vacío.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
try {
  await client.query('begin');
  await client.query("select pg_advisory_xact_lock(hashtextextended('warehouse-material-code',0))");
  const preservedTables=['materials','employee_materials','stock_movements','purchases','inventory_batches','inventory_allocations','material_requests'];
  await client.query(`lock table ${preservedTables.join(',')} in share row exclusive mode`);
  async function fingerprint(){
    const result:Record<string,string>={};
    for(const table of preservedTables){
      const query=await client.query(`select md5(coalesce(jsonb_agg(to_jsonb(t)-'category' order by (to_jsonb(t)-'category')::text)::text,'[]')) as signature from ${table} t`);
      result[table]=query.rows[0].signature;
    }
    return result;
  }
  const before=await fingerprint();
  const actor=(await client.query("select u.id from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name='superadmin' and u.is_active limit 1")).rows[0];
  assert(actor,'Se requiere un SuperAdmin para dejar constancia en auditoría.');
  const mapping=ITEM_CATEGORIES.map(c=>({previous:categoryAliases(c).filter(alias=>alias!==categoryLabel(c)),category:categoryLabel(c),code:c.code}));
  writeFileSync(`backups/category-code-mapping-${stamp}.json`,JSON.stringify({backup,mapping},null,2));
  let materials=0,holdings=0;
  for(const row of mapping){
    materials+=(await client.query('update materials set category=$2 where category=any($1::text[])',[row.previous,row.category])).rowCount??0;
    holdings+=(await client.query('update employee_materials set category=$2 where category=any($1::text[])',[row.previous,row.category])).rowCount??0;
  }
  const after=await fingerprint();
  assert.deepEqual(after,before,'Se detectó un cambio fuera de las etiquetas de categoría. Se revierte toda la operación.');
  await client.query("insert into audit_logs(id,user_id,module,action,details,result) values($1,$2,'almacenes','category_recode',$3,'success')",[randomUUID(),actor.id,JSON.stringify({backup,mapping,materials,holdings})]);
  await client.query('commit');
  writeFileSync(`backups/category-recode-verification-${stamp}.json`,JSON.stringify({backup,before,after,materials,holdings},null,2));
  console.log(JSON.stringify({categories:mapping.length,materials,holdings,backup,preservedTables:preservedTables.length,examples:mapping.slice(0,3).map(c=>({category:c.category,code:c.code}))}));
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
