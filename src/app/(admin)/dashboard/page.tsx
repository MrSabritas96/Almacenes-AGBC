import { redirect } from 'next/navigation';
import { warehouseHref, warehouseRoutes, type WarehouseView } from '@/lib/warehouse-routes';

export default async function LegacyDashboard({searchParams}: {
  searchParams: Promise<{view?: string; focus?: string}>;
}) {
  const {view, focus} = await searchParams;
  const section = view && Object.hasOwn(warehouseRoutes, view) ? view as WarehouseView : 'overview';
  redirect(warehouseHref(section, focus));
}
