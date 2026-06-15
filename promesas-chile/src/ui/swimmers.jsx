import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';


/* ============================================================
   swimmers.jsx — Nadadores (DAR / Beneficiarios) CRUD
   ============================================================ */
const SW_EMPTY = {
  nombre: '', rut: '', fechaNacimiento: '', genero: 'M', correo: '',
  tutor: '', correoTutor: '', telefono: '', club: '', direccion: '', colegio: '',
};

function SwimmerForm({ initial, group, onSave, onClose }) {
  const [f, setF] = useState({ ...SW_EMPTY, ...initial });
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const cat = DB.categoryFor(f.fechaNacimiento);
  const age = DB.ageFor(f.fechaNacimiento);
  const valid = f.nombre.trim() && f.rut.trim() && f.fechaNacimiento;
  return (
    <Modal
      title={initial ? 'Editar nadador' : 'Nuevo nadador'}
      sub={group === 'DAR' ? 'Grupo DAR — Deportista de Alto Rendimiento' : 'Grupo Beneficiarios'}
      onClose={onClose}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} onClick={() => { onSave(f); onClose(); }} icon="check">Guardar</Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field-grid">
          <Field label="Nombre completo" req><input className="input" value={f.nombre} onChange={set('nombre')} placeholder="Nombre y apellidos" /></Field>
          <Field label="RUT" req><input className="input" value={f.rut} onChange={set('rut')} placeholder="12.345.678-9" /></Field>
        </div>
        <div className="field-grid-3">
          <Field label="Fecha de nacimiento" req><input type="date" className="input" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} /></Field>
          <Field label="Género"><select className="select" value={f.genero} onChange={set('genero')}><option value="M">Masculino</option><option value="F">Femenino</option></select></Field>
          <Field label="Categoría (automática)">
            <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)', color: 'var(--cyan-700)', fontWeight: 700 }}>
              {cat}{age != null && <span style={{ color: 'var(--slate-400)', fontWeight: 600 }}>· {age} años</span>}
            </div>
          </Field>
        </div>
        <div className="divider" />
        <div className="field-grid">
          <Field label="Correo personal"><input className="input" value={f.correo} onChange={set('correo')} placeholder="nadador@mail.com" /></Field>
          <Field label="Teléfono"><input className="input" value={f.telefono} onChange={set('telefono')} placeholder="+56 9 …" /></Field>
        </div>
        <div className="field-grid">
          <Field label="Tutor responsable"><input className="input" value={f.tutor} onChange={set('tutor')} placeholder="Nombre del apoderado" /></Field>
          <Field label="Correo del tutor"><input className="input" value={f.correoTutor} onChange={set('correoTutor')} placeholder="tutor@mail.com" /></Field>
        </div>
        <div className="field-grid">
          <Field label="Club de pertenencia"><input className="input" value={f.club} onChange={set('club')} placeholder="Club deportivo" /></Field>
          <Field label="Colegio"><input className="input" value={f.colegio} onChange={set('colegio')} placeholder="Establecimiento educacional" /></Field>
        </div>
        <Field label="Dirección particular"><input className="input" value={f.direccion} onChange={set('direccion')} placeholder="Calle, número, comuna" /></Field>
      </div>
    </Modal>
  );
}

