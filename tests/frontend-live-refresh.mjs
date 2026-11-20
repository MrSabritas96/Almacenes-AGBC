import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Ejecuta los efectos reales con red, React y reloj controlados; no usa la base de trabajo.
function runtime(file, dependencies = {}) {
  let cursor=0;
  const hooks=[];
  const effects=[];
  const timers=new Map();
  const intervals=new Map();
  let timerId=0;
  let pending=false;
  const window=new EventTarget();
  const document=Object.assign(new EventTarget(),{visibilityState:'visible'});
  const react={
    createContext:value=>({Provider:'Provider',value}),
    useContext:context=>context.value,
    useRef:value=>hooks[cursor++]??(hooks[cursor-1]={current:value}),
    useCallback:callback=>hooks[cursor++]??(hooks[cursor-1]=callback),
    useEffectEvent:callback=>{
      const index=cursor++;
      if(!hooks[index]){
        const state={callback,call:(...args)=>state.callback(...args)};
        hooks[index]=state;
      }
      hooks[index].callback=callback;
      return hooks[index].call;
    },
    useTransition:()=>[pending,callback=>{pending=true;callback();}],
    useState:initial=>{
      const index=cursor++;
      if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;
      return [hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value;}];
    },
    useEffect:(callback,deps)=>{
      const index=cursor++;
      const previous=hooks[index];
      if(!previous||deps.some((value,i)=>value!==previous.deps[i])){
        hooks[index]={deps,cleanup:previous?.cleanup};
        effects.push(()=>{hooks[index].cleanup?.();hooks[index].cleanup=callback();});
      }
    },
  };
  const exports={};
  const jsx=(type,props)=>({type,props});
  const modules={react,'react/jsx-runtime':{jsx,jsxs:jsx},...dependencies};
  const source=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(source,{
    exports,require:name=>{assert(name in modules,`Dependencia inesperada ${name}`);return modules[name];},
    window,document,Event,console,Intl,Date,
    setTimeout:callback=>{const id=++timerId;timers.set(id,callback);return id;},
    clearTimeout:id=>timers.delete(id),
    setInterval:callback=>{const id=++timerId;intervals.set(id,callback);return id;},
    clearInterval:id=>intervals.delete(id),
  });
  return {
    window,document,exports,
    render(name,props){cursor=0;const result=exports[name](props);while(effects.length)effects.shift()();return result;},
    tick(){const current=[...timers];timers.clear();for(const [,callback] of current)callback();},
    poll(){for(const callback of intervals.values())callback();},
    finishTransition(){pending=false;},
    cleanup(){for(const hook of hooks)hook?.cleanup?.();},
    timerCount:()=>timers.size,
  };
}

let refreshes=0,disconnects=0;
const socketEvents=new Map();
const session=runtime('src/components/almacenes/tab-session.tsx',{
  'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})},
  'socket.io-client':{io:()=>({on:(event,callback)=>socketEvents.set(event,callback),disconnect:()=>disconnects++})},
});
const renderSession=()=>session.render('WarehouseTabSession',{children:'Contenido'});
let tree=renderSession();
const refresh=tree.props.children.props.value.refresh;
socketEvents.get('connect')();
assert.equal(refreshes,0,'Conectar por primera vez conserva la carga inicial');
for(let i=0;i<20;i++){refresh();socketEvents.get('warehouse:changed')();}
assert.equal(session.timerCount(),1,'Mutación local y ráfaga socket comparten un solo temporizador');
session.tick();
assert.equal(refreshes,1,'Una ráfaga solo carga una vez');
renderSession();
refresh();session.tick();
assert.equal(refreshes,1,'No inicia otra carga mientras sigue pendiente');
session.finishTransition();renderSession();
assert.equal(refreshes,2,'Recupera el cambio recibido durante la carga');
session.cleanup();
assert.equal(disconnects,1);
refresh();session.tick();
assert.equal(refreshes,2,'Al desmontar retira los eventos locales');

const responses=[];
let activeRequests=0,maxRequests=0,calls=0;
const icons=new Proxy({},{get:(_target,name)=>name});
const notifications=runtime('src/components/almacenes/notifications.tsx',{
  './postal-loader':{PostalLoader:'loader'},
  './tab-session':{useWarehouseTab:()=>undefined},
  'lucide-react':icons,
  '@radix-ui/react-dropdown-menu':new Proxy({},{get:(_target,name)=>name}),
  'react-hot-toast':{default:{error:()=>{}}},
  '@/actions/almacenes/notifications':{
    getWarehouseNotificationGroups:()=>{
      calls++;activeRequests++;maxRequests=Math.max(maxRequests,activeRequests);
      return new Promise(resolve=>responses.push(value=>{activeRequests--;resolve(value);}));
    },
    markWarehouseNotificationsRead:async()=>{},
  },
});
notifications.render('WarehouseNotifications',{onNavigate:()=>{}});
for(let i=0;i<15;i++)notifications.window.dispatchEvent(new Event('warehouse:changed'));
notifications.tick();notifications.poll();
notifications.document.dispatchEvent(new Event('visibilitychange'));
assert.equal(calls,1,'Eventos, polling y visibilidad no solapan consultas');
responses.shift()({inventory:{items:[],unread:0,byStatus:{}},requests:{items:[],unread:0,byStatus:{}}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(calls,2,'Los cambios en espera producen una sola consulta posterior');
assert.equal(maxRequests,1,'Nunca hay más de una consulta de avisos activa');
notifications.cleanup();
responses.shift()({});
await new Promise(resolve=>setImmediate(resolve));
notifications.window.dispatchEvent(new Event('warehouse:changed'));notifications.poll();notifications.tick();
assert.equal(calls,2,'Desmontar elimina eventos y sondeos');

let finishRead,navigated;
const item={id:'notice',entity_id:'material-1',kind:'stock_low',is_read:false,title:'Stock bajo',message:'Reponer',created_at:'2026-11-20T12:00:00Z'};
const notices=runtime('src/components/almacenes/notifications.tsx',{
  './postal-loader':{PostalLoader:'loader'},'./tab-session':{useWarehouseTab:()=>undefined},
  'lucide-react':icons,'@radix-ui/react-dropdown-menu':new Proxy({},{get:(_target,name)=>name}),
  'react-hot-toast':{default:{error:()=>{}}},
  '@/actions/almacenes/notifications':{
    getWarehouseNotificationGroups:async()=>({inventory:{items:[item],unread:1,byStatus:{}},requests:{items:[],unread:0,byStatus:{}}}),
    markWarehouseNotificationsRead:()=>new Promise(resolve=>{finishRead=resolve;}),
  },
});
const props={onNavigate:(...args)=>{navigated=args;}};
notices.render('WarehouseNotifications',props);
await new Promise(resolve=>setImmediate(resolve));
const noticeTree=notices.render('WarehouseNotifications',props);
function findNotice(node){
  if(Array.isArray(node))return node.map(findNotice).find(Boolean);
  if(!node||typeof node!=='object')return;
  if(node.props?.className?.startsWith('notification-item '))return node;
  return findNotice(node.props?.children);
}
findNotice(noticeTree).props.onSelect({preventDefault(){}});
assert.deepEqual(navigated,['inventory','material-1'],'Abrir el aviso navega sin esperar que el servidor marque leído');
assert.equal(typeof finishRead,'function','La confirmación de lectura sigue pendiente');
finishRead();
await new Promise(resolve=>setImmediate(resolve));
notices.cleanup();
console.log('OK: refresco compartido, ráfagas agrupadas, cola durante carga y avisos sin consultas concurrentes.');
