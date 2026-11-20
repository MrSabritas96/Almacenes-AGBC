"use client";

import { RefreshCw } from "lucide-react";
import { PostalLoader } from "@/components/almacenes/postal-loader";

export function RefreshButton({ refreshing, onRefresh }: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <button type="button" className="icon-button" disabled={refreshing}
      aria-busy={refreshing} aria-label={refreshing ? "Actualizando datos" : "Actualizar datos"}
      title="Actualizar datos" onClick={onRefresh}>
      {refreshing ? <PostalLoader /> : <RefreshCw size={17} aria-hidden="true" />}
    </button>
  );
}
