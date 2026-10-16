"use server";
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { warehouseContext } from '@/lib/warehouse';
import { warehouseTabCookie, warehouseTabToken } from '@/lib/warehouse-tab';
import { pool } from '@/db';

export async function openWarehouseTab(token: unknown) {
  const credential = z.string().min(1).max(512).parse(token);
  await warehouseContext(undefined, credential);
  const session = await getSession(credential);
  if (!session) throw new Error('La sesión ha expirado.');
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
