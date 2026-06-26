/* ============================================================
   app.jsx — autenticación (Supabase) + shell + ajustes
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
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
import { GoldTimesView } from './goldtimes.jsx';

const LOGO = '/logo.png';

// Credenciales de cuenta compartida (opcionales — definir en .env.local y Vercel)
const SHARED_EMAIL    = import.meta.env.VITE_APP_EMAIL;
const SHARED_PASSWORD = import.meta.env.VITE_APP_PASSWORD;

/* ============================================================
   Ajustes
   ============================================================ */
function Settings({ onClose }) {
  const st = useStore();
  const toast = useToast();
  const [c, setC] = useState(st.coach);
  const set = (k) => (e) => setC(s => ({ ...s, [k]: e.target.value }));
  const [confirmReset, setConfirmReset] = useState(false);

  const saveCoach = () => { DB.updateCoach(c); toast('Datos del técnico guardados'); };

  return (
    <Modal title="Ajustes" sub="Perfil del técnico y datos" onClose={onClose} maxWidth={560}
      foot={<><div style={{ flex: 1 }} /><Button onClick={onClose}>Listo</Button></>}>
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
  { id: 'goldtimes', label: 'Oro Sudamericano', icon: 'award' },
];
const TITLES = {
  dashboard: ['Inicio', 'Resumen general del programa'],
  swimmers: ['Nadadores', 'Gestión de fichas — DAR y Beneficiarios'],
  attendance: ['Asistencia', 'Panel mensual de asistencia'],
  trainings: ['Entrenamientos', 'Calendario y planificación de sesiones'],
  evaluations: ['Evaluaciones', 'Cronómetro, brazadas y movimientos subacuáticos'],
  reports: ['Informes', 'Generación de informe mensual en PDF'],
  goldtimes: ['Oro Sudamericano', 'Tiempos de referencia por prueba y categoría'],
};

function Shell() {
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
          {route === 'goldtimes' && <GoldTimesView />}
        </div>
      </main>

      {settings && <Settings onClose={() => setSettings(false)} />}
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
   Raíz: gestiona sesión Supabase → init DB → Shell

   Si existen VITE_APP_EMAIL + VITE_APP_PASSWORD, la app usa
   una cuenta compartida: todos los dispositivos ven los mismos
   datos sin ningún paso de login.
   Sin esas variables, crea una sesión anónima local (comportamiento
   anterior, datos solo en este dispositivo).
   ============================================================ */
function Root() {
  const [phase, setPhase] = useState('boot'); // boot | app

  const applySession = useCallback(async (s) => {
    if (!s) {
      DB.teardown();
      await DB.init('local');
    } else {
      await DB.init(s.user.id);
    }
    setPhase('app');
  }, []);

  useEffect(() => {
    let unsub;
    (async () => {
      if (!hasSupabaseConfig || !supabase) {
        await DB.init('local');
        setPhase('app');
        return;
      }

      // Reusar sesión existente si la hay (evita login innecesario)
      const { data: existing } = await supabase.auth.getSession();
      if (existing.session) {
        await applySession(existing.session);
        const sub = supabase.auth.onAuthStateChange((event, s) => {
          if (event === 'INITIAL_SESSION') return;
          applySession(s);
        });
        unsub = sub.data.subscription;
        return;
      }

      // Sin sesión — iniciar sesión automáticamente
      if (SHARED_EMAIL && SHARED_PASSWORD) {
        // Cuenta compartida: mismos datos en todos los dispositivos
        const { data, error } = await supabase.auth.signInWithPassword({
          email: SHARED_EMAIL,
          password: SHARED_PASSWORD,
        });
        if (!error && data.session) {
          await applySession(data.session);
          const sub = supabase.auth.onAuthStateChange((event, s) => {
            if (event === 'INITIAL_SESSION') return;
            applySession(s);
          });
          unsub = sub.data.subscription;
          return;
        }
        console.warn('[auth] signInWithPassword falló, usando sesión anónima:', error?.message);
      }

      // Fallback: sesión anónima (datos solo en este dispositivo)
      const { data: anonData } = await supabase.auth.signInAnonymously();
      await applySession(anonData.session);
      const sub = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'INITIAL_SESSION') return;
        applySession(s);
      });
      unsub = sub.data.subscription;
    })();
    return () => { if (unsub) unsub.unsubscribe(); };
  }, [applySession]);

  if (phase === 'boot') return <Splash />;
  return <Shell />;
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
