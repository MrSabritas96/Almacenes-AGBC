"use client";

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { confirmLeave } from '@/components/sidebar/use-can-leave';

export function WarehouseNavigationGuard() {
  const pathname = usePathname();
  const currentHref = useRef('');
  useLayoutEffect(() => {
    currentHref.current = window.location.href;
  }, [pathname]);

  useEffect(() => {
    // La Navigation API permite bloquear Atrás antes de que cambie la ruta.
    const navigation = (window as Window & {navigation?: EventTarget}).navigation;
    function beforeTraverse(event: Event & {navigationType?: string}) {
      if (event.navigationType !== 'traverse' || !event.cancelable) return;
      if (!currentHref.current || !new URL(currentHref.current).pathname.startsWith('/almacenes/')) return;
      if (!confirmLeave()) event.preventDefault();
    }
    function protect(event: PopStateEvent) {
      if (!currentHref.current || !new URL(currentHref.current).pathname.startsWith('/almacenes/')) return;
      if (confirmLeave()) return;
      event.stopImmediatePropagation();
      window.history.pushState(null, '', currentHref.current);
    }
    navigation?.addEventListener('navigate', beforeTraverse);
    window.addEventListener('popstate', protect, true);
    return () => {
      navigation?.removeEventListener('navigate', beforeTraverse);
      window.removeEventListener('popstate', protect, true);
    };
  }, []);
  return null;
}