function SwimmerDetail({ swimmer, onClose, onEdit }) {
  const st = useStore();
  const age = DB.ageFor(swimmer.fechaNacimiento);
  const cat = DB.categoryFor(swimmer.fechaNacimiento);
  // attendance summary this month
  const ym = todayISO().slice(0, 7);
  const att = st.attendance[swimmer.id] || {};
  const present = Object.keys(att).filter(d => d.startsWith(ym) && att[d]).length;
  const evals = st.evaluations.filter(e => e.swimmerIds.includes(swimmer.id));
  const rows = [
    ['user', 'RUT', swimmer.rut],
    ['calendar', 'Nacimiento', `${fmtDate(swimmer.fechaNacimiento)}${age != null ? ` · ${age} años` : ''}`],
    ['mail', 'Correo personal', swimmer.correo || '—'],
    ['phone', 'Teléfono', swimmer.telefono || '—'],
    ['users', 'Tutor', swimmer.tutor || '—'],
    ['mail', 'Correo tutor', swimmer.correoTutor || '—'],
    ['building', 'Club', swimmer.club || '—'],
    ['school', 'Colegio', swimmer.colegio || '—'],
    ['pin', 'Dirección', swimmer.direccion || '—'],
  ];
  return (
    <Modal title={swimmer.nombre} sub={`${cat} · ${swimmer.group === 'DAR' ? 'Grupo DAR' : 'Beneficiario'}`} onClose={onClose} maxWidth={640}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        <Button icon="edit" onClick={() => { onClose(); onEdit(); }}>Editar datos</Button>
      </>}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 20 }}>
        <Avatar name={swimmer.nombre} size={64} className="avatar-sm" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span className="badge badge-cyan">{cat}</span>
          <span className="badge badge-slate">{swimmer.genero === 'F' ? 'Femenino' : 'Masculino'}</span>
          {swimmer.group === 'DAR' && <span className="badge badge-green">{present} asistencias este mes</span>}
          {evals.length > 0 && <span className="badge badge-navy">{evals.length} evaluaciones</span>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {rows.map(([ic, label, val], i) => (
          <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <div className="ico" style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--line-soft)', color: 'var(--slate-500)', display: 'grid', placeItems: 'center', flex: '0 0 32px' }}>
              <Icon name={ic} style={{ width: 16, height: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: 'var(--slate-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
              <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{val}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function SwimmersView() {
  const st = useStore();
  const toast = useToast();
  const [group, setGroup] = useState('DAR');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);   // swimmer or 'new'
  const [detail, setDetail] = useState(null);
  const [removing, setRemoving] = useState(null);

  const list = useMemo(() => {
    return st.swimmers
      .filter(s => s.group === group)
      .filter(s => !q || s.nombre.toLowerCase().includes(q.toLowerCase()) || s.rut.includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [st.swimmers, group, q]);

  const counts = useMemo(() => ({
    DAR: st.swimmers.filter(s => s.group === 'DAR').length,
    BEN: st.swimmers.filter(s => s.group === 'BEN').length,
  }), [st.swimmers]);

  const save = (data) => {
    if (editing && editing !== 'new') { DB.updateSwimmer(editing.id, data); toast('Nadador actualizado'); }
    else { DB.addSwimmer({ ...data, group }); toast('Nadador agregado'); }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="tabs">
          <button className={`tab ${group === 'DAR' ? 'active' : ''}`} onClick={() => setGroup('DAR')}>DAR · {counts.DAR}</button>
          <button className={`tab ${group === 'BEN' ? 'active' : ''}`} onClick={() => setGroup('BEN')}>Beneficiarios · {counts.BEN}</button>
        </div>
        <div className="search">
          <Icon name="search" />
          <input className="input" placeholder="Buscar por nombre o RUT…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <Button icon="plus" onClick={() => setEditing('new')}>Nuevo nadador</Button>
      </div>

      {group === 'BEN' && (
        <div className="card card-pad" style={{ display: 'flex', gap: 13, alignItems: 'flex-start', marginBottom: 18, background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)' }}>
          <Icon name="alert" style={{ width: 20, height: 20, stroke: 'var(--cyan-700)', flex: '0 0 20px', marginTop: 2 }} />
          <div style={{ fontSize: 13.5, color: 'var(--cyan-700)', lineHeight: 1.5 }}>
            <strong>Beneficiarios</strong> — son 12 deportistas (6 hombres, 6 mujeres) de los que se mantiene únicamente la ficha de datos. No necesariamente entrenan en el programa. Toda baja requiere justificación y queda registrada.
          </div>
        </div>
      )}

      <div className="card">
        {list.length === 0 ? (
          <Empty icon="users" title="Sin nadadores" action={<Button icon="plus" onClick={() => setEditing('new')}>Agregar el primero</Button>}>
            No hay nadadores en este grupo todavía.
          </Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nadador</th><th>Categoría</th><th>RUT</th><th>Club</th><th>Tutor</th><th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(s)}>
                  <td>
                    <div className="name-cell">
                      <Avatar name={s.nombre} />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{s.nombre}</div>
                        <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{s.genero === 'F' ? 'Femenino' : 'Masculino'} · {DB.ageFor(s.fechaNacimiento)} años</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-cyan">{DB.categoryFor(s.fechaNacimiento)}</span></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.rut}</td>
                  <td>{s.club || '—'}</td>
                  <td>{s.tutor || '—'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn-icon" title="Editar" onClick={() => setEditing(s)}><Icon name="edit" /></button>
                      <button className="btn-icon" title="Eliminar" onClick={() => setRemoving(s)}><Icon name="trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {st.bajas.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="section-title"><h2>Registro de bajas</h2><div className="line" /></div>
          <div className="card">
            <table className="tbl">
              <thead><tr><th>Nadador</th><th>Grupo</th><th>Fecha</th><th>Justificación</th></tr></thead>
              <tbody>
                {st.bajas.slice().reverse().map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{b.nombre}</td>
                    <td><span className="badge badge-slate">{b.group === 'DAR' ? 'DAR' : 'Beneficiario'}</span></td>
                    <td>{fmtDate(b.fecha)}</td>
                    <td style={{ maxWidth: 360 }}>{b.justificacion || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <SwimmerForm
          initial={editing === 'new' ? null : editing}
          group={editing === 'new' ? group : editing.group}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {detail && <SwimmerDetail swimmer={detail} onClose={() => setDetail(null)} onEdit={() => setEditing(detail)} />}
      {removing && (
        <Confirm
          title="Dar de baja al nadador"
          danger requireText
          message={`Vas a eliminar a ${removing.nombre}. Esta acción borra su ficha y su asistencia. Indica el motivo:`}
          confirmLabel="Dar de baja"
          onConfirm={(txt) => { DB.removeSwimmer(removing.id, txt); toast('Nadador dado de baja'); }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

export { SwimmersView };
