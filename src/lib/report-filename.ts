/** Nombre legible, compatible con Windows y con la hora institucional de Bolivia. */
export function reportFilename(title:string,extension:'pdf'|'xlsx',generatedAt=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/La_Paz',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(generatedAt);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  const name=title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/,'')||'Reporte';
  return `${name} - ${part('year')}-${part('month')}-${part('day')}_${part('hour')}-${part('minute')}-${part('second')}.${extension}`;
}
