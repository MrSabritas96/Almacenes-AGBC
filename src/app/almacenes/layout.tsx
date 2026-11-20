import { WarehouseTabSession } from '@/components/almacenes/tab-session';
import { WarehouseNavigationGuard } from '@/components/almacenes/navigation-guard';

export default function WarehouseLayout({children}: {children: React.ReactNode}) {
  return <WarehouseTabSession><WarehouseNavigationGuard/>{children}</WarehouseTabSession>;
}
