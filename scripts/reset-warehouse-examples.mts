/** Limpieza solicitada de la base LOCAL. Requiere --apply y crea un respaldo completo antes de modificarla. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { formatMaterialCode } from '../src/lib/material-code';
import { ITEM_CATEGORIES } from '../src/lib/warehouse-reference';
assert(process.argv.includes('--apply'),'Requiere --apply. Elimina materiales, solicitudes y empleados existentes de la base local.');
const url=new URL(process.env.DATABASE_URL!);
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Solo bases locales.');
mkdirSync('backups',{recursive:true});
const backup=`backups/before-requested-catalog-reset-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;
const dump=spawnSync('C:/Program Files/PostgreSQL/15/bin/pg_dump.exe',['-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d',decodeURIComponent(url.pathname.slice(1)),'-Fc','-f',backup],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},encoding:'utf8'});
assert.equal(dump.status,0,'No se pudo crear el respaldo; no se modificó la base.');
assert(statSync(backup).size>1000,'Respaldo vacío; se cancela la limpieza.');
console.log('Respaldo completo:',backup);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),client=await pool.connect();
try {
  await client.query('begin');
  await client.query('lock table materials,warehouse_people,material_requests,employee_materials,stock_movements in exclusive mode');
  const actor=(await client.query("select u.id from users u join user_roles ur on ur.user_id=u.id join roles r on r.id=ur.role_id where r.name='superadmin' and u.is_active limit 1")).rows[0];
  assert(actor,'Se requiere un SuperAdmin.');
  const before=(await client.query('select (select count(*) from materials) as materials,(select count(*) from warehouse_people) as people,(select count(*) from material_requests) as requests')).rows[0];
  // Orden explícito de dependencias, sin cascadas sobre cuentas administrativas.
  await client.query('delete from purchases');
  await client.query('delete from employee_materials');
  await client.query('delete from material_requests');
  await client.query('delete from stock_movements');
  await client.query('delete from materials');
  await client.query('delete from warehouse_people');
  await client.query("delete from notificaciones where module='almacenes'");
  const deleted=await client.query("delete from users u where exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=u.id and r.name='empleado_agbc') and not exists(select 1 from user_roles ur join roles r on r.id=ur.role_id where ur.user_id=u.id and r.name<>'empleado_agbc') returning id");
  const warehouse=(await client.query("select id from warehouses order by case when id='agbc-central' then 0 else 1 end,name limit 1")).rows[0];
  assert(warehouse,'No existe almacén.');
  let sequence=0;
  for(const category of ITEM_CATEGORIES){
    for(const name of category.examples){
      // Ejemplos de catálogo sin existencias, costos ni facturas inventadas.
      await client.query('insert into materials(id,warehouse_id,code,name,category,unit,stock,minimum,location,description) values($1,$2,$3,$4,$5,$6,0,0,$7,$8)',[randomUUID(),warehouse.id,formatMaterialCode(name,++sequence),name,`${category.code} · ${category.name}`,'unidad','Por asignar','Ejemplo de catálogo. Completar presentación y características al registrar la compra.']);
    }
  }
  await client.query("insert into audit_logs(id,user_id,module,action,details,result) values($1,$2,'almacenes','requested_catalog_reset',$3,'success')",[randomUUID(),actor.id,JSON.stringify({backup,before,employeeAccountsRemoved:deleted.rowCount,categories:ITEM_CATEGORIES.length,examples:ITEM_CATEGORIES.reduce((total,category)=>total+category.examples.length,0)})]);
  await client.query('commit');
  console.log(JSON.stringify({removed:before,employeeAccountsRemoved:deleted.rowCount,categories:ITEM_CATEGORIES.length,examples:ITEM_CATEGORIES.reduce((total,category)=>total+category.examples.length,0),stock:0}));
}catch(error){await client.query('rollback');throw error;}finally{client.release();await pool.end();}
