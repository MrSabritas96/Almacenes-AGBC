"use server";
import { lookupMaterialRequests, loadPublicRequestReceipt } from '@/lib/request-status';

export async function consultMaterialRequests(input:unknown) {
  return lookupMaterialRequests(input);
}

export async function getPublicRequestReceipt(input:unknown) {
  return loadPublicRequestReceipt(input);
}
