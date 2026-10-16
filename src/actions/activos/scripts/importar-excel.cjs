/* eslint-disable @typescript-eslint/no-require-imports -- CLI CommonJS ejecutable con Node sin compilación. */
/* Importación local de María. No es una Server Action ni un endpoint público. */
require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx');
const { Pool } = require('pg');

const definitions = {
  'AGBC': { start: 2, type: 'inventario', cols: { numero_origen:'A', codigo:'B', auxiliar_grupo:'C', descripcion:'D', estado:'E', observaciones:'F', vida_util:'G', porcentaje_depreciacion:'H', costo_historico:'I', costo_migrado:'J', indicador_r:'Q', costo_final_actualizado:'R', depreciacion_gestion:'S', depreciacion_acumulada:'T', valor_neto:'U', grupo_contable:'V', grupo_contable_codigo:'W', auxiliar_grupo_alterno:'X', ubicacion:'Y', responsable:'Z', rube:'AA', acta:'AB' }, historical:['N','O','P'], migration:['K','L','M'] },
  'AGBC ANTERIOR': { start: 2, type: 'historico', cols: { numero_origen:'A',codigo:'B',descripcion:'C',costo_historico:'D',costo_migrado:'E',indicador_r:'L',costo_final_actualizado:'M',depreciacion_gestion:'N',depreciacion_acumulada:'O',valor_neto:'P',grupo_contable:'Q',auxiliar_grupo:'R',estado:'S',ubicacion:'T',responsable:'U',acta:'V' }, historical:['I','J','K'],migration:['F','G','H'] },
  'EXECOBOL 2024': {start:2,type:'inventario',cols:{numero_origen:'A',descripcion:'D',codigo:'E',codigo_historico:'F',estado:'G',ubicacion:'H',responsable:'I',acta:'J'}},
  'AF Posterior a cierre2025': {start:2,type:'inventario',cols:{numero_origen:'A',descripcion:'B',codigo:'C',codigo_historico:'D',estado:'E',ubicacion:'F',responsable:'G',acta:'H'}},
  'UPU': {start:2,type:'inventario',cols:{numero_origen:'A',codigo:'B',descripcion:'C',estado:'D',ubicacion:'E',responsable:'F',acta:'G',comentario:'H'}},
  'MOPSV': {start:2,type:'inventario',cols:{codigo:'A',descripcion:'B',ubicacion:'C',responsable:'D',acta:'E'}},
  'UPAEP': {start:7,type:'inventario',cols:{numero_origen:'A',descripcion:'B',codigo:'C',estado:'D',observaciones:'E',comentario:'F',ubicacion:'G',responsable:'H',acta:'I'}},
  'ECOBOL': {start:5,type:'inventario',cols:{numero_origen:'A',descripcion:'B',codigo:'C',codigo_historico:'D',estado:'E',ubicacion:'F',responsable:'G'}},
  'PACTA': {start:7,type:'inventario',cols:{numero_origen:'A',codigo_historico:'B',codigo:'C',descripcion:'D',estado:'E',ubicacion:'F',responsable:'G',acta:'H'}},
  'FALTANTES': {start:3,type:'faltantes',cols:{numero_origen:'A',codigo:'B',descripcion:'C',costo_historico:'D',costo_migrado:'E',indicador_r:'L',costo_final_actualizado:'M',depreciacion_gestion:'N',depreciacion_acumulada:'O',valor_neto:'P',grupo_contable:'Q',auxiliar_grupo:'R',ubicacion:'S',responsable:'T'},historical:['I','J','K'],migration:['F','G','H']},
};
const numericFields = new Set(['vida_util','porcentaje_depreciacion','costo_historico','costo_migrado','costo_final_actualizado','depreciacion_gestion','depreciacion_acumulada','valor_neto']);
const placeholders = new Set(['SIN CODIGO','SIN CÓDIGO','S/C','S/N']);
// Confirmado por María: AGBC, EXECOBOL 2024, UPU, PACTA, MOPSV y UPAEP son las versiones vigentes.
const currentSheets = new Set(['AGBC', 'EXECOBOL 2024', 'UPU', 'PACTA', 'MOPSV', 'UPAEP']);
const historicalSheets = new Set(['AGBC ANTERIOR', 'ECOBOL']);

