"use client";
import { withMinimumLoading } from '@/lib/loading-time';
import { PostalLoader } from './postal-loader';
import { useEffect, useState } from 'react';
import { ClipboardList, Download, Search } from 'lucide-react';
import { consultMaterialRequests } from '@/actions/almacenes/request-status';
import type { PublicRequestStatus as RequestMaterial } from '@/lib/request-status';
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
    let active=true,inFlight=false,initial=true;
    async function refresh(){
      if(inFlight)return;inFlight=true;
      try {const first=initial;initial=false;const next=await (first?withMinimumLoading(()=>consultMaterialRequests(lookup!)):consultMaterialRequests(lookup!));if(active)setResult(next);}
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
  const requests = new Map<string, RequestMaterial[]>();
  if (result?.ok) {
    for (const material of result.requests) {
      const reference = material.group_reference || material.reference;
      const materials = requests.get(reference);
      if (materials) materials.push(material);
      else requests.set(reference, [material]);
    }
  }
  const requestCount = requests.size;
  return <main className="warehouse-access public-intake"><header className="access-header"><Brand/><a href="/almacenes" className="text-link">Volver al acceso</a></header>
    <section className="access-panel intake-panel request-status-panel"><h1>Consultar mis solicitudes</h1><p className="muted">No necesitas una cuenta ni conservar el código del comprobante. Ingresa tu CI tal como lo registraste para ver todas tus solicitudes y las respuestas del almacén.</p>
      <form className="access-form status-lookup-form" onSubmit={submit} aria-busy={busy}>
        <label>CI (con extensión si la registraste)<input name="document" required minLength={3} maxLength={40} placeholder="Ej.: 1234567-LP" autoComplete="off" spellCheck={false}/></label>
        <label>Comprobante de solicitud (opcional)<input name="reference" maxLength={200} autoComplete="off" spellCheck={false} autoCapitalize="characters" placeholder="Déjalo vacío para ver todas"/></label>
        <button className="primary-button" disabled={busy}>{busy?<PostalLoader/>:<Search size={18}/>} {busy?'Consultando…':'Consultar solicitudes'}</button>
      </form>
      <p className="form-hint">¿Perdiste el comprobante? Consulta solo con tu CI para ver tu historial completo y volver a descargarlo. Si ingresas un comprobante, se muestra únicamente ese pedido. El estado se actualiza automáticamente cada 15 segundos mientras esta página esté visible.</p>
      {result&&!result.ok&&<p className="form-error" role="alert">{result.error}</p>}
      {pdfError&&<p className="form-error" role="alert">{pdfError}</p>}
      {result?.ok&&<div className="public-request-results"><p role="status" className="status-result-count">{requestCount?`${requestCount} ${requestCount===1?'solicitud encontrada':'solicitudes encontradas'}.`:lookup?.reference?'No se encontró una solicitud con ese CI y comprobante. Revisa los datos o deja el comprobante vacío para ver todo tu historial.':'No se encontraron solicitudes con ese CI. Comprueba que coincida con el registrado, incluida la extensión si corresponde.'}</p>
        {Array.from(requests, ([reference, materials]) => <article key={reference} className="data-panel public-status-card">
          <div className="panel-heading">
            <h2><ClipboardList size={18} aria-hidden="true"/><span>Solicitud <code>{reference}</code></span></h2>
            <small>Solicitada el {date(materials[0]?.created_at ?? null)}</small>
          </div>
          <ul className="public-status-materials" role="list">
            {materials.map(r => <li key={r.reference} className="public-status-details">
              <div className="public-status-material-heading">
                <h3>{r.material}</h3>
                <span className={`status-badge status-${r.status}`}>{r.status==='approved'?'Aceptada · Lista para recoger':statuses[r.status]??r.status}</span>
              </div>
              <p><strong>Pedido: {r.quantity} {r.unit}</strong>{r.authorized_quantity!=null&&<> · Autorizado: {r.authorized_quantity} {r.unit}</>} · {r.warehouse}</p>
              {r.status==='pending'&&<p>La administradora está revisando tu solicitud.</p>}
              {r.status==='approved'&&<p className="pickup-information"><strong>Tu solicitud fue aceptada.</strong> Puedes recoger el material el {date(r.delivery_on)} en {r.delivery_place||r.warehouse}. Presenta tu CI.</p>}
              {r.status==='waiting'&&<p>Tu solicitud fue aceptada y está en espera de reposición. La fecha de entrega aún no está confirmada.</p>}
              {r.status==='denied'&&<p>Tu solicitud fue rechazada. Revisa la respuesta del almacén.</p>}
              {r.delivered_at&&r.status==='delivered'&&<p>Entrega registrada: {date(r.delivered_at)}.</p>}
              {r.status==='cancelled'&&<p>La entrega fue anulada. Consulta con la administradora del almacén.</p>}
              {r.response&&<div className="public-status-response"><strong>Respuesta del almacén</strong><p>{r.response}</p></div>}
            </li>)}
          </ul>
          <div className="public-status-receipt">
            <button type="button" className="secondary-button receipt-download" disabled={pdfBusy} onClick={()=>void downloadReceipt(reference)}>{pdfBusy?<PostalLoader/>:<Download size={16}/>} {pdfBusy?'Generando PDF…':'Descargar comprobante'}</button>
          </div>
        </article>)}
      </div>}
      <div className="public-request-actions"><a href="/solicitar-material" className="secondary-button">Solicitar material</a><a href="/almacenes" className="text-link">Volver al acceso</a></div>
    </section>
  </main>;
}
