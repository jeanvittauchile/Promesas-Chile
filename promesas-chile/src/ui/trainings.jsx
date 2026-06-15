import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

function TrainingsView() {
  const st = useStore();
  const toast = useToast();
  const now = new Date();
  const [ym, setYm] = useState(todayISO().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(todayISO());
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

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
    </div>
  );
}

export { TrainingsView };
