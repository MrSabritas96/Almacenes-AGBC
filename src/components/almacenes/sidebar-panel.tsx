"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";

const SidebarContext = createContext({ mobileOpen: false, isMobile: false, expanded: false, toggle: () => {} });
export function SidebarToggle() {
  const { mobileOpen, isMobile, expanded, toggle } = useContext(SidebarContext);
  if (isMobile) return <Dialog.Trigger asChild><button type="button" className="icon-button"
    aria-label="Abrir menú principal" aria-expanded={mobileOpen} aria-controls="warehouse-sidebar"><Menu size={18}/></button></Dialog.Trigger>;
  const label = expanded ? "Comprimir menú" : "Fijar menú expandido";
  return <button type="button" className="icon-button" aria-label={label} title={label} aria-pressed={expanded}
    aria-controls="warehouse-sidebar" onClick={toggle}>{expanded ? <ChevronsLeft size={18}/> : <ChevronsRight size={18}/>}</button>;
}
export function SidebarPanel({ userId, children, content }: { userId: string; children: ReactNode; content: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const storageKey = `agbc-sidebar-${userId}`;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setMobileOpen(false);
    };
    const frame = requestAnimationFrame(() => {
      update();
      try { setExpanded(localStorage.getItem(storageKey) === "expanded"); }
      catch { /* El almacenamiento puede estar bloqueado. */ }
    });
    media.addEventListener("change", update);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", update); };
  }, [storageKey]);
  function toggle() {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem(storageKey, next ? "expanded" : "compact"); }
    catch { /* Preferencia solo para esta sesión. */ }
  }
  const sidebar = <aside id="warehouse-sidebar" className="dashboard-sidebar app-sidebar" data-mode={expanded ? "expanded" : "compact"}
    onClick={event => {
      if (isMobile && (event.target as HTMLElement).closest("nav button")) setMobileOpen(false);
    }}>
    {isMobile && <Dialog.Title className="sr-only">Menú principal de almacenes</Dialog.Title>}
    {isMobile && <Dialog.Close asChild><button type="button" className="icon-button sidebar-close" aria-label="Cerrar menú principal"><X size={18}/></button></Dialog.Close>}
    <div className="sidebar-wrapper">{children}</div>
  </aside>;
  return <SidebarContext.Provider value={{ mobileOpen, isMobile, expanded, toggle }}>
    <Dialog.Root open={isMobile && mobileOpen} onOpenChange={setMobileOpen}>
      <div className={`warehouse-dashboard app-wrapper sidebar-mini${expanded ? "" : " sidebar-collapse"}`} data-sidebar-expanded={expanded}>
        {isMobile ? <Dialog.Portal>
          <Dialog.Overlay className="sidebar-backdrop" />
          <Dialog.Content asChild aria-describedby={undefined}>{sidebar}</Dialog.Content>
        </Dialog.Portal> : sidebar}
        {content}
      </div>
    </Dialog.Root>
  </SidebarContext.Provider>;
}
