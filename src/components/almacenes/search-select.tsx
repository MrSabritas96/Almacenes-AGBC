"use client";
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

type Option={id:string;label:string;description?:string};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');

export function SearchSelect({label,name,value,options,onChange,onSelect,freeText=false,required=true,placeholder,maxLength=200}:{
  label:string;name?:string;value:string;options:Option[];onChange:(text:string)=>void;onSelect:(option:Option)=>void;
  freeText?:boolean;required?:boolean;placeholder?:string;maxLength?:number;
}) {
  const id=useId(),input=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[filter,setFilter]=useState('');
  const filtered=options.filter(o=>normalize(`${o.label} ${o.description??''}`).includes(normalize(filter)));
  useEffect(()=>{input.current?.setCustomValidity(!freeText&&value&&!options.some(o=>o.label===value)?'Escribe para buscar y selecciona una opción de la lista.':'');},[freeText,value,options]);
  useEffect(()=>{if(open&&active>=0)list.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({block:'nearest'});},[active,open]);
  function choose(option:Option){onSelect(option);setOpen(false);setActive(-1);input.current?.focus();}
  function show(){setFilter('');setActive(-1);setOpen(true);}
  return <div className="request-search-field" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <label htmlFor={id}>{label}</label>
    <div className="search-select-control">
      <input ref={input} id={id} name={name} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} autoComplete="off" required={required} maxLength={maxLength} value={value} placeholder={placeholder??'Escribe o selecciona'}
        onFocus={show} onChange={e=>{onChange(e.target.value);setFilter(e.target.value);setActive(-1);setOpen(true);}}
        onKeyDown={e=>{
          if(e.key==='Escape'){e.preventDefault();setOpen(false);}
          if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open){show();setActive(e.key==='ArrowDown'?(options.length?0:-1):options.length-1);}else setActive(i=>filtered.length?Math.max(0,Math.min(filtered.length-1,i+(e.key==='ArrowDown'?1:-1))):-1);}
          if(e.key==='Enter'&&open&&active>=0&&filtered[active]){e.preventDefault();choose(filtered[active]);}
        }}/>
      <button type="button" className="search-select-toggle" aria-label={`Mostrar opciones de ${label}`} aria-expanded={open} aria-controls={`${id}-list`} onMouseDown={e=>e.preventDefault()} onClick={()=>{input.current?.focus();if(open)setOpen(false);else show();}}><ChevronDown size={18}/></button>
    </div>
    {open&&<div ref={list} id={`${id}-list`} role="listbox" aria-label={`Opciones de ${label}`} className="search-select-list">
      {filtered.map((option,i)=><div key={option.id} id={`${id}-option-${i}`} role="option" aria-selected={option.label===value} className={i===active?'is-active':''} onMouseDown={e=>e.preventDefault()} onMouseMove={()=>setActive(i)} onClick={()=>choose(option)}><span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>{option.label===value&&<Check size={16}/>}</div>)}
      {!filtered.length&&<p role="status">{freeText?'Sin coincidencias. Puedes escribir un valor nuevo.':'No hay coincidencias. Prueba con otro nombre o código.'}</p>}
    </div>}
  </div>;
}
