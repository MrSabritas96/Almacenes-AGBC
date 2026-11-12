import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createId } from '@paralleldrive/cuid2';
import type { PoolClient } from 'pg';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { addExcelHeading, excelBannerPath, styleExcelColumns } from './excel-heading';
import { formatMaterialCode } from './material-code';
import { cellValue, parseWarehouseClosing, readWarehouseWorkbook } from './warehouse-closing';
import { WarehouseError } from './warehouse-errors';
import { syncStockNotifications } from './warehouse-notifications';
import { categoryLabel, ITEM_CATEGORIES, MATERIAL_UNITS, normalizeCategory } from './warehouse-reference';
import { personFields, shortText } from './warehouse-validation';

const optional = z.string().trim().max(200);
const categories = new Set(ITEM_CATEGORIES.map(categoryLabel));
const templates = {
  Materiales: {
    headers: ['Material', 'Partida PAR', 'Unidad', 'Mínimo', 'Ubicación', 'Descripción'],
    schema: z.tuple([shortText, shortText.transform(normalizeCategory).refine(value => categories.has(value)),
      z.enum(MATERIAL_UNITS), z.coerce.number().int().min(0).max(1e7), optional, z.string().max(2000)]),
  },
  Proveedores: {
    headers: ['Nombre', 'NIT', 'Tipo', 'Contacto', 'Teléfono', 'Correo', 'Dirección', 'Notas'],
    schema: z.tuple([shortText, shortText, optional, optional, optional, z.union([z.literal(''), z.email().max(200)]), optional, z.string().max(2000)]),
  },
  Empleados: {
    headers: ['Nombre', 'CI', 'Cargo', 'Unidad', 'Teléfono', 'Regional'],
    schema: z.tuple([personFields.name, personFields.document, personFields.position, personFields.department, personFields.phone, personFields.regional]),
  },
} as const;

type Template = keyof typeof templates;
export const importKinds = ['Cierre', 'Materiales', 'Proveedores', 'Empleados'] as const;
export type ImportKind = typeof importKinds[number];

const templateHeaderRow = 4;