function cellText(cell) {
  if (!cell || cell.v == null || cell.v === '') return null;
  // Conserva ceros a la izquierda en identificadores numéricos con formato 0000.
  return String(cell.t === 'n' && /^0+$/.test(cell.z || '') ? cell.w : cell.v).trim() || null;
}
function sourceDate(sheet, row, columns, field, issues) {
  if (!columns) return null;
  const parts = columns.map(col => sheet[`${col}${row}`]?.v);
  if (parts.every(v => v == null || v === '' || v === 0)) return null;
  const [day,month,year] = parts.map(Number);
  const d = new Date(Date.UTC(year,month-1,day));
  if (!parts.every(v => v != null && v !== '') || ![day,month,year].every(Number.isInteger) || year<1000 || d.getUTCFullYear()!==year || d.getUTCMonth()!==month-1 || d.getUTCDate()!==day) {
    issues.push({campo:field,tipo:'fecha_invalida',original:parts}); return null;
  }
  return d.toISOString().slice(0,10);
}

function extract(file) {
  const bytes = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const workbook = XLSX.read(bytes,{type:'buffer',cellNF:true,cellText:true,cellFormula:true});
  const sheets = workbook.SheetNames.map((name,order) => {
    const sheet=workbook.Sheets[name]; const definition=definitions[name]; const rowMap=new Map();
    for (const [address,cell] of Object.entries(sheet)) {
      if (address.startsWith('!') || (!Object.hasOwn(cell,'v') && !cell.f)) continue;
      const number=XLSX.utils.decode_cell(address).r+1;
      if(!rowMap.has(number)) rowMap.set(number,{});
      const value={}; for(const k of ['t','v','w','f','z']) if(Object.hasOwn(cell,k)) value[k]=cell[k];
      rowMap.get(number)[address]=value;
    }
    const rows=[...rowMap].sort((a,b)=>a[0]-b[0]).map(([number,cells])=>({number,cells,id:crypto.randomUUID()}));
    const assets=[];
    if(definition) for(const row of rows) {
      if(row.number<definition.start) continue;
      const description=cellText(sheet[`${definition.cols.descripcion}${row.number}`]);
      if(!description || /^(TOTAL(?:ES)?|DESCRIPCI[OÓ]N|GRUPO CONTABLE)$/i.test(description)) continue;
      const issues=[]; const asset={fila_origen_id:row.id,origen:name};
      for(const [field,col] of Object.entries(definition.cols)) {
        const c=sheet[`${col}${row.number}`]; let value=cellText(c);
        if(numericFields.has(field) && value!==null) {
          if(c.t==='e' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
            issues.push({campo:field,tipo:'numero_invalido',original:value});value=null;
          }
        }
        asset[field]=value;
      }
      asset.fecha_historica=sourceDate(sheet,row.number,definition.historical,'fecha_historica',issues);
      asset.fecha_migracion=sourceDate(sheet,row.number,definition.migration,'fecha_migracion',issues);
      if(!asset.codigo || placeholders.has(asset.codigo.toUpperCase())) issues.push({campo:'codigo',tipo:'sin_codigo_identificable'});
      asset.incidencias_importacion=issues;
      assets.push(asset);
    }
    const frequencies=new Map();
    for(const a of assets) if(a.codigo && !placeholders.has(a.codigo.toUpperCase())) frequencies.set(a.codigo,(frequencies.get(a.codigo)||0)+1);
    const duplicates=[...frequencies].filter(([,n])=>n>1);
    for(const a of assets) if(frequencies.get(a.codigo)>1) a.incidencias_importacion.push({campo:'codigo',tipo:'codigo_repetido_en_hoja'});
    return {id:crypto.randomUUID(),name,order,type:historicalSheets.has(name)?'historico':definition?.type||'auxiliar',vigencia:currentSheets.has(name)?'vigente':historicalSheets.has(name)?'historico':'pendiente',rows,assets,duplicates};
  });
  return {bytes,sha,sheets,summary:{archivo:path.basename(file),hojas:sheets.map(s=>({nombre:s.name,tipo:s.type,vigencia:s.vigencia,filas:s.rows.length,celdas:s.rows.reduce((n,r)=>n+Object.keys(r.cells).length,0),registros:s.assets.length,codigosRepetidos:s.duplicates.length,registrosConIncidencias:s.assets.filter(a=>a.incidencias_importacion.length).length})),nota:'Vigentes confirmados por María: AGBC, EXECOBOL 2024, UPU, PACTA, MOPSV y UPAEP. Las otras procedencias quedan pendientes; las versiones anteriores se conservan como históricas. No se fusionan códigos repetidos.'}};
}

