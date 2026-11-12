/** Código estable: letras del nombre y correlativo global, compartido entre almacenes. */
export function materialCodePrefix(name:string):string {
  const ignored=new Set(['DE','DEL','LA','LAS','EL','LOS','Y','EN','PARA','POR','CON','UN','UNA']);
  const words=(name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().match(/[A-Z]+/g)??[]).filter(word=>!ignored.has(word));
  if(!words.length)return 'MAT';
  return words.length===1?words[0]!.slice(0,3):words.slice(0,3).map(word=>word[0]).join('');
}
export function formatMaterialCode(name:string,sequence:number):string {
  if(!Number.isSafeInteger(sequence)||sequence<1)throw new Error('Correlativo de material inválido.');
  return `${materialCodePrefix(name)}-${String(sequence).padStart(4,'0')}`;
}
export function compareMaterialCodes(a:{code:string},b:{code:string}):number {
  const sequence=(code:string)=>Number(code.match(/\d+$/)?.[0]??Number.MAX_SAFE_INTEGER);
  return sequence(a.code)-sequence(b.code)||a.code.localeCompare(b.code,'es',{numeric:true});
}
export const compareNames=(a:string,b:string)=>a.localeCompare(b,'es',{sensitivity:'base',numeric:true});
export function compareMaterialNames(a:{name:string;code:string},b:{name:string;code:string}):number {
  return compareNames(a.name,b.name)||compareMaterialCodes(a,b);
}
