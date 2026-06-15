/* ============================================================
   components.jsx — primitivas de UI, iconos, hooks y helpers
   (portado del prototipo a módulos ES)
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from 'react';
import { DB } from '../lib/db.js';

/* ---------- Iconos (stroke, viewBox 24) ---------- */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  check: 'M20 6 9 17l-5-5',
  checkSquare: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  x: 'M18 6 6 18M6 6l12 12',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6',
  menu: 'M3 12h18M3 6h18M3 18h18',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  play: 'M6 4l14 8-14 8V4Z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  reset: 'M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8M3 3v5h5',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  wave: 'M2 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 12c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2M2 18c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2',
  arm: 'M6 20l4-9 3 2 2-4M4 4l3 3M14 4l6 6',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 6l-10 7L2 6',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  building: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 12v.01M9 15v.01M9 18v.01',
  school: 'M22 9 12 5 2 9l10 4 10-4ZM6 10.6V16c0 1 2.5 3 6 3s6-2 6-3v-5.4',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM7 11V7a5 5 0 0 1 10 0v4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3Z',
  trend: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01',
  wifi: 'M5 12.55a11 11 0 0 1 14 0M2 8.82a16 16 0 0 1 20 0M8.5 16.43a6 6 0 0 1 7 0M12 20h.01',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
};

export function Icon({ name, className, style }) {
  const d = ICONS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}
    </svg>
  );
}

/* ---------- Colores ---------- */
const AV_COLORS = ['#00A6C6', '#1FA971', '#7B5BD6', '#E0793B', '#D6457B', '#3B7BE0', '#159B8C', '#C6962B'];
export function avatarColor(name) {
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % AV_COLORS.length;
  return AV_COLORS[h];
}
export function getInitials(name) {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?';
}

export function Avatar({ name, size = 36, className = 'avatar-sm' }) {
  return (
    <div className={className} style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.36 }}>
      {getInitials(name)}
    </div>
  );
}

/* ---------- Hook de estado global ---------- */
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => DB.subscribe(() => force(x => x + 1)), []);
  return DB.get();
}

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export function useToast() { return useContext(ToastCtx); }
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div className="toast" key={t.id}><Icon name="check" /><span>{t.msg}</span></div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Botón ---------- */
export function Button({ variant = 'primary', size, icon, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ');
  return <button className={cls} {...rest}>{icon && <Icon name={icon} />}{children}</button>;
}

/* ---------- Modal ---------- */
export function Modal({ title, sub, onClose, children, foot, maxWidth = 720 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
export function Field({ label, req, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}{req && <span className="req"> *</span>}</label>}
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

/* ---------- Estado vacío ---------- */
export function Empty({ icon = 'inbox', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <p className="big">{title}</p>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* ---------- Confirmación ---------- */
export function Confirm({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onClose, requireText }) {
  const [txt, setTxt] = useState('');
  const blocked = requireText && txt.trim().length < 3;
  return (
    <Modal title={title} onClose={onClose} maxWidth={460}
      foot={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => { onConfirm(txt); onClose(); }}>{confirmLabel}</Button>
      </>}>
      <p style={{ margin: 0, color: 'var(--slate-700)', lineHeight: 1.55, fontSize: 14.5 }}>{message}</p>
      {requireText && (
        <div style={{ marginTop: 16 }}>
          <Field label="Justificación (obligatoria)" req hint="Queda registrada como baja en el sistema.">
            <textarea className="textarea" value={txt} onChange={e => setTxt(e.target.value)} placeholder="Motivo de la baja del nadador…" />
          </Field>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Helpers de fecha/tiempo ---------- */
export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const WD_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;
}
export function fmtDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return `${WD_SHORT[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function fmtTime(secs) {
  if (secs == null) return '—';
  const neg = secs < 0;
  const s2 = Math.abs(secs);
  const m = Math.floor(s2 / 60);
  const s = s2 % 60;
  return `${neg ? '-' : ''}${m}:${s.toFixed(2).padStart(5, '0')}`;
}
/* Parse "m:ss.cc" | "mm:ss" | "ss.cc" | "ss" → segundos (o null). Acepta , o . */
export function parseTime(str) {
  if (str == null) return null;
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    const mm = parseInt(parts[0], 10) || 0;
    const ss = parseFloat(parts[1]) || 0;
    return mm * 60 + ss;
  }
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

/* ---------- Helpers compartidos de dominio ---------- */
export const TR_TYPES = ['Técnica', 'Aeróbico', 'Velocidad', 'Específico', 'Resistencia', 'Recuperación'];
export const TR_TYPE_COLOR = { 'Técnica': 'cyan', 'Aeróbico': 'navy', 'Velocidad': 'red', 'Específico': 'amber', 'Resistencia': 'green', 'Recuperación': 'slate' };
export function protoById(id) { return DB.PROTOCOLS.find(p => p.id === id); }
export function metricMeta(m) { return DB.METRIC_TYPES[m]; }
