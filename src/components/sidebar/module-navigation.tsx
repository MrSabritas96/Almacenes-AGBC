"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Landmark } from "lucide-react";

import { useCanLeave } from "./use-can-leave";

export function ModuleNavigation({ current, canSwitch, busy }: {
  current: "activos" | "almacenes";
  canSwitch: boolean;
  busy?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canLeave = useCanLeave();

  function switchModule(destination: typeof current) {
    if (destination === current || !canSwitch || busy || pending || !canLeave()) return;
    startTransition(() => {
      router.push(destination === 'activos' ? '/activos/dashboard' : '/almacenes/dashboard');
    });
  }

  return (
    <nav className="module-navigation" aria-label="Módulos de SIBA" aria-busy={pending}>
      {(current === "activos" || canSwitch) && (
        <button type="button" aria-current={current === "activos" ? "page" : undefined}
          disabled={pending || (busy && current !== "activos")} onClick={() => switchModule("activos")}>
          <Landmark size={17} aria-hidden="true" /> Activos Fijos
        </button>
      )}
      {(current === "almacenes" || canSwitch) && (
        <button type="button" aria-current={current === "almacenes" ? "page" : undefined}
          disabled={pending || (busy && current !== "almacenes")} onClick={() => switchModule("almacenes")}>
          <Boxes size={17} aria-hidden="true" /> Almacenes
        </button>
      )}
    </nav>
  );
}
