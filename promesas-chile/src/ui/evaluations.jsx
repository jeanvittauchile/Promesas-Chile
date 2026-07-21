import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';
import { useStopwatch, clockParts } from './stopwatch.jsx';


/* ============================================================
   evaluations.jsx — Módulo de evaluaciones de rendimiento
   ============================================================ */
function protoById(id) { return DB.PROTOCOLS.find(p => p.id === id); }
function metricMeta(m) { return DB.METRIC_TYPES[m]; }

/* ---------- Series summary (avg nado, best/worst rep, avg rest) ---------- */
function seriesSummary(reps) {
  const done = (reps || []).filter(r => r.nado != null);
  if (done.length === 0) return null;
  const nados = done.map(r => r.nado);
  const descansos = (reps || []).filter(r => r.descanso != null).map(r => r.descanso);
  const avg = nados.reduce((a, b) => a + b, 0) / nados.length;
  let bestI = 0, worstI = 0;
  nados.forEach((n, i) => { if (n < nados[bestI]) bestI = i; if (n > nados[worstI]) worstI = i; });
  return {
    count: done.length,
    avgNado: avg,
    bestNado: nados[bestI], bestRep: bestI + 1,
    worstNado: nados[worstI], worstRep: worstI + 1,
    avgDescanso: descansos.length ? descansos.reduce((a, b) => a + b, 0) / descansos.length : null,
    totalNado: nados.reduce((a, b) => a + b, 0),
  };
}

/* ---------- Level badge ---------- */
function NivelBadge({ proto, avgTime, size }) {
  if (!proto || !proto.niveles) return null;
  const n = DB.levelFor(proto, avgTime);
  const c = !n ? 'var(--slate-400)' : n <= 2 ? '#C6962B' : n <= 4 ? '#1FA971' : n <= 6 ? '#00A6C6' : n <= 8 ? '#E0A93B' : '#E1543B';
  const sm = size === 'sm';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: sm ? 7 : 10, padding: sm ? '5px 10px' : '9px 14px', background: n ? c + '15' : 'var(--line-soft)', border: `1.5px solid ${n ? c + '40' : 'var(--line)'}`, borderRadius: 'var(--r-md)' }}>
      <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: sm ? 19 : 28, color: c, lineHeight: 1, minWidth: sm ? 26 : 34, textAlign: 'center' }}>{n ? `N${n}` : '—'}</div>
      <div style={{ lineHeight: 1.35 }}>
        <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: sm ? 11.5 : 13.5, color: c }}>{n ? `Nivel ${n}` : 'Sin nivel'}</div>
        <div style={{ fontSize: sm ? 10.5 : 11.5, color: 'var(--slate-500)', fontWeight: 600 }}>{n ? `corte ${fmtTime(proto.niveles[n - 1])} · ${proto.distancia}m` : `> ${fmtTime(proto.niveles[proto.niveles.length - 1])}`}</div>
      </div>
    </div>
  );
}

