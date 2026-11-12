import assert from 'node:assert/strict';
import { institutionalStockReport, stockMoney } from '../src/lib/institutional-stock-report';
import { stockSummary } from '../src/lib/stock-report';
import { categoryInfo, categoryLabel, ITEM_CATEGORIES } from '../src/lib/warehouse-reference';
import type { Material, Movement, Purchase } from '../src/lib/warehouse';

const category=categoryLabel(ITEM_CATEGORIES.find(c=>c.legacyBudgetCode==='32100')!);
const materials=[{id:'paper',code:'PAP-1',name:'Papel',category,unit:'resma',unit_cost:'12'}] as Material[];
const movements=[
  {material_id:'paper',delta:10,unit_cost:'10',created_at:'2025-12-31T12:00:00-04:00'},
  {material_id:'paper',delta:5,unit_cost:'20',created_at:'2026-01-01T12:00:00-04:00'},
  {material_id:'paper',delta:2,unit_cost:'10',created_at:'2026-01-02T12:00:00-04:00'},
  {material_id:'paper',delta:-4,unit_cost:'10',created_at:'2026-01-03T12:00:00-04:00'},
] as Movement[];
const rows=stockSummary(materials,movements,'2026-01-01','2026-12-31');
const purchases=[{id:'p1',material_id:'paper',category,invoice_number:'F-1',purchased_on:'2026-01-01',quantity:5,unit_cost:'20',supplier:'Proveedor',material:'Papel'}] as Purchase[];
const reconciliation=institutionalStockReport('reconciliation',rows,purchases,'2026-01-01','2026-12-31');
assert.deepEqual(reconciliation.records.map(r=>r['Monto Bs']),[100,100,20,40,180].map(stockMoney),'Las devoluciones no se presentan como compras');
assert.equal(reconciliation.totals.opening+reconciliation.totals.incoming-reconciliation.totals.outgoing,reconciliation.totals.closing);
const balances=institutionalStockReport('balances',rows,purchases,'2026-01-01','2026-12-31');
const paper=balances.records.find(r=>String(r.Partida).startsWith('PAR-015'))!;
assert.equal(paper['Cantidad inicial al 2026-01-01'],10);
assert.equal(paper['Cantidad final al 2026-12-31'],13);
assert.equal(paper['Saldo final Bs al 2026-12-31'],stockMoney(180));
assert(balances.records.some(r=>String(r.Partida).startsWith('PAR-010')),'Incluye partidas sin movimientos');
assert.equal(categoryInfo(category)?.code,'PAR-015','Exporta el código de partida interno');
assert.equal(institutionalStockReport('outgoing',rows,purchases,'2026-01-01','2026-12-31').records.at(-1)?.['Monto Bs'],stockMoney(40));
assert.equal(institutionalStockReport('purchases',rows,purchases,'2026-01-01','2026-12-31').records[0]!.Partida,'PAR-015');
assert.equal(institutionalStockReport('balances',rows,[],'2026-01-01','2026-12-31',false).records.length,2,'Un reporte filtrado no agrega otras partidas');
const unknown=institutionalStockReport('outgoing',[{...rows[0]!,category:'Legado sin clasificar'}],[],'2026-01-01','2026-12-31',false);
assert(unknown.records.some(r=>r.Descripción==='Partida personalizada: Legado sin clasificar'),'Los materiales sin homologar siguen visibles');
assert.equal(unknown.records.at(-1)?.['Monto Bs'],stockMoney(40),'No se pierden sus importes');
const mixed=institutionalStockReport('balances',[...rows,{...rows[0]!,id:'old',category:'32100',opening:1,openingValue:10,closing:1,closingValue:10}],[],'2026-01-01','2026-12-31',false);
assert.equal(mixed.groups.length,1,'Alias anteriores y códigos nuevos no crean partidas duplicadas');
assert.equal(mixed.groups[0]?.code,'PAR-015');
assert.equal(mixed.groups[0]?.closingValue,190,'La recodificación conserva los importes');
const empty=institutionalStockReport('purchases',[],[],'2026-01-01','2026-12-31');
assert.equal(empty.records.at(-1)?.['Monto Bs'],stockMoney(0));
assert.equal(stockMoney(190151.23+287733.35-301860.80),stockMoney(176023.78),'Concilia los importes de las imágenes');
console.log('OK: conciliación, compras, partidas internas, ceros, filtros y fechas coherentes.');
