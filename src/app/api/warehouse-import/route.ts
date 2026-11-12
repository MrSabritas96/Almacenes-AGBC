import { pool } from '@/db';
import { warehouseContext } from '@/lib/warehouse';
import { templateBytes } from '@/lib/warehouse-import';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const viewer = await warehouseContext(params.get('tabId') ?? undefined).catch(() => null);
  if (!viewer) return new Response('Acceso no autorizado', { status: 403 });

  const kind = params.get('template');
  const statement = params.get('statement');
  const id = statement || params.get('id');
  let filename: string;
  let bytes: Buffer;
  if (kind === 'Materiales' || kind === 'Proveedores' || kind === 'Empleados') {
    filename = `Plantilla - ${kind}.xlsx`;
    bytes = await templateBytes(kind);
  } else if (id) {
    const { rows } = await pool.query<{ filename: string; workbook_base64: string }>(
      statement
        ? 'select s.filename,s.workbook_base64 from warehouse_closing_statements s join warehouse_closings c on c.id=s.closing_id where c.id=$1 and ($2::text is null or c.warehouse_id=$2)'
        : 'select filename,workbook_base64 from warehouse_closings where id=$1 and ($2::text is null or warehouse_id=$2)',
      [id, viewer.role === 'superadmin' ? null : viewer.warehouse_id]);
    if (!rows[0]) return new Response('Cierre no encontrado', { status: 404 });
    filename = rows[0].filename;
    bytes = Buffer.from(rows[0].workbook_base64, 'base64');
  } else {
    return new Response('Archivo no encontrado', { status: 404 });
  }
  return new Response(Uint8Array.from(bytes), { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
