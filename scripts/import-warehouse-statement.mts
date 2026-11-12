import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../src/db';
import { readWarehouseWorkbook, type WarehouseClosing } from '../src/lib/warehouse-closing';
import { parseClosingStatement } from '../src/lib/warehouse-closing-statement';

const [file, warehouse, year, mode] = process.argv.slice(2);
try {
  if (!file || !warehouse || !/^\d{4}$/.test(year??'') || (mode && mode !== '--apply')) {
    throw new Error('Uso: pnpm exec tsx scripts/import-warehouse-statement.mts archivo.xlsx almacén año [--apply]');
  }
  const bytes = await readFile(file);
  const workbook = await readWarehouseWorkbook(bytes);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const {rows:[closing]} = await client.query<{id:string;data:WarehouseClosing}>(
      'select id,data from warehouse_closings where warehouse_id=$1 and year=$2 for share',[warehouse,year]);
    if (!closing) throw new Error('Primero registra los Cuadros 5 y 6 de ese almacén y año.');
    const data = parseClosingStatement(workbook,closing.data);
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (mode === '--apply') {
      const result=await client.query('insert into warehouse_closing_statements(closing_id,digest,filename,workbook_base64,data) values($1,$2,$3,$4,$5) on conflict(closing_id) do nothing',
        [closing.id,digest,basename(file),bytes.toString('base64'),JSON.stringify(data)]);
      if (result.rowCount) await client.query("insert into audit_logs(id,module,action,entity_id,details,result) values($1,'almacenes','import_closing_statement',$2,$3,'success')",
        [randomUUID(),closing.id,JSON.stringify({digest,year,warehouse})]);
      else {
        const current=await client.query('select digest from warehouse_closing_statements where closing_id=$1',[closing.id]);
        if (current.rows[0]?.digest!==digest) throw new Error('El cierre ya tiene un respaldo de EEFF distinto.');
      }
    }
    await client.query('commit');
    console.log({year, purchases:data.purchases.length, categories:data.outgoing.length, totals:data.totals, headerMismatch:data.dateHeaderMismatch});
  } catch(error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
