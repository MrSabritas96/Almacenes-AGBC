import { loadWarehouse, type Snapshot } from "@/lib/warehouse";
import WarehouseDashboard from "@/components/almacenes/dashboard";
import DashboardUnavailable from "@/components/almacenes/unavailable";
import { WarehouseTabSession } from "@/components/almacenes/tab-session";
export const dynamic = "force-dynamic";
export default async function Dashboard({searchParams}:{searchParams:Promise<{tab?:string}>}) {
  const {tab} = await searchParams;
  let snapshot: Snapshot;
  try { snapshot = await loadWarehouse(tab); }
  catch { return <DashboardUnavailable/>; }
  return <WarehouseTabSession tabId={tab}><WarehouseDashboard data={snapshot}/></WarehouseTabSession>;
}
