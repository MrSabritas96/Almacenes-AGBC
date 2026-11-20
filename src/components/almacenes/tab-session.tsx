"use client";
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useRef, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';

const TabSession = createContext<string | undefined>(undefined);
const RefreshSession = createContext<{refreshing:boolean;refresh:()=>void} | null>(null);
export const useWarehouseTab = () => useContext(TabSession);
export function useWarehouseRefresh() {
  const context=useContext(RefreshSession);
  if(!context)throw new Error('La actualización requiere WarehouseTabSession.');
  return context;
}

export function WarehouseTabSession({tabId,children}:{tabId?:string;children:ReactNode}) {
  const router = useRouter();
  const [refreshing,startRefresh] = useTransition();
  const refreshAgain = useRef(false);
  const performRefresh = useEffectEvent(() => {
    if(refreshing){refreshAgain.current=true;return;}
    startRefresh(() => router.refresh());
  });
  const refresh = useCallback(()=>{window.dispatchEvent(new Event('warehouse:refresh'));},[]);
  useEffect(()=>{
    if(!refreshing&&refreshAgain.current){refreshAgain.current=false;performRefresh();}
  },[refreshing]);

  useEffect(()=>{
    const socket = io({path:'/socket.io',auth:tabId ? {tabId} : {},withCredentials:true});
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectedOnce = false;
    const changed = () => {
      // Agrupa ráfagas, sin desplazar al usuario ni cerrar formularios.
      clearTimeout(timer);
      timer = setTimeout(() => {
        window.dispatchEvent(new Event('warehouse:changed'));
        performRefresh();
      }, 100);
    };
    socket.on('warehouse:changed',changed);
    window.addEventListener('warehouse:refresh',changed);
    socket.on('connect', () => {
      // La carga inicial ya trae los datos. Recupera cambios solo tras reconectar.
      if (connectedOnce) changed();
      connectedOnce = true;
    });
    return ()=>{clearTimeout(timer);refreshAgain.current=false;window.removeEventListener('warehouse:refresh',changed);socket.disconnect();};
  },[tabId]);
  return <TabSession.Provider value={tabId}><RefreshSession.Provider value={{refreshing,refresh}}>{children}</RefreshSession.Provider></TabSession.Provider>;
}
