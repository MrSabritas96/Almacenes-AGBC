import "dotenv/config";
import assert from "node:assert/strict";
const base=process.env.TEST_APP_URL??'http://localhost:3000';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Ejecutar solo en localhost.');
const accounts=[
  {username:process.env.SEED_ADMIN_USERNAME??'admin',email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_ADMIN_PASSWORD},
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
    const login=await fetch(`${base}/login`,{headers:{Cookie:cookie},redirect:'manual'});
    const loginHtml=await login.text();
    assert(!loginHtml.includes('Selecciona un módulo'));
    assert(login.headers.get('location')==='/activos/dashboard'||loginHtml.includes('NEXT_REDIRECT;replace;/activos/dashboard;307;'),'El ingreso redirige al dashboard de Activos Fijos');
    const entry=await fetch(`${base}/almacenes/abrir`,{headers:{Cookie:cookie},redirect:'manual'});
    const location=entry.headers.get('location');
    assert.equal(location,'/almacenes/dashboard','El ingreso abre Almacenes con la sesión compartida');
    const tabCookies=entry.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
    const dashboard=await fetch(`${base}${location}`,{headers:{Cookie:`${cookie}; ${tabCookies}`}});
    assert.equal(dashboard.status,200);
    const html=await dashboard.text();
    assert.match(html, /<nav[^>]*aria-label="Módulos de SIBA"[^>]*>.*?Activos Fijos.*?aria-current="page".*?Almacenes.*?<\/nav>/s);
    assert(html.includes('Administradores'),'Almacenes abre con la cuenta principal');
    assert(!html.includes('almacen@agbc.local'),'La cuenta retirada no aparece en Almacenes');
    assert(!html.includes('Crear administrador'),'No se ofrecen altas administrativas en Almacenes');
    const activos=await fetch(`${base}/activos/dashboard`,{headers:{Cookie:cookie},redirect:'manual'});
    assert.equal(activos.status,200);
    assert.match(await activos.text(), /<nav[^>]*aria-label="Módulos de SIBA"[^>]*>.*?aria-current="page".*?Activos Fijos.*?Almacenes.*?<\/nav>/s);
    const signout=await fetch(`${base}/api/auth/sign-out`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:'{}'});
    assert.equal(signout.status,200);
  }
}
const invalid=await signin('username',{username:process.env.SEED_ADMIN_USERNAME??'admin',password:'incorrecta123'});
assert.notEqual(invalid.status,200,'Debe rechazar contraseña incorrecta');
const removed=await signin('username',{username:'almacen',password:'incorrecta123'});
assert.notEqual(removed.status,200,'La cuenta retirada no puede iniciar sesión');
const retired=await signin('username',{username:'empleado',password:process.env.SEED_EMPLOYEE_PASSWORD??'incorrecta123'});
assert.notEqual(retired.status,200,'Las cuentas de empleados no deben iniciar sesión');
console.log('OK: misma cuenta por correo y usuario en ambos módulos. Accesos retirados rechazados.');
