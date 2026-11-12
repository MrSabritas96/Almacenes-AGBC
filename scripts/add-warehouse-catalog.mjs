import 'dotenv/config';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

// Catálogo adicional local. No altera materiales existentes ni simula existencias físicas.
const base = 'http://localhost:3000';
const warehouseId = 'agbc-central';
const items = [
  ['POS-01','Caja de cartón corrugado para encomiendas pequeñas','Material postal','Unidad',10],
  ['POS-02','Caja de cartón corrugado para encomiendas medianas','Material postal','Unidad',10],
  ['POS-03','Caja de cartón corrugado para encomiendas grandes','Material postal','Unidad',5],
  ['POS-04','Cinta de embalaje transparente de 48 mm','Material postal','Rollo de 100 metros',10],
  ['POS-05','Cinta de embalaje impresa FRÁGIL','Material postal','Rollo de 50 metros',5],
  ['POS-06','Película stretch para embalaje de 50 cm','Material postal','Rollo',3],
  ['POS-07','Plástico de burbujas protector','Material postal','Rollo de 50 metros',3],
  ['POS-08','Sobre acolchado tamaño A4','Material postal','Paquete de 25 unidades',5],
  ['POS-09','Etiquetas térmicas autoadhesivas de 100 x 150 mm','Material postal','Rollo de 500 etiquetas',5],
  ['POS-10','Precinto plástico numerado de seguridad','Material postal','Paquete de 100 unidades',5],
  ['ESC-11','Tijera de oficina de 21 cm','Material de escritorio','Unidad',5],
  ['ESC-12','Perforadora de papel de dos orificios','Material de escritorio','Unidad',3],
  ['ESC-13','Marcador permanente negro','Material de escritorio','Unidad',10],
  ['ESC-14','Resaltador amarillo','Material de escritorio','Unidad',10],
  ['ESC-15','Clips metálicos de 33 mm','Material de escritorio','Caja de 100 unidades',5],
  ['ELE-11','Balanza digital para paquetes de hasta 30 kg','Material electrónico','Unidad',1],
  ['ELE-12','Adaptador USB a Ethernet','Material electrónico','Unidad',2],
  ['LIM-01','Limpiador desinfectante para superficies','Limpieza','Botella de 1 litro',5],
  ['LIM-02','Paño de microfibra para limpieza','Limpieza','Unidad',10],
  ['SEG-01','Guantes de protección para manipulación de paquetes','Seguridad laboral','Par',10],
];
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname),'Solo base local.');
const pool = new pg.Pool({connectionString:process.env.DATABASE_URL});
try {
  assert.equal((await pool.query('select id from warehouses where id=$1',[warehouseId])).rowCount,1,'Falta el almacén central.');
  const before = Number((await pool.query('select count(*) from materials where not archived')).rows[0].count);
  const login = await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({email:process.env.SEED_ADMIN_EMAIL,password:process.env.SEED_ADMIN_PASSWORD})});
  assert.equal(login.status,200,'No se pudo autenticar al SuperAdmin.');
  const cookie = login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert.equal((await fetch(`${base}/dashboard`,{headers:{Cookie:cookie}})).status,200);
  const manifestPath = existsSync('.next/dev/server/server-reference-manifest.json') ? '.next/dev/server/server-reference-manifest.json' : '.next/server/server-reference-manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath,'utf8'));
  const actionId = Object.entries(manifest.node).find(([,v])=>v.exportedName==='warehouseAction')?.[0];
  assert(actionId,'No se encontró la acción de materiales.');
  let created = 0;
  for (const [suffix,name,category,unit,minimum] of items) {
    const code = `AGBC-${suffix}`;
    const existing = await pool.query('select code,name,archived from materials where code=$1 or (warehouse_id=$2 and lower(name)=lower($3))',[code,warehouseId,name]);
    if (existing.rowCount) {
      assert(existing.rows.some(m=>m.code===code&&m.name===name&&!m.archived),`Código o nombre ya ocupado: ${code}`);
      continue;
    }
    const command = {type:'material',warehouseId,code,name,category,unit,stock:0,minimum,location:`Pendiente de asignación física · ${category}`,reason:'Alta de catálogo solicitada; stock inicial cero, pendiente de conteo físico.'};
    const res = await fetch(`${base}/dashboard`,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',Origin:base,Cookie:cookie,'Next-Action':actionId},body:JSON.stringify([command])});
    assert.equal(res.status,200);
    const result = (await res.text()).split('\n').map(l=>l.slice(l.indexOf(':')+1)).find(l=>l.startsWith('{')&&l.includes('"ok":'));
    assert(result,`Respuesta inesperada al registrar ${code}`);
    assert.equal(JSON.parse(result).ok,true,result);
    created++;
  }
  const verified = await pool.query('select * from materials where code=any($1::text[])',[items.map(([s])=>`AGBC-${s}`)]);
  assert.equal(verified.rowCount,20);
  assert(verified.rows.every(m=>!m.archived&&m.warehouse_id===warehouseId&&m.name&&m.category&&m.unit&&m.location&&m.stock>=0&&m.minimum>=0));
  const notices = await pool.query("select count(distinct entity_id)::int as count from notificaciones where entity_id=any($1::text[]) and kind='stock_out' and not resolved",[verified.rows.filter(m=>m.stock===0).map(m=>m.id)]);
  assert.equal(notices.rows[0].count,verified.rows.filter(m=>m.stock===0).length,'Faltan avisos de stock agotado.');
  const after = Number((await pool.query('select count(*) from materials where not archived')).rows[0].count);
  assert.equal(after,before+created);
  console.log(JSON.stringify({created,verified:verified.rowCount,activeMaterials:after,stockNotifications:notices.rows[0].count}));
} finally { await pool.end(); }
