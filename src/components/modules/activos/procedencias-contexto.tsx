"use client";
import { createContext,useContext } from "react";
export type ProcedenciaCatalogo={clave:string;nombre:string;activa:boolean;version:number};
const Contexto=createContext<{catalogo:ProcedenciaCatalogo[];gestionar:boolean}>({catalogo:[],gestionar:false});
export function ProcedenciasProvider({catalogo,gestionar,children}:{catalogo:ProcedenciaCatalogo[];gestionar:boolean;children:React.ReactNode}){return <Contexto.Provider value={{catalogo,gestionar}}>{children}</Contexto.Provider>;}
export function useProcedencias(){const {catalogo,gestionar}=useContext(Contexto);return {catalogo,gestionar,activas:catalogo.filter(p=>p.activa),nombre:(clave:string)=>catalogo.find(p=>p.clave===clave)?.nombre||clave};}
export function NombreProcedencia({clave}:{clave:string}){return <>{useProcedencias().nombre(clave)}</>;}