async function importWorkbook(file,dryRun=false) {
  const data=extract(file);
  if(dryRun) {console.log(JSON.stringify(data.summary,null,2));return;}
  if(!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
  const pool=new Pool({connectionString:process.env.DATABASE_URL}); const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('activos_importacion_excel'))");
    const existing=await client.query('SELECT id FROM act_importaciones WHERE archivo_sha256=$1',[data.sha]);
    if(existing.rowCount) {
      await client.query('ROLLBACK');
      console.log('El archivo ya fue importado. No se duplicó ningún registro.');return;
    }
    const importId=crypto.randomUUID();
    await client.query('INSERT INTO act_importaciones(id,archivo_nombre,archivo_sha256,archivo_original,resumen) VALUES($1,$2,$3,$4,$5)',[importId,path.basename(file),data.sha,data.bytes,JSON.stringify(data.summary)]);
    for(const s of data.sheets) {
      await client.query('INSERT INTO act_hojas_importadas(id,importacion_id,nombre,orden,tipo,vigencia,filas_con_datos,registros_activos) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[s.id,importId,s.name,s.order,s.type,s.vigencia,s.rows.length,s.assets.length]);
      for(let offset=0;offset<s.rows.length;offset+=200) {
        const rows=s.rows.slice(offset,offset+200); const params=[];
        const tuples=rows.map(r=>{const base=params.length;params.push(r.id,s.id,r.number,JSON.stringify(r.cells));return `($${base+1},$${base+2},$${base+3},$${base+4}::jsonb)`;});
        await client.query(`INSERT INTO act_filas_importadas(id,hoja_id,fila_excel,celdas) VALUES ${tuples.join(',')}`,params);
      }
      for(let offset=0;offset<s.assets.length;offset+=100) {
        const assets=s.assets.slice(offset,offset+100);
        const fields=Object.keys(assets[0]);const params=[];
        const tuples=assets.map(a=>`(${fields.map(f=>{params.push(f==='incidencias_importacion'?JSON.stringify(a[f]):a[f]);return `$${params.length}${f==='incidencias_importacion'?'::jsonb':''}`;}).join(',')})`);
        await client.query(`INSERT INTO act_activos(${fields.join(',')}) VALUES ${tuples.join(',')}`,params);
      }
    }
    const result=await client.query('SELECT h.nombre,h.filas_con_datos,h.registros_activos,count(DISTINCT f.id)::int AS filas_guardadas,count(a.id)::int AS activos_guardados FROM act_hojas_importadas h LEFT JOIN act_filas_importadas f ON f.hoja_id=h.id LEFT JOIN act_activos a ON a.fila_origen_id=f.id WHERE h.importacion_id=$1 GROUP BY h.id ORDER BY h.orden',[importId]);
    for(const r of result.rows) if(r.filas_con_datos!==r.filas_guardadas || r.registros_activos!==r.activos_guardados) throw new Error(`No coincide la carga de ${r.nombre}`);
    await client.query('COMMIT');
    console.log(JSON.stringify({importacionId:importId,...data.summary,verificacion:result.rows},null,2));
  } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();await pool.end();}
}
if(require.main===module) {
  const args=process.argv.slice(2);const file=args.find(a=>!a.startsWith('--'));
  if(!file) {console.error('Uso: node src/actions/activos/scripts/importar-excel.cjs "ruta.xlsx" [--dry-run]');process.exitCode=1;}
  else importWorkbook(file,args.includes('--dry-run')).catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={extract,importWorkbook};
