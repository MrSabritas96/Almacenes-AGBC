import assert from 'node:assert/strict';
import { historyRange, movementDay, periodRange, stockReportData, stockSummary } from '../src/lib/stock-report';
import { institutionalStockReport, stockReportTitles } from '../src/lib/institutional-stock-report';
import { createStockWorkbook } from '../src/lib/stock-report-xlsx';
import { readFileSync } from 'node:fs';
import type { Material, Movement, Purchase } from '../src/lib/warehouse';
assert.deepEqual(periodRange('week','2026-01-01'),['2025-12-29','2026-01-04']);
assert.deepEqual(periodRange('bimester','2026-03-17'),['2026-03-01','2026-04-30']);
assert.deepEqual(periodRange('quarter','2026-12-20'),['2026-10-01','2026-12-31']);
assert.deepEqual(periodRange('month','2024-02-20'),['2024-02-01','2024-02-29']);
assert.equal(movementDay('2026-10-21T02:00:00Z'),'2026-10-20');
const material={id:'m',code:'001',name:'Papel',description:'Detalle del papel',unit:'resma',category:'32100',unit_cost:'15'} as Material;
const movements=[{material_id:'m',delta:10,unit_cost:'10',created_at:'2026-09-30T12:00:00-04:00'},
  {material_id:'m',delta:10,unit_cost:'20',created_at:'2026-10-01T12:00:00-04:00'},
  {material_id:'m',delta:-4,unit_cost:'15',created_at:'2026-10-02T12:00:00-04:00'},
  {material_id:'m',delta:100,unit_cost:'30',created_at:'2026-11-01T12:00:00-04:00'}] as Movement[];
const row=stockSummary([material],movements,'2026-10-01','2026-10-31')[0]!;
assert.equal(row.description,material.description);assert.equal(row.opening,10);assert.equal(row.openingValue,100);
assert.equal(row.incoming,10);assert.equal(row.incomingValue,200);
assert.equal(row.outgoing,4);assert.equal(row.outgoingValue,60);
assert.equal(row.closing,16);assert.equal(row.closingValue,240);
assert.deepEqual(historyRange([],[],'2026-10-30'),['2026-10-30','2026-10-30'],'Sin operaciones usa la fecha actual');
assert.deepEqual(historyRange(movements,[{purchased_on:'2020-02-01'}],'2026-10-30'),['2020-02-01','2026-11-01'],'Incluye compras antiguas y el último movimiento sin límites arbitrarios');
assert.deepEqual(historyRange([{created_at:'2026-10-21T02:00:00Z'}],[],'2026-10-30'),['2026-10-20','2026-10-30'],'Convierte movimientos a la fecha de Bolivia');
const allDates=historyRange(movements,[],'2026-10-30');
const all=stockSummary([material],movements,...allDates)[0]!;
assert.equal(all.opening,0);assert.equal(all.incoming,120);assert.equal(all.outgoing,4);assert.equal(all.closing,116,'Todo el historial incluye todos los movimientos');
const custom=stockSummary([material],movements,'2026-10-01','2026-10-02')[0]!;
assert.equal(custom.incoming,10);assert.equal(custom.outgoing,4);assert.equal(custom.opening,10,'Rango inclusivo con saldo de apertura anterior');
console.log('OK: periodos, fecha de Bolivia y saldos cuantitativos/monetarios con aperturas anteriores y sin movimientos futuros.');

// Un único origen para pantalla, PDF y Excel: compras, reservas, devoluciones y archivados.
const archived={...material,id:'archived',name:'Material archivado'};
const event=(id:string,delta:number,cost:string,date:string,reason:string):Movement=>({id,material_id:'m',material:material.name,code:material.code,category:material.category,unit:material.unit,actor:'Operador Pérez',delta,unit_cost:cost,created_at:`${date}T12:00:00-04:00`,reason,balance_after:null});
const reportMovements=[event('opening',10,'10','2026-09-30','Apertura'),event('purchase',5,'20','2026-10-01','Compra F-123'),event('reserve',-4,'10','2026-10-02','Reserva para solicitud'),event('return',2,'10','2026-10-03','Anulación de entrega'),{...event('old-purchase',3,'5','2026-10-01','Compra histórica'),material_id:archived.id,material:archived.name},{...event('old-out',-3,'5','2026-10-02','Salida histórica'),material_id:archived.id,material:archived.name},event('future',1,'50','2026-11-01','Compra futura')];
const reportPurchases=[{id:'p1',material_id:'m',supplier:'Proveedor Central',invoice_number:'F-123',invoice_description:'Papel carta',purchased_on:'2026-10-01',quantity:5,unit_cost:'20',material:'Papel'},{id:'p2',material_id:archived.id,supplier:'Proveedor antiguo',invoice_number:'F-456',purchased_on:'2026-10-01',quantity:3,unit_cost:'5',material:archived.name}] as Purchase[];
const source={materials:[material],movements:reportMovements,purchases:reportPurchases};
const selected=stockReportData(source,'2026-10-01','2026-10-31');
assert.equal(selected.rows.length,2,'Incluye el historial de materiales archivados');
assert.equal(selected.movements.length,5,'Excluye apertura anterior y movimientos futuros');
assert.equal(selected.purchases.length,2,'Conserva compras de materiales archivados');
for(const query of ['Operador Pérez','F-123','Proveedor Central','Reserva para solicitud','  Papel  ']){
  const filtered=stockReportData(source,'2026-10-01','2026-10-31',query);
  const paper=filtered.rows.find(r=>r.id==='m')!;
  assert(paper,`${query}: selecciona el material relacionado`);
  assert.equal(paper.openingValue,100);
  assert.equal(paper.closingValue,180,'Una búsqueda conserva compras, reservas y devoluciones del ítem');
  assert(filtered.movements.some(m=>m.id==='return'));
  assert(filtered.purchases.some(p=>p.id==='p1'));
}
const banner=readFileSync('public/brand/report-banner.png').toString('base64');
const workbook=createStockWorkbook({...selected,from:'2026-10-01',to:'2026-10-31',context:'Prueba de integración de reportes',includeEmpty:false,selected:'detail',banner});
assert.equal(workbook.getWorksheet('Detalle de Almacen')!.getCell('N10').result,180);
assert.equal(workbook.getWorksheet('Conciliación')!.getCell('B12').result,180);
for(const kind of Object.keys(stockReportTitles) as (keyof typeof stockReportTitles)[]){
  const report=institutionalStockReport(kind,selected.rows,selected.purchases,'2026-10-01','2026-10-31',false,n=>n);
  assert.equal(report.totals.closing,180,`${kind}: usa el saldo del historial real`);
  assert.equal(report.records.at(-1)![kind==='balances'||kind==='institutional'?'Saldo final Bs al 2026-10-31':'Monto Bs'],kind==='purchases'?115:kind==='outgoing'?55:180);
}
assert.deepEqual(stockReportData(source,'2026-10-31','2026-10-01'),{rows:[],purchases:[],movements:[]});
assert.equal(stockReportData(source,'2026-10-01','2026-10-31','','Otra partida').rows.length,0);
console.log('OK: los seis cuadros y Excel comparten datos, filtros y saldos; incluyen compras, reservas, devoluciones y archivados.');