function SeriesSummary({ reps, compact, proto }) {
  const s = seriesSummary(reps);
  if (!s) return null;
  const items = [
    { l: 'Promedio nado', v: fmtTime(s.avgNado), c: 'var(--cyan-700)' },
    { l: `Mejor rep · #${s.bestRep}`, v: fmtTime(s.bestNado), c: 'var(--green)' },
    { l: `Peor rep · #${s.worstRep}`, v: fmtTime(s.worstNado), c: 'var(--red)' },
    { l: 'Prom. descanso', v: s.avgDescanso != null ? fmtTime(s.avgDescanso) : '—', c: 'var(--amber)' },
  ];
  return (
    <>
      {proto && proto.niveles && (
        <div style={{ marginBottom: 12 }}><NivelBadge proto={proto} avgTime={s.avgNado} /></div>
      )}
      <div className={`series-sum ${compact ? 'compact' : ''}`}>
        {items.map((it, i) => (
          <div className="series-sum-item" key={i}>
            <div className="ss-label">{it.l}</div>
            <div className="ss-val" style={{ color: it.c }}>{it.v}</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- DNF ("no completó") mark ---------- */
function DnfChip({ small }) {
  return <span className="badge badge-red" style={{ fontWeight: 800, fontSize: small ? 11 : undefined }}>✕ No completó</span>;
}
function isDnf(v) { return v === null; }

/* ---------- Generic edit/delete modal for a single recorded entry ---------- */
function EditEntryModal({ title, fields, initial, onSave, onDelete, onClose }) {
  const [dnf, setDnf] = useState(initial[fields[0].key] == null);
  const [vals, setVals] = useState(() => {
    const v = {};
    fields.forEach(f => { v[f.key] = initial[f.key] != null ? (f.type === 'time' ? fmtTime(initial[f.key]) : String(initial[f.key])) : ''; });
    return v;
  });
  const setF = (k, val) => setVals(s => ({ ...s, [k]: val }));
  const primaryKey = fields[0].key;
  const save = () => {
    const out = {};
    fields.forEach(f => {
      if (dnf && f.key === primaryKey) { out[f.key] = null; return; }
      const raw = vals[f.key];
      if (f.type === 'time') out[f.key] = parseTime(raw);
      else out[f.key] = String(raw).trim() === '' ? null : parseInt(raw, 10);
    });
    onSave(out);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} maxWidth={400}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {onDelete && <Button variant="danger" icon="trash" onClick={() => { onDelete(); onClose(); }}>Eliminar</Button>}
        <Button icon="check" onClick={save}>Guardar</Button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(f => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input className="input" value={vals[f.key]} disabled={dnf && f.key === primaryKey} onChange={e => setF(f.key, e.target.value)} placeholder={f.placeholder} />
          </Field>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--red)', padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 'var(--r-md)' }}>
          <input type="checkbox" checked={dnf} onChange={e => setDnf(e.target.checked)} />
          Marcar con ✕ — no completó
        </label>
      </div>
    </Modal>
  );
}

/* ---------- Quitar nadador de la sesión activa (antes de guardar) ---------- */
function RemoveSwimmerButton({ swimmer, hasData, onRemove }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button className="btn-icon" style={{ position: 'relative', zIndex: 2, color: 'var(--red)' }}
        onClick={(e) => { e.stopPropagation(); if (hasData) setConfirming(true); else onRemove(); }}
        title={`Quitar a ${swimmer.nombre} de esta evaluación`}>
        <Icon name="x" />
      </button>
      {confirming && (
        <Confirm title="Quitar nadador" danger
          message={`${swimmer.nombre} ya tiene datos registrados en esta sesión. ¿Quitarlo de todos modos? Se perderán sus registros de hoy.`}
          confirmLabel="Quitar" onConfirm={onRemove} onClose={() => setConfirming(false)} />
      )}
    </>
  );
}

/* ---------- Setup screen ---------- */
function EvalSetup({ onStart, onCancel }) {
  const st = useStore();
  const [metrica, setMetrica] = useState('cronometro');
  const [protocolo, setProtocolo] = useState('libre');
  const [cronoMode, setCronoMode] = useState('individual'); // individual | simultaneo
  const [sel, setSel] = useState([]);
  const proto = protoById(protocolo);
  const dar = st.swimmers.filter(s => s.group === 'DAR').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="section-title" style={{ marginTop: 0 }}><h2>1 · Protocolo de evaluación</h2><div className="line" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {DB.PROTOCOLS.map(p => (
          <button key={p.id} className="proto-pick" data-on={protocolo === p.id} onClick={() => setProtocolo(p.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong>{p.nombre}</strong>
              {protocolo === p.id && <Icon name="check" style={{ width: 18, height: 18, stroke: 'var(--cyan-700)' }} />}
            </div>
            <span className="proto-set">{p.set}</span>
            {p.compuesta && <span className="badge badge-green" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Tiempo + conteos</span>}
            {p.niveles && <span className="badge badge-amber" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Sistema de niveles</span>}
          </button>
        ))}
      </div>
      {proto && (
        <div className="card card-pad" style={{ marginBottom: 28, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Focos técnicos · {proto.nombre}</div>
          <ul style={{ margin: 0, paddingLeft: 18, columns: 2, columnGap: 28, fontSize: 13, color: 'var(--slate-700)', lineHeight: 1.55 }}>
            {proto.foco.map((f, i) => <li key={i} style={{ marginBottom: 6, breakInside: 'avoid' }}>{f}</li>)}
          </ul>
        </div>
      )}
      {proto && proto.niveles && (
        <div className="card card-pad" style={{ marginBottom: 28, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Sistema de niveles · {proto.nombre}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
            {proto.niveles.map((t, i) => {
              const nv = i + 1;
              const nc = nv <= 2 ? '#C6962B' : nv <= 4 ? '#1FA971' : nv <= 6 ? '#00A6C6' : nv <= 8 ? '#E0A93B' : '#E1543B';
              return (
                <div key={nv} style={{ textAlign: 'center', padding: '9px 4px', background: nc + '15', border: `1px solid ${nc}40`, borderRadius: 'var(--r-sm)' }}>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 14, color: nc }}>N{nv}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--slate-700)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>{fmtTime(t)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--slate-500)', fontWeight: 600 }}>Tiempos de corte por {proto.distancia}m · promedio sobre la serie completa</div>
        </div>
      )}

      <div className="section-title"><h2>2 · {proto.compuesta ? 'Métricas registradas' : 'Tipo de métrica'}</h2><div className="line" /></div>
      {proto.compuesta ? (
        <div className="card card-pad" style={{ marginBottom: 28, display: 'flex', gap: 13, alignItems: 'flex-start', background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)' }}>
          <Icon name="timer" style={{ width: 20, height: 20, stroke: 'var(--cyan-700)', flex: '0 0 20px', marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: 'var(--cyan-700)', lineHeight: 1.5, marginBottom: 10 }}>
              Esta prueba registra <strong>{proto.tiempoLabel.toLowerCase()}</strong> junto con los conteos, en cada intento.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge" style={{ background: '#fff', color: 'var(--cyan-700)' }}>⏱ Tiempo total</span>
              {proto.metricas.map(m => <span key={m} className="badge" style={{ background: '#fff', color: DB.METRIC_TYPES[m].color }}>{DB.METRIC_TYPES[m].label}</span>)}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p style={{ marginTop: -8, marginBottom: 16, color: 'var(--slate-500)', fontSize: 13.5 }}>Cada métrica se registra de forma independiente, en momentos distintos de la sesión.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
            {['cronometro', 'brazadas', 'subacuatico'].map(k => {
              const m = DB.METRIC_TYPES[k];
              return (
                <button key={k} className="metric-pick" data-on={metrica === k} onClick={() => setMetrica(k)}>
                  <span className="mp-ico" style={{ background: m.color + '1a', color: m.color }}>
                    <Icon name={m.icon === 'timer' ? 'timer' : m.icon === 'arm' ? 'arm' : 'wave'} />
                  </span>
                  <span className="mp-label">{m.label}</span>
                  <span className="mp-sub">{m.sub}</span>
                </button>
              );
            })}
          </div>
          {metrica === 'cronometro' && (
            <div style={{ marginBottom: 28 }}>
              <div className="section-title"><h2>Modo de cronometraje</h2><div className="line" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <button className="metric-pick" data-on={cronoMode === 'individual'} onClick={() => setCronoMode('individual')}>
                  <span className="mp-ico" style={{ background: '#00C0E21a', color: '#00A6C6' }}><Icon name="user" /></span>
                  <span className="mp-label">Individual</span>
                  <span className="mp-sub">Un nadador a la vez{proto.repeticiones > 1 ? ' · nado + descanso por repetición' : ''}</span>
                </button>
                <button className="metric-pick" data-on={cronoMode === 'simultaneo'} onClick={() => setCronoMode('simultaneo')}>
                  <span className="mp-ico" style={{ background: '#1FA9711a', color: '#1FA971' }}><Icon name="users" /></span>
                  <span className="mp-label">Simultáneo</span>
                  <span className="mp-sub">Varios nadadores con un solo cronómetro — toca a cada uno al llegar</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="section-title"><h2>3 · Nadadores evaluados</h2><div className="line" /><span style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>{sel.length} seleccionados</span></div>
      {dar.length === 0 ? <Empty icon="users" title="No hay nadadores DAR" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 28 }}>
          {dar.map(s => (
            <button key={s.id} className="swim-pick" data-on={sel.includes(s.id)} onClick={() => toggle(s.id)}>
              <Avatar name={s.nombre} size={34} />
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
                <div style={{ fontSize: 11.5, color: 'var(--slate-400)' }}>{DB.categoryFor(s.fechaNacimiento)}</div>
              </div>
              <div className={`swim-check ${sel.includes(s.id) ? 'on' : ''}`}>{sel.includes(s.id) && <Icon name="check" />}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'linear-gradient(transparent, var(--bg) 40%)', padding: '16px 0' }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={sel.length === 0} icon="play" onClick={() => onStart({ metrica: proto.compuesta ? 'compuesta' : metrica, protocolo, swimmerIds: sel, cronoMode })}>Iniciar registro</Button>
      </div>
    </div>
  );
}

/* ---------- Recorder ---------- */
function EvalRecorder({ config, onSave, onCancel }) {
  const st = useStore();
  const toast = useToast();
  const proto = protoById(config.protocolo);
  const meta = metricMeta(config.metrica);
  const swimmers = config.swimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);
  const [removed, setRemoved] = useState(() => new Set());
  const activeSwimmers = swimmers.filter(s => !removed.has(s.id));
  const [active, setActive] = useState(config.swimmerIds[0]);
  const [data, setData] = useState(() => {
    const d = {};
    config.swimmerIds.forEach(id => { d[id] = config.metrica === 'cronometro' ? { laps: [] } : { tramos: [] }; });
    return d;
  });
  const [notas, setNotas] = useState('');
  const sw = useStopwatch();
  const [counter, setCounter] = useState(0);
  const [editingLap, setEditingLap] = useState(null); // index
  const [editingTramo, setEditingTramo] = useState(null); // index
  const activeSwimmer = swimmers.find(s => s.id === active);

  const removeSwimmer = (id) => {
    setRemoved(r => new Set([...r, id]));
    if (active === id) { const next = activeSwimmers.find(s => s.id !== id); if (next) setActive(next.id); }
  };

  const lap = () => {
    const prev = data[active].laps.filter(v => v != null).reduce((a, b) => a + b, 0);
    const split = +(sw.elapsed - prev).toFixed(2);
    setData(d => ({ ...d, [active]: { laps: [...d[active].laps, split] } }));
  };
  const lapDNF = () => setData(d => ({ ...d, [active]: { laps: [...d[active].laps, null] } }));
  const undoLap = () => setData(d => ({ ...d, [active]: { laps: d[active].laps.slice(0, -1) } }));
  const editLap = (i, patch) => setData(d => { const laps = [...d[active].laps]; laps[i] = patch.v; return { ...d, [active]: { laps } }; });
  const deleteLap = (i) => setData(d => { const laps = [...d[active].laps]; laps.splice(i, 1); return { ...d, [active]: { laps } }; });
  const registerTramo = () => {
    setData(d => ({ ...d, [active]: { tramos: [...d[active].tramos, counter] } }));
    setCounter(0);
  };
  const registerTramoDNF = () => {
    setData(d => ({ ...d, [active]: { tramos: [...d[active].tramos, null] } }));
    setCounter(0);
  };
  const undoTramo = () => setData(d => ({ ...d, [active]: { tramos: d[active].tramos.slice(0, -1) } }));
  const editTramo = (i, patch) => setData(d => { const tramos = [...d[active].tramos]; tramos[i] = patch.v; return { ...d, [active]: { tramos } }; });
  const deleteTramo = (i) => setData(d => { const tramos = [...d[active].tramos]; tramos.splice(i, 1); return { ...d, [active]: { tramos } }; });

  const hasData = activeSwimmers.some(s => (data[s.id].laps || data[s.id].tramos).length > 0);

  const save = () => {
    const clean = {};
    activeSwimmers.forEach(s => {
      const id = s.id;
      if (config.metrica === 'cronometro') {
        const laps = data[id].laps;
        clean[id] = { laps, total: +laps.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(2) };
      } else {
        clean[id] = { tramos: data[id].tramos };
      }
    });
    DB.addEvaluation({ fecha: todayISO(), protocolo: config.protocolo, metrica: config.metrica, swimmerIds: activeSwimmers.map(s => s.id), tecnico: st.coach.nombre, notas, data: clean });
    toast('Evaluación guardada');
    onSave();
  };

  const cp = clockParts(sw.elapsed);
  const activeData = data[active] || {};
  const target = proto.ciclo || null;

  return (
    <div>
      <div className="rec-head card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="mp-ico" style={{ background: meta.color + '1a', color: meta.color, width: 44, height: 44 }}><Icon name={meta.icon === 'timer' ? 'timer' : meta.icon === 'arm' ? 'arm' : 'wave'} /></span>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', fontWeight: 600 }}>{meta.label}</div>
            <h2 style={{ fontSize: 19 }}>{proto.nombre}</h2>
          </div>
          <span className="badge badge-navy" style={{ marginLeft: 6 }}>{proto.set}</span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onCancel} icon="x">Descartar</Button>
          <Button icon="check" disabled={!hasData} onClick={save}>Guardar evaluación</Button>
        </div>
      </div>

      {/* Swimmer selector */}
      <div className="rec-swimmers">
        {activeSwimmers.map(s => {
          const n = (data[s.id].laps || data[s.id].tramos).length;
          return (
            <div key={s.id} className="rec-swim" data-on={active === s.id}>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => { setActive(s.id); setCounter(0); }}>
                <Avatar name={s.nombre} size={30} />
                <span className="rs-name">{s.nombre.split(' ').slice(0, 2).join(' ')}</span>
                <span className="rs-count">{n}</span>
              </button>
              <RemoveSwimmerButton swimmer={s} hasData={n > 0} onRemove={() => removeSwimmer(s.id)} />
            </div>
          );
        })}
      </div>

      {activeSwimmers.length === 0 ? (
        <div className="card"><Empty icon="users" title="No quedan nadadores en esta sesión">Se quitaron todos los nadadores. Descarta la evaluación o vuelve atrás.</Empty></div>
      ) : (
      <div className="rec-body">
        {config.metrica === 'cronometro' ? (
          <>
            <div className="card card-pad rec-stage">
              <div className="clock" data-running={sw.running}>
                <span>{cp.m}</span><span className="sep">:</span><span>{cp.s}</span><span className="cs">.{cp.cs}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 18 }}>
                Cronometrando a <strong style={{ color: 'var(--ink)' }}>{activeSwimmer?.nombre}</strong>
                {target && <span> · objetivo {fmtTime(target)} / {proto.distancia}m</span>}
              </div>
              <div className="rec-controls">
                {!sw.running
                  ? <Button onClick={sw.start} icon="play" className="big-btn">{sw.elapsed > 0 ? 'Continuar' : 'Iniciar'}</Button>
                  : <Button onClick={sw.stop} variant="dark" icon="pause" className="big-btn">Detener</Button>}
                <Button onClick={lap} variant="ghost" icon="flag" className="big-btn" disabled={!sw.running}>Vuelta</Button>
                <Button onClick={lapDNF} variant="ghost" icon="x" className="big-btn" disabled={!sw.running} style={{ color: 'var(--red)' }}>No completó</Button>
                <Button onClick={sw.reset} variant="ghost" icon="reset" className="big-btn">Reiniciar</Button>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><div className="ico"><Icon name="list" /></div><h3>Vueltas de {activeSwimmer?.nombre?.split(' ')[0]}</h3><div style={{ flex: 1 }} />{activeData.laps?.length > 0 && <button className="btn-icon" onClick={undoLap} title="Deshacer última"><Icon name="reset" /></button>}</div>
              {(!activeData.laps || activeData.laps.length === 0) ? <Empty icon="flag" title="Sin vueltas" >Pulsa “Vuelta” para registrar cada tramo.</Empty> : (
                <table className="tbl">
                  <thead><tr><th>#</th><th>Parcial</th><th>Acumulado</th><th>vs objetivo</th><th></th></tr></thead>
                  <tbody>
                    {activeData.laps.map((l, i) => {
                      const acc = activeData.laps.slice(0, i + 1).filter(v => v != null).reduce((a, b) => a + b, 0);
                      const diff = target && l != null ? l - target : null;
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15 }}>{l != null ? fmtTime(l) : <DnfChip small />}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--slate-500)' }}>{fmtTime(acc)}</td>
                          <td>{diff != null ? <span className={`badge badge-${diff <= 0 ? 'green' : 'red'}`}>{diff <= 0 ? '−' : '+'}{Math.abs(diff).toFixed(1)}s</span> : '—'}</td>
                          <td><button className="btn-icon" onClick={() => setEditingLap(i)} title="Editar"><Icon name="edit" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {proto.niveles && activeData.laps && activeData.laps.some(v => v != null) && (
                <div className="card-pad" style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <NivelBadge proto={proto} avgTime={(() => { const vs = activeData.laps.filter(v => v != null); return vs.reduce((a, b) => a + b, 0) / vs.length; })()} />
                </div>
              )}
            </div>
            {editingLap != null && (
              <EditEntryModal title={`Vuelta ${editingLap + 1} · ${activeSwimmer?.nombre?.split(' ')[0]}`}
                fields={[{ key: 'v', type: 'time', label: 'Tiempo', hint: 'Formato m:ss.cc — ej. 1:28.40' }]}
                initial={{ v: activeData.laps[editingLap] }}
                onSave={(out) => editLap(editingLap, out)}
                onDelete={() => deleteLap(editingLap)}
                onClose={() => setEditingLap(null)} />
            )}
          </>
        ) : (
          <>
            <div className="card card-pad rec-stage">
              <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 6 }}>
                {config.metrica === 'brazadas' ? 'Brazadas' : 'Movimientos subacuáticos'} · tramo {activeData.tramos.length + 1}{proto.repeticiones > 1 ? ` de ${proto.repeticiones}` : ''}
              </div>
              <div className="big-counter" style={{ color: meta.color }}>{counter}</div>
              <div className="rec-controls">
                <Button variant="ghost" className="big-btn round" onClick={() => setCounter(c => Math.max(0, c - 1))}>−</Button>
                <Button className="big-btn round" style={{ background: meta.color, color: '#fff' }} onClick={() => setCounter(c => c + 1)}>+</Button>
              </div>
              <div className="rec-controls" style={{ marginTop: 18 }}>
                <Button variant="dark" icon="check" disabled={counter === 0} onClick={registerTramo}>Registrar tramo {activeData.tramos.length + 1}</Button>
                <Button variant="ghost" icon="x" style={{ color: 'var(--red)' }} onClick={registerTramoDNF}>No completó</Button>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><div className="ico"><Icon name="list" /></div><h3>Tramos de {activeSwimmer?.nombre?.split(' ')[0]}</h3><div style={{ flex: 1 }} />{activeData.tramos.length > 0 && <button className="btn-icon" onClick={undoTramo} title="Deshacer"><Icon name="reset" /></button>}</div>
              {activeData.tramos.length === 0 ? <Empty icon="list" title="Sin tramos">Cuenta y registra cada tramo.</Empty> : (
                <div className="card-pad">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px,1fr))', gap: 10 }}>
                    {activeData.tramos.map((t, i) => (
                      <button key={i} onClick={() => setEditingTramo(i)} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
                        <div style={{ fontSize: 10.5, color: 'var(--slate-400)', fontWeight: 700 }}>T{i + 1}</div>
                        {t != null
                          ? <div style={{ fontSize: 22, fontFamily: 'var(--font-head)', fontWeight: 700, color: meta.color }}>{t}</div>
                          : <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--red)' }}>✕</div>}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>
                    {(() => { const vs = activeData.tramos.filter(v => v != null); return vs.length ? <>Promedio: <strong style={{ color: 'var(--ink)' }}>{(vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1)}</strong> · </> : null; })()}
                    Total tramos: {activeData.tramos.length}
                  </div>
                </div>
              )}
            </div>
            {editingTramo != null && (
              <EditEntryModal title={`Tramo ${editingTramo + 1} · ${activeSwimmer?.nombre?.split(' ')[0]}`}
                fields={[{ key: 'v', type: 'count', label: 'Conteo' }]}
                initial={{ v: activeData.tramos[editingTramo] }}
                onSave={(out) => editTramo(editingTramo, out)}
                onDelete={() => deleteTramo(editingTramo)}
                onClose={() => setEditingTramo(null)} />
            )}
          </>
        )}
      </div>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <Field label="Notas de la evaluación" hint="Observaciones técnicas, contexto, recomendaciones.">
          <textarea className="textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del técnico…" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Compound recorder (Salida 15m / Viraje 5-15m) ---------- */
function CompoundRecorder({ config, onSave, onCancel }) {
  const st = useStore();
  const toast = useToast();
  const proto = protoById(config.protocolo);
  const meta = metricMeta('compuesta');
  const swimmers = config.swimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);
  const [removed, setRemoved] = useState(() => new Set());
  const activeSwimmers = swimmers.filter(s => !removed.has(s.id));
  const [active, setActive] = useState(config.swimmerIds[0]);
  const [data, setData] = useState(() => {
    const d = {}; config.swimmerIds.forEach(id => { d[id] = { intentos: [] }; }); return d;
  });
  const [counts, setCounts] = useState(() => { const c = {}; proto.metricas.forEach(m => c[m] = 0); return c; });
  const [notas, setNotas] = useState('');
  const [editingIntento, setEditingIntento] = useState(null); // index
  const sw = useStopwatch();
  const activeSwimmer = swimmers.find(s => s.id === active);
  const activeData = data[active] || { intentos: [] };

  const removeSwimmer = (id) => {
    setRemoved(r => new Set([...r, id]));
    if (active === id) { const next = activeSwimmers.find(s => s.id !== id); if (next) { setActive(next.id); resetEntry(); } }
  };

  const setCount = (m, v) => setCounts(c => ({ ...c, [m]: Math.max(0, v) }));
  const resetEntry = () => { sw.reset(); const c = {}; proto.metricas.forEach(m => c[m] = 0); setCounts(c); };
  const registrar = () => {
    const intento = { tiempo: +sw.elapsed.toFixed(2) };
    proto.metricas.forEach(m => intento[m] = counts[m]);
    setData(d => ({ ...d, [active]: { intentos: [...d[active].intentos, intento] } }));
    resetEntry();
  };
  const registrarDNF = () => {
    const intento = { tiempo: null };
    proto.metricas.forEach(m => intento[m] = null);
    setData(d => ({ ...d, [active]: { intentos: [...d[active].intentos, intento] } }));
    resetEntry();
  };
  const undoIntento = () => setData(d => ({ ...d, [active]: { intentos: d[active].intentos.slice(0, -1) } }));
  const editIntento = (i, patch) => setData(d => { const intentos = [...d[active].intentos]; intentos[i] = { tiempo: patch.tiempo, ...Object.fromEntries(proto.metricas.map(m => [m, patch[m]])) }; return { ...d, [active]: { intentos } }; });
  const deleteIntento = (i) => setData(d => { const intentos = [...d[active].intentos]; intentos.splice(i, 1); return { ...d, [active]: { intentos } }; });

  const hasData = activeSwimmers.some(s => data[s.id].intentos.length > 0);
  const canRegister = sw.elapsed > 0 && !sw.running;

  const save = () => {
    const clean = {};
    activeSwimmers.forEach(s => { clean[s.id] = data[s.id]; });
    DB.addEvaluation({ fecha: todayISO(), protocolo: config.protocolo, metrica: 'compuesta', swimmerIds: activeSwimmers.map(s => s.id), tecnico: st.coach.nombre, notas, data: clean });
    toast('Evaluación guardada'); onSave();
  };

  const cp = clockParts(sw.elapsed);

  return (
    <div>
      <div className="rec-head card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="mp-ico" style={{ background: meta.color + '1a', color: meta.color, width: 44, height: 44 }}><Icon name="timer" /></span>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', fontWeight: 600 }}>Prueba compuesta · tiempo + conteos</div>
            <h2 style={{ fontSize: 19 }}>{proto.nombre}</h2>
          </div>
          <span className="badge badge-navy" style={{ marginLeft: 6 }}>{proto.set}</span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onCancel} icon="x">Descartar</Button>
          <Button icon="check" disabled={!hasData} onClick={save}>Guardar evaluación</Button>
        </div>
      </div>

      <div className="rec-swimmers">
        {activeSwimmers.map(s => (
          <div key={s.id} className="rec-swim" data-on={active === s.id}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => { setActive(s.id); resetEntry(); }}>
              <Avatar name={s.nombre} size={30} />
              <span className="rs-name">{s.nombre.split(' ').slice(0, 2).join(' ')}</span>
              <span className="rs-count">{data[s.id].intentos.length}</span>
            </button>
            <RemoveSwimmerButton swimmer={s} hasData={data[s.id].intentos.length > 0} onRemove={() => removeSwimmer(s.id)} />
          </div>
        ))}
      </div>

      {activeSwimmers.length === 0 ? (
        <div className="card"><Empty icon="users" title="No quedan nadadores en esta sesión">Se quitaron todos los nadadores. Descarta la evaluación o vuelve atrás.</Empty></div>
      ) : (
      <div className="rec-body">
        <div className="card card-pad rec-stage">
          <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 4 }}>{proto.tiempoLabel}</div>
          <div className="clock" data-running={sw.running} style={{ fontSize: 58 }}>
            <span>{cp.m}</span><span className="sep">:</span><span>{cp.s}</span><span className="cs" style={{ fontSize: 30 }}>.{cp.cs}</span>
          </div>
          <div className="rec-controls" style={{ marginBottom: 22 }}>
            {!sw.running
              ? <Button onClick={sw.start} icon="play" className="big-btn">{sw.elapsed > 0 ? 'Continuar' : 'Iniciar'}</Button>
              : <Button onClick={sw.stop} variant="dark" icon="pause" className="big-btn">Detener</Button>}
            <Button onClick={sw.reset} variant="ghost" icon="reset" className="big-btn">Reiniciar</Button>
          </div>
          <div className="comp-counters">
            {proto.metricas.map(m => {
              const mm = DB.METRIC_TYPES[m];
              return (
                <div key={m} className="comp-counter">
                  <div className="comp-counter-label" style={{ color: mm.color }}>{mm.label}</div>
                  <div className="comp-counter-num" style={{ color: mm.color }}>{counts[m]}</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button className="comp-btn" onClick={() => setCount(m, counts[m] - 1)}>−</button>
                    <button className="comp-btn" style={{ background: mm.color, color: '#fff', borderColor: mm.color }} onClick={() => setCount(m, counts[m] + 1)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rec-controls" style={{ marginTop: 20 }}>
            <Button variant="dark" icon="check" disabled={!canRegister} onClick={registrar}>
              Registrar intento {activeData.intentos.length + 1}
            </Button>
            <Button variant="ghost" icon="x" style={{ color: 'var(--red)' }} onClick={registrarDNF}>No completó</Button>
          </div>
          {sw.running && <div style={{ fontSize: 12, color: 'var(--slate-400)', marginTop: 8 }}>Detén el cronómetro para registrar el intento</div>}
        </div>

        <div className="card">
          <div className="card-head"><div className="ico"><Icon name="list" /></div><h3>Intentos de {activeSwimmer?.nombre?.split(' ')[0]}</h3><div style={{ flex: 1 }} />{activeData.intentos.length > 0 && <button className="btn-icon" onClick={undoIntento} title="Deshacer"><Icon name="reset" /></button>}</div>
          {activeData.intentos.length === 0 ? <Empty icon="timer" title="Sin intentos">Cronometra el tiempo y cuenta, luego registra el intento.</Empty> : (
            <table className="tbl">
              <thead><tr><th>#</th><th>Tiempo</th>{proto.metricas.map(m => <th key={m}>{DB.METRIC_TYPES[m].label}</th>)}<th></th></tr></thead>
              <tbody>
                {activeData.intentos.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15 }}>{it.tiempo != null ? fmtTime(it.tiempo) : <DnfChip small />}</td>
                    {proto.metricas.map(m => <td key={m} style={{ fontWeight: 700, color: DB.METRIC_TYPES[m].color }}>{it[m] != null ? it[m] : '—'}</td>)}
                    <td><button className="btn-icon" onClick={() => setEditingIntento(i)} title="Editar"><Icon name="edit" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {editingIntento != null && (
          <EditEntryModal title={`Intento ${editingIntento + 1} · ${activeSwimmer?.nombre?.split(' ')[0]}`}
            fields={[{ key: 'tiempo', type: 'time', label: proto.tiempoLabel, hint: 'Formato m:ss.cc' }, ...proto.metricas.map(m => ({ key: m, type: 'count', label: DB.METRIC_TYPES[m].label }))]}
            initial={activeData.intentos[editingIntento]}
            onSave={(out) => editIntento(editingIntento, out)}
            onDelete={() => deleteIntento(editingIntento)}
            onClose={() => setEditingIntento(null)} />
        )}
      </div>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <Field label="Notas de la evaluación" hint="Observaciones técnicas, contexto, recomendaciones.">
          <textarea className="textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del técnico…" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Multi-swimmer recorder (simultaneous, one clock, por rondas) ---------- */
function MultiRecorder({ config, onSave, onCancel }) {
  const st = useStore();
  const toast = useToast();
  const proto = protoById(config.protocolo);
  const meta = metricMeta('cronometro');
  const swimmers = config.swimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);
  const [removed, setRemoved] = useState(() => new Set());
  const activeSwimmers = swimmers.filter(s => !removed.has(s.id));
  const [data, setData] = useState(() => { const d = {}; config.swimmerIds.forEach(id => { d[id] = { laps: [] }; }); return d; });
  const [offsets, setOffsets] = useState(() => { const o = {}; config.swimmerIds.forEach(id => { o[id] = 0; }); return o; });
  const [rests, setRests] = useState([]);          // general rest durations between rondas
  const [round, setRound] = useState(0);           // current ronda number (0 = not started)
  const [phase, setPhase] = useState('idle');      // idle | nado | descanso
  const [tapped, setTapped] = useState({});        // which swimmers recorded this ronda
  const [notas, setNotas] = useState('');
  const [editingLap, setEditingLap] = useState(null); // { id, index }
  const sw = useStopwatch();
  const reps = proto.repeticiones;
  const target = proto.ciclo || null;
  const OFFSETS = [0, 5, 10, 15, 20, 25, 30];
  const corr = (raw, id) => raw == null ? null : Math.max(0, +(raw - (offsets[id] || 0)).toFixed(2)); // corrected for stagger
  const uncorr = (val, id) => val == null ? null : +(val + (offsets[id] || 0)).toFixed(2);
  const setOffset = (id, v) => setOffsets(o => ({ ...o, [id]: v }));
  const removeSwimmer = (id) => setRemoved(r => new Set([...r, id]));

  // Start a new nado ronda — clock always restarts from 0
  const iniciarRonda = () => {
    if (phase === 'descanso') setRests(r => [...r, +sw.elapsed.toFixed(2)]); // close rest
    sw.reset(); sw.start();
    setRound(r => r + 1);
    setTapped({});
    setPhase('nado');
  };
  // Switch everyone to a general rest — clock restarts from 0 and times the rest
  const descansar = () => { sw.reset(); sw.start(); setPhase('descanso'); };
  const finalizar = () => {
    if (phase === 'descanso') setRests(r => [...r, +sw.elapsed.toFixed(2)]);
    sw.stop(); setPhase('idle');
  };

  const tap = (id) => {
    if (phase !== 'nado' || tapped[id]) return;
    if (data[id].laps.length >= reps) return;
    const t = +sw.elapsed.toFixed(2);
    setData(d => ({ ...d, [id]: { laps: [...d[id].laps, t] } }));
    setTapped(tp => ({ ...tp, [id]: true }));
  };
  const tapDNF = (id) => {
    if (phase !== 'nado' || tapped[id]) return;
    if (data[id].laps.length >= reps) return;
    setData(d => ({ ...d, [id]: { laps: [...d[id].laps, null] } }));
    setTapped(tp => ({ ...tp, [id]: true }));
  };
  const undo = (id) => {
    setData(d => ({ ...d, [id]: { laps: d[id].laps.slice(0, -1) } }));
    setTapped(tp => { const n = { ...tp }; delete n[id]; return n; });
  };
  const editLap = (id, i, correctedVal) => setData(d => { const laps = [...d[id].laps]; laps[i] = uncorr(correctedVal, id); return { ...d, [id]: { laps } }; });
  const deleteLap = (id, i) => setData(d => { const laps = [...d[id].laps]; laps.splice(i, 1); return { ...d, [id]: { laps } }; });

  const totalLaps = activeSwimmers.reduce((n, s) => n + data[s.id].laps.length, 0);
  const allDone = activeSwimmers.length > 0 && activeSwimmers.every(s => data[s.id].laps.length >= reps);
  const hasData = totalLaps > 0;
  const allTapped = activeSwimmers.length > 0 && activeSwimmers.every(s => tapped[s.id] || data[s.id].laps.length >= reps);

  const save = () => {
    const clean = {};
    activeSwimmers.forEach(s => { const laps = data[s.id].laps.map(r => corr(r, s.id)); clean[s.id] = { laps, total: +laps.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(2) }; });
    DB.addEvaluation({ fecha: todayISO(), protocolo: config.protocolo, metrica: 'cronometro', swimmerIds: activeSwimmers.map(s => s.id), tecnico: st.coach.nombre, notas, data: clean, modo: 'simultaneo', descansos: rests, desfases: offsets });
    toast('Evaluación guardada'); onSave();
  };

  const cp = clockParts(sw.elapsed);
  const isRest = phase === 'descanso';
  const phaseLabel = phase === 'nado' ? `Nado · ronda ${round}${reps > 1 ? ` de ${reps}` : ''}` : isRest ? 'Descanso general' : round === 0 ? 'Listo para iniciar' : 'En pausa';

  return (
    <div>
      <div className="rec-head card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="mp-ico" style={{ background: '#1FA9711a', color: '#1FA971', width: 44, height: 44 }}><Icon name="users" /></span>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', fontWeight: 600 }}>Cronómetro simultáneo · {activeSwimmers.length} nadadores</div>
            <h2 style={{ fontSize: 19 }}>{proto.nombre}</h2>
          </div>
          <span className="badge badge-navy" style={{ marginLeft: 6 }}>{proto.set}</span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onCancel} icon="x">Descartar</Button>
          <Button icon="check" disabled={!hasData} onClick={save}>Guardar evaluación</Button>
        </div>
      </div>

      <div className="card card-pad rec-stage" style={{ marginBottom: 18 }}>
        <div className="phase-pill" style={{ background: isRest ? 'var(--amber-bg)' : phase === 'nado' ? 'var(--cyan-050)' : 'var(--line-soft)', color: isRest ? '#97681a' : phase === 'nado' ? 'var(--cyan-700)' : 'var(--slate-500)' }}>
          {(phase === 'nado' || isRest) && <span className="ph-dot" style={{ background: isRest ? 'var(--amber)' : 'var(--cyan-700)' }} />}{phaseLabel}
        </div>
        <div className="clock" data-running={sw.running} style={{ color: isRest ? 'var(--amber)' : undefined }}>
          <span>{cp.m}</span><span className="sep">:</span><span>{cp.s}</span><span className="cs">.{cp.cs}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 18 }}>
          {isRest ? <span>Descanso para todos — al iniciar la siguiente ronda el cronómetro vuelve a 0</span>
            : reps > 1 ? <span>Cada nadador registra hasta {reps} vueltas{target && <span> · objetivo {fmtTime(target)} / {proto.distancia}m</span>}</span>
            : <span>Toca la tarjeta de cada nadador cuando llega a la pared</span>}
        </div>
        <div className="rec-controls">
          {phase === 'idle' && <Button onClick={iniciarRonda} icon="play" className="big-btn" disabled={allDone}>{round === 0 ? 'Iniciar ronda 1' : `Iniciar ronda ${round + 1}`}</Button>}
          {phase === 'nado' && <>
            <Button onClick={descansar} icon="pause" className="big-btn" style={{ background: 'var(--amber)', color: '#fff' }}>Descansar</Button>
            <Button onClick={finalizar} variant="ghost" icon="check" className="big-btn">Finalizar</Button>
          </>}
          {isRest && <>
            <Button onClick={iniciarRonda} icon="play" className="big-btn" disabled={allDone}>Iniciar ronda {round + 1}</Button>
            <Button onClick={finalizar} variant="ghost" icon="check" className="big-btn">Finalizar</Button>
          </>}
        </div>
        {phase === 'nado' && allTapped && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--cyan-700)' }}>Todos registrados en esta ronda — pulsa “Descansar” o “Finalizar”</div>}
        {allDone && hasData && <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✓ Todos los nadadores completaron la serie</div>}
        {rests.length > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--slate-400)', fontWeight: 600 }}>Descansos: {rests.map(r => fmtTime(r)).join(' · ')}</div>}
      </div>

      <div className="multi-grid">
        {activeSwimmers.map(s => {
          const laps = data[s.id].laps;
          const done = laps.length >= reps;
          const off = offsets[s.id] || 0;
          const lapsC = laps.map(r => corr(r, s.id));
          const last = laps.length > 0 ? lapsC[lapsC.length - 1] : undefined;
          const isTapped = !!tapped[s.id];
          const armed = phase === 'nado' && !done && !isTapped;
          const diff = target && last != null ? last - target : null;
          return (
            <div key={s.id} className="multi-card" data-done={done} data-armed={armed} data-tapped={isTapped}>
              <button className="mc-tap" onClick={() => tap(s.id)} disabled={!armed} aria-label={`Registrar vuelta de ${s.nombre}`} />
              <div className="mc-head">
                <Avatar name={s.nombre} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mc-name">{s.nombre.split(' ').slice(0, 2).join(' ')}</div>
                  <div className="mc-cat">{DB.categoryFor(s.fechaNacimiento)}</div>
                </div>
                {armed && <button className="btn-icon" style={{ position: 'relative', zIndex: 2, color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); tapDNF(s.id); }} title="Marcar no completado"><Icon name="x" /></button>}
                {laps.length > 0 && <button className="btn-icon" style={{ position: 'relative', zIndex: 2 }} onClick={(e) => { e.stopPropagation(); undo(s.id); }} title="Deshacer última"><Icon name="reset" /></button>}
                <RemoveSwimmerButton swimmer={s} hasData={laps.length > 0} onRemove={() => removeSwimmer(s.id)} />
              </div>
              <div className="mc-off" onClick={(e) => e.stopPropagation()}>
                <span className="mc-off-label">Desfase salida</span>
                <div className="mc-off-chips">
                  {OFFSETS.map(o => (
                    <button key={o} className={`mc-off-chip ${off === o ? 'on' : ''}`} onClick={() => setOffset(s.id, o)}>{o === 0 ? '0' : `−${o}`}</button>
                  ))}
                </div>
              </div>
              <div className="mc-time" style={{ color: last == null ? 'var(--red)' : isTapped ? 'var(--green)' : undefined }}>{last === undefined ? '0:00.00' : last == null ? '✕' : fmtTime(last)}</div>
              <div className="mc-sub">
                {done ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Completado</span>
                  : isTapped ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>✓ Registrado · ronda {round}</span>
                  : armed ? <span style={{ color: 'var(--cyan-700)', fontWeight: 700 }}>Toca al llegar</span>
                  : <span>{phase === 'nado' ? 'Nadando…' : 'En espera'}</span>}
                {off > 0 && <span className="badge badge-amber" title="Corrige el desfase de salida">−{off}s</span>}
                {diff != null && <span className={`badge badge-${diff <= 0 ? 'green' : 'red'}`} style={{ marginLeft: 'auto' }}>{diff <= 0 ? '−' : '+'}{Math.abs(diff).toFixed(1)}s</span>}
                {reps > 1 && <span className="mc-prog">{laps.length}/{reps}</span>}
              </div>
              {reps > 1 && laps.length > 0 && (
                <div className="mc-laps">
                  {lapsC.map((l, i) => (
                    <button key={i} className="mc-lap" style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2, cursor: 'pointer', border: 'none', color: l == null ? 'var(--red)' : undefined, fontWeight: l == null ? 800 : undefined }}
                      onClick={(e) => { e.stopPropagation(); setEditingLap({ id: s.id, index: i }); }}>
                      {l == null ? '✕' : fmtTime(l)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editingLap && (
        <EditEntryModal title={`Vuelta ${editingLap.index + 1} · ${swimmers.find(s => s.id === editingLap.id)?.nombre?.split(' ')[0]}`}
          fields={[{ key: 'v', type: 'time', label: 'Tiempo', hint: 'Formato m:ss.cc — ej. 1:28.40' }]}
          initial={{ v: corr(data[editingLap.id].laps[editingLap.index], editingLap.id) }}
          onSave={(out) => editLap(editingLap.id, editingLap.index, out.v)}
          onDelete={() => deleteLap(editingLap.id, editingLap.index)}
          onClose={() => setEditingLap(null)} />
      )}
      <div className="multi-hint">
        {phase === 'nado' ? 'Toca la tarjeta de cada nadador en el momento exacto en que toca la pared.'
          : isRest ? 'Descanso general en curso. Inicia la siguiente ronda cuando estén listos.'
          : 'Inicia la ronda para empezar a registrar. Cada ronda el cronómetro parte de 0.'}
      </div>

      {reps > 1 && hasData && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head"><div className="ico"><Icon name="list" /></div><h3>Resumen por nadador</h3></div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeSwimmers.filter(s => data[s.id].laps.length > 0).map(s => (
              <div key={s.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><Avatar name={s.nombre} size={28} /><strong style={{ fontSize: 14 }}>{s.nombre.split(' ').slice(0, 2).join(' ')}</strong>{(offsets[s.id] || 0) > 0 && <span className="badge badge-amber">−{offsets[s.id]}s salida</span>}<span className="badge badge-cyan" style={{ marginLeft: 'auto' }}>Total {fmtTime(data[s.id].laps.map(r => corr(r, s.id)).filter(v => v != null).reduce((a, b) => a + b, 0))}</span></div>
                <SeriesSummary reps={data[s.id].laps.map(r => ({ nado: corr(r, s.id) }))} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <Field label="Notas de la evaluación" hint="Observaciones técnicas, contexto, recomendaciones.">
          <textarea className="textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del técnico…" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Interval recorder (series: tiempo de nado + descanso) ---------- */
function IntervalRecorder({ config, onSave, onCancel }) {
  const st = useStore();
  const toast = useToast();
  const proto = protoById(config.protocolo);
  const meta = metricMeta('cronometro');
  const swimmers = config.swimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);
  const [removed, setRemoved] = useState(() => new Set());
  const activeSwimmers = swimmers.filter(s => !removed.has(s.id));
  const [active, setActive] = useState(config.swimmerIds[0]);
  const [data, setData] = useState(() => { const d = {}; config.swimmerIds.forEach(id => { d[id] = { reps: [] }; }); return d; });
  const [phase, setPhase] = useState('idle'); // idle | nado | descanso | done
  const [notas, setNotas] = useState('');
  const [editingRep, setEditingRep] = useState(null); // index
  const sw = useStopwatch();
  const activeSwimmer = swimmers.find(s => s.id === active);
  const reps = data[active]?.reps || [];
  const ciclo = proto.ciclo || null;

  const switchTo = (id) => {
    setActive(id); sw.reset();
    const r = data[id]?.reps || [];
    setPhase(r.length >= proto.repeticiones ? 'done' : 'idle');
  };
  const removeSwimmer = (id) => {
    setRemoved(r => new Set([...r, id]));
    if (active === id) { const next = activeSwimmers.find(s => s.id !== id); if (next) switchTo(next.id); }
  };

  // idle -> nado
  const iniciar = () => { sw.reset(); sw.start(); setPhase('nado'); };
  // nado -> descanso (or done on last rep)
  const llegada = () => {
    const nado = +sw.elapsed.toFixed(2);
    const nextReps = [...reps, { nado, descanso: null }];
    setData(d => ({ ...d, [active]: { reps: nextReps } }));
    if (nextReps.length >= proto.repeticiones) { sw.stop(); setPhase('done'); }
    else { sw.reset(); sw.start(); setPhase('descanso'); }
  };
  // nado -> descanso (or done), marking the rep as not completed
  const llegadaDNF = () => {
    const nextReps = [...reps, { nado: null, descanso: null }];
    setData(d => ({ ...d, [active]: { reps: nextReps } }));
    if (nextReps.length >= proto.repeticiones) { sw.stop(); setPhase('done'); }
    else { sw.reset(); sw.start(); setPhase('descanso'); }
  };
  // descanso -> nado (record rest on last rep, start next)
  const salida = () => {
    const desc = +sw.elapsed.toFixed(2);
    setData(d => {
      const r = [...d[active].reps]; r[r.length - 1] = { ...r[r.length - 1], descanso: desc };
      return { ...d, [active]: { reps: r } };
    });
    sw.reset(); sw.start(); setPhase('nado');
  };
  const finalizar = () => { sw.stop(); setPhase('done'); };
  const reiniciarSerie = () => { setData(d => ({ ...d, [active]: { reps: [] } })); sw.reset(); setPhase('idle'); };
  const editRep = (i, patch) => setData(d => { const r = [...d[active].reps]; r[i] = { nado: patch.nado, descanso: patch.descanso }; return { ...d, [active]: { reps: r } }; });
  const deleteRep = (i) => setData(d => { const r = [...d[active].reps]; r.splice(i, 1); return { ...d, [active]: { reps: r } }; });

  const hasData = activeSwimmers.some(s => data[s.id].reps.length > 0);
  const save = () => {
    const clean = {};
    activeSwimmers.forEach(s => {
      const r = data[s.id].reps;
      clean[s.id] = { reps: r, totalNado: +r.reduce((a, b) => a + (b.nado || 0), 0).toFixed(2), totalCiclo: +r.reduce((a, b) => a + (b.nado || 0) + (b.descanso || 0), 0).toFixed(2) };
    });
    DB.addEvaluation({ fecha: todayISO(), protocolo: config.protocolo, metrica: 'cronometro', swimmerIds: activeSwimmers.map(s => s.id), tecnico: st.coach.nombre, notas, data: clean });
    toast('Evaluación guardada'); onSave();
  };

  const cp = clockParts(sw.elapsed);
  const repNum = phase === 'nado' ? reps.length + 1 : phase === 'descanso' ? reps.length : reps.length;
  const phaseLabel = phase === 'nado' ? 'Nadando' : phase === 'descanso' ? 'Descanso' : phase === 'done' ? 'Serie completa' : 'Listo para iniciar';
  const phaseColor = phase === 'descanso' ? 'var(--amber)' : 'var(--cyan-700)';
  const nadosOk = reps.filter(r => r.nado != null);
  const totalNado = nadosOk.reduce((a, b) => a + b.nado, 0);

  return (
    <div>
      <div className="rec-head card card-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="mp-ico" style={{ background: meta.color + '1a', color: meta.color, width: 44, height: 44 }}><Icon name="timer" /></span>
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)', fontWeight: 600 }}>Cronómetro de serie · nado + descanso</div>
            <h2 style={{ fontSize: 19 }}>{proto.nombre}</h2>
          </div>
          <span className="badge badge-navy" style={{ marginLeft: 6 }}>{proto.set}</span>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onCancel} icon="x">Descartar</Button>
          <Button icon="check" disabled={!hasData} onClick={save}>Guardar evaluación</Button>
        </div>
      </div>

      <div className="rec-swimmers">
        {activeSwimmers.map(s => (
          <div key={s.id} className="rec-swim" data-on={active === s.id}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }} onClick={() => switchTo(s.id)}>
              <Avatar name={s.nombre} size={30} />
              <span className="rs-name">{s.nombre.split(' ').slice(0, 2).join(' ')}</span>
              <span className="rs-count">{data[s.id].reps.length}/{proto.repeticiones}</span>
            </button>
            <RemoveSwimmerButton swimmer={s} hasData={data[s.id].reps.length > 0} onRemove={() => removeSwimmer(s.id)} />
          </div>
        ))}
      </div>

      {activeSwimmers.length === 0 ? (
        <div className="card"><Empty icon="users" title="No quedan nadadores en esta sesión">Se quitaron todos los nadadores. Descarta la evaluación o vuelve atrás.</Empty></div>
      ) : (
      <div className="rec-body">
        <div className="card card-pad rec-stage">
          <div className="phase-pill" style={{ background: phase === 'descanso' ? 'var(--amber-bg)' : phase === 'done' ? 'var(--green-bg)' : 'var(--cyan-050)', color: phase === 'descanso' ? '#97681a' : phase === 'done' ? '#137a4f' : 'var(--cyan-700)' }}>
            {phase !== 'done' && phase !== 'idle' && <span className="ph-dot" style={{ background: phaseColor }} />}{phaseLabel}
            {(phase === 'nado' || phase === 'descanso') && <strong style={{ marginLeft: 4 }}>· Rep {repNum} de {proto.repeticiones}</strong>}
          </div>
          <div className="clock" data-running={sw.running} style={{ color: phase === 'descanso' ? 'var(--amber)' : undefined }}>
            <span>{cp.m}</span><span className="sep">:</span><span>{cp.s}</span><span className="cs">.{cp.cs}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, marginBottom: 18 }}>
            Cronometrando a <strong style={{ color: 'var(--ink)' }}>{activeSwimmer?.nombre}</strong>{ciclo && <span> · salida cada {fmtTime(ciclo)}</span>}{!ciclo && proto.pausa > 0 && <span> · descanso {proto.pausa} seg</span>}{proto.lapDistancia && <span> · vuelta cada {proto.lapDistancia}m</span>}
          </div>
          <div className="rec-controls">
            {phase === 'idle' && <Button onClick={iniciar} icon="play" className="big-btn">Iniciar serie</Button>}
            {phase === 'nado' && <>
              <Button onClick={llegada} variant="dark" icon="flag" className="big-btn">Llegada (fin nado)</Button>
              <Button onClick={llegadaDNF} variant="ghost" icon="x" className="big-btn" style={{ color: 'var(--red)' }}>No completó</Button>
            </>}
            {phase === 'descanso' && <>
              <Button onClick={salida} icon="play" className="big-btn">Salida (siguiente)</Button>
              <Button onClick={finalizar} variant="ghost" icon="pause" className="big-btn">Finalizar serie</Button>
            </>}
            {phase === 'done' && <Button onClick={reiniciarSerie} variant="ghost" icon="reset" className="big-btn">Reiniciar serie</Button>}
          </div>
          {reps.length > 0 && (
            <div style={{ marginTop: 18, display: 'flex', gap: 14, fontSize: 13, color: 'var(--slate-500)', fontWeight: 600, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span>Nado total <strong style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(totalNado)}</strong></span>
              <span>Reps <strong style={{ color: 'var(--ink)' }}>{reps.length}/{proto.repeticiones}</strong></span>
              {proto.niveles && nadosOk.length > 0 && <NivelBadge proto={proto} avgTime={totalNado / nadosOk.length} size="sm" />}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><div className="ico"><Icon name="list" /></div><h3>Serie de {activeSwimmer?.nombre?.split(' ')[0]}</h3></div>
          {reps.length === 0 ? <Empty icon="timer" title="Sin repeticiones">Inicia la serie: cronometra el nado, marca la llegada y la salida.</Empty> : (
            <table className="tbl">
              <thead><tr><th>#</th><th>Nado</th><th>Descanso</th><th>Ciclo</th>{ciclo && <th>vs salida</th>}<th></th></tr></thead>
              <tbody>
                {reps.map((r, i) => {
                  const cic = (r.nado || 0) + (r.descanso || 0);
                  const diff = ciclo && r.nado != null && r.descanso != null ? cic - ciclo : null;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15, color: 'var(--cyan-700)' }}>{r.nado != null ? fmtTime(r.nado) : <DnfChip small />}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: r.descanso != null ? 'var(--amber)' : 'var(--slate-300)', fontWeight: 700 }}>{r.descanso != null ? fmtTime(r.descanso) : '—'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--slate-500)' }}>{r.nado != null && r.descanso != null ? fmtTime(cic) : '—'}</td>
                      {ciclo && <td>{diff != null ? <span className={`badge badge-${diff <= 0 ? 'green' : 'red'}`}>{diff <= 0 ? '−' : '+'}{Math.abs(diff).toFixed(1)}s</span> : '—'}</td>}
                      <td><button className="btn-icon" onClick={() => setEditingRep(i)} title="Editar"><Icon name="edit" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {reps.length > 0 && (
            <div className="card-pad" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>Resumen de la serie</div>
              <SeriesSummary reps={reps} proto={proto} />
            </div>
          )}
        </div>
        {editingRep != null && (
          <EditEntryModal title={`Repetición ${editingRep + 1} · ${activeSwimmer?.nombre?.split(' ')[0]}`}
            fields={[{ key: 'nado', type: 'time', label: 'Nado', hint: 'Formato m:ss.cc' }, { key: 'descanso', type: 'time', label: 'Descanso', hint: 'Opcional · m:ss.cc' }]}
            initial={reps[editingRep]}
            onSave={(out) => editRep(editingRep, out)}
            onDelete={() => deleteRep(editingRep)}
            onClose={() => setEditingRep(null)} />
        )}
      </div>
      )}

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <Field label="Notas de la evaluación" hint="Observaciones técnicas, contexto, recomendaciones.">
          <textarea className="textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del técnico…" />
        </Field>
      </div>
    </div>
  );
}

/* ---------- Evaluation detail ---------- */
function EvalDetail({ ev, onClose }) {
  const st = useStore();
  const toast = useToast();
  const proto = protoById(ev.protocolo); const meta = metricMeta(ev.metrica);
  const [editMode, setEditMode] = useState(false);
  const [wData, setWData] = useState(ev.data);
  const [wSwimmerIds, setWSwimmerIds] = useState(ev.swimmerIds);
  const [wNotas, setWNotas] = useState(ev.notas || '');
  const [editingEntry, setEditingEntry] = useState(null); // { swimmerId, kind, index }
  const [removingSwimmer, setRemovingSwimmer] = useState(null);
  const swimmers = wSwimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);

  const recalc = (id, patch) => setWData(d => {
    const cur = { ...(d[id] || {}), ...patch };
    if (cur.laps) cur.total = +cur.laps.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(2);
    if (cur.reps) {
      cur.totalNado = +cur.reps.reduce((a, b) => a + (b.nado || 0), 0).toFixed(2);
      cur.totalCiclo = +cur.reps.reduce((a, b) => a + (b.nado || 0) + (b.descanso || 0), 0).toFixed(2);
    }
    return { ...d, [id]: cur };
  });
  const removeSwimmer = (id) => { setWSwimmerIds(ids => ids.filter(x => x !== id)); setRemovingSwimmer(null); };
  const save = () => {
    DB.updateEvaluation(ev.id, { data: wData, swimmerIds: wSwimmerIds, notas: wNotas });
    toast('Evaluación actualizada');
    setEditMode(false);
  };

  return (
    <Modal title={`${meta.label} · ${proto.nombre}`} sub={`${fmtDateLong(ev.fecha)} · ${ev.tecnico}`} onClose={onClose} maxWidth={680}
      foot={editMode ? <>
        <Button variant="ghost" onClick={() => { setWData(ev.data); setWSwimmerIds(ev.swimmerIds); setWNotas(ev.notas || ''); setEditMode(false); }}>Cancelar</Button>
        <Button icon="check" onClick={save}>Guardar cambios</Button>
      </> : null}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="badge badge-navy">{proto.set}</span>
        {ev.manual && <span className="badge badge-amber">Registro manual</span>}
        <div style={{ flex: 1 }} />
        {!editMode && <Button variant="ghost" size="sm" icon="edit" onClick={() => setEditMode(true)}>Editar</Button>}
      </div>
      {swimmers.map(s => {
        const d = wData[s.id] || {};
        return (
          <div key={s.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Avatar name={s.nombre} size={30} /><strong style={{ fontSize: 14.5 }}>{s.nombre}</strong>
              {ev.metrica === 'cronometro' && d.total != null && <span className="badge badge-cyan">Total {fmtTime(d.total)}</span>}
              {ev.metrica === 'cronometro' && d.totalNado != null && <span className="badge badge-cyan">Nado {fmtTime(d.totalNado)}</span>}
              {editMode && <button className="btn-icon" style={{ marginLeft: 'auto', color: 'var(--red)' }} onClick={() => setRemovingSwimmer(s)} title="Quitar de esta evaluación"><Icon name="trash" /></button>}
            </div>
            {ev.metrica === 'cronometro' ? (
              d.reps ? (
                <React.Fragment>
                <table className="tbl" style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)' }}>
                  <thead><tr><th>#</th><th>Nado</th><th>Descanso</th><th>Ciclo</th>{editMode && <th></th>}</tr></thead>
                  <tbody>
                    {d.reps.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--cyan-700)' }}>{r.nado != null ? fmtTime(r.nado) : <DnfChip small />}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: r.descanso != null ? 'var(--amber)' : 'var(--slate-300)' }}>{r.descanso != null ? fmtTime(r.descanso) : '—'}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--slate-500)' }}>{r.nado != null && r.descanso != null ? fmtTime((r.nado || 0) + r.descanso) : '—'}</td>
                        {editMode && <td><button className="btn-icon" onClick={() => setEditingEntry({ swimmerId: s.id, kind: 'reps', index: i })} title="Editar"><Icon name="edit" /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ marginTop: 12 }}><SeriesSummary reps={d.reps} compact proto={proto} /></div>
                </React.Fragment>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(d.laps || []).map((l, i) => (
                      editMode
                        ? <button key={i} className="lap-chip" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setEditingEntry({ swimmerId: s.id, kind: 'laps', index: i })}>{i + 1}<b style={{ color: l == null ? 'var(--red)' : undefined }}>{l == null ? '✕' : fmtTime(l)}</b></button>
                        : <span key={i} className="lap-chip">{i + 1}<b style={{ color: l == null ? 'var(--red)' : undefined }}>{l == null ? '✕' : fmtTime(l)}</b></span>
                    ))}
                  </div>
                  {proto.niveles && d.laps && d.laps.some(v => v != null) && (
                    <div style={{ marginTop: 10 }}>
                      <NivelBadge proto={proto} avgTime={(() => { const vs = d.laps.filter(v => v != null); return vs.reduce((a, b) => a + b, 0) / vs.length; })()} size="sm" />
                    </div>
                  )}
                </>
              )
            ) : ev.metrica === 'compuesta' ? (
              (d.intentos || []).length === 0 ? <span className="rp-empty" style={{ fontSize: 12.5 }}>Sin intentos</span> : (
                <table className="tbl" style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)' }}>
                  <thead><tr><th>#</th><th>Tiempo</th>{proto.metricas.map(m => <th key={m}>{DB.METRIC_TYPES[m].label}</th>)}{editMode && <th></th>}</tr></thead>
                  <tbody>
                    {d.intentos.map((it, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{it.tiempo != null ? fmtTime(it.tiempo) : <DnfChip small />}</td>
                        {proto.metricas.map(m => <td key={m} style={{ fontWeight: 700, color: DB.METRIC_TYPES[m].color }}>{it[m] != null ? it[m] : '—'}</td>)}
                        {editMode && <td><button className="btn-icon" onClick={() => setEditingEntry({ swimmerId: s.id, kind: 'intentos', index: i })} title="Editar"><Icon name="edit" /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(d.tramos || []).map((t, i) => (
                  editMode
                    ? <button key={i} className="lap-chip" style={{ cursor: 'pointer', border: 'none' }} onClick={() => setEditingEntry({ swimmerId: s.id, kind: 'tramos', index: i })}>T{i + 1}<b style={{ color: t == null ? 'var(--red)' : undefined }}>{t == null ? '✕' : t}</b></button>
                    : <span key={i} className="lap-chip">T{i + 1}<b style={{ color: t == null ? 'var(--red)' : undefined }}>{t == null ? '✕' : t}</b></span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {editMode ? (
        <div style={{ marginTop: 8 }}>
          <Field label="Notas de la evaluación">
            <textarea className="textarea" value={wNotas} onChange={e => setWNotas(e.target.value)} placeholder="Observaciones del técnico…" />
          </Field>
        </div>
      ) : (
        wNotas && <div style={{ marginTop: 8, padding: 14, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 13.5, color: 'var(--slate-700)', lineHeight: 1.55 }}><strong style={{ color: 'var(--ink)' }}>Notas: </strong>{wNotas}</div>
      )}

      {editingEntry && (() => {
        const { swimmerId, kind, index } = editingEntry;
        const d = wData[swimmerId] || {};
        const swName = st.swimmers.find(x => x.id === swimmerId)?.nombre?.split(' ')[0];
        if (kind === 'reps') {
          return (
            <EditEntryModal title={`Repetición ${index + 1} · ${swName}`}
              fields={[{ key: 'nado', type: 'time', label: 'Nado', hint: 'Formato m:ss.cc' }, { key: 'descanso', type: 'time', label: 'Descanso', hint: 'Opcional · m:ss.cc' }]}
              initial={d.reps[index]}
              onSave={(out) => { const reps = [...d.reps]; reps[index] = out; recalc(swimmerId, { reps }); }}
              onDelete={() => { const reps = [...d.reps]; reps.splice(index, 1); recalc(swimmerId, { reps }); }}
              onClose={() => setEditingEntry(null)} />
          );
        }
        if (kind === 'laps') {
          return (
            <EditEntryModal title={`Vuelta ${index + 1} · ${swName}`}
              fields={[{ key: 'v', type: 'time', label: 'Tiempo', hint: 'Formato m:ss.cc' }]}
              initial={{ v: d.laps[index] }}
              onSave={(out) => { const laps = [...d.laps]; laps[index] = out.v; recalc(swimmerId, { laps }); }}
              onDelete={() => { const laps = [...d.laps]; laps.splice(index, 1); recalc(swimmerId, { laps }); }}
              onClose={() => setEditingEntry(null)} />
          );
        }
        if (kind === 'tramos') {
          return (
            <EditEntryModal title={`Tramo ${index + 1} · ${swName}`}
              fields={[{ key: 'v', type: 'count', label: 'Conteo' }]}
              initial={{ v: d.tramos[index] }}
              onSave={(out) => { const tramos = [...d.tramos]; tramos[index] = out.v; recalc(swimmerId, { tramos }); }}
              onDelete={() => { const tramos = [...d.tramos]; tramos.splice(index, 1); recalc(swimmerId, { tramos }); }}
              onClose={() => setEditingEntry(null)} />
          );
        }
        return (
          <EditEntryModal title={`Intento ${index + 1} · ${swName}`}
            fields={[{ key: 'tiempo', type: 'time', label: proto.tiempoLabel || 'Tiempo', hint: 'Formato m:ss.cc' }, ...(proto.metricas || []).map(m => ({ key: m, type: 'count', label: DB.METRIC_TYPES[m].label }))]}
            initial={d.intentos[index]}
            onSave={(out) => { const intentos = [...d.intentos]; intentos[index] = out; recalc(swimmerId, { intentos }); }}
            onDelete={() => { const intentos = [...d.intentos]; intentos.splice(index, 1); recalc(swimmerId, { intentos }); }}
            onClose={() => setEditingEntry(null)} />
        );
      })()}

      {removingSwimmer && (
        <Confirm title="Quitar nadador" danger
          message={`¿Quitar a ${removingSwimmer.nombre} de esta evaluación? Se perderán sus registros guardados aquí al confirmar los cambios.`}
          confirmLabel="Quitar" onConfirm={() => removeSwimmer(removingSwimmer.id)} onClose={() => setRemovingSwimmer(null)} />
      )}
    </Modal>
  );
}

/* ---------- Manual entry (test realizado sin la app) ---------- */
function isDnfInput(v) { return String(v == null ? '' : v).trim().toUpperCase() === 'X'; }
function manualPlan(proto, metrica) {
  if (!proto) return { kind: 'laps', count: 1 };
  if (proto.compuesta) return { kind: 'compuesta', metricas: proto.metricas, tiempoLabel: proto.tiempoLabel };
  if (metrica === 'brazadas' || metrica === 'subacuatico') return { kind: 'tramos', count: Math.max(proto.repeticiones || 1, 1) };
  // cronometro
  if (proto.repeticiones > 1) return { kind: 'reps', count: proto.repeticiones };
  if (proto.lapDistancia) return { kind: 'laps', count: Math.max(Math.round(proto.distancia / proto.lapDistancia), 1) };
  return { kind: 'laps', count: 1 };
}

function ManualEvalForm({ onSave, onCancel }) {
  const st = useStore();
  const toast = useToast();
  const [fecha, setFecha] = useState(todayISO());
  const [protocolo, setProtocolo] = useState('libre');
  const [metrica, setMetrica] = useState('cronometro');
  const [sel, setSel] = useState([]);
  const [data, setData] = useState({});
  const [notas, setNotas] = useState('');

  const proto = protoById(protocolo);
  const plan = useMemo(() => manualPlan(proto, metrica), [protocolo, metrica]);
  const planKey = `${protocolo}:${metrica}:${plan.kind}:${plan.count || 0}`;
  const dar = st.swimmers.filter(s => s.group === 'DAR').sort((a, b) => a.nombre.localeCompare(b.nombre));
  const effMetrica = plan.kind === 'compuesta' ? 'compuesta' : metrica;

  useEffect(() => { setData({}); }, [planKey]);

  const blankEntry = () => {
    if (plan.kind === 'reps') return { reps: Array.from({ length: plan.count }, () => ({ nado: '', descanso: '' })) };
    if (plan.kind === 'laps') return { laps: Array.from({ length: plan.count }, () => '') };
    if (plan.kind === 'tramos') return { tramos: Array.from({ length: plan.count }, () => '') };
    return { intentos: [Object.assign({ tiempo: '' }, ...plan.metricas.map(m => ({ [m]: '' })))] };
  };
  const entryOf = (id) => data[id] || blankEntry();
  const mutate = (id, fn) => setData(d => {
    const cur = JSON.parse(JSON.stringify(d[id] || blankEntry()));
    fn(cur);
    return { ...d, [id]: cur };
  });
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const hasData = sel.length > 0 && sel.some(id => {
    const e = entryOf(id);
    if (plan.kind === 'reps') return e.reps.some(r => isDnfInput(r.nado) || parseTime(r.nado) != null);
    if (plan.kind === 'laps') return e.laps.some(l => isDnfInput(l) || parseTime(l) != null);
    if (plan.kind === 'tramos') return e.tramos.some(t => isDnfInput(t) || String(t).trim() !== '');
    return e.intentos.some(it => isDnfInput(it.tiempo) || parseTime(it.tiempo) != null);
  });

  const save = () => {
    const finalData = {};
    sel.forEach(id => {
      const e = entryOf(id);
      if (plan.kind === 'reps') {
        const reps = e.reps
          .filter(r => isDnfInput(r.nado) || parseTime(r.nado) != null)
          .map(r => ({ nado: isDnfInput(r.nado) ? null : parseTime(r.nado), descanso: parseTime(r.descanso) }));
        finalData[id] = { reps, totalNado: reps.reduce((a, b) => a + (b.nado || 0), 0) };
      } else if (plan.kind === 'laps') {
        const laps = e.laps
          .filter(l => isDnfInput(l) || parseTime(l) != null)
          .map(l => isDnfInput(l) ? null : parseTime(l));
        finalData[id] = { laps, total: laps.filter(v => v != null).reduce((a, b) => a + b, 0) };
      } else if (plan.kind === 'tramos') {
        finalData[id] = {
          tramos: e.tramos
            .filter(t => isDnfInput(t) || !isNaN(parseInt(t, 10)))
            .map(t => isDnfInput(t) ? null : parseInt(t, 10)),
        };
      } else {
        const intentos = e.intentos
          .filter(it => isDnfInput(it.tiempo) || parseTime(it.tiempo) != null)
          .map(it => {
            const dnf = isDnfInput(it.tiempo);
            const o = { tiempo: dnf ? null : parseTime(it.tiempo) };
            plan.metricas.forEach(m => { o[m] = dnf ? null : (parseInt(it[m], 10) || 0); });
            return o;
          });
        finalData[id] = { intentos };
      }
    });
    DB.addEvaluation({ fecha, protocolo, metrica: effMetrica, swimmerIds: sel, tecnico: st.coach.nombre, notas, data: finalData, manual: true });
    toast('Evaluación registrada manualmente');
    onSave();
  };

  const tHint = 'Formato m:ss.cc — ej. 1:28.40 ó 88.4 · escribe X si no completó';

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="card card-pad" style={{ marginBottom: 20, display: 'flex', gap: 13, alignItems: 'flex-start', background: 'var(--amber-bg)', borderColor: 'var(--amber)' }}>
        <Icon name="edit" style={{ width: 20, height: 20, stroke: '#97681a', flex: '0 0 20px', marginTop: 2 }} />
        <div style={{ fontSize: 13.5, color: '#97681a', lineHeight: 1.5 }}>
          <strong>Registro manual.</strong> Ingresa los datos de un test que ya realizaste sin la app. Elige el protocolo, la fecha real y escribe los tiempos o conteos por nadador.
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 0 }}><h2>1 · Protocolo y fecha</h2><div className="line" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 14, marginBottom: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {DB.PROTOCOLS.map(p => (
            <button key={p.id} className="proto-pick" data-on={protocolo === p.id} onClick={() => setProtocolo(p.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <strong>{p.nombre}</strong>
                {protocolo === p.id && <Icon name="check" style={{ width: 18, height: 18, stroke: 'var(--cyan-700)' }} />}
              </div>
              <span className="proto-set">{p.set}</span>
              {p.compuesta && <span className="badge badge-green" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Tiempo + conteos</span>}
              {p.niveles && <span className="badge badge-amber" style={{ marginTop: 6, alignSelf: 'flex-start' }}>Sistema de niveles</span>}
            </button>
          ))}
        </div>
        <div className="card card-pad" style={{ position: 'sticky', top: 88 }}>
          <Field label="Fecha del test" req><input type="date" className="input" value={fecha} max={todayISO()} onChange={e => setFecha(e.target.value)} /></Field>
          {!proto.compuesta && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-500)', marginBottom: 8 }}>Métrica</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['cronometro', 'brazadas', 'subacuatico'].map(k => {
                  const m = DB.METRIC_TYPES[k];
                  return (
                    <button key={k} className="metric-pick" data-on={metrica === k} onClick={() => setMetrica(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                      <span className="mp-ico" style={{ background: m.color + '1a', color: m.color, width: 30, height: 30 }}><Icon name={m.icon === 'timer' ? 'timer' : m.icon === 'arm' ? 'arm' : 'wave'} /></span>
                      <span style={{ textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{m.label}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {proto.compuesta && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--slate-500)', lineHeight: 1.5 }}>
              Prueba compuesta: registra <strong style={{ color: 'var(--ink)' }}>{proto.tiempoLabel.toLowerCase()}</strong> + conteos por intento.
            </div>
          )}
        </div>
      </div>

      <div className="section-title"><h2>2 · Nadadores y datos</h2><div className="line" /><span style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>{sel.length} seleccionados</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
        {dar.map(s => (
          <button key={s.id} className="swim-pick" data-on={sel.includes(s.id)} onClick={() => toggle(s.id)}>
            <Avatar name={s.nombre} size={34} />
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.nombre}</div>
              <div style={{ fontSize: 11.5, color: 'var(--slate-400)' }}>{DB.categoryFor(s.fechaNacimiento)}</div>
            </div>
            <div className={`swim-check ${sel.includes(s.id) ? 'on' : ''}`}>{sel.includes(s.id) && <Icon name="check" />}</div>
          </button>
        ))}
      </div>

      {sel.length === 0 ? (
        <div className="card"><Empty icon="users" title="Selecciona nadadores" >Elige al menos un nadador para ingresar sus datos.</Empty></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sel.map(id => {
            const s = st.swimmers.find(x => x.id === id);
            const e = entryOf(id);
            return (
              <div key={id} className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Avatar name={s.nombre} size={32} />
                  <strong style={{ fontSize: 14.5 }}>{s.nombre}</strong>
                  <span className="badge badge-slate">{DB.categoryFor(s.fechaNacimiento)}</span>
                  <div style={{ flex: 1 }} />
                  <button className="btn-icon" onClick={() => toggle(id)} title="Quitar"><Icon name="x" /></button>
                </div>

                {plan.kind === 'reps' && (
                  <>
                    <div style={{ fontSize: 11.5, color: 'var(--slate-500)', marginBottom: 10 }}>Tiempo de nado por repetición · {tHint}. Descanso opcional.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                      {e.reps.map((r, i) => (
                        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 10px', background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--slate-400)', marginBottom: 5 }}>REP {i + 1}</div>
                          <input className="input" placeholder="m:ss.cc" value={r.nado} onChange={ev => mutate(id, c => { c.reps[i].nado = ev.target.value; })} style={{ fontVariantNumeric: 'tabular-nums', marginBottom: 5 }} />
                          <input className="input" placeholder="descanso (seg)" value={r.descanso} onChange={ev => mutate(id, c => { c.reps[i].descanso = ev.target.value; })} style={{ fontSize: 12, padding: '5px 8px', color: 'var(--amber)' }} />
                        </div>
                      ))}
                    </div>
                    {proto.niveles && (() => {
                      const vals = e.reps.map(r => parseTime(r.nado)).filter(v => v != null);
                      return vals.length ? <div style={{ marginTop: 12 }}><NivelBadge proto={proto} avgTime={vals.reduce((a, b) => a + b, 0) / vals.length} size="sm" /></div> : null;
                    })()}
                  </>
                )}

                {plan.kind === 'laps' && (
                  <>
                    <div style={{ fontSize: 11.5, color: 'var(--slate-500)', marginBottom: 10 }}>{plan.count === 1 ? 'Tiempo total' : `Tiempo por tramo${proto.lapDistancia ? ` de ${proto.lapDistancia} m` : ''}`} · {tHint}.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                      {e.laps.map((l, i) => (
                        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 10px', background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--slate-400)', marginBottom: 5 }}>{plan.count === 1 ? 'TIEMPO' : `TRAMO ${i + 1}`}</div>
                          <input className="input" placeholder="m:ss.cc" value={l} onChange={ev => mutate(id, c => { c.laps[i] = ev.target.value; })} style={{ fontVariantNumeric: 'tabular-nums' }} />
                        </div>
                      ))}
                    </div>
                    {proto.niveles && (() => {
                      const vals = e.laps.map(parseTime).filter(v => v != null);
                      return vals.length ? <div style={{ marginTop: 12 }}><NivelBadge proto={proto} avgTime={vals.reduce((a, b) => a + b, 0) / vals.length} size="sm" /></div> : null;
                    })()}
                  </>
                )}

                {plan.kind === 'tramos' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--slate-500)' }}>Conteo de {metrica === 'brazadas' ? 'brazadas' : 'movimientos subacuáticos'} por tramo · escribe X si no completó.</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" onClick={() => mutate(id, c => { if (c.tramos.length > 1) c.tramos.pop(); })} title="Quitar tramo"><Icon name="minus" /></button>
                        <button className="btn-icon" onClick={() => mutate(id, c => { c.tramos.push(''); })} title="Agregar tramo"><Icon name="plus" /></button>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                      {e.tramos.map((t, i) => (
                        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '8px 10px', background: 'var(--surface-2)' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--slate-400)', marginBottom: 5 }}>T{i + 1}</div>
                          <input className="input" placeholder="0 ó X" value={t} onChange={ev => mutate(id, c => { c.tramos[i] = ev.target.value; })} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }} />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {plan.kind === 'compuesta' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--slate-500)' }}>{proto.tiempoLabel} + conteos por intento. {tHint}.</div>
                      <button className="btn-icon" onClick={() => mutate(id, c => { c.intentos.push(Object.assign({ tiempo: '' }, ...plan.metricas.map(m => ({ [m]: '' })))); })} title="Agregar intento"><Icon name="plus" /></button>
                    </div>
                    <table className="tbl" style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)' }}>
                      <thead><tr><th>#</th><th>Tiempo</th>{plan.metricas.map(m => <th key={m}>{DB.METRIC_TYPES[m].label}</th>)}<th></th></tr></thead>
                      <tbody>
                        {e.intentos.map((it, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{i + 1}</td>
                            <td><input className="input" placeholder="m:ss.cc" value={it.tiempo} onChange={ev => mutate(id, c => { c.intentos[i].tiempo = ev.target.value; })} style={{ maxWidth: 110, fontVariantNumeric: 'tabular-nums' }} /></td>
                            {plan.metricas.map(m => (
                              <td key={m}><input className="input" type="number" min="0" placeholder="0" value={it[m]} onChange={ev => mutate(id, c => { c.intentos[i][m] = ev.target.value; })} style={{ maxWidth: 80, color: DB.METRIC_TYPES[m].color, fontWeight: 700 }} /></td>
                            ))}
                            <td>{e.intentos.length > 1 && <button className="btn-icon" onClick={() => mutate(id, c => { c.intentos.splice(i, 1); })}><Icon name="trash" /></button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <Field label="Notas de la evaluación" hint="Contexto del test, condiciones, observaciones.">
          <textarea className="textarea" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del técnico…" />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'linear-gradient(transparent, var(--bg) 40%)', padding: '16px 0', marginTop: 8 }}>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!hasData} icon="check" onClick={save}>Guardar evaluación</Button>
      </div>
    </div>
  );
}

/* ---------- Main view ---------- */
function EvaluationsView() {
  const st = useStore();
  const toast = useToast();
  const [mode, setMode] = useState('list');
  const [config, setConfig] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const evals = st.evaluations.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (mode === 'setup') return <EvalSetup onCancel={() => setMode('list')} onStart={(c) => { setConfig(c); setMode('record'); }} />;
  if (mode === 'manual') return <ManualEvalForm onCancel={() => setMode('list')} onSave={() => setMode('list')} />;
  if (mode === 'record') {
    const cfgProto = protoById(config.protocolo);
    if (cfgProto.compuesta) return <CompoundRecorder config={config} onCancel={() => setMode('list')} onSave={() => setMode('list')} />;
    if (config.metrica === 'cronometro' && config.cronoMode === 'simultaneo')
      return <MultiRecorder config={config} onCancel={() => setMode('list')} onSave={() => setMode('list')} />;
    if (config.metrica === 'cronometro' && cfgProto.repeticiones > 1)
      return <IntervalRecorder config={config} onCancel={() => setMode('list')} onSave={() => setMode('list')} />;
    return <EvalRecorder config={config} onCancel={() => setMode('list')} onSave={() => setMode('list')} />;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div style={{ fontSize: 13.5, color: 'var(--slate-500)' }}>Registra cronómetro, brazadas y movimientos subacuáticos por separado.</div>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" icon="edit" onClick={() => setMode('manual')}>Registro manual</Button>
        <Button icon="plus" onClick={() => setMode('setup')}>Nueva evaluación</Button>
      </div>

      {evals.length === 0 ? (
        <div className="card"><Empty icon="award" title="Aún no hay evaluaciones" action={<Button icon="play" onClick={() => setMode('setup')}>Iniciar la primera</Button>}>Crea una evaluación para registrar el rendimiento de tus nadadores.</Empty></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 16 }}>
          {evals.map(ev => {
            const proto = protoById(ev.protocolo); const meta = metricMeta(ev.metrica);
            const swimmers = ev.swimmerIds.map(id => st.swimmers.find(s => s.id === id)).filter(Boolean);
            return (
              <div key={ev.id} className="card card-pad eval-card" onClick={() => setDetail(ev)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span className="mp-ico" style={{ background: meta.color + '1a', color: meta.color, width: 40, height: 40 }}><Icon name={meta.icon === 'timer' ? 'timer' : meta.icon === 'arm' ? 'arm' : 'wave'} /></span>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setDeleting(ev); }}><Icon name="trash" /></button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{meta.label}</div>
                  <h3 style={{ fontSize: 16, marginTop: 2 }}>{proto.nombre}</h3>
                  <div style={{ fontSize: 12.5, color: 'var(--slate-500)', marginTop: 3 }}>{fmtDate(ev.fecha)} · {proto.set}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 14, gap: 8 }}>
                  <div style={{ display: 'flex' }}>
                    {swimmers.slice(0, 4).map((s, i) => <div key={s.id} style={{ marginLeft: i ? -10 : 0, border: '2px solid #fff', borderRadius: '50%' }}><Avatar name={s.nombre} size={28} /></div>)}
                  </div>
                  <span style={{ fontSize: 12.5, color: 'var(--slate-500)', fontWeight: 600 }}>{swimmers.length} nadador{swimmers.length !== 1 ? 'es' : ''}</span>
                  {ev.manual && <><div style={{ flex: 1 }} /><span className="badge badge-amber">Manual</span></>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && <EvalDetail ev={detail} onClose={() => setDetail(null)} />}
      {deleting && <Confirm title="Eliminar evaluación" danger message="¿Eliminar esta evaluación registrada?" confirmLabel="Eliminar" onConfirm={() => { DB.removeEvaluation(deleting.id); toast('Evaluación eliminada'); }} onClose={() => setDeleting(null)} />}
    </div>
  );
}

export { EvaluationsView };
