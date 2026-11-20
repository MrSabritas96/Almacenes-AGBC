import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac";
import { checkWarehouseAccess } from "@/actions/almacenes/access";
import { PostalParcel } from "./postal-parcel";
import { LoginPanel } from "./login-panel";
import styles from "./login.module.css";

export default async function Login() {
  const session = await getSession();
  if (session) {
    if (await hasPermission(session.user.id, "activos:read")) redirect("/activos/dashboard");
    if ((await checkWarehouseAccess()).ok) redirect("/almacenes/dashboard");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.brand} aria-labelledby="siba-title">
          <Image src="/brand/correos-logo.png" alt="Correos de Bolivia" width={240} height={90} className={styles.logo} />
          <div>
            <h1 id="siba-title">SIBA</h1>
            <p>Sistema Integral de Bienes y almacenes</p>
          </div>
          <PostalParcel className={styles.parcel} />
        </section>
        <LoginPanel name={session?.user.name} />
      </div>
    </main>
  );
}
