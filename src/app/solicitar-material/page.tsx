import { withMinimumLoading } from '@/lib/loading-time';
import PublicMaterialRequest from "@/components/almacenes/public-request";
import { requestCatalog } from "@/lib/material-intake";
import { todayInBolivia } from "@/lib/warehouse-validation";
export const dynamic = "force-dynamic";
export default async function Page() {
  let catalog;
  try { catalog = await withMinimumLoading(()=>requestCatalog()); }
  catch { return <main className="access-panel error-page"><h1>Formulario no disponible</h1><p>No se pudo cargar el catálogo. Actualiza la página o contacta a la administradora.</p></main>; }
  return <PublicMaterialRequest catalog={catalog} today={todayInBolivia()}/>;
}
