import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { db, pool, schema } from "./index";

const MODULES = ["activos", "almacenes"] as const;
const ACTIONS = ["read", "create", "update", "delete"] as const;
async function main() {
  await db.insert(schema.permissions).values([
    ...MODULES.flatMap(m=>ACTIONS.map(a=>({key:`${m}:${a}`,module:m}))),
    ...["backup","audit","users"].map(a=>({key:`sistema:${a}`,module:"sistema"})),
    {key:"almacenes:request",module:"almacenes"},
  ]).onConflictDoNothing();
  await db.insert(schema.roles).values([
    {name:"superadmin",description:"Acceso total",isSystem:true},
    {name:"admin_activos",description:"Administra activos",isSystem:true},
  ]).onConflictDoNothing();
  const allRoles=await db.select().from(schema.roles);
  const allPerms=await db.select().from(schema.permissions);
  const activosRole=allRoles.find(r=>r.name==="admin_activos")!;
  await db.insert(schema.rolePermissions).values(allPerms.filter(p=>p.module==="activos").map(p=>({roleId:activosRole.id,permissionId:p.id}))).onConflictDoNothing();
  await db.insert(schema.warehouses).values({id:'agbc-central',name:'Almacén central',location:'La Paz'}).onConflictDoNothing();
  const accounts=[
    {username:process.env.SEED_ADMIN_USERNAME??"admin",email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_ADMIN_PASSWORD,name:process.env.SEED_ADMIN_NAME??'SuperAdmin AGBC',role:'superadmin',position:'Superadministrador'},
  ];
  for (const a of accounts) {
    if(!a.email) throw new Error('Configura SEED_ADMIN_EMAIL.');
    let [user]=await db.select().from(schema.users).where(eq(schema.users.email,a.email));
    if(!user){
      if(!a.password||a.password.length<8) throw new Error(`Configura una contraseña de 8 caracteres o más para ${a.role}.`);
      const password=await hashPassword(a.password);
      user=await db.transaction(async tx=>{
        const [created]=await tx.insert(schema.users).values({email:a.email!,name:a.name,username:a.username}).returning();
        if (!created) throw new Error("No se pudo crear la cuenta.");
        await tx.insert(schema.accounts).values({userId:created.id,accountId:created.id,providerId:'credential',password});
        return created;
      });
      console.log('Cuenta creada:',a.email);
    }
    if (!user) throw new Error("No se pudo crear la cuenta.");
    if (!user.username) await db.update(schema.users).set({username:a.username}).where(eq(schema.users.id,user.id));
    const role=allRoles.find(r=>r.name===a.role)!;
    await db.insert(schema.userRoles).values({userId:user.id,roleId:role.id}).onConflictDoNothing();
    await db.insert(schema.staffProfiles).values({userId:user.id,warehouseId:'agbc-central',position:a.position,department:'AGBC'}).onConflictDoNothing();
  }
  console.log('Seed completado: roles, almacén central y cuenta administrativa. Los empleados se registran como fichas sin acceso.');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
