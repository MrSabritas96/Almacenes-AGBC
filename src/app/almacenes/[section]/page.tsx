import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { hasPermission } from '@/lib/rbac';
import { loadWarehouse } from '@/lib/warehouse';
import { warehouseView } from '@/lib/warehouse-routes';
import WarehouseDashboard from '@/components/almacenes/dashboard';
import DashboardUnavailable from '@/components/almacenes/unavailable';

export const dynamic = 'force-dynamic';

export default async function WarehousePage({params, searchParams}: {
  params: Promise<{section: string}>;
  searchParams: Promise<{focus?: string}>;
}) {
  const {section} = await params;
  const view = warehouseView(section);
  if (!view) notFound();
  const session = await getSession();
  if (!session) redirect('/login');
  const {focus} = await searchParams;
  let data;
  try {
    data = await loadWarehouse();
  } catch {
    return <DashboardUnavailable/>;
  }
  if (['staff', 'warehouses'].includes(view) && data.viewer.role !== 'superadmin') notFound();
  const canSwitch = await hasPermission(session.user.id, 'activos:read');
  return <WarehouseDashboard data={data} canSwitch={canSwitch} initialView={view} initialFocus={focus}/>;
}