export async function templateBytes(kind: Template) {
  const book = new ExcelJS.Workbook();
  book.creator = 'Agencia Boliviana de Correos';
  const banner = book.addImage({ base64: await readFile(join(process.cwd(), 'public', excelBannerPath), 'base64'), extension: 'png' });
  const sheet = book.addWorksheet(kind, { views: [{ state: 'frozen', ySplit: templateHeaderRow }] });
  for (let i = 1; i <= templates[kind].headers.length; i++) {
    sheet.getColumn(i).width = 24;
    sheet.getColumn(i).numFmt = '@';
  }
  addExcelHeading(sheet, banner, `Plantilla de importación de ${kind.toLowerCase()}`);
  styleExcelColumns(sheet, templateHeaderRow, templates[kind].headers);
  if (kind === 'Materiales') {
    sheet.getColumn(4).numFmt = '0';
    const reference = book.addWorksheet('Referencia', { views: [{ state: 'frozen', ySplit: templateHeaderRow }] });
    reference.columns = [{ width: 65 }, { width: 24 }];
    addExcelHeading(reference, banner, 'Referencia de materiales');
    styleExcelColumns(reference, templateHeaderRow, ['Partidas PAR', 'Unidades']);
    for (let i = 0; i < Math.max(ITEM_CATEGORIES.length, MATERIAL_UNITS.length); i++) {
      const category = ITEM_CATEGORIES[i];
      reference.addRow([category ? categoryLabel(category) : '', MATERIAL_UNITS[i] ?? '']);
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function parseWarehouseImport(kind: ImportKind, bytes: Buffer) {
  const book = await readWarehouseWorkbook(bytes);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (kind === 'Cierre') return { kind, digest, closing: parseWarehouseClosing(book) } as const;
  const sheet = book.getWorksheet(kind);
  const template = templates[kind];
  const headerRow = [1, templateHeaderRow].find(row =>
    sheet && template.headers.every((header, i) => sheet.getCell(row, i + 1).value === header));
  if (!sheet || !headerRow || sheet.rowCount > headerRow + 1000 || sheet.columnCount > template.headers.length) {
    throw new WarehouseError(`Usa la plantilla ${kind} con un máximo de 1.000 filas de datos.`);
  }
  const rows: { row: number; values: (string | number)[]; key: string }[] = [];
  const seen = new Set<string>();
  for (let i = headerRow + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const raw = template.headers.map((_, index) => {
      const value = cellValue(row.getCell(index + 1));
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
      throw new WarehouseError(`${kind}, fila ${i}: usa texto o números enteros.`);
    });
    if (raw.every(value => value === '')) continue;
    if (kind === 'Materiales' && raw[3] === '') raw[3] = '5';
    const result = template.schema.safeParse(raw);
    if (!result.success) {
      const column = Number(result.error.issues[0]?.path[0]);
      throw new WarehouseError(`${kind}, fila ${i}: revisa ${template.headers[column] ?? 'los campos'}.`);
    }
    const values = result.data;
    const key = masterKey(String(kind === 'Materiales' ? values[0] : values[1]));
    if (seen.has(key)) throw new WarehouseError(`${kind}, fila ${i}: hay un identificador repetido en el archivo.`);
    seen.add(key);
    rows.push({ row: i, values, key });
  }
  if (!rows.length) throw new WarehouseError('La plantilla está vacía. Añade al menos una fila.');
  return { kind, digest, rows } as const;
}

const masterKey = (value: string) => value.trim().toLowerCase();
type Import = Awaited<ReturnType<typeof parseWarehouseImport>>;

export async function storeWarehouseImport(client: PoolClient, input: {
  imported: Import; warehouseId: string; actor: string | null; filename: string; bytes: Buffer; apply: boolean;
}) {
  const { imported, warehouseId, actor, filename, bytes, apply } = input;
  const warehouse = await client.query('select id from warehouses where id=$1 for share', [warehouseId]);
  if (!warehouse.rowCount) throw new WarehouseError('El almacén seleccionado ya no existe.');
  let count: number;
  let entityId = warehouseId;
  if (imported.kind === 'Cierre') {
    const { closing, digest } = imported;
    const existing = await client.query('select id,digest from warehouse_closings where warehouse_id=$1 and year=$2', [warehouseId, closing.year]);
    if (existing.rows[0]) {
      if (existing.rows[0].digest === digest) return { alreadyImported: true };
      throw new WarehouseError(`El almacén ya tiene un cierre de ${closing.year}. Verifica el archivo registrado.`);
    }
    count = closing.detailRows.length;
    if (apply) {
      entityId = createId();
      const inserted = await client.query(
        'insert into warehouse_closings(id,warehouse_id,year,digest,filename,workbook_base64,data,imported_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict (warehouse_id,year) do nothing returning id',
        [entityId, warehouseId, closing.year, digest, filename, bytes.toString('base64'), JSON.stringify(closing), actor],
      );
      if (!inserted.rowCount) {
        const current = await client.query('select digest from warehouse_closings where warehouse_id=$1 and year=$2', [warehouseId, closing.year]);
        if (current.rows[0]?.digest === digest) return { alreadyImported: true };
        throw new WarehouseError(`El almacén ya tiene un cierre de ${closing.year}.`);
      }
    }
  } else {
    const { kind, rows } = imported;
    count = rows.length;
    if (apply && kind === 'Materiales') await client.query("select pg_advisory_xact_lock(hashtextextended('warehouse-material-code',0))");
    const existingSql = {
      Materiales: 'select name as key from materials where warehouse_id=$1',
      Proveedores: 'select nit as key from suppliers where warehouse_id=$1',
      Empleados: 'select document as key from warehouse_people where warehouse_id=$1',
    } as const;
    const existing = new Set((await client.query<{ key: string }>(existingSql[kind], [warehouseId])).rows.map(row => masterKey(row.key)));
    const collision = rows.find(row => existing.has(row.key));
    if (collision) throw new WarehouseError(`${kind}, fila ${collision.row}: ya existe una ficha con ese identificador en el almacén.`);
    if (apply) {
      let sequence = kind === 'Materiales' ? Number((await client.query("select coalesce(max(substring(code from '([0-9]+)$')::numeric),0)+1 as next from materials")).rows[0].next) : 0;
      for (const { row, values } of rows) {
        const insert = {
          Materiales: 'insert into materials(id,warehouse_id,name,category,unit,minimum,location,description,code) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          Proveedores: 'insert into suppliers(id,warehouse_id,name,nit,business_type,contact,phone,email,address,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (warehouse_id,nit) do nothing returning id',
          Empleados: 'insert into warehouse_people(id,warehouse_id,name,document,position,department,phone,regional) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict (warehouse_id,document) do nothing returning id',
        } as const;
        const fields = kind === 'Materiales' ? [...values, formatMaterialCode(String(values[0]), sequence++)] : values;
        const id = createId();
        const result = await client.query(insert[kind], [id, warehouseId, ...fields]);
        if (!result.rowCount) throw new WarehouseError(`${kind}, fila ${row}: ya existe una ficha con ese identificador.`);
        if (kind === 'Materiales') await syncStockNotifications(client, id);
      }
    }
  }
  if (apply) {
    await client.query("insert into audit_logs(id,user_id,module,action,entity_id,details,result) values($1,$2,'almacenes','import_workbook',$3,$4,'success')",
      [createId(), actor, entityId, JSON.stringify({ kind: imported.kind, count, filename, warehouseId, digest: imported.digest })]);
  }
  return { alreadyImported: false };
}
