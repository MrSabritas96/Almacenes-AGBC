"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importWarehouseWorkbook, listWarehouseClosings, loadWarehouseClosing } from '@/actions/almacenes/imports';
import type { WarehouseClosing } from '@/lib/warehouse-closing';
import type { ImportKind } from '@/lib/warehouse-import';
import type { Snapshot } from '@/lib/warehouse-types';
import { useWarehouseTab } from './tab-session';
import { WarehouseClosingStatement } from './warehouse-closing-statement';
import type { ClosingStatement } from '@/lib/warehouse-closing-statement';

const options: Record<ImportKind, string> = {
  Cierre: 'Cierre anual · Cuadros 5 y 6',
  Materiales: 'Catálogo de materiales',
  Proveedores: 'Proveedores',
  Empleados: 'Fichas de empleados',
};
type Preview = Extract<Awaited<ReturnType<typeof importWarehouseWorkbook>>, { ok: true }>;
type Archive = Extract<Awaited<ReturnType<typeof listWarehouseClosings>>, { ok: true }>['rows'];
const quantity = new Intl.NumberFormat('es-BO');
const price = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 6 });
const money = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amounts = (values: number[], detailed: boolean) =>
  values.map((value, i) => (detailed ? i >= 4 : i % 2 === 1) ? money.format(value / 100) : quantity.format(value));

