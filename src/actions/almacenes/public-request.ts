"use server";
import { revalidatePath } from "next/cache";
import { receiveMaterialRequest } from "@/lib/material-intake";

export async function submitPublicRequest(input: unknown) {
  const result = await receiveMaterialRequest(input);
  if (result.ok) {
    revalidatePath("/dashboard");
    (globalThis as typeof globalThis & { __io?: { to: (room: string) => { emit: (event: string) => void } } }).__io?.to("warehouse:live").emit("warehouse:changed");
  }
  return result;
}
