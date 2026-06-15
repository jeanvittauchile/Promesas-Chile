import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';


/* ============================================================
   trainings.jsx — Gestión de entrenamientos
   ============================================================ */
const TR_TYPES = ['Técnica', 'Aeróbico', 'Velocidad', 'Específico', 'Resistencia', 'Recuperación'];
const TR_TYPE_COLOR = { 'Técnica': 'cyan', 'Aeróbico': 'navy', 'Velocidad': 'red', 'Específico': 'amber', 'Resistencia': 'green', 'Recuperación': 'slate' };
const TR_EMPTY = { fecha: '', titulo: '', grupo: 'DAR', tipo: 'Técnica', duracion: 90, ubicacion: 'Piscina Olímpica Valdivia', contenido: '' };

const VOL_META = [
  { k: 'total', label: 'Total', color: 'var(--navy)' },
  { k: 'tecnica', label: 'Técnica', color: '#00A6C6' },
  { k: 'pateo', label: 'Pateo', color: '#E0793B' },
  { k: 'brazos', label: 'Brazos', color: '#1FA971' },
  { k: 'velocidad', label: 'Velocidad ≤25m', color: '#E1543B' },
];
const fmtM = (n) => `${(+n || 0).toLocaleString('es-CL')} m`;

function VolumeStrip({ t, sub }) {
  const v = DB.volumenFor(t);
  if (!v.total) return null;
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
      {VOL_META.map(m => (
        <span key={m.k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', background: m.k === 'total' ? 'var(--navy)' : 'var(--surface-2)', border: `1px solid ${m.k === 'total' ? 'var(--navy)' : 'var(--line-soft)'}`, borderRadius: 'var(--r-sm)', fontSize: 11.5, fontWeight: 600, color: m.k === 'total' ? '#fff' : 'var(--slate-600)' }}>
          {m.k !== 'total' && <span style={{ width: 7, height: 7, borderRadius: 2, background: m.color }} />}
          {m.label}
          <b style={{ color: m.k === 'total' ? '#fff' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{(+v[m.k] || 0).toLocaleString('es-CL')}</b>
        </span>
      ))}
      {v.manual && <span className="badge badge-amber">Ajustado</span>}
      {sub && <span style={{ fontSize: 11, color: 'var(--slate-400)' }}>· en metros</span>}
    </div>
  );
}

function VolumeEditor({ contenido, value, onChange }) {
  const auto = useMemo(() => DB.parseVolume(contenido), [contenido]);
  const manual = !!(value && value.manual);
  const shown = manual ? value : auto;
  const setField = (k) => (e) => {
    const n = Math.max(0, parseInt(e.target.value, 10) || 0);
    onChange({ total: auto.total, tecnica: auto.tecnica, pateo: auto.pateo, brazos: auto.brazos, velocidad: auto.velocidad, ...(manual ? value : {}), [k]: n, manual: true });
  };
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 14, background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Volumen de la sesión</span>
          <span className={`badge badge-${manual ? 'amber' : 'cyan'}`}>{manual ? 'Ajuste manual' : 'Cálculo automático'}</span>
        </div>
        {manual && <button type="button" className="link-btn" onClick={() => onChange(null)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--cyan-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>↺ Recalcular desde el contenido</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {VOL_META.map(m => (
          <div key={m.k} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '8px 8px 9px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              {m.k !== 'total' && <span style={{ width: 7, height: 7, borderRadius: 2, background: m.color }} />}
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: m.k === 'total' ? 'var(--navy)' : 'var(--slate-500)' }}>{m.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <input type="number" min="0" className="input" value={shown[m.k]} onChange={setField(m.k)} style={{ padding: '5px 7px', fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-head)' }} />
              <span style={{ fontSize: 11, color: 'var(--slate-400)', fontWeight: 600 }}>m</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--slate-500)', lineHeight: 1.5 }}>
        Se calcula desde el contenido (ej. <code>12×25 sprint</code>, <code>3×(400 libre + 100 patada)</code>). Edita cualquier valor para ajustarlo manualmente. La velocidad cuenta solo tramos de ≤25 m.
      </p>
    </div>
  );
}

function TrainingForm({ initial, presetDate, onSave, onClose }) {
  const [f, setF] = useState({ ...TR_EMPTY, fecha: presetDate || todayISO(), ...initial });
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const valid = f.titulo.trim() && f.fecha;
  return (
    <Modal title={initial ? 'Editar entrenamiento' : 'Nuevo entrenamiento'} onClose={onClose} maxWidth={640}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} icon="check" onClick={() => { onSave(f); onClose(); }}>Guardar</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Título del entrenamiento" req><input className="input" value={f.titulo} onChange={set('titulo')} placeholder="Ej: Técnica de viraje y streamline" /></Field>
        <div className="field-grid">
          <Field label="Fecha" req><input type="date" className="input" value={f.fecha} onChange={set('fecha')} /></Field>
          <Field label="Grupo"><select className="select" value={f.grupo} onChange={set('grupo')}><option value="DAR">DAR</option><option value="BEN">Beneficiarios</option><option value="TODOS">Todos</option></select></Field>
        </div>
        <div className="field-grid-3">
          <Field label="Tipo"><select className="select" value={f.tipo} onChange={set('tipo')}>{TR_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Duración (min)"><input type="number" className="input" value={f.duracion} onChange={set('duracion')} /></Field>
          <Field label="Ubicación"><input className="input" value={f.ubicacion} onChange={set('ubicacion')} /></Field>
        </div>
        <Field label="Contenido de la sesión" hint="Una serie por línea. Visible para todos los nadadores del grupo.">
          <textarea className="textarea" style={{ minHeight: 140, fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.6 }} value={f.contenido} onChange={set('contenido')} placeholder={'400 nado suave + movilidad\n8×50 viraje con 5 ondas\n10×100 libre @2:20…'} />
        </Field>
        <VolumeEditor contenido={f.contenido} value={f.volumen} onChange={(v) => setF(s => ({ ...s, volumen: v }))} />
      </div>
    </Modal>
  );
}

function TrainingCard({ t, onEdit, onDelete, highlight }) {
  return (
    <div className="card card-pad" style={{ borderColor: highlight ? 'var(--cyan)' : 'var(--line)', boxShadow: highlight ? '0 0 0 3px var(--cyan-050)' : 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          <div style={{ textAlign: 'center', flex: '0 0 52px', background: 'var(--navy)', color: '#fff', borderRadius: 'var(--r-md)', padding: '8px 0' }}>
            <div style={{ fontSize: 20, fontFamily: 'var(--font-head)', fontWeight: 700, lineHeight: 1 }}>{new Date(t.fecha + 'T00:00:00').getDate()}</div>
            <div style={{ fontSize: 10.5, opacity: .7, textTransform: 'uppercase', marginTop: 2 }}>{MONTHS[new Date(t.fecha + 'T00:00:00').getMonth()].slice(0, 3)}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
              <span className={`badge badge-${TR_TYPE_COLOR[t.tipo] || 'slate'}`}>{t.tipo}</span>
              <span className="badge badge-slate">{t.grupo === 'TODOS' ? 'Todos' : t.grupo === 'DAR' ? 'DAR' : 'Beneficiarios'}</span>
              {highlight && <span className="badge badge-cyan">Hoy</span>}
            </div>
            <h3 style={{ fontSize: 16, marginBottom: 3 }}>{t.titulo}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="clock" style={{ width: 14, height: 14, stroke: 'var(--slate-400)' }} />{t.duracion} min</span>
              <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="pin" style={{ width: 14, height: 14, stroke: 'var(--slate-400)' }} />{t.ubicacion}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={() => onEdit(t)}><Icon name="edit" /></button>
          <button className="btn-icon" onClick={() => onDelete(t)}><Icon name="trash" /></button>
        </div>
      </div>
      {t.contenido && (
        <pre style={{ margin: '14px 0 0', padding: '14px 16px', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.7, color: 'var(--slate-700)', whiteSpace: 'pre-wrap' }}>{t.contenido}</pre>
      )}
      <VolumeStrip t={t} />
    </div>
  );
}

/* ---- helpers de fecha para Excel ---- */
function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}

const VALID_TYPES = new Set(TR_TYPES);

function TrainingImport({ onClose }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);

  function downloadTemplate() {
    const headers = ['fecha*', 'titulo*', 'grupo', 'tipo', 'duracion', 'ubicacion', 'contenido'];
    const example = ['2024-03-15', 'Técnica de viraje y streamline', 'DAR', 'Técnica', 90, 'Piscina Olímpica Valdivia', '400 nado suave + movilidad\n8×50 viraje con 5 ondas\n10×100 libre @2:20'];
    const example2 = ['2024-03-17', 'Trabajo aeróbico base', 'DAR', 'Aeróbico', 120, 'Piscina Olímpica Valdivia', '600 suave\n10×200 libre @3:30\n400 vuelta'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example, example2]);
    ws['!cols'] = [14, 32, 8, 14, 10, 26, 40].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Entrenamientos');
    XLSX.writeFile(wb, 'plantilla_entrenamientos.xlsx');
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = raw.map(r => {
          const tipo = String(r['tipo'] || 'Técnica').trim();
          const grupo = String(r['grupo'] || 'DAR').trim().toUpperCase();
          return {
            fecha: parseExcelDate(r['fecha*'] || r['fecha']),
            titulo: String(r['titulo*'] || r['titulo'] || '').trim(),
            grupo: ['DAR', 'BEN', 'TODOS'].includes(grupo) ? grupo : 'DAR',
            tipo: VALID_TYPES.has(tipo) ? tipo : 'Técnica',
            duracion: Math.max(1, parseInt(r['duracion'], 10) || 90),
            ubicacion: String(r['ubicacion'] || 'Piscina Olímpica Valdivia').trim(),
            contenido: String(r['contenido'] || '').replace(/\\n/g, '\n').trim(),
          };
        }).filter(r => r.fecha || r.titulo);
        setRows(parsed);
      } catch {
        toast('No se pudo leer el archivo. Usa el formato de la plantilla.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function doImport() {
    const valid = rows.filter(r => r.fecha && r.titulo);
    valid.forEach(r => DB.addTraining(r));
    toast(`${valid.length} entrenamiento${valid.length !== 1 ? 's' : ''} importado${valid.length !== 1 ? 's' : ''}`);
    onClose();
  }

  const valid = rows ? rows.filter(r => r.fecha && r.titulo) : [];

  return (
    <Modal title="Importar entrenamientos desde Excel" onClose={onClose} maxWidth={720}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {rows && <Button icon="check" disabled={valid.length === 0} onClick={doImport}>Importar {valid.length} entrenamiento{valid.length !== 1 ? 's' : ''}</Button>}
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card card-pad" style={{ background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--cyan-700)', fontSize: 14, marginBottom: 4 }}>1. Descarga la plantilla Excel</div>
              <div style={{ fontSize: 12.5, color: 'var(--cyan-600)', lineHeight: 1.5 }}>
                Completa los entrenamientos. Las columnas con <strong>*</strong> son obligatorias.<br />
                La fecha debe ser <code>YYYY-MM-DD</code>. Grupo: <code>DAR</code>, <code>BEN</code> o <code>TODOS</code>.<br />
                Tipos válidos: {TR_TYPES.join(', ')}.
              </div>
            </div>
            <Button variant="ghost" icon="download" size="sm" onClick={downloadTemplate}>Plantilla .xlsx</Button>
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', marginBottom: 8 }}>2. Sube el archivo completado</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '2px dashed var(--line)', borderRadius: 'var(--r-md)', cursor: 'pointer', background: 'var(--surface-2)', transition: 'border-color .15s' }}>
            <Icon name={rows ? 'check' : 'upload'} style={{ width: 20, height: 20, stroke: rows ? '#137a4f' : 'var(--slate-400)', flex: '0 0 20px' }} />
            <span style={{ fontSize: 13, color: rows ? '#137a4f' : 'var(--slate-500)', fontWeight: rows ? 600 : 400 }}>
              {rows ? `Archivo cargado — ${rows.length} fila${rows.length !== 1 ? 's' : ''} detectada${rows.length !== 1 ? 's' : ''}` : 'Haz clic para seleccionar el archivo (.xlsx, .xls, .csv)'}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>

        {rows && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>3. Vista previa</div>
              <div style={{ fontSize: 12.5 }}>
                <span className="badge badge-green">{valid.length} válidos</span>
                {rows.length - valid.length > 0 && <span className="badge badge-red" style={{ marginLeft: 6 }}>{rows.length - valid.length} incompletos</span>}
              </div>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--r-md)' }}>
              <table className="tbl">
                <thead>
                  <tr><th>Estado</th><th>Fecha</th><th>Título</th><th>Grupo</th><th>Tipo</th><th>Duración</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const ok = r.fecha && r.titulo;
                    return (
                      <tr key={i} style={{ background: ok ? '' : 'var(--red-bg)' }}>
                        <td><span className={`badge badge-${ok ? 'green' : 'red'}`}>{ok ? '✓' : 'Incompleto'}</span></td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.fecha || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                        <td style={{ fontWeight: 600, maxWidth: 180 }}>{r.titulo || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                        <td><span className="badge badge-slate">{r.grupo}</span></td>
                        <td><span className={`badge badge-${TR_TYPE_COLOR[r.tipo] || 'slate'}`}>{r.tipo}</span></td>
                        <td>{r.duracion} min</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length - valid.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--slate-500)' }}>
                Las filas incompletas (sin fecha o título) serán omitidas al importar.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TrainingsView() {
  const st = useStore();
  const toast = useToast();
  const now = new Date();
  const [ym, setYm] = useState(todayISO().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [importing, setImporting] = useState(false);

  const [yy, mm] = ym.split('-').map(Number);
  const first = new Date(yy, mm - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(yy, mm, 0).getDate();

  const byDay = useMemo(() => {
    const m = {};
    st.trainings.forEach(t => { (m[t.fecha] = m[t.fecha] || []).push(t); });
    return m;
  }, [st.trainings]);

  const shiftMonth = (d) => { const dt = new Date(yy, mm - 1 + d, 1); setYm(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); };
  const dayISO = (d) => `${ym}-${String(d).padStart(2, '0')}`;
  const selList = (byDay[selectedDay] || []).slice().sort((a, b) => a.titulo.localeCompare(b.titulo));

  const save = (data) => {
    if (editing && editing !== 'new') { DB.updateTraining(editing.id, data); toast('Entrenamiento actualizado'); }
    else { DB.addTraining(data); toast('Entrenamiento creado'); }
  };

  return (
    <div>
      <div className="toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 4 }}>
          <button className="btn-icon" onClick={() => shiftMonth(-1)}><Icon name="chevL" /></button>
          <div style={{ minWidth: 156, textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-head)', fontSize: 14.5 }}>{MONTHS[mm - 1]} {yy}</div>
          <button className="btn-icon" onClick={() => shiftMonth(1)}><Icon name="chevR" /></button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setYm(todayISO().slice(0, 7)); setSelectedDay(todayISO()); }}>Hoy</Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" icon="upload" onClick={() => setImporting(true)}>Importar Excel</Button>
        <Button icon="plus" onClick={() => setEditing('new')}>Nuevo entrenamiento</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }} className="tr-layout">
        {/* Calendar */}
        <div className="card card-pad">
          <div className="cal-grid cal-head">
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => <div key={d} className="cal-wd">{d}</div>)}
          </div>
          <div className="cal-grid">
            {Array.from({ length: startPad }).map((_, i) => <div key={'p' + i} className="cal-cell empty" />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const iso = dayISO(d);
              const items = byDay[iso] || [];
              const isToday = iso === todayISO();
              const isSel = iso === selectedDay;
              return (
                <button key={d} className={`cal-cell ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}`} onClick={() => setSelectedDay(iso)}>
                  <span className="cal-num">{d}</span>
                  <span className="cal-dots">
                    {items.slice(0, 3).map((t, i) => <span key={i} className={`cal-dot dot-${TR_TYPE_COLOR[t.tipo] || 'slate'}`} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 16, fontSize: 11.5, color: 'var(--slate-500)' }}>
            {TR_TYPES.map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className={`cal-dot dot-${TR_TYPE_COLOR[t]}`} style={{ width: 8, height: 8 }} />{t}
              </span>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            <h2>{fmtDateLong(selectedDay)}</h2>
            <div className="line" />
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setEditing('new')}>Agregar</Button>
          </div>
          {selList.length === 0 ? (
            <div className="card"><Empty icon="calendar" title="Sin entrenamientos" action={<Button size="sm" icon="plus" onClick={() => setEditing('new')}>Crear entrenamiento</Button>}>No hay sesiones programadas para este día.</Empty></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selList.map(t => <TrainingCard key={t.id} t={t} highlight={selectedDay === todayISO()} onEdit={setEditing} onDelete={setDeleting} />)}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <TrainingForm initial={editing === 'new' ? null : editing} presetDate={editing === 'new' ? selectedDay : null} onSave={save} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <Confirm title="Eliminar entrenamiento" danger message={`¿Eliminar "${deleting.titulo}"? Esta acción no se puede deshacer.`} confirmLabel="Eliminar"
          onConfirm={() => { DB.removeTraining(deleting.id); toast('Entrenamiento eliminado'); }} onClose={() => setDeleting(null)} />
      )}
      {importing && <TrainingImport onClose={() => setImporting(false)} />}
    </div>
  );
}

export { TrainingsView };
