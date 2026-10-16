import { Sidebar } from "@/components/sidebar/sidebar";
import { requireSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar userId={session.user.id} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
