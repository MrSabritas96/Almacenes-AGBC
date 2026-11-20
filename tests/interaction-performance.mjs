/** Render virtual: ejecuta los manejadores reales sin navegador, red ni PostgreSQL. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file, dependencies) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const {outputText} = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }});
  const exports = {};
  new Function('require', 'exports', 'window', 'setTimeout', outputText)(name => {
    assert(name in dependencies, `Dependencia inesperada: ${name}`);
    return dependencies[name];
  }, exports, browser, () => assert.fail('Las interacciones no deben esperar un temporizador artificial'));
  return exports;
}

let url = new URL('http://localhost/almacenes/dashboard');
const history = [url.href];
let position = 0, canLeave = true, refreshes = 0, calls = 0;
let result = {ok: true};
const errors = [];
const browser = {
  history: {
    pushState(_state, _title, href) { url = new URL(href, url); history.splice(++position); history.push(url.href); },
    replaceState(_state, _title, href) { url = new URL(href, url); history[position] = url.href; },
    back() { if (position) url = new URL(history[--position]); },
    forward() { if (position + 1 < history.length) url = new URL(history[++position]); },
  },
  scrollTo() {}, matchMedia: () => ({matches: true}), dispatchEvent() {},
};
const state = [];
let cursor = 0;
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], value => {state[index] = typeof value === 'function' ? value(state[index]) : value;}];
  },
  useRef: value => ({current: value}), useEffect() {},
  useCallback: callback => callback, useMemo: callback => callback(), useDeferredValue: value => value,
  useTransition: () => [false, callback => callback()],
};
const tokens = new Proxy({}, {get: (_target, key) => String(key)});
const dependencies = {
  react,
  'react/jsx-runtime': {jsx: (component, props) => ({component, props}), jsxs: (component, props) => ({component, props}), Fragment: 'Fragment'},
  'next/navigation': {usePathname: () => url.pathname, useSearchParams: () => url.searchParams, useRouter: () => ({
    push: () => assert.fail('Cambiar de sección no debe solicitar otra página'),
    replace: () => assert.fail('Quitar el foco no debe solicitar otra página'),
    refresh: () => {refreshes++;},
  })},
  'next/link': {default: 'Link'}, 'lucide-react': tokens,
  'react-hot-toast': {default: {success() {}, error: message => errors.push(message)}},
  '@/actions/almacenes/manage': {warehouseAction: async () => {calls++; if (result instanceof Error) throw result; return result;}},
  './tab-session': {
    useWarehouseTab: () => undefined,
    useWarehouseRefresh: () => ({refreshing: false, refresh: () => {refreshes++;}}),
  },
  '@/lib/auth/client': {authClient: {}},
  '@/components/sidebar/use-can-leave': {confirmLeave: () => canLeave},
};
for (const file of ['warehouse-routes', 'warehouse-types', 'material-code', 'warehouse-budget', 'warehouse-reference', 'csv']) {
  const value = load(`src/lib/${file}.ts`, dependencies);
  dependencies[`@/lib/${file}`] = value;
  dependencies[`./${file}`] = value;
}
for (const name of [
  './request-date', './postal-loader', './brand', './sidebar-account', '@/components/sidebar/module-navigation',
  '@/components/sidebar/refresh-button', './employee-materials', './response-message', './material-fields',
  './people-records', './notifications', './sidebar-panel', './purchases', './stock-reports', './inventory-categories',
]) dependencies[name] = tokens;
const {default: Dashboard} = load('src/components/almacenes/dashboard.tsx', dependencies);
const data = {
  viewer: {id: 'admin', name: 'Administradora', role: 'superadmin', warehouse_id: 'central'},
  warehouses: [{id: 'central', name: 'Central', requests_enabled: true}],
  materials: [], budgetItems: [], staff: [], requests: [], employeeMaterials: [], movements: [], suppliers: [], purchases: [],
};
let tree;
function render() { cursor = 0; tree = Dashboard({data, canSwitch: true, initialView: 'overview'}); return tree; }
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...Object.values(node.props).flatMap(value => nodes(value))];
}
function find(predicate) { const node = nodes(tree).find(predicate); assert(node, 'Control esperado en el render'); return node; }
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  return node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' ? node : '';
}
function clickSection(label, overrides = {}) {
  let prevented = false;
  find(node => node.component === 'Link' && node.props['aria-label'] === label).props.onClick({
    button: 0, preventDefault() {prevented = true;}, ...overrides,
  });
  return prevented;
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); render(); }

render();
assert(clickSection('Inventario'));
render();
assert.equal(url.pathname, '/almacenes/inventario');
assert.equal(text(find(node => node.component === 'h1')), 'Inventario');
assert.equal(refreshes, 0, 'Las secciones reutilizan el snapshot ya autorizado');
assert.equal(calls, 0, 'Navegar no ejecuta mutaciones');
const length = history.length;
assert(!clickSection('Solicitudes', {ctrlKey: true}), 'Ctrl+clic conserva la apertura nativa en otra pestaña');
assert.equal(history.length, length);
canLeave = false;
assert(clickSection('Solicitudes'));
assert.equal(history.length, length, 'Un formulario protegido puede cancelar la navegación');
canLeave = true;
clickSection('Solicitudes'); render();
browser.history.back(); render();
assert.equal(text(find(node => node.component === 'h1')), 'Inventario');
browser.history.forward(); render();
assert.equal(text(find(node => node.component === 'h1')), 'Solicitudes');

find(node => node.component === 'WarehouseNotifications').props.onNavigate('inventory', 'material & 1'); render();
assert.equal(url.searchParams.get('focus'), 'material & 1');
const focusLength = history.length;
find(node => node.component === 'button' && text(node) === 'Mostrar todos los registros').props.onClick(); render();
assert.equal(url.searchParams.get('focus'), null);
assert.equal(history.length, focusLength, 'Quitar el foco reemplaza la entrada actual');
assert(!nodes(tree).some(node => node.props.className === 'notification-focus'));
browser.history.pushState(null, '', '/almacenes/materiales-por-empleado?focus=persona-1'); render();
assert.equal(find(node => node.component === 'EmployeeMaterials').props.userId, 'persona-1');
browser.history.back(); render();
assert.equal(text(find(node => node.component === 'h1')), 'Inventario');
browser.history.forward(); render();
assert.equal(find(node => node.component === 'EmployeeMaterials').props.userId, 'persona-1');

clickSection('Solicitudes'); render();
find(node => node.component === 'button' && text(node) === 'Cerrar formulario').props.onClick();
assert.equal(calls, 1, 'La operación comienza inmediatamente');
await settle();
assert.equal(refreshes, 1, 'Actualiza los datos después de guardar');
result = {ok: false, error: 'No tienes permiso.'};
find(node => node.component === 'button' && text(node) === 'Cerrar formulario').props.onClick();
await settle();
assert.equal(errors.at(-1), 'No tienes permiso.');
assert.equal(refreshes, 1, 'Un rechazo no se trata como guardado');
result = new Error('Conexión interrumpida');
find(node => node.component === 'button' && text(node) === 'Cerrar formulario').props.onClick();
await settle();
assert.equal(errors.at(-1), 'No se pudo conectar. Intenta nuevamente.');
assert.equal(refreshes, 1);
console.log('OK: navegación sin recarga, Atrás/Adelante, foco por URL, formularios protegidos y operaciones inmediatas con errores preservados.');
