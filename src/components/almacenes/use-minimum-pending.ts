"use client";
import { useEffect, useRef, useState } from 'react';
import { MINIMUM_LOADING_MS } from '@/lib/loading-time';

/** Mantiene un indicador visual sin retrasar las actualizaciones de datos. */
export function useMinimumPending(pending:boolean) {
  const [visible,setVisible]=useState(pending);
  const timeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>{
    if(!pending)return;
    clearTimeout(timeout.current);
    const frame=requestAnimationFrame(()=>setVisible(true));
    timeout.current=setTimeout(()=>setVisible(false),MINIMUM_LOADING_MS);
    return()=>cancelAnimationFrame(frame);
  },[pending]);
  useEffect(()=>()=>clearTimeout(timeout.current),[]);
  return pending||visible;
}
