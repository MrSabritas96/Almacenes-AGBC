"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

const changedForms = new WeakSet<HTMLFormElement>();

export function useCanLeave() {
  useEffect(() => {
    function markChanged({ target, type }: Event) {
      if (!(target instanceof Element) || (type === "click" && !target.closest("button"))) return;
      const form = target.closest("form");
      if (form && form.getAttribute("method")?.toLowerCase() !== "get") changedForms.add(form);
    }
    const events = ["input", "change", "click", "submit"];
    function resetForm({ target }: Event) {
      if (target instanceof HTMLFormElement) changedForms.delete(target);
    }
    for (const event of events) document.addEventListener(event, markChanged, true);
    document.addEventListener("reset", resetForm, true);
    return () => {
      for (const event of events) document.removeEventListener(event, markChanged, true);
      document.removeEventListener("reset", resetForm, true);
    };
  }, []);

  return confirmLeave;
}

export function confirmLeave() {
  if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not(#workspace-sidebar)')) {
    toast.error("Guarda o cierra el formulario antes de continuar.");
    return false;
  }
  const edited = Array.from(document.forms).filter(form => changedForms.has(form) && form.getClientRects().length > 0);
  if (edited.some(form => form.matches('[aria-busy="true"]') || form.querySelector("fieldset:disabled"))) {
    toast.error("Espera a que termine la operación del formulario.");
    return false;
  }
  return !edited.length || window.confirm("Hay cambios sin guardar. ¿Quieres salir y descartarlos?");
}
