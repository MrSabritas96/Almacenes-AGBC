"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Download, LoaderCircle, Send } from "lucide-react";
import { submitPublicRequest } from "@/actions/almacenes/public-request";
import { Brand } from "./brand";
import { downloadRequestReceipt } from "./request-receipt";
import { ResponseMessage } from "./response-message";

type Catalog = { warehouses: {id:string;name:string;location:string}[]; materials: {id:string;name:string;code:string;unit:string;warehouse_id:string}[] };
export default function PublicMaterialRequest({ catalog }: { catalog: Catalog }) {
  const [warehouse,setWarehouse]=useState(catalog.warehouses[0]?.id??"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [reference,setReference]=useState("");
  const [copyStatus,setCopyStatus]=useState("");
  const [receiptDocument,setReceiptDocument]=useState("");
  const [pdfBusy,setPdfBusy]=useState(false);
  const [pdfError,setPdfError]=useState("");
  const submissionKey=useRef("");
  async function copyReference() {
    try { await navigator.clipboard.writeText(reference);setCopyStatus("Comprobante copiado."); }
    catch { setCopyStatus("No se pudo copiar. Selecciona el código y cópialo manualmente."); }
  }
  async function downloadReceipt() {
    if(pdfBusy)return;setPdfBusy(true);setPdfError("");
    try { await downloadRequestReceipt(receiptDocument,reference); }
    catch(error) { setPdfError(error instanceof Error?error.message:"No se pudo descargar el comprobante."); }
    finally { setPdfBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(busy)return;
    const values=Object.fromEntries(new FormData(event.currentTarget));
    submissionKey.current ||= crypto.randomUUID();
    setBusy(true);setError("");
    try {
      const result=await submitPublicRequest({...values,warehouseId:warehouse,quantity:Number(values.quantity),submissionKey:submissionKey.current});
      if(!result.ok){setError(result.error);return;}
      setReceiptDocument(String(values.document??""));setReference(result.reference);
    } catch {setError("No se pudo enviar. Reintenta; el mismo envío no se registrará dos veces.");}
    finally {setBusy(false);}
  }
  return <main className="warehouse-access public-intake"><header className="access-header"><Brand/><div className="public-request-actions"><Link href="/consultar-solicitud" className="text-link">Consultar solicitud</Link><Link href="/almacenes" className="text-link">Acceso administrativo</Link></div></header>
    <section className="access-panel intake-panel">
      <h1>Solicitud de material</h1><p className="muted">No necesitas una cuenta. Registra tus datos y el material que necesitas; la administradora revisará tu solicitud.</p>
      {reference?<div className="request-confirmation" role="status"><CheckCircle2 size={36}/><h2>Solicitud recibida</h2><p>Guarda este comprobante: <strong className="request-reference">{reference}</strong></p><div className="public-request-actions"><button type="button" className="secondary-button" onClick={()=>void copyReference()}><Copy size={16}/>Copiar comprobante</button><button type="button" className="secondary-button" disabled={pdfBusy} onClick={()=>void downloadReceipt()}>{pdfBusy?<LoaderCircle size={16} className="motion-spin"/>:<Download size={16}/>} {pdfBusy?"Generando PDF…":"Descargar comprobante"}</button></div>{pdfError&&<p className="form-error" role="alert">{pdfError}</p>}<p className="copy-status" role="status" aria-live="polite">{copyStatus}</p><p>Consulta el estado con tu CI, extensión y este comprobante. Conserva el comprobante y compártelo únicamente con personas autorizadas. Cuando se apruebe tu solicitud, verás la respuesta y la fecha de recojo. Presenta tu CI para verificar la entrega.</p><Link href="/consultar-solicitud" className="secondary-button">Consultar estado de mi solicitud</Link><button className="primary-button" onClick={()=>{submissionKey.current="";setReference("");setCopyStatus("");setPdfError("");setReceiptDocument("");}}>Enviar otra solicitud</button></div>:!catalog.warehouses.length?<p className="form-error" role="status">Los formularios de solicitud están cerrados. Contacta a la administradora de almacén.</p>:<form className="access-form" onSubmit={submit} aria-busy={busy}>
        <fieldset className="form-grid" disabled={busy}>
          <label className="full-width">Almacén<select required value={warehouse} onChange={event=>setWarehouse(event.target.value)}>{catalog.warehouses.map(w=><option value={w.id} key={w.id}>{w.name} · {w.location}</option>)}</select></label>
          <label>Nombre completo<input name="name" required maxLength={200} autoComplete="name"/></label>
          <label>CI y extensión<input name="document" required minLength={3} maxLength={40} placeholder="Ej.: 1234567-LP"/></label>
          <label>Cargo<input name="position" required maxLength={200}/></label>
          <label>Unidad / departamento<input name="department" required maxLength={200}/></label>
          <label>Teléfono de contacto (opcional)<input name="phone" type="tel" maxLength={40} autoComplete="tel"/></label>
          <label>Fecha requerida<input name="neededOn" type="date" required/></label>
          <label className="full-width">Material<select key={warehouse} name="materialId" required defaultValue=""><option value="" disabled>Selecciona un material</option>{catalog.materials.filter(m=>m.warehouse_id===warehouse).map(m=><option key={m.id} value={m.id}>{m.code} · {m.name} ({m.unit})</option>)}</select></label>
          <label>Cantidad<input name="quantity" type="number" min={1} max={10000} required defaultValue={1}/></label>
          <label>Prioridad<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="urgent">Urgente</option></select></label>
          <ResponseMessage decision="purpose" required/>
          <label className="intake-honeypot" aria-hidden="true">Sitio web<input name="website" tabIndex={-1} autoComplete="off"/></label>
        </fieldset>
        <p className="form-hint">El CI permite reunir tu historial en este almacén. Puedes consultar el estado con tu CI, extensión y el comprobante que recibirás, sin crear una cuenta.</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy?<LoaderCircle size={18} className="motion-spin"/>:<Send size={18}/>} {busy?"Enviando…":"Enviar solicitud"}</button>
      </form>}
    </section>
  </main>;
}
