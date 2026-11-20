"use server";
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { warehouseContext } from '@/lib/warehouse';
import { warehouseTabCookie, warehouseTabId, warehouseTabToken } from '@/lib/warehouse-tab';
import { pool } from '@/db';

export async function openWarehouseTab(previousTab?: string) {
  const session = await getSession();
  if (!session) throw new Error('La sesión ha expirado.');
  await warehouseContext(undefined, session.session.token);
  const previous = warehouseTabId.safeParse(previousTab);
  if (previous.success && (await warehouseTabToken(previous.data)) === session.session.token) {
    return { tabId: previous.data };
  }
  const tabId = randomUUID();
  (await cookies()).set(warehouseTabCookie(tabId), session.session.token, {
    httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', expires:new Date(session.session.expiresAt),
  });
  return { tabId };
}

export async function closeWarehouseTab(tabId: string) {
  const token = await warehouseTabToken(tabId);
  await pool.query('delete from sessions where token=$1',[token]);
  (await cookies()).delete(warehouseTabCookie(tabId));
  return {ok:true};
}
