"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateInputValue, displayDate } from '@/lib/request-date';

const localISO=(date:Date)=>`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function DateField({label,name,required,min,max,defaultValue='',text:draft,onTextChange}:{
  label:string;name?:string;required?:boolean;min?:string;max?:string;
  defaultValue?:string;text?:string;onTextChange?:(text:string)=>void;
}) {
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/La_Paz'});
  const id=useId(),input=useRef<HTMLInputElement>(null),calendar=useRef<HTMLDivElement>(null);
  const [localText,setLocalText]=useState(()=>displayDate(defaultValue)),[open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date(`${today}T12:00:00`));
  const text=draft??localText;
  const setText=onTextChange??setLocalText;
  const value=dateInputValue(text);
  const outsideRange=(iso:string)=>(!!min&&iso<min)||(!!max&&iso>max);
  const error=text&&!value?'Ingresa una fecha válida en formato dd/mm/aaaa.'
    :value&&min&&value<min?`La fecha debe ser igual o posterior al ${displayDate(min)}.`
    :value&&max&&value>max?`La fecha debe ser igual o anterior al ${displayDate(max)}.`:'';
  useEffect(()=>{input.current?.setCustomValidity(error);},[error]);
  const start=new Date(month);
  start.setDate(1);
  start.setDate(1-(start.getDay()+6)%7);
  const days=Array.from({length:42},(_,i)=>{const day=new Date(start);day.setDate(start.getDate()+i);return day;});
  function choose(iso:string){setText(displayDate(iso));setOpen(false);input.current?.focus();}
  function moveMonth(delta:number){const next=new Date(month);next.setMonth(month.getMonth()+delta,1);setMonth(next);}
  function moveDay(e:React.KeyboardEvent<HTMLButtonElement>,day:Date){
    const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-(day.getDay()+6)%7,End:6-(day.getDay()+6)%7};
    const offset=delta[e.key];if(offset===undefined)return;e.preventDefault();const next=new Date(day);next.setDate(day.getDate()+offset);
    if(outsideRange(localISO(next)))return;setMonth(next);
    requestAnimationFrame(()=>calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${localISO(next)}"]`)?.focus());
  }
  return <div className="date-field" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);input.current?.focus();}}}>
    <label htmlFor={id}>{label}</label>
    <div className="search-select-control"><input ref={input} id={id} required={required} value={text} placeholder="dd/mm/aaaa" maxLength={10} inputMode="numeric" aria-invalid={!!error} onChange={e=>setText(e.target.value)} onBlur={()=>{if(value)setText(displayDate(value));}}/>
      {name&&<input type="hidden" name={name} value={value}/>}
      <button type="button" className="search-select-toggle" aria-label={`Calendario: ${label}`} aria-expanded={open} aria-controls={`${id}-calendar`} onClick={()=>{if(!open){setMonth(new Date(`${value||(min&&today<min?min:max&&today>max?max:today)}T12:00:00`));setOpen(true);requestAnimationFrame(()=>{
        const panel=calendar.current;
        (panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:enabled')??panel?.querySelector<HTMLButtonElement>('.calendar-day:enabled'))?.focus();
      });}else setOpen(false);}}><CalendarDays size={18}/></button>
    </div>
    {open&&<div ref={calendar} id={`${id}-calendar`} role="group" aria-label={`Calendario: ${label}`} className="request-calendar">
      <div className="calendar-heading"><button type="button" aria-label="Mes anterior" onClick={()=>moveMonth(-1)}><ChevronLeft size={18}/></button><span aria-live="polite">{new Intl.DateTimeFormat('es-BO',{month:'long',year:'numeric'}).format(month)}</span><button type="button" aria-label="Mes siguiente" onClick={()=>moveMonth(1)}><ChevronRight size={18}/></button></div>
      <div className="calendar-week" aria-hidden="true">{['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d=><span key={d}>{d}</span>)}</div>
      <div className="calendar-days">{days.map(day=>{const iso=localISO(day);return <button type="button" key={iso} data-date={iso} className={`calendar-day${day.getMonth()!==month.getMonth()?' other-month':''}`} disabled={outsideRange(iso)} aria-label={new Intl.DateTimeFormat('es-BO',{dateStyle:'full'}).format(day)} aria-pressed={iso===value} aria-current={iso===today?'date':undefined} onKeyDown={e=>moveDay(e,day)} onClick={()=>choose(iso)}>{day.getDate()}</button>;})}</div>
      <div className="calendar-footer"><button type="button" disabled={outsideRange(today)} onClick={()=>choose(today)}>Hoy</button><button type="button" onClick={()=>{setOpen(false);input.current?.focus();}}>Escribir fecha</button></div>
    </div>}
  </div>;
}
