import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';


/* ============================================================
   eval-report.jsx — Informe de Resultados de Evaluaciones (A4)
   ============================================================ */
const ER = {
  proto: (id) => DB.PROTOCOLS.find(p => p.id === id),
  metric: (m) => DB.METRIC_TYPES[m],
  sw: (st, id) => st.swimmers.find(s => s.id === id),
};
const POS_COLORS = ['#C6962B', '#9AA7B0', '#B97A3E'];

/* ---------- Horizontal comparative bars ---------- */
function CompareBars({ rows, unit, lowerBetter, color = '#00C0E2', note }) {
  if (!rows.length) return <p className="rp-empty">Sin datos suficientes.</p>;
  const vals = rows.map(r => r.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  return (
    <>
      <div className="chart-bars">
        {rows.map((r, i) => {
          const norm = lowerBetter ? (max - r.value) / span : (r.value - min) / span;
          const w = 30 + norm * 70;
          const isBest = lowerBetter ? r.value === min : r.value === max;
          return (
            <div className="chart-bar-row" key={i}>
              <div className="cb-label" title={r.label}>{r.label}</div>
              <div className="cb-track"><div className="cb-fill" style={{ width: w + '%', background: isBest ? '#1FA971' : color }} /></div>
              <div className="cb-val">{r.display}</div>
            </div>
          );
        })}
      </div>
      {note && <p className="chart-note">{note}</p>}
    </>
  );
}

/* ---------- Ranking list with medals ---------- */
function RankList({ rows }) {
  if (!rows.length) return <p className="rp-empty">Sin datos suficientes.</p>;
  return (
    <div className="rank-list">
      {rows.map((r, i) => (
        <div className="rank-item" key={r.id}>
          <div className="rank-pos" style={{ background: i < 3 ? POS_COLORS[i] : 'var(--line-soft)', color: i < 3 ? '#fff' : 'var(--slate-500)' }}>{i + 1}</div>
          <div className="rank-av" style={{ background: avatarColor(r.label) }}>{getInitials(r.label)}</div>
          <div className="rank-meta">
            <div className="rank-name">{r.label}</div>
            <div className="rank-sub">{r.subtext}</div>
          </div>
          <div className="rank-val">{r.display}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- SVG multi-line progression chart ---------- */
function LineChart({ series, xLabels, unit }) {
  const W = 560, H = 230, padL = 52, padR = 16, padT = 16, padB = 34;
  const allY = series.flatMap(s => s.points.map(p => p.y));
  if (allY.length === 0) return <p className="rp-empty">Sin datos suficientes.</p>;
  let minY = Math.min(...allY), maxY = Math.max(...allY);
  const pad = (maxY - minY) * 0.15 || 1; minY -= pad; maxY += pad;
  if (unit === 'time') minY = Math.max(0, minY);
  const n = xLabels.length;
  const x = (i) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - minY) / (maxY - minY || 1)) * (H - padT - padB);
  const yticks = 4;
  return (
    <svg className="linechart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: yticks + 1 }).map((_, i) => {
        const v = minY + (i / yticks) * (maxY - minY);
        const yy = y(v);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#EEF2F5" strokeWidth="1" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize="10" fill="#8A99A6">{unit === 'time' ? fmtTime(v) : v.toFixed(1)}</text>
          </g>
        );
      })}
      {xLabels.map((lb, i) => <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="#8A99A6">{lb}</text>)}
      {series.map((s, si) => {
        const pts = s.points.filter(p => p.y != null);
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.x)},${y(p.y)}`).join(' ');
        return (
          <g key={si}>
            {pts.length > 1 && <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {pts.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2.5" />)}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Main evaluation report — A4 multi-page ---------- */
function EvalReport({ st, ym }) {
  const [yy, mm] = ym.split('-').map(Number);
  const evals = st.evaluations.filter(e => e.fecha.startsWith(ym)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const coach = st.coach;
  const logoUrl = '/logo.png';

  const swName = (id) => { const s = ER.sw(st, id); return s ? s.nombre : '—'; };

  /* ---- Cronómetro series ---- */
  const cronoSeries = evals.filter(e => e.metrica === 'cronometro' && ER.proto(e.protocolo).repeticiones > 1);
  const seriesProtos = [...new Set(cronoSeries.map(e => e.protocolo))];

  function rankSeries(protoId) {
    const evs = cronoSeries.filter(e => e.protocolo === protoId);
    const byS = {};
    evs.forEach(e => Object.entries(e.data).forEach(([id, d]) => {
      if (!d.laps || !d.laps.length) return;
      (byS[id] = byS[id] || []).push(...d.laps.filter(v => v != null));
    }));
    return Object.entries(byS).filter(([, laps]) => laps.length > 0).map(([id, laps]) => {
      const avg = laps.reduce((a, b) => a + b, 0) / laps.length;
      const best = Math.min(...laps);
      return { id, label: swName(id), value: avg, best, count: laps.length };
    }).sort((a, b) => a.value - b.value);
  }

  /* ---- Progresión ---- */
  const progProto = seriesProtos.map(p => ({ p, dates: [...new Set(cronoSeries.filter(e => e.protocolo === p).map(e => e.fecha))] }))
    .sort((a, b) => b.dates.length - a.dates.length)[0];

  let progSeries = [], progXLabels = [];
  if (progProto && progProto.dates.length >= 2) {
    const dates = progProto.dates.sort();
    progXLabels = dates.map(d => fmtDate(d).replace(/ \d{4}$/, ''));
    const perSwimmer = {};
    cronoSeries.filter(e => e.protocolo === progProto.p).forEach(e => {
      Object.entries(e.data).forEach(([id, d]) => {
        const laps = (d.laps || []).filter(v => v != null);
        if (!laps.length) return;
        const avg = laps.reduce((a, b) => a + b, 0) / laps.length;
        (perSwimmer[id] = perSwimmer[id] || {})[e.fecha] = avg;
      });
    });
    const ranked = rankSeries(progProto.p);
    progSeries = ranked.filter(r => Object.keys(perSwimmer[r.id] || {}).length >= 1).slice(0, 4).map((r, i) => ({
      name: r.label, color: ['#00A6C6', '#1FA971', '#7B5BD6', '#E0793B'][i],
      points: dates.map((d, xi) => ({ x: xi, y: perSwimmer[r.id] && perSwimmer[r.id][d] != null ? perSwimmer[r.id][d] : null })),
    }));
  }

  /* ---- Compuesta ---- */
  const compEvals = evals.filter(e => e.metrica === 'compuesta');
  const compProtos = [...new Set(compEvals.map(e => e.protocolo))];
  function rankComp(protoId) {
    const evs = compEvals.filter(e => e.protocolo === protoId);
    const byS = {};
    evs.forEach(e => Object.entries(e.data).forEach(([id, d]) => {
      (d.intentos || []).forEach(it => { if (it.tiempo != null) (byS[id] = byS[id] || []).push(it.tiempo); });
    }));
    return Object.entries(byS).map(([id, ts]) => ({ id, label: swName(id), value: Math.min(...ts), avg: ts.reduce((a, b) => a + b, 0) / ts.length, count: ts.length }))
      .sort((a, b) => a.value - b.value);
  }

  /* ---- Counts ---- */
  function rankCount(metric) {
    const evs = evals.filter(e => e.metrica === metric);
    const byS = {};
    evs.forEach(e => Object.entries(e.data).forEach(([id, d]) => {
      if (!d.tramos || !d.tramos.length) return;
      (byS[id] = byS[id] || []).push(...d.tramos.filter(v => v != null));
    }));
    return Object.entries(byS).filter(([, t]) => t.length > 0).map(([id, t]) => ({ id, label: swName(id), value: t.reduce((a, b) => a + b, 0) / t.length, count: t.length }))
      .sort((a, b) => a.value - b.value);
  }
  const brazadasRank = rankCount('brazadas');
  const subRank = rankCount('subacuatico');

  /* ---- Totales ---- */
  const swimmersEvaluated = new Set();
  evals.forEach(e => e.swimmerIds.forEach(id => swimmersEvaluated.add(id)));
  const byMetric = { cronometro: 0, brazadas: 0, subacuatico: 0, compuesta: 0 };
  evals.forEach(e => { byMetric[e.metrica] = (byMetric[e.metrica] || 0) + 1; });

  const empty = evals.length === 0;
  const hasPage2Content = !empty && (progSeries.length > 0 || compProtos.length > 0 || brazadasRank.length > 0 || subRank.length > 0 || evals.length > 0);

  return (
    <div className="report-viewer">

      {/* ══════════════ PÁGINA 1: Encabezado + Métricas + Rankings ══════════════ */}
      <div className="report-page">
        {/* Cabecera */}
        <div className="rp-header">
          <div className="rp-brand">
            <img src={logoUrl} alt="Promesas Chile" />
            <div>
              <div className="rp-program">Promesas Chile · Natación</div>
              <div className="rp-doctype">Informe de Resultados de Evaluaciones</div>
            </div>
          </div>
          <div className="rp-period">
            <div className="rp-period-label">Periodo</div>
            <div className="rp-period-val">{MONTHS[mm - 1]} {yy}</div>
          </div>
        </div>

        {/* Técnico */}
        <div className="rp-coach">
          <div><span className="rp-k">Técnico</span><span className="rp-v">{coach.nombre}</span></div>
          <div><span className="rp-k">Evaluaciones</span><span className="rp-v">{evals.length}</span></div>
          <div><span className="rp-k">Deportistas evaluados</span><span className="rp-v">{swimmersEvaluated.size}</span></div>
          <div><span className="rp-k">Región</span><span className="rp-v">{coach.region}</span></div>
        </div>

        {empty ? (
          <>
            <div className="rp-section">
              <p className="rp-empty" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                No se registraron evaluaciones en este periodo. Realiza evaluaciones en el módulo correspondiente para generar este informe.
              </p>
            </div>
            <div className="rp-spacer" />
            <div className="rp-foot">
              <div>{coach.programa} — Generado el {fmtDateLong(todayISO())}</div>
              <div className="rp-sign"><span className="rp-sign-line" />{coach.nombre} · {coach.rol}</div>
            </div>
          </>
        ) : (
          <>
            {/* Distribución por tipo de métrica */}
            <div className="rp-section">
              <h2 className="rp-h">Evaluaciones por tipo de métrica</h2>
              <div className="rp-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
                <div className="rp-stat">
                  <div className="rp-stat-v" style={{ color: '#00A6C6' }}>{byMetric.cronometro}</div>
                  <div className="rp-stat-l">Cronómetro</div>
                </div>
                <div className="rp-stat">
                  <div className="rp-stat-v" style={{ color: '#1FA971' }}>{byMetric.brazadas}</div>
                  <div className="rp-stat-l">Brazadas</div>
                </div>
                <div className="rp-stat">
                  <div className="rp-stat-v" style={{ color: '#7B5BD6' }}>{byMetric.subacuatico}</div>
                  <div className="rp-stat-l">Mov. subacuáticos</div>
                </div>
                <div className="rp-stat">
                  <div className="rp-stat-v" style={{ color: '#159B8C' }}>{byMetric.compuesta}</div>
                  <div className="rp-stat-l">Salida / Viraje</div>
                </div>
              </div>
            </div>

            {/* Rankings por protocolo cronómetro */}
            {seriesProtos.map(pid => {
              const proto = ER.proto(pid);
              const rank = rankSeries(pid);
              const rankRows = rank.map(r => ({ id: r.id, label: r.label, display: fmtTime(r.value), subtext: `Mejor 100: ${fmtTime(r.best)} · ${r.count} reps` }));
              const barRows = rank.map(r => ({ label: r.label.split(' ').slice(0, 2).join(' '), value: r.value, display: fmtTime(r.value) }));
              return (
                <div className="rp-section rp-twocol" key={pid}>
                  <div>
                    <h2 className="rp-h">Ranking · {proto.nombre}</h2>
                    <RankList rows={rankRows} />
                  </div>
                  <div>
                    <h2 className="rp-h">Comparativa promedio 100m</h2>
                    <CompareBars rows={barRows} lowerBetter unit="time" note="Barra más larga = más rápido (mejor promedio por 100m)." />
                  </div>
                </div>
              );
            })}

            <div className="rp-spacer" />
            {hasPage2Content && <div className="rp-page-num">Página 1 de 2 · {coach.programa}</div>}
          </>
        )}
      </div>

      {/* ══════════════ PÁGINA 2: Progresión + Compuesta + Counts + Detalle ══════════════ */}
      {hasPage2Content && (
        <div className="report-page">
          {/* Cabecera de continuación */}
          <div className="rp-cont-header">
            <span className="rp-cont-title">Promesas Chile · Natación — Resultados de Evaluaciones</span>
            <span className="rp-cont-meta">{MONTHS[mm - 1]} {yy}</span>
          </div>

          {/* Progresión temporal */}
          {progSeries.length > 0 && (
            <div className="rp-section">
              <h2 className="rp-h">Progresión de tiempos · {ER.proto(progProto.p).nombre}</h2>
              <div className="linechart-wrap">
                <LineChart series={progSeries} xLabels={progXLabels} unit="time" />
                <div className="chart-legend">
                  {progSeries.map((s, i) => (
                    <span key={i} className="cl-item">
                      <span className="cl-dot" style={{ background: s.color }} />
                      {s.name.split(' ').slice(0, 2).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
              <p className="chart-note">Promedio por 100m en cada fecha de control. Tendencia descendente = mejora.</p>
            </div>
          )}

          {/* Ranking compuesta */}
          {compProtos.map(pid => {
            const proto = ER.proto(pid);
            const rank = rankComp(pid);
            const rankRows = rank.map(r => ({ id: r.id, label: r.label, display: fmtTime(r.value), subtext: `Promedio: ${fmtTime(r.avg)} · ${r.count} intentos` }));
            const barRows = rank.map(r => ({ label: r.label.split(' ').slice(0, 2).join(' '), value: r.value, display: fmtTime(r.value) }));
            return (
              <div className="rp-section rp-twocol" key={pid}>
                <div>
                  <h2 className="rp-h">Ranking · {proto.nombre}</h2>
                  <RankList rows={rankRows} />
                </div>
                <div>
                  <h2 className="rp-h">Mejores tiempos</h2>
                  <CompareBars rows={barRows} lowerBetter color="#159B8C" note="Tiempo más bajo = mejor salida/viraje." />
                </div>
              </div>
            );
          })}

          {/* Counts comparativas */}
          {(brazadasRank.length > 0 || subRank.length > 0) && (
            <div className="rp-section rp-twocol">
              {brazadasRank.length > 0 && (
                <div>
                  <h2 className="rp-h">Promedio de brazadas por tramo</h2>
                  <CompareBars
                    rows={brazadasRank.map(r => ({ label: r.label.split(' ').slice(0, 2).join(' '), value: r.value, display: r.value.toFixed(1) }))}
                    color="#1FA971"
                    note="Menos brazadas = mayor eficiencia técnica."
                  />
                </div>
              )}
              {subRank.length > 0 && (
                <div>
                  <h2 className="rp-h">Promedio de mov. subacuáticos</h2>
                  <CompareBars
                    rows={subRank.map(r => ({ label: r.label.split(' ').slice(0, 2).join(' '), value: r.value, display: r.value.toFixed(1) }))}
                    color="#7B5BD6"
                  />
                </div>
              )}
            </div>
          )}

          {/* Detalle log */}
          <div className="rp-section">
            <h2 className="rp-h">Detalle de evaluaciones del periodo</h2>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Métrica</th>
                  <th>Protocolo</th>
                  <th className="num">Nadadores</th>
                  <th>Técnico</th>
                </tr>
              </thead>
              <tbody>
                {evals.map(e => {
                  const m = ER.metric(e.metrica);
                  const p = ER.proto(e.protocolo);
                  return (
                    <tr key={e.id}>
                      <td>{fmtDate(e.fecha)}</td>
                      <td><span className="rp-tag" style={{ color: m.color, borderColor: m.color }}>{m.label}</span></td>
                      <td>{p.nombre}</td>
                      <td className="num">{e.swimmerIds.length}</td>
                      <td>{e.tecnico}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rp-spacer" />

          {/* Pie con firma */}
          <div className="rp-foot">
            <div>{coach.programa} — Generado el {fmtDateLong(todayISO())}</div>
            <div className="rp-sign">
              <span className="rp-sign-line" />
              {coach.nombre} · {coach.rol}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { EvalReport };
