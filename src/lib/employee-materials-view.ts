import type { Snapshot } from './warehouse-types';
import { compareNames } from './material-code';

/** Los datos recibidos ya están limitados al almacén y la regional de la vista. */
export function employeeMaterialView(data:Pick<Snapshot,'viewer'|'staff'|'employeeMaterials'|'requests'>,filter='',query='') {
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  const search=normalize(query);
  const people=new Map(data.staff.filter(s=>s.role==='empleado_agbc').map(s=>[s.id,s]));
  function matches(id:string,...values:string[]){
    const person=people.get(id);
    return (!filter||id===filter)&&normalize([...values,person?.name,person?.document,person?.regional,person?.position,person?.department].filter(Boolean).join(' ')).includes(search);
  }
  const delivered=data.requests.filter(r=>r.status==='delivered');
  const initial=data.employeeMaterials.filter(h=>matches(h.user_id,h.name,h.employee));
  const deliveries=delivered.filter(r=>matches(r.user_id,r.material,r.employee));
  // Se calcula antes de buscar: una búsqueda sin coincidencias no significa que no tenga materiales.
  const owners=new Set([...data.employeeMaterials.map(h=>h.user_id),...delivered.map(r=>r.user_id)]);
  const withoutMaterials=data.viewer.role==='empleado_agbc'?[]:[...people.values()].filter(p=>!owners.has(p.id)&&matches(p.id)).sort((a,b)=>compareNames(a.name,b.name));
  return {initial,deliveries,withoutMaterials};
}
