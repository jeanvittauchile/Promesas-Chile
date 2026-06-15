/* ============================================================
   app.jsx — autenticación (Supabase) + bloqueo PIN + shell + ajustes
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { DB } from '../lib/db.js';
import { supabase, hasSupabaseConfig } from '../lib/supabase.js';
import {
  Icon, getInitials, useStore, useToast, ToastProvider, Button, Modal, Field,
} from './components.jsx';
import { Dashboard } from './dashboard.jsx';
import { SwimmersView } from './swimmers.jsx';
import { AttendanceView } from './attendance.jsx';
import { TrainingsView } from './trainings.jsx';
import { EvaluationsView } from './evaluations.jsx';
import { ReportsView } from './reports.jsx';

const LOGO = '/logo.png';

/* ============================================================
   Pantalla de autenticación (correo + contraseña — Supabase)
   ============================================================ */
function AuthScreen() {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) setMsg({ type: 'err', text: traducirError(error.message) });
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pass });
        if (error) setMsg({ type: 'err', text: traducirError(error.message) });
        else setMsg({ type: 'ok', text: 'Cuenta creada. Si tu proyecto exige verificación, revisa tu correo. Luego inicia sesión.' });
      }
    } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-aside">
        <div className="login-brand"><img src={LOGO} alt="Promesas Chile" /></div>
        <div className="login-aside-text">
          <h1>Plataforma de gestión deportiva</h1>
          <p>Nadadores, asistencia, evaluaciones de rendimiento e informes — en terreno, online y offline.</p>
        </div>
        <div className="login-waves">
          <svg viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 60 C60 30 120 90 200 60 C280 30 340 90 400 60 L400 120 L0 120 Z" /><path d="M0 80 C60 50 120 110 200 80 C280 50 340 110 400 80 L400 120 L0 120 Z" opacity=".5" /></svg>
        </div>
      </div>
      <div className="login-main">
        <form className="login-card" onSubmit={submit} style={{ textAlign: 'left' }}>
          <div className="login-lock" style={{ margin: '0 0 18px' }}><Icon name="lock" /></div>
          <h2 style={{ fontSize: 22 }}>{mode === 'signin' ? 'Ingreso del técnico' : 'Crear cuenta'}</h2>
          <p className="login-sub" style={{ marginBottom: 22 }}>
            {mode === 'signin' ? 'Accede con tu correo y contraseña.' : 'Registra el correo del técnico responsable.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Correo electrónico">
              <input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tecnico@promesaschile.cl" />
            </Field>
            <Field label="Contraseña">
              <input className="input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={6} value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" />
            </Field>
            {msg && (
              <div className="card card-pad" style={{ padding: '10px 12px', fontSize: 13, background: msg.type === 'err' ? 'var(--red-bg)' : 'var(--green-bg)', borderColor: 'transparent', color: msg.type === 'err' ? 'var(--red)' : '#137a4f' }}>
                {msg.text}
              </div>
            )}
            <Button type="submit" disabled={busy} icon={mode === 'signin' ? 'logout' : 'plus'} style={{ width: '100%' }}>
              {busy ? 'Procesando…' : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}
            </Button>
          </div>
          <div className="login-hint" style={{ textAlign: 'center' }}>
            {mode === 'signin'
              ? <>¿Sin cuenta? <button type="button" className="link" onClick={() => { setMode('signup'); setMsg(null); }} style={linkStyle}>Crear una</button></>
              : <>¿Ya tienes cuenta? <button type="button" className="link" onClick={() => { setMode('signin'); setMsg(null); }} style={linkStyle}>Ingresar</button></>}
          </div>
        </form>
      </div>
    </div>
  );
}
const linkStyle = { background: 'none', border: 'none', color: 'var(--cyan-700)', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 };
function traducirError(m) {
  if (/invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(m)) return 'Este correo ya está registrado.';
  if (/password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  return m;
}

/* ============================================================
   Bloqueo PIN de dispositivo (sobre sesión ya autenticada)
   ============================================================ */
function PinLock({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(false);
  const max = 4;

  const submit = (p) => {
    if (DB.checkPin(p)) { sessionStorage.setItem('pcn_auth', '1'); onUnlock(); }
    else { setErr(true); setShake(true); setTimeout(() => setShake(false), 420); setTimeout(() => { setPin(''); setErr(false); }, 650); }
  };
  const press = (n) => {
    if (pin.length >= max) return;
    const np = pin + n; setPin(np);
    if (np.length === max) setTimeout(() => submit(np), 120);
  };
  const del = () => setPin(p => p.slice(0, -1));

  useEffect(() => {
    const h = (e) => {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') del();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [pin]);

  return (
    <div className="login">
      <div className="login-aside">
        <div className="login-brand"><img src={LOGO} alt="Promesas Chile" /></div>
        <div className="login-aside-text">
          <h1>Plataforma de gestión deportiva</h1>
          <p>Nadadores, asistencia, evaluaciones de rendimiento e informes — en terreno, online y offline.</p>
        </div>
        <div className="login-waves">
          <svg viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 60 C60 30 120 90 200 60 C280 30 340 90 400 60 L400 120 L0 120 Z" /><path d="M0 80 C60 50 120 110 200 80 C280 50 340 110 400 80 L400 120 L0 120 Z" opacity=".5" /></svg>
        </div>
      </div>
      <div className="login-main">
        <div className={`login-card ${shake ? 'shake' : ''}`}>
          <div className="login-lock"><Icon name="lock" /></div>
          <h2>Desbloquear dispositivo</h2>
          <p className="login-sub">Introduce tu PIN de acceso rápido</p>
          <div className={`pin-dots ${err ? 'err' : ''}`}>
            {Array.from({ length: max }).map((_, i) => <span key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''} ${err ? 'err' : ''}`} />)}
          </div>
          <div className="pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} className="pin-key" onClick={() => press(String(n))}>{n}</button>)}
            <span />
            <button className="pin-key" onClick={() => press('0')}>0</button>
            <button className="pin-key pin-del" onClick={del} aria-label="Borrar"><Icon name="chevL" /></button>
          </div>
          <div className="login-hint">PIN por defecto: <strong>1234</strong> — cámbialo en Ajustes</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Ajustes
   ============================================================ */
function Settings({ onClose, onLogout }) {
  const st = useStore();
  const toast = useToast();
  const [c, setC] = useState(st.coach);
  const set = (k) => (e) => setC(s => ({ ...s, [k]: e.target.value }));
  const [oldPin, setOldPin] = useState(''); const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const saveCoach = () => { DB.updateCoach(c); toast('Datos del técnico guardados'); };
  const changePin = () => {
    if (!DB.checkPin(oldPin)) { toast('PIN actual incorrecto'); return; }
    if (!/^\d{4}$/.test(newPin)) { toast('El PIN debe tener 4 dígitos'); return; }
    DB.setPin(newPin); setOldPin(''); setNewPin(''); toast('PIN actualizado');
  };

  return (
    <Modal title="Ajustes" sub="Perfil del técnico, seguridad y datos" onClose={onClose} maxWidth={560}
      foot={<><Button variant="ghost" onClick={onLogout} icon="logout">Cerrar sesión</Button><div style={{ flex: 1 }} /><Button onClick={onClose}>Listo</Button></>}>
      <div className="section-title" style={{ marginTop: 0 }}><h2>Técnico responsable</h2><div className="line" /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field-grid">
          <Field label="Nombre"><input className="input" value={c.nombre || ''} onChange={set('nombre')} /></Field>
          <Field label="Rol"><input className="input" value={c.rol || ''} onChange={set('rol')} /></Field>
        </div>
        <div className="field-grid">
          <Field label="Región"><input className="input" value={c.region || ''} onChange={set('region')} /></Field>
          <Field label="Correo"><input className="input" value={c.email || ''} onChange={set('email')} /></Field>
        </div>
        <div><Button size="sm" icon="check" onClick={saveCoach}>Guardar perfil</Button></div>
      </div>

      <div className="divider" />
      <div className="section-title"><h2>Seguridad (PIN del dispositivo)</h2><div className="line" /></div>
      <div className="field-grid">
        <Field label="PIN actual"><input className="input" type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={e => setOldPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" /></Field>
        <Field label="Nuevo PIN (4 dígitos)"><input className="input" type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" /></Field>
      </div>
      <div style={{ marginTop: 12 }}><Button size="sm" variant="ghost" icon="lock" onClick={changePin}>Cambiar PIN</Button></div>

      <div className="divider" />
      <div className="section-title"><h2>Datos</h2><div className="line" /></div>
      <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 0 }}>
        Tus datos se sincronizan con la nube (Supabase) cuando hay conexión y quedan disponibles offline en este dispositivo.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Button size="sm" variant="ghost" icon="download" onClick={async () => { await DB.loadDemoData(); toast('Datos de demostración cargados'); }}>Cargar datos de demostración</Button>
      </div>
      {!confirmReset ? <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>Borrar todos los datos</Button>
        : <div style={{ display: 'flex', gap: 8 }}><Button size="sm" variant="danger" onClick={() => { DB.resetAll(); toast('Datos borrados'); setConfirmReset(false); }}>Confirmar borrado</Button><Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancelar</Button></div>}
    </Modal>
  );
}

/* ---------- Indicador de conexión ---------- */
function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const u = () => setOn(navigator.onLine);
    window.addEventListener('online', u); window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  return on;
}

/* ============================================================
   Shell
   ============================================================ */
const NAV = [
  { id: 'dashboard', label: 'Inicio', icon: 'home' },
  { id: 'swimmers', label: 'Nadadores', icon: 'users' },
  { id: 'attendance', label: 'Asistencia', icon: 'checkSquare' },
  { id: 'trainings', label: 'Entrenamientos', icon: 'calendar' },
  { id: 'evaluations', label: 'Evaluaciones', icon: 'timer' },
  { id: 'reports', label: 'Informes', icon: 'doc' },
];
const TITLES = {
  dashboard: ['Inicio', 'Resumen general del programa'],
  swimmers: ['Nadadores', 'Gestión de fichas — DAR y Beneficiarios'],
  attendance: ['Asistencia', 'Panel mensual de asistencia'],
  trainings: ['Entrenamientos', 'Calendario y planificación de sesiones'],
  evaluations: ['Evaluaciones', 'Cronómetro, brazadas y movimientos subacuáticos'],
  reports: ['Informes', 'Generación de informe mensual en PDF'],
};

function Shell({ onLogout }) {
  const st = useStore();
  const online = useOnline();
  const [route, setRoute] = useState('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const go = (r) => { setRoute(r); setNavOpen(false); };
  const [title, sub] = TITLES[route];

  return (
    <div className="app">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="logo-wrap"><img src={LOGO} alt="Promesas Chile" /></div>
        <div className="nav-group-label">Programa</div>
        {NAV.map(n => (
          <button key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => go(n.id)}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </button>
        ))}
        <div className="sidebar-foot">
          <button className="coach-chip" style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => setSettings(true)}>
            <div className="avatar">{getInitials(st.coach.nombre || 'Técnico')}</div>
            <div className="meta"><strong>{st.coach.nombre || 'Técnico'}</strong><span>{st.coach.rol || 'Entrenador'}</span></div>
            <Icon name="cog" style={{ width: 17, height: 17, stroke: 'rgba(255,255,255,.5)', marginLeft: 'auto' }} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar no-print">
          <button className="hamburger" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>
          <div>
            <h1>{title}</h1>
            <div className="sub">{sub}</div>
          </div>
          <div className="topbar-spacer" />
          <div className={`conn-pill ${online ? 'conn-on' : 'conn-off'}`} title={online ? 'Conectado — los cambios se sincronizan' : 'Sin conexión — trabajando en modo offline'}>
            <span className="dot" />{online ? 'En línea · sincronizado' : 'Offline · guardado local'}
          </div>
        </header>
        <div className="content" data-screen-label={title}>
          {route === 'dashboard' && <Dashboard go={go} />}
          {route === 'swimmers' && <SwimmersView />}
          {route === 'attendance' && <AttendanceView />}
          {route === 'trainings' && <TrainingsView />}
          {route === 'evaluations' && <EvaluationsView />}
          {route === 'reports' && <ReportsView />}
        </div>
      </main>

      {settings && <Settings onClose={() => setSettings(false)} onLogout={onLogout} />}
    </div>
  );
}

/* ---------- Cargando ---------- */
function Splash({ text = 'Cargando…' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <img src={LOGO} alt="" style={{ width: 120, opacity: .9, marginBottom: 16 }} />
        <div style={{ color: 'var(--slate-500)', fontWeight: 600 }}>{text}</div>
      </div>
    </div>
  );
}

/* ============================================================
   Raíz: gestiona sesión Supabase → init DB → bloqueo PIN → Shell
   ============================================================ */
function Root() {
  const [phase, setPhase] = useState('boot'); // boot | auth | locked | app
  const [session, setSession] = useState(null);

  // Asegura PIN por defecto en el dispositivo.
  useEffect(() => { if (!DB.hasPin()) DB.setPin('1234'); }, []);

  // Sesión Supabase (o modo local si no hay credenciales).
  useEffect(() => {
    let unsub;
    (async () => {
      if (!hasSupabaseConfig || !supabase) {
        await DB.init('local');
        setPhase(sessionStorage.getItem('pcn_auth') === '1' ? 'app' : 'locked');
        return;
      }
      const { data } = await supabase.auth.getSession();
      await applySession(data.session);
      const sub = supabase.auth.onAuthStateChange((_e, s) => applySession(s));
      unsub = sub.data.subscription;
    })();
    return () => { if (unsub) unsub.unsubscribe(); };
  }, []);

  async function applySession(s) {
    setSession(s);
    if (!s) {
      DB.teardown();
      await DB.init('local');
      setPhase(sessionStorage.getItem('pcn_auth') === '1' ? 'app' : 'locked');
      return;
    }
    await DB.init(s.user.id);
    setPhase(sessionStorage.getItem('pcn_auth') === '1' ? 'app' : 'locked');
  }

  const logout = async () => {
    sessionStorage.removeItem('pcn_auth');
    if (hasSupabaseConfig && supabase) await supabase.auth.signOut();
    // onAuthStateChange dispara applySession(null) → fase locked
    else { DB.teardown(); await DB.init('local'); setPhase('locked'); }
  };

  if (phase === 'boot') return <Splash />;
  if (phase === 'locked') return <PinLock onUnlock={() => setPhase('app')} />;
  return <Shell onLogout={logout} />;
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
