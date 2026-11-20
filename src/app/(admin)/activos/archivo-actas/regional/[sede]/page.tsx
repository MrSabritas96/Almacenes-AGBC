import { notFound } from "next/navigation";
import ArchivoPage from "../../_archivo";
const sedes: Record<string,{nombre:string;valor:string}>={
 "todas":{nombre:"todas las regionales",valor:""},
 "la-paz":{nombre:"La Paz · Oficina Central",valor:"Oficina Central"},
 "santa-cruz":{nombre:"Santa Cruz",valor:"Santa Cruz"},
 "cochabamba":{nombre:"Cochabamba",valor:"Cochabamba"},
 "oruro":{nombre:"Oruro",valor:"Oruro"},
 "potosi":{nombre:"Potosí",valor:"Potosí"},
 "chuquisaca":{nombre:"Chuquisaca · Regional Sucre",valor:"Sucre"},
 "tarija":{nombre:"Tarija",valor:"Tarija"},
 "beni":{nombre:"Beni",valor:"Beni"},
 "pando":{nombre:"Pando",valor:"Pando"},
 "el-alto":{nombre:"El Alto",valor:"El Alto"},
};
export default async function RegionalPage({params,searchParams}:{params:Promise<{sede:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {sede:slug}=await params;
 const seleccionada=Object.hasOwn(sedes,slug)?sedes[slug]:undefined;
 if(!seleccionada)notFound();
 return <ArchivoPage searchParams={searchParams} sede={{slug,...seleccionada}}/>;
}
