import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';


/* ============================================================
   attendance.jsx — Panel de asistencia mensual
   ============================================================ */
function AttendanceView() {
  const st = useStore();
  const toast = useToast();
  const now = new Date();
  const [ym, setYm] = useState(todayISO().slice(0, 7));
  const [group, setGroup] = useState('DAR');

  const [yy, mm] = ym.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayStr = todayISO();

  const swimmers = useMemo(() =>
    st.swimmers.filter(s => s.group === group).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [st.swimmers, group]);

  // Which days have scheduled trainings (highlight columns)
  const trainingDays = useMemo(() => {
    const set = new Set();
    st.trainings.forEach(t => { if (t.fecha.startsWith(ym)) set.add(parseInt(t.fecha.slice(8), 10)); });
    return set;
  }, [st.trainings, ym]);

  const shiftMonth = (d) => {
    const dt = new Date(yy, mm - 1 + d, 1);
    setYm(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };

  const cellKey = (day) => `${ym}-${String(day).padStart(2, '0')}`;
  const isPresent = (sid, day) => !!(st.attendance[sid] && st.attendance[sid][cellKey(day)]);

  const swimmerTotal = (sid) => days.reduce((n, d) => n + (isPresent(sid, d) ? 1 : 0), 0);
  const dayTotal = (day) => swimmers.reduce((n, s) => n + (isPresent(s.id, day) ? 1 : 0), 0);
  const activeDays = days.filter(d => trainingDays.has(d) || swimmers.some(s => isPresent(s.id, d)));
  const grandTotal = swimmers.reduce((n, s) => n + swimmerTotal(s.id), 0);
  const possible = activeDays.length * swimmers.length;
  const pct = possible ? Math.round((grandTotal / possible) * 100) : 0;

  const markColumn = (day, val) => {
    swimmers.forEach(s => DB.setAttendance(s.id, cellKey(day), val));
    toast(val ? `Día ${day} marcado presente` : `Día ${day} desmarcado`);
  };

  return (
    <div>
      <div className="toolbar">
        <div className="tabs">
          <button className={`tab ${group === 'DAR' ? 'active' : ''}`} onClick={() => setGroup('DAR')}>DAR</button>
          <button className={`tab ${group === 'BEN' ? 'active' : ''}`} onClick={() => setGroup('BEN')}>Beneficiarios</button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: 4 }}>
          <button className="btn-icon" onClick={() => shiftMonth(-1)}><Icon name="chevL" /></button>
          <div style={{ minWidth: 156, textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-head)', fontSize: 14.5 }}>{MONTHS[mm - 1]} {yy}</div>
          <button className="btn-icon" onClick={() => shiftMonth(1)}><Icon name="chevR" /></button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setYm(todayISO().slice(0, 7))}>Hoy</Button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat">
          <div className="label"><span className="ico" style={{ background: 'var(--cyan-050)', color: 'var(--cyan-700)' }}><Icon name="checkSquare" style={{ width: 16, height: 16 }} /></span>Asistencias del mes</div>
          <div className="value">{grandTotal}</div>
        </div>
        <div className="stat">
          <div className="label"><span className="ico" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}><Icon name="trend" style={{ width: 16, height: 16 }} /></span>Tasa de asistencia</div>
          <div className="value">{pct}<span style={{ fontSize: 20, color: 'var(--slate-400)' }}>%</span></div>
        </div>
        <div className="stat">
          <div className="label"><span className="ico" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}><Icon name="calendar" style={{ width: 16, height: 16 }} /></span>Días con entrenamiento</div>
          <div className="value">{activeDays.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="ico"><Icon name="checkSquare" /></div>
          <div style={{ flex: 1 }}>
            <h3>Asistencia diaria · {group === 'DAR' ? 'Grupo DAR' : 'Beneficiarios'}</h3>
            <div style={{ fontSize: 12.5, color: 'var(--slate-500)' }}>Marca cada día de entrenamiento. Las columnas turquesa tienen entrenamiento programado.</div>
          </div>
        </div>
        {swimmers.length === 0 ? (
          <Empty icon="users" title="Sin nadadores en este grupo" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="att-tbl">
              <thead>
                <tr>
                  <th className="att-name-col">Nadador</th>
                  {days.map(d => {
                    const dt = new Date(yy, mm - 1, d);
                    const isToday = cellKey(d) === todayStr;
                    const isTr = trainingDays.has(d);
                    return (
                      <th key={d} className={`att-day ${isTr ? 'is-training' : ''} ${isToday ? 'is-today' : ''}`} title={isTr ? 'Entrenamiento programado · clic para marcar a todos' : 'Clic para marcar a todos'}
                        onClick={() => markColumn(d, dayTotal(d) < swimmers.length)}>
                        <span className="wd">{WD_SHORT[dt.getDay()][0]}</span>
                        <span className="dd">{d}</span>
                      </th>
                    );
                  })}
                  <th className="att-total-col">Total</th>
                </tr>
              </thead>
              <tbody>
                {swimmers.map(s => {
                  const tot = swimmerTotal(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="att-name-col">
                        <div className="name-cell">
                          <Avatar name={s.nombre} size={30} />
                          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13.5, whiteSpace: 'nowrap' }}>{s.nombre.split(' ').slice(0, 2).join(' ')}</div>
                        </div>
                      </td>
                      {days.map(d => {
                        const on = isPresent(s.id, d);
                        const isToday = cellKey(d) === todayStr;
                        return (
                          <td key={d} className={`att-cell ${isToday ? 'is-today' : ''}`}>
                            <button className={`att-box ${on ? 'on' : ''}`} onClick={() => DB.toggleAttendance(s.id, cellKey(d))} aria-label={`Día ${d}`}>
                              {on && <Icon name="check" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="att-total-col"><span className="badge badge-navy">{tot}</span></td>
                    </tr>
                  );
                })}
                <tr className="att-foot-row">
                  <td className="att-name-col" style={{ fontWeight: 700, color: 'var(--slate-500)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Por día</td>
                  {days.map(d => <td key={d} className="att-cell" style={{ fontWeight: 700, color: 'var(--slate-500)', fontSize: 12.5 }}>{dayTotal(d) || ''}</td>)}
                  <td className="att-total-col" style={{ fontWeight: 800, color: 'var(--navy)' }}>{grandTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--slate-400)', marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--cyan)', display: 'inline-block' }} /> Presente</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 14, height: 14, borderRadius: 4, border: '1.5px solid var(--line)', display: 'inline-block' }} /> Ausente</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--cyan-050)', border: '1px solid var(--cyan-100)', display: 'inline-block' }} /> Día con entrenamiento</span>
      </p>
    </div>
  );
}

export { AttendanceView };
