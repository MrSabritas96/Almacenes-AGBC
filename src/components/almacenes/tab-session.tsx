"use client";
import { createContext, useContext, useEffect, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const TabSession = createContext<string | undefined>(undefined);
export const useWarehouseTab = () => useContext(TabSession);

export function WarehouseTabSession({tabId,children}:{tabId?:string;children:ReactNode}) {
  const router = useRouter();
  const [,startRefresh] = useTransition();
  useEffect(()=>{
    if (!tabId) return;
    const socket = io({path:'/socket.io',auth:{tabId},withCredentials:true});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      window.dispatchEvent(new Event('warehouse:changed'));
      // Agrupa ráfagas, sin desplazar al usuario ni cerrar formularios.
      clearTimeout(timer);
      timer = setTimeout(()=>startRefresh(()=>router.refresh()),100);
    };
    socket.on('warehouse:changed',changed);
    socket.on('connect',changed); // Recupera cambios ocurridos durante una desconexión.
    return ()=>{clearTimeout(timer);socket.disconnect();};
  },[tabId,router]);
  return <TabSession.Provider value={tabId}>{children}</TabSession.Provider>;
}
