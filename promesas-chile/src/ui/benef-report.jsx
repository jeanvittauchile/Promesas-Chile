import React from 'react';
import { DB } from '../lib/db.js';
import { fmtDate, fmtDateLong, todayISO } from './components.jsx';


/* ============================================================
   benef-report.jsx — Ficha de Beneficiarios en PDF (A4)
   ============================================================ */
function BeneficiaryReport({ st, list }) {
  const coach = st.coach;
  const logoUrl = '/logo.png';

  const hombres = list.filter(s => s.genero === 'M').length;
  const mujeres = list.filter(s => s.genero === 'F').length;
  const conTiempo = list.filter(s => s.tiempo).length;

  const pctFor = (s) => {
    const gt = DB.goldTimeFor(s.prueba, s.genero, s.fechaNacimiento);
    return gt ? DB.proximityPct(s.tiempo, gt) : null;
  };
  const pcts = list.map(pctFor).filter(p => p != null);
  const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

  return (
    <div className="report-viewer">

      {/* ══════════════ PÁGINA 1: Resumen + Prueba/Tiempo ══════════════ */}
      <div className="report-page">
        <div className="rp-header">
          <div className="rp-brand">
            <img src={logoUrl} alt="Promesas Chile" />
            <div>
              <div className="rp-program">Promesas Chile · Natación</div>
              <div className="rp-doctype">Ficha de Beneficiarios</div>
            </div>
          </div>
          <div className="rp-period">
            <div className="rp-period-label">Fecha de emisión</div>
            <div className="rp-period-val">{fmtDate(todayISO())}</div>
          </div>
        </div>

        <div className="rp-coach">
          <div><span className="rp-k">Técnico responsable</span><span className="rp-v">{coach.nombre}</span></div>
          <div><span className="rp-k">Rol</span><span className="rp-v">{coach.rol}</span></div>
          <div><span className="rp-k">Región</span><span className="rp-v">{coach.region}</span></div>
          <div><span className="rp-k">Contacto</span><span className="rp-v">{coach.email}</span></div>
        </div>

        <div className="rp-section">
          <h2 className="rp-h">Resumen del grupo</h2>
          <div className="rp-stats">
            <div className="rp-stat">
              <div className="rp-stat-v">{list.length}</div>
              <div className="rp-stat-l">Beneficiarios</div>
            </div>
            <div className="rp-stat">
              <div className="rp-stat-v">{hombres}</div>
              <div className="rp-stat-l">Hombres</div>
            </div>
            <div className="rp-stat">
              <div className="rp-stat-v">{mujeres}</div>
              <div className="rp-stat-l">Mujeres</div>
            </div>
            <div className="rp-stat">
              <div className="rp-stat-v">{conTiempo}</div>
              <div className="rp-stat-l">Con tiempo registrado</div>
            </div>
            <div className="rp-stat rp-stat-hl">
              <div className="rp-stat-v">{avgPct != null ? `${avgPct}%` : '—'}</div>
              <div className="rp-stat-l">Promedio % del oro sudamericano</div>
            </div>
          </div>
        </div>

        <div className="rp-section">
          <h2 className="rp-h">Prueba de clasificación</h2>
          <table className="rp-table">
            <thead>
              <tr>
                <th>Nadador</th>
                <th>Categoría</th>
                <th>Género</th>
                <th>RUT</th>
                <th>Prueba</th>
                <th className="num">Tiempo</th>
                <th className="num">% Oro</th>
              </tr>
            </thead>
            <tbody>
              {list.map(s => {
                const p = pctFor(s);
                return (
                  <tr key={s.id}>
                    <td className="strong">{s.nombre}</td>
                    <td>{DB.categoryFor(s.fechaNacimiento)}</td>
                    <td>{s.genero === 'F' ? 'Femenino' : 'Masculino'}</td>
                    <td>{s.rut || '—'}</td>
                    <td>{s.prueba || '—'}</td>
                    <td className="num">{s.tiempo || '—'}</td>
                    <td className="num strong">{p != null ? `${p}%` : '—'}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#8A99A6', padding: '20px 10px' }}>Sin beneficiarios registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rp-spacer" />
        <div className="rp-page-num">Página 1 de 2 · {coach.programa}</div>
      </div>

      {/* ══════════════ PÁGINA 2: Datos de contacto ══════════════ */}
      <div className="report-page">
        <div className="rp-cont-header">
          <span className="rp-cont-title">Promesas Chile · Natación — Ficha de Beneficiarios</span>
          <span className="rp-cont-meta">{fmtDate(todayISO())}</span>
        </div>

        <div className="rp-section">
          <h2 className="rp-h">Datos de contacto y responsables</h2>
          <table className="rp-table">
            <thead>
              <tr>
                <th>Nadador</th>
                <th>Tutor</th>
                <th>Correo tutor</th>
                <th>Teléfono</th>
                <th>Club</th>
                <th>Colegio</th>
                <th>Dirección</th>
              </tr>
            </thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id}>
                  <td className="strong">{s.nombre}</td>
                  <td>{s.tutor || '—'}</td>
                  <td>{s.correoTutor || '—'}</td>
                  <td>{s.telefono || '—'}</td>
                  <td>{s.club || '—'}</td>
                  <td>{s.colegio || '—'}</td>
                  <td>{s.direccion || '—'}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#8A99A6', padding: '20px 10px' }}>Sin beneficiarios registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rp-spacer" />

        <div className="rp-foot">
          <div>{coach.programa} — Generado el {fmtDateLong(todayISO())}</div>
          <div className="rp-sign">
            <span className="rp-sign-line" />
            {coach.nombre} · {coach.rol}
          </div>
        </div>
      </div>
    </div>
  );
}

export { BeneficiaryReport };
