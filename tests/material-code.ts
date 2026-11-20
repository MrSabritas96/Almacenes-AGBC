import assert from 'node:assert/strict';
import {ITEM_CATEGORIES,categoryInfo,categoryLabel,categoryAliases,normalizeCategory,officialBudgetItem,compareCategoryLabels,compareInventoryMaterials} from '../src/lib/warehouse-reference';
import {compareMaterialCodes,compareMaterialNames,formatMaterialCode,materialCodePrefix} from '../src/lib/material-code';
assert.equal(formatMaterialCode('Papel bond carta',1),'PBC-0001');
assert.equal(formatMaterialCode('Bolígrafo azul',2),'BA-0002');
assert.equal(formatMaterialCode('Cinta de embalaje',10),'CE-0010');
assert.equal(formatMaterialCode('Alcohol',10000),'ALC-10000');
assert.equal(materialCodePrefix('123'),'MAT');
assert.equal(materialCodePrefix('Tóner HP 145A'),'THA');
assert.throws(()=>formatMaterialCode('Papel',0));
assert.deepEqual([{code:'AAA-0010'},{code:'ZZZ-0002'},{code:'3'},{code:'AAA-0001'}].sort(compareMaterialCodes).map(m=>m.code),['AAA-0001','ZZZ-0002','3','AAA-0010']);
console.log('OK: iniciales sin tildes, conectores excluidos, correlativos y orden numérico independiente del prefijo.');

assert.deepEqual(ITEM_CATEGORIES.map(c=>c.code).sort(),[
  '25500','25600','25900','31110','31120','31300','32100','32200','32300',
  '33100','33200','33300','33400','34110','34200','34300','34400','34500',
  '34600','34800','39100','39300','39400','39500','39700','39800','39990','43110','43700',
],'Conserva las 29 partidas de la foto original');
assert.deepEqual(
  ['31110 · Víveres','25500 · Publicidad','32100 · Papel de escritorio','33400 · Calzados'].sort(compareCategoryLabels),
  ['33400 · Calzados','32100 · Papel de escritorio','25500 · Publicidad','31110 · Víveres'],
);
assert.equal(categoryLabel(ITEM_CATEGORIES[0]!), '33400 · Calzados');
assert.equal(normalizeCategory('31110 · Víveres'), '31110 · Víveres');
assert.equal(normalizeCategory('39900 · Otros materiales y suministros'), '39990 · Otros materiales y suministros');
assert.equal(normalizeCategory('PAR-015 · Papel de escritorio'), '32100 · Papel de escritorio');
assert.equal(normalizeCategory('32100 · Papel'), '32100 · Papel de escritorio');
assert.equal(normalizeCategory('39200 · Nombre escrito por error'), '39200 · Material Deportivo y Recreativo');
assert.equal(officialBudgetItem('39900'),undefined,'No se habilitan partidas agrupadoras');
assert.equal(officialBudgetItem('99999'),undefined);
for(const category of ITEM_CATEGORIES)for(const alias of categoryAliases(category)){
  assert.equal(categoryInfo(alias)?.code,category.code,'Cada alias histórico tiene una sola partida');
  assert.equal(normalizeCategory(alias),categoryLabel(category));
}
assert.equal(normalizeCategory('Partida personalizada'),'Partida personalizada');
assert.equal(categoryInfo('Partida nueva'),undefined);
assert.deepEqual([{name:'Zapato',code:'Z-0001'},{name:'Álbum',code:'A-0200'}].sort(compareMaterialNames).map(m=>m.name),['Álbum','Zapato']);
assert(compareInventoryMaterials({category:'PUB-001 · Publicidad',name:'Afiche',code:'A-0001'},{category:'CAL-001 · Calzados',name:'Zapato',code:'Z-0200'})>0,'Ordena partidas por nombre y acepta etiquetas antiguas');
console.log('OK: 29 códigos del clasificador y compatibilidad con todas las etiquetas anteriores.');
