import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const {outputText} = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }});
  const exports = {};
  new Function('require', 'exports', outputText)(name => {
    assert(name in dependencies, `Dependencia inesperada: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

const routes = await load('src/lib/warehouse-routes.ts');
for (const [view, href] of Object.entries(routes.warehouseRoutes)) {
  assert.equal(routes.warehouseView(href.split('/').pop()), view);
  assert(!href.includes('?'));
  assert.equal(routes.warehouseHref(view, 'a&b'), `${href}?focus=a%26b`);
}
assert.equal(routes.warehouseView('inexistente'), undefined);

let session = {user: {id: 'admin'}};
let role = 'superadmin';
let receivedArgs;
const dependencies = {
  'react/jsx-runtime': {jsx: (component, props) => ({component, props})},
  'next/navigation': {
    redirect: href => {throw new Error(`redirect:${href}`);},
    notFound: () => {throw new Error('notFound');},
  },
  '@/lib/auth/session': {getSession: async () => session},
  '@/lib/rbac': {hasPermission: async () => true},
  '@/lib/warehouse': {loadWarehouse: async (...args) => {
    receivedArgs = args;
    return {viewer: {id: 'admin', role}};
  }},
  '@/lib/warehouse-routes': routes,
  '@/components/almacenes/dashboard': {default: 'dashboard'},
  '@/components/almacenes/unavailable': {default: 'unavailable'},
};
const {default: page} = await load('src/app/almacenes/[section]/page.tsx', dependencies);
const input = section => ({params: Promise.resolve({section}), searchParams: Promise.resolve({focus: 'material-1'})});
const rendered = await page(input('inventario'));
assert.equal(rendered.props.initialView, 'inventory');
assert(!('initialFocus' in rendered.props), 'El foco se lee de la URL actual para conservar Atrás y Adelante');
assert.deepEqual(receivedArgs, [], 'Carga los datos con la sesión global');
await assert.rejects(() => page(input('desconocido')), /notFound/);
role = 'admin_almacenes';
await assert.rejects(() => page(input('administradores')), /notFound/);
session = null;
await assert.rejects(() => page(input('inventario')), /redirect:\/login/);

const {default: legacy} = await load('src/app/(admin)/dashboard/page.tsx', dependencies);
await assert.rejects(() => legacy({searchParams: Promise.resolve({view: 'inventory', focus: 'm1', tab: 'old'})}),
  /redirect:\/almacenes\/inventario\?focus=m1/);
await assert.rejects(() => legacy({searchParams: Promise.resolve({view: 'invalid'})}), /redirect:\/almacenes\/dashboard/);
console.log('OK: rutas por sección, sesión compartida, permisos y redirecciones antiguas.');
