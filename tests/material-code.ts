import assert from 'node:assert/strict';
import {ITEM_CATEGORIES,categoryInfo,categoryLabel,categoryAliases,normalizeCategory,compareInventoryMaterials} from '../src/lib/warehouse-reference';
import {compareMaterialCodes,compareMaterialNames,compareNames,formatMaterialCode,materialCodePrefix} from '../src/lib/material-code';
assert.equal(formatMaterialCode('Papel bond carta',1),'PBC-0001');
assert.equal(formatMaterialCode('Bolígrafo azul',2),'BA-0002');
assert.equal(formatMaterialCode('Cinta de embalaje',10),'CE-0010');
assert.equal(formatMaterialCode('Alcohol',10000),'ALC-10000');
assert.equal(materialCodePrefix('123'),'MAT');
assert.equal(materialCodePrefix('Tóner HP 145A'),'THA');
assert.throws(()=>formatMaterialCode('Papel',0));
assert.deepEqual([{code:'AAA-0010'},{code:'ZZZ-0002'},{code:'3'},{code:'AAA-0001'}].sort(compareMaterialCodes).map(m=>m.code),['AAA-0001','ZZZ-0002','3','AAA-0010']);
console.log('OK: iniciales sin tildes, conectores excluidos, correlativos y orden numérico independiente del prefijo.');

assert.equal(ITEM_CATEGORIES.length,29);
assert.deepEqual(ITEM_CATEGORIES.map(c=>c.legacyBudgetCode).sort(),[
  '25500','25600','25900','31110','31120','31300','32100','32200','32300',
  '33100','33200','33300','33400','34110','34200','34300','34400','34500',
  '34600','34800','39100','39300','39400','39500','39700','39800','39900','43110','43700',
],'Incluye las 29 partidas del listado del administrador');
assert.equal(new Set(ITEM_CATEGORIES.map(c=>c.code)).size,29);
assert(ITEM_CATEGORIES.every((c,i)=>Number(c.code.match(/\d+$/)![0])===i+1));
assert.equal(categoryLabel(ITEM_CATEGORIES[0]!), 'PAR-001 · Calzados');
assert.deepEqual(ITEM_CATEGORIES.map(c=>c.name),ITEM_CATEGORIES.map(c=>c.name).sort(compareNames),'Ordena nombres antes de asignar códigos');
assert.equal(categoryInfo('25500 · Publicidad')?.code,'PAR-023');
assert.equal(categoryInfo('PUB-001 · Publicidad')?.code,'PAR-023');
assert.equal(categoryInfo('00000 · Publicidad')?.code,'PAR-023');
assert.equal(categoryInfo('PE-007 · Papel de escritorio')?.code,'PAR-015');
assert.equal(categoryInfo('PE-015 · Papel de escritorio')?.code,'PAR-015');
assert.equal(categoryInfo('CAT-015 · Papel de escritorio')?.code,'PAR-015','Conserva el enlace con la clasificación anterior');
assert.deepEqual(ITEM_CATEGORIES.map(c=>c.code),Array.from({length:29},(_,i)=>`PAR-${String(i+1).padStart(3,'0')}`),'Partidas correlativas, desde 001 y sin números presupuestarios');
for(const category of ITEM_CATEGORIES)for(const alias of categoryAliases(category)){
  assert.equal(categoryInfo(alias)?.code,category.code,'Cada alias histórico tiene una sola partida');
  assert.equal(normalizeCategory(alias),categoryLabel(category));
}
assert.equal(normalizeCategory('Partida personalizada'),'Partida personalizada');
assert.equal(categoryInfo('Partida nueva'),undefined);
assert.deepEqual([{name:'Zapato',code:'Z-0001'},{name:'Álbum',code:'A-0200'}].sort(compareMaterialNames).map(m=>m.name),['Álbum','Zapato']);
assert(compareInventoryMaterials({category:'PUB-001 · Publicidad',name:'Afiche',code:'A-0001'},{category:'CAL-001 · Calzados',name:'Zapato',code:'Z-0200'})>0,'Ordena partidas por nombre y acepta etiquetas antiguas');
console.log('OK: partidas PAR-001 a PAR-029, orden alfabético y compatibilidad con todas las etiquetas anteriores.');
