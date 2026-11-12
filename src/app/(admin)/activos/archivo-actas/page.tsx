import { redirect } from "next/navigation";
import ArchivoPage from "./_archivo";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(params))if(typeof value==="string"&&value)query.set(key,value);
 // Preserve links from the responsible catalog and previous searches.
 if(query.size){
  const regional=query.get("regional")??"";
  const slug=regional==="Oficina Central"?"la-paz":regional==="Sucre"?"chuquisaca":regional?regional.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ /g,"-"):"todas";
  redirect(`/activos/archivo-actas/regional/${encodeURIComponent(slug)}?${query}`);
 }
 return <ArchivoPage searchParams={searchParams}/>;
}
