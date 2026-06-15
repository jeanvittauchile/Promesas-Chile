import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime, TR_TYPE_COLOR,
} from './components.jsx';


/* ============================================================
   dashboard.jsx — Inicio
   ============================================================ */
function Dashboard({ go }) {
  const st = useStore();
  const today = todayISO();
  const ym = today.slice(0, 7);

  const dar = st.swimmers.filter(s => s.group === 'DAR');
  const ben = st.swimmers.filter(s => s.group === 'BEN');
  const todayTrainings = st.trainings.filter(t => t.fecha === today).sort((a, b) => a.titulo.localeCompare(b.titulo));

  // today's attendance for DAR
  const presentToday = dar.filter(s => st.attendance[s.id] && st.attendance[s.id][today]).length;

  // month attendance rate
  const activeDays = new Set();
  st.trainings.forEach(t => { if (t.fecha.startsWith(ym)) activeDays.add(t.fecha.slice(8)); });
  dar.forEach(s => { const a = st.attendance[s.id] || {}; Object.keys(a).forEach(k => { if (k.startsWith(ym) && a[k]) activeDays.add(k.slice(8)); }); });
  let pres = 0; dar.forEach(s => { const a = st.attendance[s.id] || {}; Object.keys(a).forEach(k => { if (k.startsWith(ym) && a[k]) pres++; }); });
  const possible = activeDays.size * dar.length;
  const pct = possible ? Math.round((pres / possible) * 100) : 0;

  const monthEvals = st.evaluations.filter(e => e.fecha.startsWith(ym));
  const recentEvals = st.evaluations.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 4);
  const upcoming = st.trainings.filter(t => t.fecha > today).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 3);

  const proto = (id) => DB.PROTOCOLS.find(p => p.id === id);
  const mm = (m) => DB.METRIC_TYPES[m];

  const stats = [
    { label: 'Nadadores DAR', value: dar.length, icon: 'users', bg: 'var(--cyan-050)', fg: 'var(--cyan-700)', sub: `${ben.length} beneficiarios` },
    { label: 'Asistencia del mes', value: pct + '%', icon: 'trend', bg: 'var(--green-bg)', fg: 'var(--green)', sub: `${pres} asistencias` },
    { label: 'Evaluaciones del mes', value: monthEvals.length, icon: 'award', bg: '#efeafb', fg: '#7B5BD6', sub: `${st.evaluations.length} en total` },
    { label: 'Presentes hoy', value: `${presentToday}/${dar.length}`, icon: 'checkSquare', bg: 'var(--amber-bg)', fg: 'var(--amber)', sub: fmtDate(today) },
  ];

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: 22 }}>
        {stats.map((s, i) => (
          <div className="stat" key={i}>
            <div className="label"><span className="ico" style={{ background: s.bg, color: s.fg }}><Icon name={s.icon} style={{ width: 16, height: 16 }} /></span>{s.label}</div>
            <div className="value">{s.value}</div>
            <div className="delta" style={{ color: 'var(--slate-400)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 22, alignItems: 'start' }} className="dash-grid">
        {/* Today's training */}
        <div>
          <div className="card">
            <div className="card-head">
              <div className="ico"><Icon name="calendar" /></div>
              <div style={{ flex: 1 }}><h3>Entrenamiento de hoy</h3><div style={{ fontSize: 12.5, color: 'var(--slate-500)' }}>{fmtDateLong(today)}</div></div>
              <Button variant="ghost" size="sm" onClick={() => go('trainings')}>Ver calendario</Button>
            </div>
            <div className="card-pad">
              {todayTrainings.length === 0 ? (
                <Empty icon="calendar" title="Sin entrenamiento hoy" action={<Button size="sm" icon="plus" onClick={() => go('trainings')}>Programar</Button>}>No hay sesión programada para hoy.</Empty>
              ) : todayTrainings.map(t => (
                <div key={t.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span className={`badge badge-${TR_TYPE_COLOR[t.tipo] || 'cyan'}`}>{t.tipo}</span>
                    <span className="badge badge-slate">{t.grupo === 'TODOS' ? 'Todos' : t.grupo}</span>
                    <span className="badge badge-slate">{t.duracion} min</span>
                  </div>
                  <h3 style={{ fontSize: 17, marginBottom: 10 }}>{t.titulo}</h3>
                  {t.contenido && <pre style={{ margin: 0, padding: '14px 16px', background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-md)', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.7, color: 'var(--slate-700)', whiteSpace: 'pre-wrap' }}>{t.contenido}</pre>}
                </div>
              ))}
            </div>
          </div>

          {/* Quick attendance */}
          <div className="card" style={{ marginTop: 22 }}>
            <div className="card-head">
              <div className="ico"><Icon name="checkSquare" /></div>
              <div style={{ flex: 1 }}><h3>Asistencia de hoy · DAR</h3><div style={{ fontSize: 12.5, color: 'var(--slate-500)' }}>Marca rápida — toca para registrar</div></div>
              <Button variant="ghost" size="sm" onClick={() => go('attendance')}>Panel mensual</Button>
            </div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dar.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(s => {
                const on = st.attendance[s.id] && st.attendance[s.id][today];
                return (
                  <div key={s.id} className="quick-att" data-on={!!on} onClick={() => DB.toggleAttendance(s.id, today)}>
                    <Avatar name={s.nombre} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{s.nombre}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--slate-400)' }}>{DB.categoryFor(s.fechaNacimiento)}</div>
                    </div>
                    <div className={`att-box ${on ? 'on' : ''}`}>{on && <Icon name="check" />}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="card">
            <div className="card-head"><div className="ico"><Icon name="award" /></div><h3>Evaluaciones recientes</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentEvals.length === 0 ? <Empty icon="award" title="Sin evaluaciones" /> : recentEvals.map(e => {
                const p = proto(e.protocolo); const m = mm(e.metrica);
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span className="mp-ico" style={{ background: m.color + '1a', color: m.color, width: 36, height: 36, flex: '0 0 36px' }}><Icon name={m.icon === 'timer' ? 'timer' : m.icon === 'arm' ? 'arm' : 'wave'} style={{ width: 18, height: 18 }} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{p.nombre} · {e.swimmerIds.length} nad.</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 600 }}>{fmtDate(e.fecha)}</span>
                  </div>
                );
              })}
              <Button variant="ghost" size="sm" icon="plus" onClick={() => go('evaluations')} className="no-print" style={{ marginTop: 4 }}>Nueva evaluación</Button>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="ico"><Icon name="clock" /></div><h3>Próximos entrenamientos</h3></div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.length === 0 ? <Empty icon="calendar" title="Nada programado" /> : upcoming.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ textAlign: 'center', flex: '0 0 44px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '6px 0' }}>
                    <div style={{ fontSize: 16, fontFamily: 'var(--font-head)', fontWeight: 700, lineHeight: 1, color: 'var(--navy)' }}>{new Date(t.fecha + 'T00:00:00').getDate()}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--slate-400)', textTransform: 'uppercase' }}>{MONTHS[new Date(t.fecha + 'T00:00:00').getMonth()].slice(0, 3)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{t.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{t.tipo} · {t.duracion} min</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Dashboard };
