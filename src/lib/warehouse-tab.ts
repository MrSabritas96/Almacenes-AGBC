import { cookies } from 'next/headers';
import { z } from 'zod';

export const warehouseTabId = z.string().uuid();
export const warehouseTabCookie = (id: string) => `agbc-tab-${warehouseTabId.parse(id)}`;
export async function warehouseTabToken(id: string) {
  return (await cookies()).get(warehouseTabCookie(id))?.value ?? '';
}
