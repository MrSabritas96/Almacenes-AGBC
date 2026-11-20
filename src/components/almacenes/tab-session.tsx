"use client";
import { createContext, useContext, useEffect, useEffectEvent, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const TabSession = createContext<string | undefined>(undefined);
export const useWarehouseTab = () => useContext(TabSession);

export function WarehouseTabSession({tabId,children}:{tabId?:string;children:ReactNode}) {
  const router = useRouter();
  const [,startRefresh] = useTransition();
  const refresh = useEffectEvent(() => startRefresh(() => router.refresh()));

  useEffect(()=>{
    const socket = io({path:'/socket.io',auth:tabId ? {tabId} : {},withCredentials:true});
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectedOnce = false;
    const changed = () => {
      window.dispatchEvent(new Event('warehouse:changed'));
      // Agrupa ráfagas, sin desplazar al usuario ni cerrar formularios.
      clearTimeout(timer);
      timer = setTimeout(() => refresh(), 100);
    };
    socket.on('warehouse:changed',changed);
    socket.on('connect', () => {
      // La carga inicial ya trae los datos. Recupera cambios solo tras reconectar.
      if (connectedOnce) changed();
      connectedOnce = true;
    });
    return ()=>{clearTimeout(timer);socket.disconnect();};
  },[tabId]);
  return <TabSession.Provider value={tabId}>{children}</TabSession.Provider>;
}
