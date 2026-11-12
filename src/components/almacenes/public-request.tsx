"use client";
import { withMinimumLoading } from '@/lib/loading-time';
import { PostalLoader } from './postal-loader';
import { useRef, useState } from "react";
import { CheckCircle2, Copy, Download, Send } from "lucide-react";
import { submitPublicRequest } from "@/actions/almacenes/public-request";
import { Brand } from "./brand";
import { downloadRequestReceipt } from "./request-receipt";
import { ResponseMessage } from "./response-message";
import { SearchSelect } from "./search-select";
import { REGIONALS } from "@/lib/warehouse-reference";
import type { requestCatalog } from "@/lib/material-intake";

type Catalog = Awaited<ReturnType<typeof requestCatalog>>;
const emptyPerson={name:'',document:'',position:'',department:'',phone:'',regional:''};
export default function PublicMaterialRequest({ catalog }: { catalog: Catalog;today:string }) {
  const [warehouse,setWarehouse]=useState(catalog.warehouses[0]?.id??"");
  const [warehouseText,setWarehouseText]=useState(catalog.warehouses[0]?.name??'');
  const [person,setPerson]=useState(emptyPerson),[selectedPerson,setSelectedPerson]=useState('');
  const [lines,setLines]=useState([{key:0,materialText:'',quantity:'1'}]),[priorityText,setPriorityText]=useState('Normal');
  const nextLine=useRef(1);
  const emptyLines=()=>[{key:nextLine.current++,materialText:'',quantity:'1'}];
  function updateLine(key:number,patch:Partial<{materialText:string;quantity:string}>){setLines(current=>current.map(line=>line.key===key?{...line,...patch}:line));}
  const materials=catalog.materials.filter(m=>m.warehouse_id===warehouse).map(m=>({id:m.id,label:`${m.code} · ${m.name} (${m.unit})`}));
  const people=catalog.people.filter(p=>p.warehouse_id===warehouse);
  function changeWarehouse(id:string){setWarehouse(id);setPerson(emptyPerson);setSelectedPerson('');setLines(emptyLines());}
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
      const result=await withMinimumLoading(()=>submitPublicRequest({...values,warehouseId:warehouse,lines:lines.map(line=>({materialId:materials.find(m=>m.label===line.materialText)?.id??'',quantity:Number(line.quantity)})),priority:priorityText==='Urgente'?'urgent':'normal',submissionKey:submissionKey.current}));
      if(!result.ok){setError(result.error);return;}
      setReceiptDocument(String(values.document??""));setReference(result.reference);
    } catch {setError("No se pudo enviar. Reintenta; el mismo envío no se registrará dos veces.");}
    finally {setBusy(false);}
  }
  return <main className="warehouse-access public-intake"><header className="access-header"><Brand/><div className="public-request-actions"><a href="/consultar-solicitud" className="text-link">Consultar solicitud</a><a href="/almacenes" className="text-link">Acceso administrativo</a></div></header>
    <section className="access-panel intake-panel">
      <h1>Solicitud de material</h1><p className="muted">No necesitas una cuenta. Registra tus datos y los materiales que necesitas; la administradora revisará tu solicitud.</p>
      {reference?<div className="request-confirmation" role="status"><CheckCircle2 size={36}/><h2>Solicitud recibida</h2><p>Guarda este comprobante: <strong className="request-reference">{reference}</strong></p><div className="public-request-actions"><button type="button" className="secondary-button" onClick={()=>void copyReference()}><Copy size={16}/>Copiar comprobante</button><button type="button" className="secondary-button" disabled={pdfBusy} onClick={()=>void downloadReceipt()}>{pdfBusy?<PostalLoader/>:<Download size={16}/>} {pdfBusy?"Generando PDF…":"Descargar comprobante"}</button></div>{pdfError&&<p className="form-error" role="alert">{pdfError}</p>}<p className="copy-status" role="status" aria-live="polite">{copyStatus}</p><p>Consulta todas tus solicitudes con tu CI tal como lo registraste. Este comprobante es opcional para buscar un pedido específico. Conserva el comprobante y compártelo únicamente con personas autorizadas. Cuando se apruebe tu solicitud, verás la respuesta y la fecha de recojo. Presenta tu CI para verificar la entrega.</p><a href="/consultar-solicitud" className="secondary-button">Consultar estado de mi solicitud</a><button className="primary-button" onClick={()=>{submissionKey.current="";setReference("");setCopyStatus("");setPdfError("");setReceiptDocument("");setLines(emptyLines());setPriorityText('Normal');}}>Enviar otra solicitud</button></div>:!catalog.warehouses.length?<p className="form-error" role="status">Los formularios de solicitud están cerrados. Contacta a la administradora de almacén.</p>:<form className="access-form" onSubmit={submit} aria-busy={busy}>
        <fieldset className="form-grid" disabled={busy}>
          <div className="full-width"><SearchSelect label="Almacén" value={warehouseText} options={catalog.warehouses.map(w=>({id:w.id,label:w.name,description:w.location}))} onChange={text=>{setWarehouseText(text);const match=catalog.warehouses.find(w=>w.name===text);if(match&&match.id!==warehouse)changeWarehouse(match.id);}} onSelect={option=>{if(option.id!==warehouse)changeWarehouse(option.id);setWarehouseText(option.label);}}/></div>
          <SearchSelect label="Nombre completo" name="name" value={person.name} freeText options={people.map(p=>({id:p.id,label:p.name,description:`${p.regional} · ${p.position} · ${p.department} · CI: ${p.document}`}))} onChange={name=>{setPerson({... (selectedPerson?emptyPerson:person),name});setSelectedPerson('');}} onSelect={option=>{const p=people.find(p=>p.id===option.id)!;setPerson({name:p.name,document:p.document,position:p.position,department:p.department,phone:p.phone,regional:p.regional});setSelectedPerson(p.id);}} placeholder="Busca tu nombre o escribe uno nuevo"/>
          <label>CI y extensión<input name="document" required minLength={3} maxLength={40} placeholder="Ej.: 1234567-LP" value={person.document} onChange={e=>setPerson({...person,document:e.target.value})}/></label>
          <label>Cargo<input name="position" required maxLength={200} value={person.position} onChange={e=>setPerson({...person,position:e.target.value})}/></label>
          <label>Unidad / departamento<input name="department" required maxLength={200} value={person.department} onChange={e=>setPerson({...person,department:e.target.value})}/></label>
          <label>Teléfono de contacto (opcional)<input name="phone" type="tel" maxLength={40} autoComplete="tel" value={person.phone} onChange={e=>setPerson({...person,phone:e.target.value})}/></label>
          <label>Regional<select name="regional" required value={person.regional} onChange={e=>setPerson({...person,regional:e.target.value})}><option value="">Selecciona una regional</option>{REGIONALS.map(r=><option key={r}>{r}</option>)}</select></label>
          <div className="full-width request-lines">
            <div className="request-lines-heading"><h2>Materiales solicitados</h2><small>Hasta 20 materiales en un solo envío.</small></div>
            {lines.map((line,index)=><section className="request-material-line" key={line.key} aria-label={`Material solicitado ${index+1}`}>
              <SearchSelect label={`Material ${index+1}`} value={line.materialText} options={materials} onChange={text=>updateLine(line.key,{materialText:text})} onSelect={option=>updateLine(line.key,{materialText:option.label})} placeholder="Escribe el nombre o código, o abre la lista" maxLength={500}/>
              <label>Cantidad del material {index+1}<input type="number" min={1} max={10000} required value={line.quantity} onChange={e=>updateLine(line.key,{quantity:e.target.value})}/></label>
              <button type="button" className="small-button danger" disabled={lines.length===1} aria-label={`Quitar material ${index+1}`} onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))}>Quitar</button>
            </section>)}
            <button type="button" className="secondary-button" disabled={lines.length>=20} onClick={()=>setLines([...lines,{key:nextLine.current++,materialText:'',quantity:'1'}])}>Añadir otro material</button>
            <p className="form-hint">Recibirás un solo comprobante. El almacén responderá a cada material por separado. Si necesitas más unidades de un material, reúne su cantidad en una sola línea.</p>
          </div>
          <SearchSelect label="Prioridad" value={priorityText} options={[{id:'normal',label:'Normal'},{id:'urgent',label:'Urgente'}]} onChange={setPriorityText} onSelect={option=>setPriorityText(option.label)}/>
          <ResponseMessage decision="purpose" required/>
          <label className="intake-honeypot" aria-hidden="true">Sitio web<input name="website" tabIndex={-1} autoComplete="off"/></label>
        </fieldset>
        <p className="form-hint">El CI permite reunir tu historial en este almacén. Puedes consultar todas tus solicitudes solo con tu CI, sin crear una cuenta. El comprobante será un filtro opcional.</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy?<PostalLoader/>:<Send size={18}/>} {busy?"Enviando…":"Enviar solicitud"}</button>
      </form>}
    </section>
  </main>;
}
