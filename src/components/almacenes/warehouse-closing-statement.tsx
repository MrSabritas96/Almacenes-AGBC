"use client";

import { useState } from 'react';
import type { ClosingStatement } from '@/lib/warehouse-closing-statement';
import { stockMoney } from '@/lib/institutional-stock-report';

export function WarehouseClosingStatement({ statement, year, original }: {
  statement: ClosingStatement; year: number; original: string;
}) {
  const [view,setView] = useState<'purchases' | 'outgoing'>('purchases');
  const { totals } = statement;
  const purchases = view === 'purchases';
  const rows = purchases
    ? statement.purchases.map(row=>({key:row.order, reference:row.reference||'—', label:row.description, amount:row.amount}))
    : statement.outgoing.map(row=>({key:row.category, reference:row.category, label:row.description, amount:row.amount}));
  return <section className="data-panel view-enter" aria-label={`Estados financieros de almacenes ${year}`}>
    <div className="panel-heading"><h3>EEFF de almacenes · {year}</h3></div>
    <div className="px-4 pt-3 pb-4 space-y-4">
      <p className="form-hint">Cierre histórico conciliado con los Cuadros 5 y 6. Importes en bolivianos.</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 tabular-nums">
        {[
          ['Inventario inicial',totals.opening], ['+ Compras',totals.purchased],
          ['− Salidas',totals.spent], ['Inventario final',totals.final],
        ].map(([label,value],index)=><div key={label} className={`rounded-lg border p-3 ${index===3?'border-amber-400 bg-amber-50 text-[#0b3b83]':'border-slate-300'}`}>
          <dt className="text-sm">{label}</dt><dd className="text-lg font-semibold">Bs {stockMoney(Number(value)/100)}</dd>
        </div>)}
      </dl>
      <div className="table-toolbar">
        <label>Detalle EEFF<select value={view} onChange={event=>setView(event.target.value==='outgoing'?'outgoing':'purchases')}>
          <option value="purchases">Ingresos por compras ({statement.purchases.length})</option>
          <option value="outgoing">Salidas por partida ({statement.outgoing.length})</option>
        </select></label>
        <a className="secondary-button" href={original}>Descargar respaldo EEFF original</a>
      </div>
      <div className="table-scroll"><table className="tabular-nums">
        <caption>{purchases?'Ingresos por compras':'Salidas por partida'} · {year}</caption>
        <thead><tr>{purchases&&<th scope="col">N.º</th>}<th scope="col">{purchases?'Número de ingreso':'Partida original'}</th><th scope="col">Detalle</th><th scope="col" className="text-right">Monto Bs</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.key}>{purchases&&<td>{row.key}</td>}<td>{row.reference}</td><td>{row.label}</td><td className="text-right">{stockMoney(row.amount/100)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={purchases?3:2}>Total</th><td className="text-right font-semibold">{stockMoney((purchases?totals.purchased:totals.spent)/100)}</td></tr></tfoot>
      </table></div>
      {statement.dateHeaderMismatch&&<p className="form-hint">El respaldo original dice {year-1} en los encabezados de saldos. Esta vista usa la gestión {year} del cierre conciliado.</p>}
    </div>
  </section>;
}
