import { categoryInfo, ITEM_CATEGORIES } from './warehouse-reference';
import type { Purchase } from './warehouse';
import type { stockSummary } from './stock-report';

export const stockReportTitles = {
  reconciliation: 'Conciliación de inventario',
  purchases: 'Ingresos al almacén por compras',
  outgoing: 'Salidas de almacén por partida',
  balances: 'Bienes de consumo por partida',
  institutional: 'Resumen de almacenes (bienes de consumo)',
};
export type StockReportKind = keyof typeof stockReportTitles;
type StockRow = ReturnType<typeof stockSummary>[number];
export const stockReportNote = 'Clasificación por partidas internas del almacén PAR. Base: stock disponible. Las reservas se descuentan al aprobar; la entrega no genera un segundo descuento. Las salidas incluyen reservas y ajustes negativos. Otros ingresos incluyen devoluciones, ajustes y aperturas del periodo. PEPS desde su activación; los movimientos anteriores conservan su valoración histórica. Cantidades agregadas de distintas unidades: referencia de conteo, no magnitud física homogénea.';
export const stockMoney = (value: number) => value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// La misma proyección alimenta pantalla y PDF; se usa el código interno de partida en todas las salidas.
export function institutionalStockReport(kind: StockReportKind, rows: StockRow[], purchases: Purchase[], from: string, to: string, includeEmpty = true, money: (value: number) => string | number = stockMoney) {
  const totals = rows.reduce((a, r) => ({ opening: a.opening + r.openingValue, incoming: a.incoming + r.incomingValue, outgoing: a.outgoing + r.outgoingValue, closing: a.closing + r.closingValue }), { opening: 0, incoming: 0, outgoing: 0, closing: 0 });
  const purchased = purchases.reduce((sum, p) => sum + p.quantity * Number(p.unit_cost), 0);
  const groups = new Map<string, { code: string; name: string; opening: number; openingValue: number; outgoingValue: number; closing: number; closingValue: number }>();
  if (includeEmpty) for (const c of ITEM_CATEGORIES) groups.set(c.code, { code: c.code, name: c.name, opening: 0, openingValue: 0, outgoingValue: 0, closing: 0, closingValue: 0 });
  for (const row of rows) {
    const category = categoryInfo(row.category);
    const code = category?.code ?? row.category;
    const group = groups.get(code) ?? { code, name: category?.name ?? `Partida personalizada: ${row.category}`, opening: 0, openingValue: 0, outgoingValue: 0, closing: 0, closingValue: 0 };
    group.opening += row.opening; group.openingValue += row.openingValue; group.outgoingValue += row.outgoingValue; group.closing += row.closing; group.closingValue += row.closingValue;
    groups.set(code, group);
  }
  const ordered = [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
  let records: Record<string, string | number>[];
  if (kind === 'reconciliation') records = [
    { Concepto: 'Inventario inicial', 'Monto Bs': money(totals.opening) },
    { Concepto: 'Más: compras del periodo', 'Monto Bs': money(purchased) },
    { Concepto: 'Más: otros ingresos (devoluciones / ajustes / aperturas)', 'Monto Bs': money(totals.incoming - purchased) },
    { Concepto: 'Menos: salidas / reservas / ajustes negativos', 'Monto Bs': money(totals.outgoing) },
    { Concepto: 'Inventario final disponible', 'Monto Bs': money(totals.closing) },
  ];
  else if (kind === 'purchases') records = [
    ...[...purchases].sort((a, b) => a.purchased_on.localeCompare(b.purchased_on) || a.id.localeCompare(b.id)).map((p, i) => ({ 'N°': i + 1, Fecha: p.purchased_on, Partida: categoryInfo(p.category ?? '')?.code ?? p.category ?? 'Sin partida', 'Detalle de compra': p.invoice_description || p.material, 'Factura / entrada': `${p.invoice_number} / ${p.batch_id ? `E-${String(p.batch_id).padStart(6, '0')}` : p.id}`, Proveedor: p.supplier, 'Monto Bs': money(p.quantity * Number(p.unit_cost)) })),
    { 'N°': '', Fecha: '', Partida: '', 'Detalle de compra': 'TOTAL', 'Factura / entrada': '', Proveedor: '', 'Monto Bs': money(purchased) },
  ];
  else if (kind === 'outgoing') records = [
    ...ordered.map(g => ({ Partida: g.code, Descripción: g.name, 'Monto Bs': money(g.outgoingValue) })),
    { Partida: '', Descripción: 'TOTAL', 'Monto Bs': money(totals.outgoing) },
  ];
  else {
    const initialQuantity = `Cantidad inicial al ${from}`, initialValue = `Saldo inicial Bs al ${from}`, finalQuantity = `Cantidad final al ${to}`, finalValue = `Saldo final Bs al ${to}`;
    records = [
      ...ordered.map((g, i) => ({ 'N°': i + 1, Partida: `${g.code} · ${g.name}`, [initialQuantity]: g.opening, [initialValue]: money(g.openingValue), [finalQuantity]: g.closing, [finalValue]: money(g.closingValue) })),
      { 'N°': '', Partida: 'TOTAL', [initialQuantity]: rows.reduce((s, r) => s + r.opening, 0), [initialValue]: money(totals.opening), [finalQuantity]: rows.reduce((s, r) => s + r.closing, 0), [finalValue]: money(totals.closing) },
    ];
  }
  return { title: stockReportTitles[kind], records, totals, groups: ordered };
}
