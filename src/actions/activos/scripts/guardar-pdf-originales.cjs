/* eslint-disable @typescript-eslint/no-require-imports -- CLI local para PDF exportados de Excel. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../..');require(root+'/node_modules/dotenv').config({path:root+'/.env',quiet:true});const{Client}=require('pg');
async function guardar(planPath,pdfFolder,controlPath){
 const plan=JSON.parse(fs.readFileSync(planPath,'utf8')),control=JSON.parse(fs.readFileSync(controlPath,'utf8'));
 assert.equal(control.verificados,plan.length,'Falta verificar algún PDF');assert.equal(control.incidencias.length,0,'Existen PDF pendientes de revisión');
 const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const files=new Map(plan.map(p=>[p.ruta,p.sha256]));for(const [file,hash] of files)assert.equal(sha(fs.readFileSync(file)),hash,'Cambió el Excel original');
 const client=new Client({connectionString:process.env.DATABASE_URL});await client.connect();
 try{await client.query('begin');await client.query('select pg_advisory_xact_lock(735205)');
 const before=(await client.query('select id,md5(documento::text) contenido,responsable_id,numero,tipo,fecha from act_documentos_archivo order by id')).rows;
 const custody=(await client.query('select * from act_custodia_actual order by id')).rows;let bytes=0;
 for(const p of plan){assert(/^[a-f0-9-]{36}$/.test(p.id));const pdf=fs.readFileSync(path.join(pdfFolder,p.id+'.pdf'));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');const hash=sha(pdf);assert.equal(control.pdfs.find(row=>row.id===p.id)?.sha256,hash,'El PDF cambió después de la revisión');const result=await client.query('update act_archivo_pdf set pdf_original=$2,pdf_sha256=$3,motor=$4 where documento_id=$1 and fuente_sha256=$5',[p.id,pdf,hash,p.oculto?'LibreOffice 26.8.1 - consulta de contenido oculto':'LibreOffice 26.8.1 - exportación del Excel original',p.sha256]);assert.equal(result.rowCount,1,'Falta clasificación o cambió la fuente: '+p.id);bytes+=pdf.length;}
 assert.deepEqual((await client.query('select id,md5(documento::text) contenido,responsable_id,numero,tipo,fecha from act_documentos_archivo order by id')).rows,before);
 assert.deepEqual((await client.query('select * from act_custodia_actual order by id')).rows,custody);
 const [count]=(await client.query('select count(*)::int n,count(*) filter(where pdf_original is not null)::int pdfs from act_archivo_pdf')).rows;assert.equal(count.pdfs,plan.length);
 await client.query('commit');return {actas:plan.length,pdfGuardados:count.pdfs,bytes,excelOriginalesVerificados:files.size,bienesSinCambios:custody.length,documentosSinCambios:before.length};
 }catch(e){await client.query('rollback');throw e}finally{await client.end()}
}
if(require.main===module){if(process.argv.length!==5)throw Error('Uso: guardar-pdf-originales.cjs plan.json carpeta_pdf control.json');guardar(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});}
module.exports={guardar};
