import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pool } from '../src/db';
import { parseWarehouseImport, storeWarehouseImport } from '../src/lib/warehouse-import';

const [path, warehouseId, mode] = process.argv.slice(2);
try {
  if (!path || !warehouseId || (mode && mode !== '--apply')) {
    throw new Error('Uso: pnpm exec tsx scripts/import-warehouse-closing.mts archivo.xlsx almacén [--apply]');
  }
  const bytes = await readFile(path);
  const imported = await parseWarehouseImport('Cierre', bytes);
  if (imported.kind !== 'Cierre') throw new Error('Formato de cierre inválido.');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await storeWarehouseImport(client, {
      imported, warehouseId, actor: null, filename: basename(path), bytes, apply: mode === '--apply',
    });
    await client.query('commit');
    console.log({ warehouseId, year: imported.closing.year, summaryRows: imported.closing.summaryRows.length,
      detailRows: imported.closing.detailRows.length, totals: imported.closing.detailTotals,
      status: result.alreadyImported ? 'Ya registrado' : mode === '--apply' ? 'Importado' : 'Validado' });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
