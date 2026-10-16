"use client";
import { useId, useRef, useState } from 'react';

const suggestions: Record<string, {label:string;text:string}[]> = {
  stock_reason: [
    {label:'Compra',text:'Ingreso por compra de materiales para abastecimiento del almacén.'},
    {label:'Reposición',text:'Reposición de existencias del almacén.'},
    {label:'Devolución',text:'Ingreso por devolución de material no utilizado.'},
    {label:'Conteo físico',text:'Ajuste de existencias según conteo físico del almacén.'},
    {label:'Registro inicial',text:'Registro inicial del material en el inventario.'},
    {label:'Corrección de registro',text:'Corrección de un registro de inventario.'},
  ],
  purpose: [
    {label:'Uso diario',text:'Solicito este material para realizar las actividades diarias de mi unidad.'},
    {label:'Reposición de insumos',text:'Solicito este material para reponer los insumos consumidos en las actividades de mi unidad.'},
    {label:'Atención al público',text:'El material será utilizado en la atención al público y la prestación de los servicios de la agencia.'},
    {label:'Correspondencia y encomiendas',text:'Solicito este material para la recepción, clasificación y despacho de correspondencia y encomiendas.'},
    {label:'Organización de documentos',text:'El material se utilizará para organizar, identificar y archivar la documentación de mi unidad.'},
  ],
  approved: [
    {label:'Recoger material',text:'Solicitud aprobada. Puede recoger su material en el almacén en la fecha indicada.'},
    {label:'Presentar CI',text:'Su material está reservado. Presente su documento de identidad al momento del recojo.'},
    {label:'Coordinar recojo',text:'Solicitud aprobada. Por favor, coordine el recojo del material con el responsable del almacén.'},
  ],
  waiting: [
    {label:'Esperar reposición',text:'Su solicitud fue aceptada y queda en espera de reposición del material.'},
    {label:'Stock insuficiente',text:'Actualmente no hay stock suficiente para atender su solicitud. Consulte con el almacén la disponibilidad del material.'},
  ],
  denied: [
    {label:'Ampliar justificación',text:'La solicitud fue rechazada porque requiere una justificación más detallada. Por favor, complete la información y presente una nueva solicitud.'},
    {label:'Revisar cantidad',text:'No fue posible aprobar la cantidad solicitada. Por favor, revise la cantidad requerida y presente una nueva solicitud.'},
  ],
  delivered: [
    {label:'Entrega conforme',text:'El material fue entregado conforme a la solicitud aprobada.'},
    {label:'Identidad verificada',text:'Se confirmó la entrega del material al empleado, previa verificación de su documento de identidad.'},
  ],
};

export function ResponseMessage({decision,required}:{decision:string;required:boolean}) {
  const [message,setMessage]=useState('');
  const field=useRef<HTMLTextAreaElement>(null);
  const hint=useId();
  const purpose=decision==='purpose';
  const stockReason=decision==='stock_reason';
  const name=stockReason?'reason':purpose?'purpose':'response';
  const label=stockReason?'Motivo de entrada o ajuste':purpose?'Motivo de la solicitud':decision==='denied'?'Motivo del rechazo':decision==='waiting'?'Información sobre la falta de stock':'Mensaje para el empleado';
  return <div className="full-width response-editor" data-field={name}>
    <label className="response-editor-label" htmlFor={`${hint}-message`}>{label}</label>
    <div className="response-suggestions" role="group" aria-label={purpose||stockReason?'Motivos sugeridos':'Mensajes sugeridos'}>
      {(suggestions[decision]??[]).map(item=><button type="button" key={item.label} className="small-button" aria-pressed={message===item.text}
        onClick={()=>{setMessage(item.text);field.current?.focus();}}>{item.label}</button>)}
    </div>
    <p id={hint} className="form-hint">{purpose||stockReason?'Elige una sugerencia y adáptala a tu necesidad, o escribe tu propio motivo.':'Elige una sugerencia y edítala, o escribe tu propio mensaje.'}</p>
    <textarea ref={field} id={`${hint}-message`} name={name} value={message} onChange={e=>setMessage(e.target.value)}
      required={required} minLength={purpose?10:undefined} maxLength={stockReason?200:2000} aria-describedby={hint} placeholder={stockReason?'Describe el motivo de la entrada o del ajuste…':purpose?'Describe para qué necesitas el material…':'Escribe el mensaje para el empleado…'}/>
  </div>;
}
