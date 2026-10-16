"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Download, LoaderCircle, Search } from 'lucide-react';
import { consultMaterialRequests } from '@/actions/almacenes/request-status';
import { statuses } from '@/lib/warehouse-types';
import { downloadRequestReceipt } from './request-receipt';
import { Brand } from './brand';

const date=(value:string|null)=>value?new Intl.DateTimeFormat('es-BO',{timeZone:'America/La_Paz',dateStyle:'medium'}).format(new Date(value.length===10?`${value}T12:00:00-04:00`:value)):'Por confirmar';
type Result=Awaited<ReturnType<typeof consultMaterialRequests>>;
export default function PublicRequestStatus() {
  const [lookup,setLookup]=useState<{document:string;reference:string}|null>(null);
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);
  const [pdfError,setPdfError]=useState('');
  useEffect(()=>{
    if(!lookup)return;
    let active=true,inFlight=false;
    async function refresh(){
      if(inFlight)return;inFlight=true;
      try {const next=await consultMaterialRequests(lookup!);if(active)setResult(next);}
      catch {if(active)setResult({ok:false,error:'No se pudo conectar. Intenta nuevamente.'});}
      finally {inFlight=false;if(active)setBusy(false);}
    }
    void refresh();
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    const interval=setInterval(visible,15000);
    document.addEventListener('visibilitychange',visible);
    return()=>{active=false;clearInterval(interval);document.removeEventListener('visibilitychange',visible);};
  },[lookup]);
  async function downloadReceipt(reference:string){
    if(!lookup||pdfBusy)return;setPdfBusy(true);setPdfError('');
    try{await downloadRequestReceipt(lookup.document,reference);}
    catch(error){setPdfError(error instanceof Error?error.message:'No se pudo descargar el comprobante.');}
    finally{setPdfBusy(false);}
  }
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;
    const values=new FormData(event.currentTarget);
    const document=String(values.get('document')??'');
    const reference=String(values.get('reference')??'').trim();
    setResult(null);setPdfError('');setBusy(true);setLookup({document,reference});
  }
  return <main className="warehouse-access public-intake"><header className="access-header"><Brand/><Link href="/almacenes" className="text-link">Volver al acceso</Link></header>
    <section className="access-panel intake-panel request-status-panel"><h1>Consultar mi solicitud</h1><p className="muted">No necesitas una cuenta. Ingresa tu CI con extensión y el comprobante que recibiste al enviar la solicitud para ver la respuesta del almacén.</p>
      <form className="access-form status-lookup-form" onSubmit={submit} aria-busy={busy}>
        <label>CI y extensión<input name="document" required minLength={3} maxLength={40} placeholder="Ej.: 1234567-LP" autoComplete="off" spellCheck={false}/></label>
        <label>Comprobante de solicitud<input name="reference" required maxLength={200} autoComplete="off" spellCheck={false} autoCapitalize="characters" placeholder="Ej.: SOL-7K3M-9P2R"/></label>
        <button className="primary-button" disabled={busy}>{busy?<LoaderCircle size={18} className="motion-spin"/>:<Search size={18}/>} {busy?'Consultando…':'Consultar solicitud'}</button>
      </form>
      <p className="form-hint">Se muestra únicamente la solicitud que coincide con tu CI y comprobante. El estado se actualiza automáticamente cada 15 segundos mientras esta página esté visible.</p>
      {result&&!result.ok&&<p className="form-error" role="alert">{result.error}</p>}
      {pdfError&&<p className="form-error" role="alert">{pdfError}</p>}
      {result?.ok&&<div className="public-request-results"><p role="status" className="status-result-count">{result.requests.length?'Solicitud encontrada.':'No se encontró una solicitud con esos datos. Revisa el CI, la extensión y el comprobante.'}</p>
        {result.requests.map(r=><article key={r.reference} className="data-panel public-status-card">
          <div className="panel-heading"><h2><ClipboardList size={18}/>{r.material}</h2><span className={`status-badge status-${r.status}`}>{r.status==='approved'?'Aceptada · Lista para recoger':statuses[r.status]??r.status}</span></div>
          <div className="public-status-details"><p><strong>{r.quantity} {r.unit}</strong> · {r.warehouse}</p><p>Solicitada: {date(r.created_at)} · Fecha requerida: {date(r.needed_on)}</p>
            {r.status==='pending'&&<p>La administradora está revisando tu solicitud.</p>}
            {r.status==='approved'&&<p className="pickup-information"><strong>Tu solicitud fue aceptada.</strong> Puedes recoger el material el {date(r.delivery_on)} en {r.delivery_place||r.warehouse}. Presenta tu CI.</p>}
            {r.status==='waiting'&&<p>Tu solicitud fue aceptada y está en espera de reposición. La fecha de entrega aún no está confirmada.</p>}
            {r.status==='denied'&&<p>Tu solicitud fue rechazada. Revisa la respuesta del almacén.</p>}
            {r.delivered_at&&r.status==='delivered'&&<p>Entrega registrada: {date(r.delivered_at)}.</p>}
            {r.status==='cancelled'&&<p>La entrega fue anulada. Consulta con la administradora del almacén.</p>}
            {r.response&&<div className="public-status-response"><strong>Respuesta del almacén</strong><p>{r.response}</p></div>}
            <small>Comprobante: {r.reference}</small><button type="button" className="secondary-button receipt-download" disabled={pdfBusy} onClick={()=>void downloadReceipt(r.reference)}>{pdfBusy?<LoaderCircle size={16} className="motion-spin"/>:<Download size={16}/>} {pdfBusy?'Generando PDF…':'Descargar comprobante'}</button>
          </div>
        </article>)}
      </div>}
      <div className="public-request-actions"><Link href="/solicitar-material" className="secondary-button">Solicitar material</Link><Link href="/almacenes" className="text-link">Volver al acceso</Link></div>
    </section>
  </main>;
}
