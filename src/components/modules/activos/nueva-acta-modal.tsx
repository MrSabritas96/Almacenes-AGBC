"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { FormularioActa } from "./formulario-acta";

export function NuevaActaModal({hoy,responsables,className,gestionActiva,fechaInicial,fechaMinima,fechaMaxima,etiqueta}:{hoy:string;responsables:{nombre:string;cargo:string|null}[];className?:string;gestionActiva?:number;fechaInicial?:string;fechaMinima?:string;fechaMaxima?:string;etiqueta?:string}) {
 const dialogo=useRef<HTMLDialogElement>(null);
 const [solicitud,setSolicitud]=useState<string|null>(null);
 useEffect(()=>{
  if(!solicitud)return;
  const dialog=dialogo.current;if(!dialog)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  if(!dialog.open)dialog.showModal();
  return ()=>{dialog.close();document.body.style.overflow=overflow;};
 },[solicitud]);
 return <>
  <button type="button" aria-haspopup="dialog" onClick={()=>setSolicitud(crypto.randomUUID())} className={className??"inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-700"}><Plus className="h-4 w-4" aria-hidden="true"/>{etiqueta??"Nueva acta"}</button>
  <dialog ref={dialogo} onClose={()=>setSolicitud(null)} aria-labelledby="titulo-nueva-acta" className="fixed inset-0 m-auto max-h-[94dvh] w-[min(1200px,96vw)] max-w-none overflow-y-auto rounded-2xl border border-ink-200 bg-slate-50 p-0 text-ink-900 shadow-2xl backdrop:bg-slate-950/55">
   {solicitud&&<><header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-200 bg-white px-5 py-4 sm:px-6"><div><h2 id="titulo-nueva-acta" className="text-xl font-bold">Nueva acta de activos · Gestión {gestionActiva??hoy.slice(0,4)}</h2><p className="mt-1 text-xs text-ink-500">Completa los datos y guarda el PDF para imprimir.</p></div><button type="button" onClick={()=>dialogo.current?.close()} aria-label="Cerrar nueva acta" className="shrink-0 rounded-lg p-2 text-ink-500 hover:bg-ink-100 focus-visible:outline-2 focus-visible:outline-brand-500"><X className="h-5 w-5" aria-hidden="true"/></button></header><div className="p-4 sm:p-6"><FormularioActa hoy={hoy} gestionActiva={gestionActiva} fechaInicial={fechaInicial} fechaMinima={fechaMinima} fechaMaxima={fechaMaxima} solicitudId={solicitud} responsables={responsables}/></div></>}
  </dialog>
 </>;
}