function ClosingTable({ closing, detail, query }: { closing: WarehouseClosing; detail: boolean; query: string }) {
  const filter = query.trim().toLocaleLowerCase('es');
  const headers = detail
    ? ['Fila Excel', 'N.º', 'Material', 'Unidad', 'Precio unitario Bs', 'Cantidad inicial', 'Entradas', 'Salidas', 'Cantidad final', 'Inicial Bs', 'Entradas Bs', 'Salidas Bs', 'Final Bs']
    : ['Fila Excel', 'N.º', 'Partida original', 'Cantidad inicial', 'Inicial Bs', 'Cantidad final', 'Final Bs'];
  const records = detail
    ? closing.detailRows.filter(row => row.description.toLocaleLowerCase('es').includes(filter))
      .map(row => ({ row: row.row, cells: [row.item, row.description, row.unit || '—', price.format(row.price), ...amounts(row.values, true)] }))
    : closing.summaryRows.filter(row => row.category.toLocaleLowerCase('es').includes(filter))
      .map(row => ({ row: row.row, cells: [row.item, row.category, ...amounts(row.values, false)] }));
  return <div className="table-scroll"><table className="tabular-nums">
    <caption>{detail ? 'Cuadro 6 · Detalle por ítem' : 'Cuadro 5 · Resumen por partida'} · {closing.year}</caption>
    <thead><tr>{headers.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{records.map(record => <tr key={record.row}><td>{record.row}</td>
      {record.cells.map((value, i) => <td key={i}>{value}</td>)}</tr>)}</tbody>
    <tfoot><tr><th scope="row" colSpan={detail ? 5 : 3}>Total del cierre</th>
      {amounts(detail ? closing.detailTotals : closing.summaryTotals, detail).map((value, i) => <td key={i}>{value}</td>)}</tr></tfoot>
  </table>{!records.length && <p className="empty-state">No hay filas que coincidan con la búsqueda.</p>}</div>;
}

export function WarehouseImports({ warehouses, query, closingYear }: {
  warehouses: Snapshot['warehouses']; query: string; closingYear?: number;
}) {
  const router = useRouter();
  const tabId = useWarehouseTab();
  const [kind, setKind] = useState<ImportKind>('Cierre');
  const [warehouse, setWarehouse] = useState(warehouses.length === 1 ? warehouses[0]!.id : '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [archive, setArchive] = useState<Archive | null>(null);
  const [closing, setClosing] = useState<{ id: string; data: WarehouseClosing; statement: ClosingStatement | null } | null>(null);
  const [view, setView] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const href = (key: string, value: string) => `/api/warehouse-import?${new URLSearchParams({ [key]: value, ...(tabId ? { tabId } : {}) })}`;
  const resetPreview = () => { setPreview(null); setError(''); setNotice(''); };

  useEffect(() => {
    let active = true;
    async function loadArchive() {
      const result = await listWarehouseClosings(tabId);
      if (!active) return;
      if (!result.ok) throw new Error(result.error);
      setArchive(result.rows);
      if (!closingYear) return;
      const matches = result.rows.filter(row => row.year === closingYear);
      if (matches.length !== 1) return;
      const { id } = matches[0]!;
      const record = await loadWarehouseClosing(id, tabId);
      if (!active) return;
      if (!record.ok) throw new Error(record.error);
      setClosing({ id, data: record.data, statement: record.statement });
      setView('6');
    }
    void loadArchive().catch(() => {
      if (active) setError('No se pudieron consultar los cierres.');
    });
    return () => { active = false; };
  }, [closingYear, tabId]);

  async function fetchArchive() {
    const result = await listWarehouseClosings(tabId);
    if (result.ok) setArchive(result.rows);
    else setError(result.error);
  }

  async function openClosing(id: string) {
    setClosing(null);
    if (!id) return;
    setError('');
    setBusy(true);
    try {
      const result = await loadWarehouseClosing(id, tabId);
      if (result.ok) { setClosing({ id, data: result.data, statement: result.statement }); setView('5'); }
      else setError(result.error);
    } catch {
      setError('No se pudo abrir el cierre. Intenta nuevamente.');
    } finally { setBusy(false); }
  }

  async function submit(apply: boolean) {
    if (!file || !warehouse || (apply && !preview)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.set('warehouse', warehouse);
      form.set('kind', kind);
      form.set('file', file);
      if (apply && preview) form.set('reviewed', preview.reviewKey);
      const result = await importWarehouseWorkbook(form, tabId);
      if (!result.ok) { setError(result.error); setPreview(null); return; }
      if (result.alreadyImported || result.apply) {
        setPreview(null);
        setNotice(result.alreadyImported ? 'Este cierre ya está registrado.' : `Importación completa · ${result.count} filas guardadas.`);
        if (kind === 'Cierre') await fetchArchive();
        else router.refresh();
      } else {
        setPreview(result);
      }
    } catch {
      setError('No se pudo procesar el archivo. Intenta nuevamente.');
    } finally { setBusy(false); }
  }

  return <section className="data-panel view-enter" aria-label="Cierres e importación">
    <div className="panel-heading movement-table-heading"><h2>Cierres e importación</h2></div>
    <div className="movement-archive">
      <section aria-label="Cierres históricos">
        <h3>Cierres registrados</h3>
        <div className="table-toolbar">
          <label>Año y almacén<select disabled={busy || !archive?.length} value={closing?.id ?? ''} onChange={event => void openClosing(event.target.value)}>
            <option value="">{archive?.length ? 'Seleccionar cierre' : archive ? 'Sin cierres registrados' : 'Cargando cierres…'}</option>
            {archive?.map(row => <option key={row.id} value={row.id}>{row.year} · {row.warehouse}</option>)}
          </select></label>
          {closing && <>
            <label>Cuadro<select disabled={busy} value={view} onChange={event => setView(event.target.value)}>
              <option value="5">Cuadro 5 · Resumen</option><option value="6">Cuadro 6 · Detalle</option>
              {closing.statement && <option value="eeff">EEFF · Conciliación, compras y salidas</option>}
            </select></label>
            <a className="secondary-button" href={href('id', closing.id)}>Descargar Excel original</a>
          </>}
        </div>
        {closing && (view === 'eeff' && closing.statement
          ? <WarehouseClosingStatement statement={closing.statement} year={closing.data.year} original={href('statement',closing.id)}/>
          : <ClosingTable closing={closing.data} detail={view==='6'} query={query}/>)}
      </section>
      <form className="movement-import" onSubmit={event => { event.preventDefault(); void submit(false); }} aria-busy={busy}>
        <h3>Importar archivo Excel</h3>
        <div className="table-toolbar">
          <label>Tipo de datos<select disabled={busy} value={kind} onChange={event => { setKind(event.target.value as ImportKind); resetPreview(); }}>
            {Object.entries(options).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>Almacén de destino<select required disabled={busy} value={warehouse} onChange={event => { setWarehouse(event.target.value); resetPreview(); }}>
            <option value="">Seleccionar almacén</option>{warehouses.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select></label>
          <label>Archivo Excel<input type="file" required accept=".xlsx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); resetPreview(); }}/></label>
          {kind !== 'Cierre' && <a className="secondary-button" href={href('template', kind)}>Descargar plantilla</a>}
          <button className="secondary-button" disabled={!file || !warehouse || busy}>Revisar archivo</button>
        </div>
        <p className="form-hint">{kind === 'Cierre' ? 'Usa el formato institucional con ambos cuadros. Se guarda en el histórico.' : kind === 'Materiales' ? 'Las nuevas fichas se crean con stock cero y código generado por el sistema.' : 'La plantilla añade fichas nuevas. Guarda los identificadores como texto para conservar ceros a la izquierda.'}</p>
        {preview && <div className="space-y-2">
          <p role="status"><strong>{preview.count} filas validadas.</strong>{preview.closing &&
            ` Cierre ${preview.closing.year} · ${preview.closing.categories} partidas · Saldo final Bs ${money.format(preview.closing.totals[7]! / 100)}.`}</p>
          {!!preview.sample.length && <ul className="form-hint">{preview.sample.map((row, i) => <li key={i}>{row.join(' · ')}</li>)}</ul>}
          <button type="button" className="primary-button" disabled={busy} onClick={() => void submit(true)}>Importar {preview.count} filas</button>
        </div>}
      </form>
      {busy && <p role="status">Procesando…</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  </section>;
}
