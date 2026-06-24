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

const LOGO = '/logo.png';

/* ============================================================
   LoginScreen — acceso desde un dispositivo nuevo
   ============================================================ */
function LoginScreen({ onAnon }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // email | otp
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    if (err) setError('No se pudo enviar el código. Verifica el correo e intenta de nuevo.');
    else setStep('otp');
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (otp.trim().length < 6) return;
    setLoading(true); setError('');
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(), token: otp.trim(), type: 'email',
    });
    if (err) setError('Código incorrecto o expirado. Intenta de nuevo.');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={LOGO} alt="Promesas Chile" style={{ width: 80, marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 8px' }}>Promesas Chile</h1>
          {step === 'email'
            ? <p style={{ color: 'var(--slate-500)', fontSize: 14, margin: 0 }}>Ingresa tu correo para acceder a tus datos desde este dispositivo</p>
            : <p style={{ color: 'var(--slate-500)', fontSize: 14, margin: 0 }}>Revisa tu bandeja de entrada e ingresa el código de 6 dígitos</p>}
        </div>

        {step === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="input" type="email" placeholder="correo@ejemplo.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOtp()}
              style={{ fontSize: 16 }} autoFocus
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
            <Button onClick={sendOtp} disabled={loading || !email.trim()}>
              {loading ? 'Enviando…' : 'Enviar código de acceso'}
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--slate-200)' }} />
              <span style={{ color: 'var(--slate-400)', fontSize: 13 }}>o</span>
              <div style={{ flex: 1, height: 1, background: 'var(--slate-200)' }} />
            </div>
            <Button variant="ghost" onClick={onAnon} disabled={loading}>
              Continuar sin cuenta (solo este dispositivo)
            </Button>
          </div>
        )}

        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--slate-600)', fontSize: 14, margin: 0, textAlign: 'center' }}>
              Código enviado a <strong>{email}</strong>
            </p>
            <input
              className="input" type="text" inputMode="numeric" placeholder="000000"
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
              maxLength={6} style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center' }} autoFocus
            />
            {error && <p style={{ color: 'var(--red)', fontSize: 13, margin: 0 }}>{error}</p>}
            <Button onClick={verifyOtp} disabled={loading || otp.length < 6}>
              {loading ? 'Verificando…' : 'Ingresar'}
            </Button>
            <button
              style={{ background: 'none', border: 'none', color: 'var(--slate-400)', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
              onClick={() => { setStep('email'); setOtp(''); setError(''); }}
            >
              ← Cambiar correo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Ajustes
   ============================================================ */
function Settings({ onClose }) {
  const st = useStore();
  const toast = useToast();
  const [c, setC] = useState(st.coach);
  const set = (k) => (e) => setC(s => ({ ...s, [k]: e.target.value }));
  const [confirmReset, setConfirmReset] = useState(false);

  // Vinculación de correo para usuarios anónimos
  const [authUser, setAuthUser] = useState(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setAuthUser(data?.user ?? null));
  }, []);

  const saveCoach = () => { DB.updateCoach(c); toast('Datos del técnico guardados'); };

  const sendLinkEmail = async () => {
    if (!linkEmail.trim()) return;
    setLinkLoading(true); setLinkError('');
    const { error } = await supabase.auth.updateUser(
      { email: linkEmail.trim() },
      { emailRedirectTo: window.location.origin },
    );
    if (error) setLinkError('No se pudo enviar el correo: ' + error.message);
    else setLinkSent(true);
    setLinkLoading(false);
  };

  const isAnon = authUser?.is_anonymous === true;
  const hasEmail = authUser?.email;

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

      {hasSupabaseConfig && (
        <>
          <div className="divider" />
          <div className="section-title"><h2>Acceso desde otros dispositivos</h2><div className="line" /></div>
          {hasEmail && !isAnon ? (
            <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 0 }}>
              Cuenta vinculada a <strong>{authUser.email}</strong>. Usa ese correo para acceder desde cualquier dispositivo.
            </p>
          ) : linkSent ? (
            <p style={{ fontSize: 13, color: 'var(--green)', marginTop: 0 }}>
              Revisa tu correo <strong>{linkEmail}</strong> y haz clic en el enlace de confirmación. Una vez confirmado, podrás usar ese correo para ingresar desde otros dispositivos.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 0 }}>
                Vincula un correo a tu cuenta para acceder a tus datos desde cualquier dispositivo. Se enviará un enlace de confirmación.
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <input
                    className="input" type="email" placeholder="tu@correo.com"
                    value={linkEmail} onChange={e => setLinkEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendLinkEmail()}
                  />
                </div>
                <Button size="sm" onClick={sendLinkEmail} disabled={linkLoading || !linkEmail.trim()}>
                  {linkLoading ? 'Enviando…' : 'Vincular correo'}
                </Button>
              </div>
              {linkError && <p style={{ fontSize: 13, color: 'var(--red)', marginTop: 6 }}>{linkError}</p>}
            </>
          )}
        </>
      )}

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
   ============================================================ */
function Root() {
  const [phase, setPhase] = useState('boot'); // boot | login | app

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

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        // Sin sesión — mostrar pantalla de login para que el usuario elija
        // cómo acceder (correo o modo anónimo local).
        setPhase('login');
        const sub = supabase.auth.onAuthStateChange((event, s) => {
          if (event === 'INITIAL_SESSION') return;
          if (s) applySession(s);
        });
        unsub = sub.data.subscription;
        return;
      }

      await applySession(data.session);
      // INITIAL_SESSION ya fue manejado manualmente arriba; ignorarlo para
      // evitar una segunda hidratación que puede sobreescribir datos locales.
      const sub = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'INITIAL_SESSION') return;
        applySession(s);
      });
      unsub = sub.data.subscription;
    })();
    return () => { if (unsub) unsub.unsubscribe(); };
  }, [applySession]);

  const handleAnon = useCallback(async () => {
    const { data } = await supabase.auth.signInAnonymously();
    await applySession(data.session);
  }, [applySession]);

  if (phase === 'boot') return <Splash />;
  if (phase === 'login') return <LoginScreen onAnon={handleAnon} />;
  return <Shell />;
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
