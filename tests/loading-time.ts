import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { MINIMUM_LOADING_MS, withMinimumLoading } from '../src/lib/loading-time';

async function main(){
  mock.timers.enable({apis:['setTimeout']});
  try {
    assert.equal(MINIMUM_LOADING_MS,1500);
    let done=false;
    const quick=withMinimumLoading(()=>42).then(value=>{done=true;return value;});
    await Promise.resolve();await Promise.resolve();
    mock.timers.tick(1499);await Promise.resolve();assert(!done,'No termina antes de los 1.5 segundos');
    mock.timers.tick(1);assert.equal(await quick,42);
    const failure=new Error('Prueba');
    let rejected=false;
    const failed=withMinimumLoading(()=>{throw failure;}).catch(error=>{rejected=true;assert.equal(error,failure);});
    await Promise.resolve();await Promise.resolve();
    mock.timers.tick(1499);await Promise.resolve();assert(!rejected,'Los errores también conservan la animación');
    mock.timers.tick(1);await failed;
    let finish!:(value:string)=>void;
    const work=new Promise<string>(resolve=>{finish=resolve;});
    done=false;
    const slow=withMinimumLoading(()=>work).then(value=>{done=true;return value;});
    await Promise.resolve();mock.timers.tick(4000);await Promise.resolve();assert(!done,'No termina mientras el trabajo siga pendiente');
    finish('Listo');assert.equal(await slow,'Listo');
  }finally{mock.timers.reset();}
  console.log('OK: mínimo de 1.5 segundos, errores preservados y espera de operaciones lentas sin demoras acumuladas.');
}
void main();
