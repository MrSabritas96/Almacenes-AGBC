export const warehouseRoutes = {
  overview: '/almacenes/dashboard',
  inventory: '/almacenes/inventario',
  requests: '/almacenes/solicitudes',
  people: '/almacenes/fichas',
  holdings: '/almacenes/materiales-por-empleado',
  suppliers: '/almacenes/proveedores',
  history: '/almacenes/movimientos',
  staff: '/almacenes/administradores',
  warehouses: '/almacenes/almacenes',
} as const;

export type WarehouseView = keyof typeof warehouseRoutes;

export function warehouseHref(view: WarehouseView, focus?: string) {
  const path = warehouseRoutes[view];
  return focus ? `${path}?${new URLSearchParams({focus})}` : path;
}

export function warehouseView(section: string): WarehouseView | undefined {
  return (Object.keys(warehouseRoutes) as WarehouseView[])
    .find(view => warehouseRoutes[view] === `/almacenes/${section}`);
}
