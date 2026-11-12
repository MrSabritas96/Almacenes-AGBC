/* Importa los libros Excel de vehículos conservando archivo, hojas y celdas originales.
 * No crea activos duplicados ni importa PDF. Uso local, no es un endpoint público.
 */
require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx');
const { Pool } = require('pg');

function extraer(file) {
  const bytes = fs.readFileSync(file);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const workbook = XLSX.read(bytes, { type: 'buffer', cellNF: true, cellText: true, cellFormula: true });
  const hojas = workbook.SheetNames.map((nombre, orden) => {
    const sheet = workbook.Sheets[nombre];
    const porFila = new Map();
    for (const [direccion, celda] of Object.entries(sheet)) {
      if (direccion.startsWith('!') || (!Object.hasOwn(celda, 'v') && !celda.f)) continue;
      const fila = XLSX.utils.decode_cell(direccion).r + 1;
      if (!porFila.has(fila)) porFila.set(fila, {});
      const valor = {};
      for (const campo of ['t', 'v', 'w', 'f', 'z']) if (Object.hasOwn(celda, campo)) valor[campo] = celda[campo];
      porFila.get(fila)[direccion] = valor;
    }
    const filas = [...porFila].sort((a, b) => a[0] - b[0]).map(([numero, celdas]) => ({ numero, celdas, id: crypto.randomUUID() }));
    const get = (celda) => String(sheet[celda]?.w ?? sheet[celda]?.v ?? '').replace(/\s+/g, ' ').trim();
    const placa = get('B9').replace(/[^a-z0-9]/gi, '').toUpperCase();
    const conductor = get('A11').replace(/^CONDUCTOR\s+ASIGNADO\s*:\s*/i, '').trim();
    const filasServicio = filas.filter(r => r.numero > 15 && String(r.celdas[`C${r.numero}`]?.w ?? r.celdas[`C${r.numero}`]?.v ?? '').trim() && !/^_+$/.test(String(r.celdas[`C${r.numero}`]?.w ?? r.celdas[`C${r.numero}`]?.v ?? '').trim()));
    return { id: crypto.randomUUID(), nombre, orden, filas, placa, conductor, filasServicio: filasServicio.length };
  });
  return {
    bytes,
    sha,
    hojas,
    resumen: {
      archivo: path.basename(file),
      tipo: 'kardex_vehiculos',
      hojas: hojas.length,
      hojasConPlaca: hojas.filter(h => h.placa).length,
      placas: [...new Set(hojas.flatMap(h => h.placa ? [h.placa] : []))],
      filasServicio: hojas.reduce((total, h) => total + h.filasServicio, 0),
      filasOriginales: hojas.reduce((total, h) => total + h.filas.length, 0),
      activosCreados: 0,
      nota: 'Se preserva el Excel original y sus celdas. Las fichas se relacionan por placa al inventario vigente. No se crean activos nuevos ni se procesan archivos PDF.',
    },
  };
}

async function importar(file, dryRun = false) {
  const data = extraer(file);
  if (dryRun) { console.log(JSON.stringify(data.resumen, null, 2)); return; }
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('activos_importacion_excel'))");
    const existing = await client.query('SELECT id FROM act_importaciones WHERE archivo_sha256=$1', [data.sha]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ archivo: path.basename(file), yaImportado: true, duplicadosCreados: 0 }));
      return;
    }
    const importId = crypto.randomUUID();
    await client.query(
      'INSERT INTO act_importaciones(id,archivo_nombre,archivo_sha256,archivo_original,resumen) VALUES($1,$2,$3,$4,$5)',
      [importId, path.basename(file), data.sha, data.bytes, JSON.stringify(data.resumen)],
    );
    for (const hoja of data.hojas) {
      await client.query(
        'INSERT INTO act_hojas_importadas(id,importacion_id,nombre,orden,tipo,vigencia,filas_con_datos,registros_activos) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [hoja.id, importId, hoja.nombre, hoja.orden, 'kardex_vehiculos', 'vigente', hoja.filas.length, 0],
      );
      for (let offset = 0; offset < hoja.filas.length; offset += 150) {
        const filas = hoja.filas.slice(offset, offset + 150);
        const params = [];
        const tuples = filas.map(f => {
          const base = params.length;
          params.push(f.id, hoja.id, f.numero, JSON.stringify(f.celdas));
          return `($${base + 1},$${base + 2},$${base + 3},$${base + 4}::jsonb)`;
        });
        await client.query(`INSERT INTO act_filas_importadas(id,hoja_id,fila_excel,celdas) VALUES ${tuples.join(',')}`, params);
      }
    }
    const verificacion = await client.query(
      'SELECT h.nombre,h.filas_con_datos,count(f.id)::int AS filas_guardadas FROM act_hojas_importadas h LEFT JOIN act_filas_importadas f ON f.hoja_id=h.id WHERE h.importacion_id=$1 GROUP BY h.id ORDER BY h.orden',
      [importId],
    );
    for (const hoja of verificacion.rows) if (hoja.filas_con_datos !== hoja.filas_guardadas) throw new Error(`No coincide la carga de la hoja ${hoja.nombre}`);
    await client.query('COMMIT');
    console.log(JSON.stringify({ importacionId: importId, ...data.resumen, verificacion: verificacion.rows }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  if (!file) {
    console.error('Uso: node src/actions/activos/scripts/importar-kardex-vehiculos.cjs "ruta.xlsx" [--dry-run]');
    process.exitCode = 1;
  } else importar(file, args.includes('--dry-run')).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { extraer, importar };
