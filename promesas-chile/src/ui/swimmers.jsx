import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../lib/db.js';
import {
  Icon, Avatar, avatarColor, getInitials,
  useStore, useToast, Button, Modal, Field, Empty, Confirm,
  MONTHS, WD_SHORT, fmtDate, fmtDateLong, todayISO, fmtTime, parseTime,
} from './components.jsx';
import { BeneficiaryReport } from './benef-report.jsx';


/* ============================================================
   swimmers.jsx — Nadadores (DAR / Beneficiarios) CRUD
   ============================================================ */
const SW_EMPTY = {
  nombre: '', rut: '', fechaNacimiento: '', genero: 'M', correo: '',
  tutor: '', correoTutor: '', telefono: '', club: '', direccion: '', colegio: '',
  prueba: '', tiempo: '',
};

function SwimmerForm({ initial, group, onSave, onClose }) {
  const [f, setF] = useState({ ...SW_EMPTY, ...initial });
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const cat = DB.categoryFor(f.fechaNacimiento);
  const age = DB.ageFor(f.fechaNacimiento);
  const valid = f.nombre.trim();
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
          <Field label="RUT"><input className="input" value={f.rut} onChange={set('rut')} placeholder="12.345.678-9" /></Field>
        </div>
        <div className="field-grid-3">
          <Field label="Fecha de nacimiento"><input type="date" className="input" value={f.fechaNacimiento} onChange={set('fechaNacimiento')} /></Field>
          <Field label="Género"><select className="select" value={f.genero} onChange={set('genero')}><option value="M">Masculino</option><option value="F">Femenino</option></select></Field>
          <Field label="Categoría (automática)">
            <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)', color: 'var(--cyan-700)', fontWeight: 700 }}>
              {cat}{age != null && <span style={{ color: 'var(--slate-400)', fontWeight: 600 }}>· {age} años</span>}
            </div>
          </Field>
        </div>
        {group === 'BEN' && (
          <>
            <div className="divider" />
            <div className="field-grid">
              <Field label="Prueba">
                <select className="select" value={f.prueba} onChange={set('prueba')}>
                  <option value="">— seleccionar —</option>
                  {DB.PRUEBAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Tiempo de clasificación"><input className="input" value={f.tiempo} onChange={set('tiempo')} placeholder="ej: 1:05.43" /></Field>
            </div>
          </>
        )}
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
  const goldTime = swimmer.group === 'BEN' ? DB.goldTimeFor(swimmer.prueba, swimmer.genero, swimmer.fechaNacimiento) : null;
  const pct = goldTime ? DB.proximityPct(swimmer.tiempo, goldTime) : null;
  const pctColor = pct == null ? null : pct >= 95 ? '#0f766e' : pct >= 85 ? '#0369a1' : pct >= 70 ? '#b45309' : '#6b7280';
  const rows = [
    ...(swimmer.group === 'BEN' && (swimmer.prueba || swimmer.tiempo) ? [
      ['award', 'Prueba', swimmer.prueba || '—'],
      ['clock', 'Tiempo de clasificación', swimmer.tiempo
        ? `${swimmer.tiempo}${pct != null ? ` · ${pct}% del oro (${goldTime})` : ''}`
        : '—'],
    ] : []),
    ['user', 'RUT', swimmer.rut || '—'],
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
          {pct != null && <span className="badge" style={{ background: pctColor + '1a', color: pctColor, border: `1px solid ${pctColor}40` }}>{pct}% del oro sudamericano</span>}
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

function SwimmerImport({ group, onClose }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);

  function downloadTemplate() {
    const headers = group === 'BEN'
      ? ['nombre*', 'rut', 'fechaNacimiento', 'genero', 'prueba', 'tiempo', 'correo', 'tutor', 'correoTutor', 'telefono', 'club', 'colegio', 'direccion']
      : ['nombre*', 'rut', 'fechaNacimiento', 'genero', 'correo', 'tutor', 'correoTutor', 'telefono', 'club', 'colegio', 'direccion'];
    const example = group === 'BEN'
      ? ['Ana Pérez González', '12.345.678-9', '2010-03-15', 'F', '100m Mariposa', '1:05.43', 'ana@mail.com', 'María González', 'maria@mail.com', '+56 9 1234 5678', 'Club Natación Valdivia', 'Liceo San Carlos', 'Av. Principal 123, Valdivia']
      : ['Juan Pérez González', '12.345.678-9', '2010-03-15', 'M', 'juan@mail.com', 'María González', 'maria@mail.com', '+56 9 1234 5678', 'Club Natación Valdivia', 'Liceo San Carlos', 'Av. Principal 123, Valdivia'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = (group === 'BEN'
      ? [26, 18, 18, 8, 20, 14, 26, 26, 26, 18, 22, 24, 32]
      : [26, 18, 18, 8, 26, 26, 26, 18, 22, 24, 32]
    ).map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nadadores');
    XLSX.writeFile(wb, 'plantilla_nadadores.xlsx');
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
        const parsed = raw.map(r => ({
          nombre: String(r['nombre*'] || r['nombre'] || '').trim(),
          rut: String(r['rut*'] || r['rut'] || '').trim(),
          fechaNacimiento: parseExcelDate(r['fechaNacimiento*'] || r['fechaNacimiento']),
          genero: String(r['genero'] || 'M').trim().toUpperCase() === 'F' ? 'F' : 'M',
          prueba: String(r['prueba'] || '').trim(),
          tiempo: String(r['tiempo'] || '').trim(),
          correo: String(r['correo'] || '').trim(),
          tutor: String(r['tutor'] || '').trim(),
          correoTutor: String(r['correoTutor'] || '').trim(),
          telefono: String(r['telefono'] || '').trim(),
          club: String(r['club'] || '').trim(),
          colegio: String(r['colegio'] || '').trim(),
          direccion: String(r['direccion'] || '').trim(),
        })).filter(r => r.nombre || r.rut);
        setRows(parsed);
      } catch {
        toast('No se pudo leer el archivo. Usa el formato de la plantilla.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function doImport() {
    const valid = rows.filter(r => r.nombre);
    valid.forEach(r => DB.addSwimmer({ ...r, group }));
    toast(`${valid.length} nadador${valid.length !== 1 ? 'es' : ''} importado${valid.length !== 1 ? 's' : ''}`);
    onClose();
  }

  const valid = rows ? rows.filter(r => r.nombre) : [];

  return (
    <Modal title="Importar nadadores desde Excel"
      sub={group === 'DAR' ? 'Grupo DAR — Deportista de Alto Rendimiento' : 'Grupo Beneficiarios'}
      onClose={onClose} maxWidth={700}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {rows && <Button icon="check" disabled={valid.length === 0} onClick={doImport}>Importar {valid.length} nadador{valid.length !== 1 ? 'es' : ''}</Button>}
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card card-pad" style={{ background: 'var(--cyan-050)', borderColor: 'var(--cyan-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--cyan-700)', fontSize: 14, marginBottom: 4 }}>1. Descarga la plantilla Excel</div>
              <div style={{ fontSize: 12.5, color: 'var(--cyan-600)', lineHeight: 1.5 }}>
                Solo el <strong>nombre*</strong> es obligatorio. Los demás datos se pueden agregar después.<br />
                La fecha de nacimiento debe estar en formato <code>YYYY-MM-DD</code> (ej: 2010-03-15).
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
                  <tr><th>Estado</th><th>Nombre</th><th>RUT</th><th>Nacimiento</th><th>Género</th><th>Club</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const ok = r.nombre;
                    return (
                      <tr key={i} style={{ background: ok ? '' : 'var(--red-bg)' }}>
                        <td><span className={`badge badge-${ok ? 'green' : 'red'}`}>{ok ? '✓' : 'Incompleto'}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.nombre || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.rut || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                        <td>{r.fechaNacimiento || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                        <td>{r.genero === 'F' ? 'Femenino' : 'Masculino'}</td>
                        <td>{r.club || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.length - valid.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--slate-500)' }}>
                Las filas sin nombre serán omitidas al importar.
              </p>
            )}
          </div>
        )}
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
  const [importing, setImporting] = useState(false);
  const [showReport, setShowReport] = useState(false);

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

  if (showReport) {
    const benList = st.swimmers.filter(s => s.group === 'BEN').sort((a, b) => a.nombre.localeCompare(b.nombre));
    return (
      <div>
        <div className="toolbar no-print">
          <Button variant="ghost" icon="chevL" onClick={() => setShowReport(false)}>Volver</Button>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" icon="print" onClick={() => window.print()}>Imprimir</Button>
          <Button icon="download" onClick={() => window.print()}>Descargar PDF</Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <BeneficiaryReport st={st} list={benList} />
        </div>
      </div>
    );
  }

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
        {group === 'BEN' && <Button variant="ghost" icon="doc" onClick={() => setShowReport(true)}>Generar PDF</Button>}
        <Button variant="ghost" icon="upload" onClick={() => setImporting(true)}>Importar Excel</Button>
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
                <th>Nadador</th><th>Categoría</th><th>RUT</th><th>Club</th>
                {group === 'BEN' ? <><th>Prueba</th><th>Tiempo</th></> : <th>Tutor</th>}
                <th style={{ textAlign: 'right' }}>Acciones</th>
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
                        <div style={{ fontSize: 12, color: 'var(--slate-400)' }}>{s.genero === 'F' ? 'Femenino' : 'Masculino'}{DB.ageFor(s.fechaNacimiento) != null ? ` · ${DB.ageFor(s.fechaNacimiento)} años` : ''}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-cyan">{DB.categoryFor(s.fechaNacimiento)}</span></td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.rut}</td>
                  <td>{s.club || '—'}</td>
                  {group === 'BEN' ? (
                    <>
                      <td>{s.prueba || '—'}</td>
                      <td>
                        {s.tiempo || '—'}
                        {(() => {
                          const gt = DB.goldTimeFor(s.prueba, s.genero, s.fechaNacimiento);
                          const p = gt ? DB.proximityPct(s.tiempo, gt) : null;
                          if (p == null) return null;
                          const c = p >= 95 ? '#0f766e' : p >= 85 ? '#0369a1' : p >= 70 ? '#b45309' : '#6b7280';
                          return <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: c }}>({p}%)</span>;
                        })()}
                      </td>
                    </>
                  ) : <td>{s.tutor || '—'}</td>}
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
      {importing && <SwimmerImport group={group} onClose={() => setImporting(false)} />}
    </div>
  );
}

export { SwimmersView };
