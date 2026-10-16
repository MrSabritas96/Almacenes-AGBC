import "dotenv/config";
import assert from "node:assert/strict";
const base=process.env.TEST_APP_URL??'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Ejecutar solo en localhost.');
const accounts=[
  {username:'admin',email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_ADMIN_PASSWORD},
  {username:'almacen',email:process.env.SEED_WAREHOUSE_EMAIL??'almacen@agbc.local',password:process.env.SEED_WAREHOUSE_PASSWORD},
];
async function signin(kind,body){
  return fetch(`${base}/api/auth/sign-in/${kind}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});
}
for(const a of accounts){
  let id;
  for(const [kind,identifier] of [['email',a.email],['username',a.username]]){
    const res=await signin(kind,{[kind]:identifier,password:a.password});
    assert.equal(res.status,200,`Debe funcionar el acceso ${kind} de ${a.username}`);
    const data=await res.json();assert.equal(data.user.username,a.username);
    if(id)assert.equal(data.user.id,id,'El alias y correo deben corresponder a la misma cuenta');
    id=data.user.id;
    const cookie=res.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    const dashboard=await fetch(`${base}/dashboard`,{headers:{Cookie:cookie}});
    assert.equal(dashboard.status,200);
    const html=await dashboard.text();
    const menu={admin:'Administradores',almacen:'Fichas e historial'}[a.username];
    assert(html.includes(menu),`Debe abrir el dashboard de su rol para ${a.username}`);
    const signout=await fetch(`${base}/api/auth/sign-out`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:'{}'});
    assert.equal(signout.status,200);
  }
}
const invalid=await signin('username',{username:'admin',password:'incorrecta123'});
assert.notEqual(invalid.status,200,'Debe rechazar contraseña incorrecta');
const retired=await signin('username',{username:'empleado',password:process.env.SEED_EMPLOYEE_PASSWORD??'incorrecta123'});
assert.notEqual(retired.status,200,'Las cuentas de empleados no deben iniciar sesión');
console.log('OK: acceso automático de administradores por correo/usuario; empleados y contraseñas incorrectas rechazados.');
