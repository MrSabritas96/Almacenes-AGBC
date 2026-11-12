"use server";

import { revalidatePath } from 'next/cache';
import { pool } from '@/db';
import { warehouseContext } from '@/lib/warehouse';
import { maxWorkbookBytes, type WarehouseClosing } from '@/lib/warehouse-closing';
import { WarehouseError } from '@/lib/warehouse-errors';
import type { ClosingStatement } from '@/lib/warehouse-closing-statement';
import { importKinds, parseWarehouseImport, storeWarehouseImport, type ImportKind } from '@/lib/warehouse-import';

export async function importWarehouseWorkbook(form: FormData, tabId?: string) {
  try {
    const viewer = await warehouseContext(tabId);
    const warehouseId = form.get('warehouse');
    const kind = form.get('kind') as ImportKind;
    const file = form.get('file');
    const reviewed = form.get('reviewed');
    const apply = typeof reviewed === 'string' && reviewed.length > 0;
    if (typeof warehouseId !== 'string' || !warehouseId || (viewer.role !== 'superadmin' && viewer.warehouse_id !== warehouseId)) {
      throw new WarehouseError('Selecciona un almacén autorizado.');
    }
    if (!importKinds.includes(kind)) throw new WarehouseError('Selecciona un tipo de importación.');
    if (!(file instanceof File) || !/\.xlsx$/i.test(file.name) || !file.size || file.size > maxWorkbookBytes) {
      throw new WarehouseError('Selecciona un Excel .xlsx de hasta 2 MB.');
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const imported = await parseWarehouseImport(kind, bytes);
    const reviewKey = JSON.stringify([warehouseId, kind, imported.digest]);
    if (apply && reviewed !== reviewKey) throw new WarehouseError('El archivo o el destino cambió. Revisa la vista previa nuevamente.');
    const client = await pool.connect();
    let result;
    try {
      await client.query('begin');
      result = await storeWarehouseImport(client, { imported, warehouseId, actor: viewer.id, filename: file.name.slice(-255), bytes, apply });
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    if (apply) revalidatePath('/dashboard');
    return {
      ok: true as const, apply, reviewKey, ...result,
      count: imported.kind === 'Cierre' ? imported.closing.detailRows.length : imported.rows.length,
      sample: imported.kind === 'Cierre' ? [] : imported.rows.slice(0, 8).map(row => row.values.slice(0, 3)),
      closing: imported.kind === 'Cierre' ? { year: imported.closing.year, totals: imported.closing.detailTotals, categories: imported.closing.summaryRows.length } : null,
    };
  } catch (error) {
    if (!(error instanceof WarehouseError)) console.error('[almacenes/import]', error);
    return { ok: false as const, error: error instanceof WarehouseError ? error.message : 'No se pudo procesar la importación. Intenta nuevamente.' };
  }
}

export async function listWarehouseClosings(tabId?: string) {
  try {
    const viewer = await warehouseContext(tabId);
    const scope = viewer.role === 'superadmin' ? null : viewer.warehouse_id;
    const { rows } = await pool.query<{ id: string; year: number; warehouse: string; filename: string }>(
      'select c.id,c.year,w.name as warehouse,c.filename from warehouse_closings c join warehouses w on w.id=c.warehouse_id where ($1::text is null or c.warehouse_id=$1) order by c.year desc,w.name', [scope]);
    return { ok: true as const, rows };
  } catch {
    return { ok: false as const, error: 'No se pudieron consultar los cierres históricos.' };
  }
}

export async function loadWarehouseClosing(id: string, tabId?: string) {
  try {
    const viewer = await warehouseContext(tabId);
    const scope = viewer.role === 'superadmin' ? null : viewer.warehouse_id;
    const { rows } = await pool.query<{ data: WarehouseClosing; statement: ClosingStatement | null }>(
      'select c.data,s.data as statement from warehouse_closings c left join warehouse_closing_statements s on s.closing_id=c.id where c.id=$1 and ($2::text is null or c.warehouse_id=$2)', [id, scope]);
    if (rows[0]) return { ok: true as const, ...rows[0] };
  } catch {
    // Return the same error for missing and inaccessible records.
  }
  return { ok: false as const, error: 'No se pudo consultar el cierre seleccionado.' };
}
