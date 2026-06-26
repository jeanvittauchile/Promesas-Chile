import React, { useState } from 'react';
import { DB } from '../lib/db.js';
import { useStore, useToast, Button, Icon } from './components.jsx';

/* ============================================================
   goldtimes.jsx — Tabla editable de tiempos oro sudamericano
   ============================================================ */

function GoldTimesView() {
  const st = useStore();
  const toast = useToast();
  const [cat, setCat] = useState('Juv A');
  const [editing, setEditing] = useState(null); // { prueba, f, m }

  const customCat = st.goldTimes?.[cat] || {};
  const hasCustom = Object.keys(customCat).some(g => Object.keys(customCat[g] || {}).length > 0);

  function startEdit(prueba, curF, curM) {
    setEditing({ prueba, f: curF || '', m: curM || '' });
  }

  function saveEdit() {
    const key = DB.EVENT_KEY[editing.prueba];
    if (key) {
      DB.updateGoldTime(cat, 'F', key, editing.f.trim() || null);
      DB.updateGoldTime(cat, 'M', key, editing.m.trim() || null);
    }
    setEditing(null);
    toast('Tiempo actualizado');
  }

  function resetCat() {
    DB.resetGoldTimes(cat);
    setEditing(null);
    toast('Tiempos restaurados a valores por defecto');
  }

  return (
    <div>
      <div className="toolbar">
        <div className="tabs">
          {DB.GOLD_CATS.map(c => (
            <button
              key={c.id}
              className={`tab ${cat === c.id ? 'active' : ''}`}
              onClick={() => { setCat(c.id); setEditing(null); }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {hasCustom && (
          <Button variant="ghost" icon="refresh" onClick={resetCat}>
            Restaurar por defecto
          </Button>
        )}
      </div>

      <div className="card card-pad" style={{ background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)', marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: 'var(--cyan-700)', lineHeight: 1.5 }}>
          <strong>Oro Sudamericano — {DB.GOLD_CATS.find(c => c.id === cat)?.label}</strong>
          {' '}· Tiempos de referencia para el cálculo de cercanía a la marca.
          Haz clic en <Icon name="edit" style={{ width: 13, height: 13, display: 'inline', verticalAlign: 'middle' }} /> para editar una prueba.
          Los valores modificados se muestran en <strong style={{ color: 'var(--cyan-700)' }}>azul</strong>.
          {hasCustom && <span style={{ marginLeft: 6, fontWeight: 700 }}>· Hay valores personalizados activos.</span>}
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Prueba</th>
              <th>Damas</th>
              <th>Varones</th>
              <th style={{ textAlign: 'right', width: 56 }}></th>
            </tr>
          </thead>
          <tbody>
            {DB.PRUEBAS.map(prueba => {
              const key = DB.EVENT_KEY[prueba];
              const defF = DB.DEFAULT_GOLD_TIMES[cat]?.F?.[key];
              const defM = DB.DEFAULT_GOLD_TIMES[cat]?.M?.[key];
              const custF = st.goldTimes?.[cat]?.F?.[key];
              const custM = st.goldTimes?.[cat]?.M?.[key];
              const curF = custF ?? defF;
              const curM = custM ?? defM;
              const isRow = editing?.prueba === prueba;

              return (
                <tr key={prueba}>
                  <td style={{ fontWeight: 600 }}>{prueba}</td>

                  <td>
                    {isRow ? (
                      <input
                        className="input"
                        style={{ width: 110, padding: '4px 8px', fontSize: 13 }}
                        value={editing.f}
                        onChange={e => setEditing(ed => ({ ...ed, f: e.target.value }))}
                        placeholder={defF || 'MM:SS.cc'}
                        autoFocus
                      />
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: custF ? 'var(--cyan-700)' : 'inherit', fontWeight: custF ? 700 : 500 }}>
                        {curF || <span style={{ color: 'var(--slate-300)' }}>—</span>}
                        {custF && <span style={{ fontSize: 10, marginLeft: 5, color: 'var(--cyan-500)', fontWeight: 600 }}>editado</span>}
                      </span>
                    )}
                  </td>

                  <td>
                    {isRow ? (
                      <input
                        className="input"
                        style={{ width: 110, padding: '4px 8px', fontSize: 13 }}
                        value={editing.m}
                        onChange={e => setEditing(ed => ({ ...ed, m: e.target.value }))}
                        placeholder={defM || 'MM:SS.cc'}
                      />
                    ) : (
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: custM ? 'var(--cyan-700)' : 'inherit', fontWeight: custM ? 700 : 500 }}>
                        {curM || <span style={{ color: 'var(--slate-300)' }}>—</span>}
                        {custM && <span style={{ fontSize: 10, marginLeft: 5, color: 'var(--cyan-500)', fontWeight: 600 }}>editado</span>}
                      </span>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    {isRow ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn-icon" title="Guardar" onClick={saveEdit}><Icon name="check" /></button>
                        <button className="btn-icon" title="Cancelar" onClick={() => setEditing(null)}><Icon name="x" /></button>
                      </div>
                    ) : (
                      <button className="btn-icon" title="Editar" onClick={() => startEdit(prueba, curF, curM)}>
                        <Icon name="edit" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { GoldTimesView };
