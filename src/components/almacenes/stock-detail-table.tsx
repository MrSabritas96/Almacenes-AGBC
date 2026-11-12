import type { stockSummary } from '@/lib/stock-report';

const amount=(value:number)=>value.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});

export function StockDetailTable({rows}:{rows:ReturnType<typeof stockSummary>}) {
  const hasDescription=rows.some(row=>row.description?.trim());
  const weights=[21,44,...(hasDescription?[44]:[]),17,18,23,18,23,18,23,18,23];
  const totals=rows.reduce((a,r)=>({opening:a.opening+r.openingValue,incoming:a.incoming+r.incomingValue,outgoing:a.outgoing+r.outgoingValue,closing:a.closing+r.closingValue}),{opening:0,incoming:0,outgoing:0,closing:0});
  return <table className="stock-movement-table" data-description={hasDescription}>
    <colgroup>{weights.map((weight,index)=><col key={index} style={{width:`${weight/weights.reduce((sum,w)=>sum+w,0)*100}%`}}/>)}</colgroup>
    <thead>
      <tr>
        {['Código','Artículo',...(hasDescription?['Descripción']:[]),'Unidad'].map(label=><th key={label} rowSpan={2} scope="col">{label}</th>)}
        {['Saldos iniciales','Ingresos','Egresos','Saldo final'].map(label=><th key={label} colSpan={2} scope="colgroup">{label}</th>)}
      </tr>
      <tr>{Array.from({length:4},(_,index)=><QuantityValue key={index}/>)}</tr>
    </thead>
    <tbody>{rows.map(row=><tr key={row.id}>
      <td>{row.code}</td><td><strong>{row.name}</strong><small>{row.category}</small></td>{hasDescription&&<td>{row.description?.trim()}</td>}<td>{row.unit}</td>
      <td>{row.opening}</td><td>{amount(row.openingValue)}</td>
      <td>{row.incoming}</td><td>{amount(row.incomingValue)}</td>
      <td>{row.outgoing}</td><td>{amount(row.outgoingValue)}</td>
      <td>{row.closing}</td><td>{amount(row.closingValue)}</td>
    </tr>)}</tbody>
    <tfoot><tr><th colSpan={hasDescription?4:3} scope="row">Totales Bs</th><td/><td>{amount(totals.opening)}</td><td/><td>{amount(totals.incoming)}</td><td/><td>{amount(totals.outgoing)}</td><td/><td>{amount(totals.closing)}</td></tr></tfoot>
  </table>;
}

function QuantityValue(){return <><th scope="col">Cantidad</th><th scope="col">Valor Bs</th></>;}
