"use client";
import { DateField } from './request-date';
import { dateInputValue, displayDate } from '@/lib/request-date';
import { Archive, ClipboardList, FileSpreadsheet, Search } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import type { Snapshot } from '@/lib/warehouse-types';
import { historyRange, movementDay, periodRange, stockReportData } from '@/lib/stock-report';
import { institutionalStockReport, stockReportNote, stockReportTitles, type StockReportKind } from '@/lib/institutional-stock-report';
import { withMinimumLoading } from '@/lib/loading-time';
import { PostalLoader } from './postal-loader';
import { reportFilename } from '@/lib/report-filename';
import { StockDetailTable } from './stock-detail-table';
import { WarehouseImports } from './warehouse-imports';
const amount=(v:number)=>v.toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2});
const views = [
  { id: 'operations', label: 'Operaciones', icon: ClipboardList },
  { id: 'reports', label: 'Reportes', icon: FileSpreadsheet },
  { id: 'archive', label: 'Cierres e importación', icon: Archive },
] as const;

export function StockReports({data,search,query,onSearch}:{
  data:Snapshot;search:string;query:string;onSearch:(value:string)=>void;
}) {
  const [view,setView]=useState<(typeof views)[number]['id']>('operations');
  const [archiveSearch,setArchiveSearch]=useState('');
  const [archiveVisited,setArchiveVisited]=useState(false);
  const [period,setPeriod]=useState('month'),[anchor,setAnchor]=useState(()=>displayDate(movementDay(new Date().toISOString()))),[customFrom,setCustomFrom]=useState(anchor),[customTo,setCustomTo]=useState(anchor),[busy,setBusy]=useState(false),[category,setCategory]=useState('all');
  const [reportKind,setReportKind]=useState<StockReportKind|'detail'>('detail');
  const reference=dateInputValue(anchor), start=dateInputValue(customFrom), end=dateInputValue(customTo);
  const [from,to]=period==='all'?historyRange(data.movements,data.purchases):period==='custom'?[start,end]:reference?periodRange(period,reference):['',''];
  const validRange=!!from&&!!to&&from<=to;
  const year=from.slice(0,4);
  const closingYear=from===`${year}-01-01`&&to===`${year}-12-31`?Number(year):undefined;
  const rangeLabel=`${period==='all'?'Todo el historial · ':''}Del ${displayDate(from)} al ${displayDate(to)}`;
  const {rows,purchases,movements}=stockReportData(data,from,to,query,category);
  const selectedReport=view!=='reports'||!validRange||reportKind==='detail'?null:institutionalStockReport(reportKind,rows,purchases,from,to,category==='all'&&!query.trim());
  const hasDescription=rows.some(row=>row.description?.trim());
  const reportTitle=selectedReport?.title??'Detalle de Almacen';
  const exportDisabled=busy||!validRange||search!==query;
  async function excel(scope:'selected'|'all'|'eeff'){
    if(!validRange){toast.error('Revisa el intervalo de fechas.');return;}
    setBusy(true);
    try {await withMinimumLoading(async()=>{
      const {stockWorkbookBytes}=await import('@/lib/stock-report-xlsx');
      const bytes=await stockWorkbookBytes({rows,purchases,from,to,includeEmpty:category==='all'&&!query.trim(),selected:reportKind,scope,context:`${data.warehouses.map(w=>w.name).join(', ')} · Emitido por: ${data.viewer.name} · Partida: ${category} · Búsqueda: ${query||'Todas'}`});
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
      const title=scope==='eeff'?'EEFF de almacenes':scope==='all'?'Todos los cuadros de almacén':reportTitle;
      const link=document.createElement('a');link.href=url;link.download=reportFilename(title,'xlsx');document.body.append(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast.success(scope==='eeff'?'Excel de EEFF generado.':scope==='all'?'Excel generado con los seis cuadros.':'Excel generado con el cuadro seleccionado.');
    });}catch{toast.error('No se pudo generar el archivo Excel. Intenta nuevamente.');}finally{setBusy(false);}
  }
  async function pdf(print=false){
    if(!validRange){toast.error('Revisa el intervalo de fechas.');return;}
    const preview=print?window.open('','_blank'):null;
    setBusy(true);try{await withMinimumLoading(async()=>{const {createReportPdf,loadReportLogos}=await import('@/lib/report-pdf');const logos=await loadReportLogos();const report:Record<string,unknown>[]=rows.map(r=>({Código:r.code,Artículo:r.name,...(hasDescription?{Descripción:r.description?.trim()||''}:{}),Unidad:r.unit,'Cantidad inicial':r.opening,'Valor inicial Bs':amount(r.openingValue),'Entradas cantidad':r.incoming,'Entradas Bs':amount(r.incomingValue),'Salidas cantidad':r.outgoing,'Salidas Bs':amount(r.outgoingValue),'Cantidad final':r.closing,'Valor final Bs':amount(r.closingValue)}));
      if(!report.length&&!selectedReport)throw new Error('Sin registros');
      report.push({Código:'TOTALES Bs',Artículo:'',...(hasDescription?{Descripción:''}:{}),Unidad:'','Cantidad inicial':'-','Valor inicial Bs':amount(totals.opening),'Entradas cantidad':'-','Entradas Bs':amount(totals.incoming),'Salidas cantidad':'-','Salidas Bs':amount(totals.outgoing),'Cantidad final':'-','Valor final Bs':amount(totals.closing)});
      const doc=createReportPdf(selectedReport?.title??'Detalle de Almacen',selectedReport?.records??report,`${data.viewer.name} · ${data.warehouses.map(w=>w.name).join(', ')} · ${rangeLabel} · Ítem/partida: ${category} · Búsqueda: ${query||'Todas'} · Expresado en bolivianos. ${stockReportNote}`,logos,undefined,{institutionalSignatures:reportKind==='institutional',movementLayout:reportKind==='detail'});
      const filename=reportFilename(reportTitle,'pdf');
      doc.setProperties({title:filename.replace(/\.pdf$/,'')});
      if(print&&preview){
        const downloadUrl=URL.createObjectURL(doc.output('blob'));
        doc.autoPrint();
        const url=URL.createObjectURL(doc.output('blob'));
        preview.document.title=filename;
        const bar=preview.document.createElement('header'),label=preview.document.createElement('span'),download=preview.document.createElement('a'),printButton=preview.document.createElement('button'),frame=preview.document.createElement('iframe');
        bar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;background:#f4f7fb;color:#0b3b83;font:14px Arial,sans-serif';
        label.textContent=filename;download.textContent='Descargar PDF';download.href=downloadUrl;download.download=filename;
        printButton.type='button';printButton.textContent='Imprimir';printButton.onclick=()=>frame.contentWindow?.print();
        frame.title=reportTitle;frame.src=`${url}#toolbar=0`;frame.style.cssText='display:block;width:100%;height:calc(100vh - 56px);border:0';
        bar.append(label,download,printButton);preview.document.body.style.margin='0';preview.document.body.replaceChildren(bar,frame);
        preview.addEventListener('pagehide',()=>{
          URL.revokeObjectURL(url);
          URL.revokeObjectURL(downloadUrl);
        },{once:true});
      }else await doc.save(filename,{returnPromise:true});
    });}catch{preview?.close();toast.error('No se pudo generar el reporte.');}finally{setBusy(false);}
  }
  const totals=rows.reduce((a,r)=>({opening:a.opening+r.openingValue,incoming:a.incoming+r.incomingValue,outgoing:a.outgoing+r.outgoingValue,closing:a.closing+r.closingValue}),{opening:0,incoming:0,outgoing:0,closing:0});
  const archive = view==='archive';
  return <>
    <div className="movement-nav" role="group" aria-label="Secciones de movimientos">
      {views.map(({id,label,icon:Icon})=><button key={id} type="button" aria-pressed={view===id} onClick={()=>{
        setView(id);
        if(id==='archive')setArchiveVisited(true);
      }}><Icon size={18} aria-hidden="true"/>{label}</button>)}
    </div>

    <section className="data-panel movement-filters" aria-label={archive?'Buscar en cierres':'Filtros de movimientos'}>
      <div className="table-toolbar movement-fields">
        <label className="movement-search">{archive?'Buscar en el cierre':'Buscar movimientos'}
          <span className="search-field"><Search size={17} aria-hidden="true"/><input value={archive?archiveSearch:search} onChange={event=>(archive?setArchiveSearch:onSearch)(event.target.value)} placeholder={archive?'Material o partida':'Material, factura o responsable'}/></span>
        </label>
        {!archive&&<>
          <label>Periodo<select value={period} onChange={event=>setPeriod(event.target.value)}>
            {Object.entries({day:'Día',week:'Semana',month:'Mes',bimester:'Bimestre',quarter:'Trimestre',year:'Año',custom:'Rango de fechas',all:'Todo el historial'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></label>
          {period==='custom'?<>
            <DateField key="from" label="Desde" max={end} text={customFrom} onTextChange={setCustomFrom} required/>
            <DateField key="to" label="Hasta" min={start} text={customTo} onTextChange={setCustomTo} required/>
          </>:period!=='all'&&<DateField key="anchor" label="Fecha de referencia" text={anchor} onTextChange={setAnchor} required/>}
          <label>Partida<select value={category} onChange={event=>setCategory(event.target.value)}>
            <option value="all">Todas las partidas</option>
            {Array.from(new Set([...data.materials.map(material=>material.category),...data.movements.map(movement=>movement.category)])).sort().map(item=><option key={item}>{item}</option>)}
          </select></label>
        </>}
      </div>
      {!archive&&!validRange&&<p role="alert" className="form-error">{!from||!to?(period==='custom'?'Ingresa fechas válidas en Desde y Hasta (dd/mm/aaaa).':'Ingresa una fecha de referencia válida (dd/mm/aaaa).'):'La fecha inicial debe ser anterior o igual a la fecha final.'}</p>}
    </section>

    {view==='operations'&&validRange&&<>
      <section className="data-panel view-enter">
        <div className="panel-heading movement-table-heading">
          <div><h2>Operaciones del periodo</h2><p className="muted">{rangeLabel}</p></div>
          <span className="movement-count">{movements.length} {movements.length===1?'operación':'operaciones'}</span>
        </div>
        {movements.length?<div className="table-scroll"><table className="movement-log"><thead><tr>
          {['Fecha','Material / código','Variación','Costo unitario Bs','Valor Bs','Saldo posterior','Motivo / responsable'].map(label=><th key={label} scope="col">{label}</th>)}
        </tr></thead><tbody>{movements.map(m=><tr key={m.id}>
          <td>{displayDate(movementDay(m.created_at))}</td>
          <td><strong>{m.material}</strong><small className="font-mono">{m.code}</small></td>
          <td className={m.delta>0?'stock-good':m.delta<0?'stock-warning':undefined}>{m.delta>0?'+':''}{m.delta}</td>
          <td>{amount(Number(m.unit_cost))}</td><td>{amount(m.delta*Number(m.unit_cost))}</td>
          <td>{m.balance_after??'Sin dato histórico'}</td><td>{m.reason}<small>{m.actor}</small></td>
        </tr>)}</tbody></table></div>:<p className="empty-state">No hay operaciones con estos filtros. Prueba otro periodo o partida.</p>}
      </section>
      <p className="form-hint">Al aprobar una solicitud, la reserva reduce el stock disponible. La entrega confirma esa reserva.</p>
    </>}

    {view==='reports'&&<div className="view-enter">
      <section className="data-panel movement-filters" aria-label="Exportar reportes" aria-busy={busy}>
        <div className="table-toolbar movement-fields">
          <label>Cuadro a consultar<select value={reportKind} onChange={event=>setReportKind(event.target.value as StockReportKind|'detail')}>
            <option value="detail">Detalle de almacén</option>
            {Object.entries(stockReportTitles).map(([key,title])=><option key={key} value={key}>{title}</option>)}
          </select></label>
          <div className="movement-actions" role="group" aria-label="Exportar cuadro seleccionado">
            <button className="secondary-button" disabled={exportDisabled} onClick={()=>void pdf()}>Descargar PDF</button>
            <button className="secondary-button" disabled={exportDisabled} onClick={()=>void pdf(true)}>Imprimir</button>
            <button className="primary-button" disabled={exportDisabled} onClick={()=>void excel('selected')}>Descargar Excel</button>
          </div>
        </div>
        <details className="movement-extra-exports">
          <summary>Otros archivos de Excel</summary>
          <p className="form-hint">Descarga los seis cuadros juntos o genera los estados financieros (EEFF) con conciliación, compras, salidas y saldos por partida. Ambos usan los filtros actuales.</p>
          <div className="movement-actions">
            <button className="secondary-button" disabled={exportDisabled} onClick={()=>void excel('all')}>Excel con los seis cuadros</button>
            <button className="secondary-button" disabled={exportDisabled} onClick={()=>void excel('eeff')}>Excel de estados financieros</button>
          </div>
        </details>
        {busy&&<p className="form-hint" role="status"><PostalLoader/> Generando archivo…</p>}
      </section>
      {validRange&&<section className="data-panel">
        <div className="panel-heading movement-table-heading"><div><h2>{selectedReport?.title??'Detalle de almacén'}</h2><p className="muted">{rangeLabel} · Valores en Bs</p></div></div>
        {selectedReport?<div className="table-scroll"><table className="tabular-nums">
          <thead><tr>{Object.keys(selectedReport.records[0]!).map(key=><th key={key} scope="col">{key}</th>)}</tr></thead>
          <tbody>{selectedReport.records.slice(0,-1).map((record,index)=><tr key={index}>{Object.entries(record).map(([key,value])=><td key={key}>{value}</td>)}</tr>)}</tbody>
          <tfoot><tr>{Object.entries(selectedReport.records.at(-1)!).map(([key,value])=><th key={key}>{value}</th>)}</tr></tfoot>
        </table></div>:rows.length?<div className="table-scroll"><StockDetailTable rows={rows}/></div>:<p className="empty-state">No hay registros con estos filtros.</p>}
        <div className="movement-report-note">
          <p className="form-hint">{stockReportNote} Al buscar, los cuadros incluyen todas las operaciones del periodo de cada material encontrado para conciliar sus saldos.</p>
          {reportKind==='institutional'&&<p className="form-hint">Excel y PDF incluyen espacios de firma para Contabilidad, Responsable de almacenes y DGAA - DAF.</p>}
        </div>
      </section>}
    </div>}

    {archiveVisited&&<div hidden={!archive}>
      <WarehouseImports key={closingYear??'manual'} warehouses={data.warehouses} query={archiveSearch} closingYear={closingYear}/>
    </div>}
  </>;
}
