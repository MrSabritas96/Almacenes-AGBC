import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq,sql } from "drizzle-orm";
import { db,pool,schema } from "@/db";
import { actInventarioVigente,actAsignaciones,actFilasImportadas,actHojasImportadas } from "@/db/schema/activos.schema";
import { registrarActivoManual } from "../activo-nuevo-servicio";
import { nuevoActivoSchema } from "../activo-nuevo-modelo";
import { seriesCodigosActivo,separarCodigo } from "../activo-codigos";
import { clasificarActivo } from "../categorias-modelo";
async function main(){
 const [user]=await db.select().from(schema.users).where(eq(schema.users.email,"admin@agbc.local"));assert(user);
 const total=async()=>Number((await db.execute<{n:number}>(sql`select count(*)::int n from act_inventario_vigente`)).rows[0]!.n);
 const antes=await total(),rollback=new Error("ROLLBACK_PRUEBA");
 try{await db.transaction(async tx=>{
  const contarCategorias=async()=>{const rows=await tx.select({grupo:actInventarioVigente.grupoContable,descripcion:actInventarioVigente.descripcion}).from(actInventarioVigente);const counts:Record<string,number>={};for(const r of rows){const c=clasificarActivo(r.grupo,r.descripcion).categoria;counts[c]=(counts[c]??0)+1;}return counts;};
  const categoriasAntes=await contarCategorias();
  const input=nuevoActivoSchema.parse({solicitudId:randomUUID(),codigo:"CODIGO-MANIPULADO-999",serie:"AGBC-02-01-",descripcion:"Equipo de oficina para prueba revertida",categoria:"muebles",origen:"AGBC",estado:"BUENO",regional:"La Paz",ubicacion:"Depósito de prueba",responsableId:null,observaciones:"Prueba sin alta definitiva"});
  const serieAntes=(await seriesCodigosActivo("AGBC",tx)).find(s=>s.prefijo===input.serie)!;assert(serieAntes);
  const a=await registrarActivoManual(input,user.id,tx);const [saved]=await tx.select().from(actInventarioVigente).where(eq(actInventarioVigente.id,a.id));assert(saved);
  const categoriasDespues=await contarCategorias();assert.equal(categoriasDespues.muebles,(categoriasAntes.muebles??0)+1);for(const [categoria,n] of Object.entries(categoriasAntes))if(categoria!=="muebles")assert.equal(categoriasDespues[categoria],n);
  assert.equal(clasificarActivo(saved.grupoContable,saved.descripcion).categoria,"muebles");assert.equal(saved.responsable,null);assert.equal(saved.codigo,serieAntes.siguiente);assert.equal(a.codigo,saved.codigo);
  assert.equal((await registrarActivoManual(input,user.id,tx)).id,a.id);
  await assert.rejects(()=>registrarActivoManual({...input,descripcion:"Solicitud modificada"},user.id,tx),/solicitud ya se utilizó/);
  const segundo=await registrarActivoManual({...input,solicitudId:randomUUID()},user.id,tx);
  assert.notEqual(segundo.codigo,a.codigo);assert.equal(separarCodigo(segundo.codigo)!.numero,separarCodigo(a.codigo)!.numero+1n);
  const cliente=await pool.connect();try{await cliente.query("begin");const r=await cliente.query("select pg_try_advisory_xact_lock(hashtext($1)) libre",[`alta-activo-serie:${input.serie}`]);assert.equal(r.rows[0].libre,false);}finally{await cliente.query("rollback");cliente.release();}
  await assert.rejects(()=>registrarActivoManual({...input,solicitudId:randomUUID(),serie:"INEXISTENTE-"},user.id,tx),/No se encuentra esa serie/);
  assert.equal((await tx.select().from(actAsignaciones).where(eq(actAsignaciones.activoId,a.id))).length,0);
  const [h]=await tx.select({tipo:actHojasImportadas.tipo}).from(actFilasImportadas).innerJoin(actHojasImportadas,eq(actHojasImportadas.id,actFilasImportadas.hojaId)).where(eq(actFilasImportadas.id,saved.filaOrigenId));assert.equal(h!.tipo,"alta_manual");
  assert.equal(Number((await tx.execute<{n:number}>(sql`select count(*)::int n from act_inventario_vigente`)).rows[0]!.n),antes+2);
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}
 assert.equal(await total(),antes);console.log(JSON.stringify({altaEnInventario:true,categoriaGuardada:true,idempotencia:true,correlativosConsecutivos:true,bloqueoConcurrenteVerificado:true,codigoDelClienteIgnorado:true,sinActaAutomatica:true,origenManualTrazable:true,pruebaRevertida:true,totalInventario:antes}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
