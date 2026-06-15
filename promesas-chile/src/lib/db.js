/* ============================================================
   db.js — capa de datos offline-first respaldada por Supabase.

   Expone `DB` con la MISMA interfaz del prototipo (get/subscribe +
   mutaciones síncronas optimistas), de modo que los componentes
   portados funcionan sin cambios. Cada mutación:
     1) actualiza el estado local en memoria (optimista),
     2) lo persiste en caché (localStorage) para uso offline,
     3) notifica a los suscriptores (re-render),
     4) encola la escritura remota a Supabase y la sincroniza.

   Si faltan las credenciales de Supabase, funciona 100% local.
   ============================================================ */
import { supabase, hasSupabaseConfig } from './supabase.js';
import {
  PROTOCOLS, METRIC_TYPES, CAT_BY_YEAR,
  categoryFor, ageFor, levelFor, parseVolume, volumenFor, uid,
  emptyState, seed,
} from './domain.js';

const PIN_KEY = 'pcn_pin_v1';
const cacheKey = (userId) => `pcn_cache_v1:${userId || 'local'}`;

let state = emptyState();
let userId = null;
let ready = false;
const subs = new Set();
const queue = [];          // operaciones remotas pendientes
let flushing = false;
let hydrateTimer = null;
let channel = null;

/* ---------- núcleo ---------- */
function emit() { subs.forEach(fn => fn()); }
function persistCache() {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(state)); } catch (e) { /* cuota */ }
}
function commit() { persistCache(); emit(); }

function loadCache() {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (raw) { state = JSON.parse(raw); return true; }
  } catch (e) { /* ignore */ }
  return false;
}

/* ---------- sincronización remota ---------- */
function enqueue(op) { queue.push(op); flush(); }

async function flush() {
  if (flushing || !hasSupabaseConfig || !supabase || !userId || !navigator.onLine) return;
  flushing = true;
  try {
    while (queue.length) {
      const op = queue[0];
      const ok = await runOp(op);
      if (!ok) break;          // reintentar más tarde (online/timer)
      queue.shift();
    }
  } finally {
    flushing = false;
  }
}

async function runOp(op) {
  try {
    if (op.type === 'upsert') {
      const { error } = await supabase.from(op.table).upsert({ id: op.id, owner: userId, doc: op.doc });
      return !error;
    }
    if (op.type === 'delete') {
      const { error } = await supabase.from(op.table).delete().eq('owner', userId).eq('id', op.id);
      return !error;
    }
    if (op.type === 'coach') {
      const { error } = await supabase.from('coach').upsert({ owner: userId, doc: op.doc });
      return !error;
    }
    if (op.type === 'att-set') {
      const { error } = await supabase.from('attendance').upsert({ owner: userId, swimmer_id: op.swimmerId, day: op.day });
      return !error;
    }
    if (op.type === 'att-del') {
      const { error } = await supabase.from('attendance').delete().eq('owner', userId).eq('swimmer_id', op.swimmerId).eq('day', op.day);
      return !error;
    }
    if (op.type === 'att-del-swimmer') {
      const { error } = await supabase.from('attendance').delete().eq('owner', userId).eq('swimmer_id', op.swimmerId);
      return !error;
    }
    if (op.type === 'report') {
      const { error } = await supabase.from('reports').upsert({ owner: userId, ym: op.ym, notas: op.notas, resultados: op.resultados });
      return !error;
    }
    if (op.type === 'wipe') {
      for (const t of ['swimmers', 'trainings', 'evaluations', 'bajas']) {
        await supabase.from(t).delete().eq('owner', userId);
      }
      await supabase.from('attendance').delete().eq('owner', userId);
      await supabase.from('reports').delete().eq('owner', userId);
      return true;
    }
    return true;
  } catch (e) {
    console.warn('[sync] operación falló, se reintentará:', op.type, e?.message);
    return false;
  }
}

/* ---------- hidratación desde Supabase ---------- */
async function hydrateFromCloud() {
  if (!hasSupabaseConfig || !supabase || !userId) return;
  try {
    const [sw, tr, ev, bj, att, rep, co] = await Promise.all([
      supabase.from('swimmers').select('doc').eq('owner', userId),
      supabase.from('trainings').select('doc').eq('owner', userId),
      supabase.from('evaluations').select('doc').eq('owner', userId),
      supabase.from('bajas').select('doc').eq('owner', userId),
      supabase.from('attendance').select('swimmer_id, day').eq('owner', userId),
      supabase.from('reports').select('ym, notas, resultados').eq('owner', userId),
      supabase.from('coach').select('doc').eq('owner', userId).maybeSingle(),
    ]);

    const next = emptyState();
    next.swimmers = (sw.data || []).map(r => r.doc);
    next.trainings = (tr.data || []).map(r => r.doc);
    next.evaluations = (ev.data || []).map(r => r.doc);
    next.bajas = (bj.data || []).map(r => r.doc);

    const attendance = {};
    (att.data || []).forEach(r => {
      const day = typeof r.day === 'string' ? r.day.slice(0, 10) : r.day;
      (attendance[r.swimmer_id] = attendance[r.swimmer_id] || {})[day] = true;
    });
    next.attendance = attendance;

    const reports = {};
    (rep.data || []).forEach(r => { reports[r.ym] = { notas: r.notas || '', resultados: r.resultados || '' }; });
    next.reports = reports;

    if (co.data && co.data.doc) {
      next.coach = co.data.doc;
    } else {
      // primer ingreso: crea fila de técnico por defecto
      next.coach = state.coach && state.coach.email ? state.coach : emptyState().coach;
      enqueue({ type: 'coach', doc: next.coach });
    }

    state = next;
    commit();
  } catch (e) {
    console.warn('[hydrate] no se pudo leer de la nube (se usa caché local):', e?.message);
  }
}

function scheduleHydrate() {
  if (hydrateTimer) clearTimeout(hydrateTimer);
  hydrateTimer = setTimeout(() => { if (queue.length === 0) hydrateFromCloud(); }, 400);
}

function subscribeRealtime() {
  if (!hasSupabaseConfig || !supabase || !userId) return;
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel(`pcn:${userId}`);
  ['swimmers', 'trainings', 'evaluations', 'bajas', 'attendance', 'reports', 'coach'].forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `owner=eq.${userId}` }, scheduleHydrate);
  });
  channel.subscribe();
}

/* ---------- inicialización / sesión ---------- */
async function init(id) {
  userId = id || null;
  loadCache();
  emit();
  if (hasSupabaseConfig && supabase && userId) {
    await hydrateFromCloud();
    subscribeRealtime();
    window.addEventListener('online', flush);
    flush();
  }
  ready = true;
  return state;
}

function teardown() {
  if (channel && supabase) { supabase.removeChannel(channel); channel = null; }
  window.removeEventListener('online', flush);
  userId = null;
  state = emptyState();
  queue.length = 0;
  emit();
}

/* ---------- API pública (idéntica al prototipo) ---------- */
export const DB = {
  PROTOCOLS, METRIC_TYPES, CAT_BY_YEAR,
  categoryFor, ageFor, levelFor, parseVolume, volumenFor, uid,
  get: () => state,
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  isReady: () => ready,
  init, teardown,

  // PIN (bloqueo de dispositivo local)
  hasPin() { return !!localStorage.getItem(PIN_KEY); },
  setPin(p) { localStorage.setItem(PIN_KEY, p); },
  checkPin(p) { return localStorage.getItem(PIN_KEY) === p; },

  // Técnico
  updateCoach(patch) {
    state.coach = { ...state.coach, ...patch };
    commit();
    enqueue({ type: 'coach', doc: state.coach });
  },

  // Nadadores
  addSwimmer(data) {
    const s = { id: uid(), activo: true, justificacion: '', creado: new Date().toISOString().slice(0, 10), ...data };
    state.swimmers.push(s);
    commit();
    enqueue({ type: 'upsert', table: 'swimmers', id: s.id, doc: s });
  },
  updateSwimmer(id, patch) {
    const s = state.swimmers.find(x => x.id === id);
    if (s) { Object.assign(s, patch); commit(); enqueue({ type: 'upsert', table: 'swimmers', id, doc: s }); }
  },
  removeSwimmer(id, justificacion) {
    const s = state.swimmers.find(x => x.id === id);
    if (s) {
      const baja = { id: uid(), swimmerId: id, nombre: s.nombre, group: s.group, justificacion: justificacion || '', fecha: new Date().toISOString().slice(0, 10) };
      state.bajas.push(baja);
      state.swimmers = state.swimmers.filter(x => x.id !== id);
      delete state.attendance[id];
      commit();
      enqueue({ type: 'upsert', table: 'bajas', id: baja.id, doc: baja });
      enqueue({ type: 'delete', table: 'swimmers', id });
      enqueue({ type: 'att-del-swimmer', swimmerId: id });
    }
  },

  // Entrenamientos
  addTraining(data) {
    const t = { id: uid(), ...data };
    state.trainings.push(t);
    commit();
    enqueue({ type: 'upsert', table: 'trainings', id: t.id, doc: t });
  },
  updateTraining(id, patch) {
    const t = state.trainings.find(x => x.id === id);
    if (t) { Object.assign(t, patch); commit(); enqueue({ type: 'upsert', table: 'trainings', id, doc: t }); }
  },
  removeTraining(id) {
    state.trainings = state.trainings.filter(x => x.id !== id);
    commit();
    enqueue({ type: 'delete', table: 'trainings', id });
  },

  // Asistencia
  toggleAttendance(swimmerId, day) {
    if (!state.attendance[swimmerId]) state.attendance[swimmerId] = {};
    const cur = state.attendance[swimmerId][day];
    if (cur) { delete state.attendance[swimmerId][day]; commit(); enqueue({ type: 'att-del', swimmerId, day }); }
    else { state.attendance[swimmerId][day] = true; commit(); enqueue({ type: 'att-set', swimmerId, day }); }
  },
  setAttendance(swimmerId, day, val) {
    if (!state.attendance[swimmerId]) state.attendance[swimmerId] = {};
    if (val) { state.attendance[swimmerId][day] = true; commit(); enqueue({ type: 'att-set', swimmerId, day }); }
    else { delete state.attendance[swimmerId][day]; commit(); enqueue({ type: 'att-del', swimmerId, day }); }
  },

  // Evaluaciones
  addEvaluation(data) {
    const e = { id: uid(), ...data };
    state.evaluations.push(e);
    commit();
    enqueue({ type: 'upsert', table: 'evaluations', id: e.id, doc: e });
  },
  updateEvaluation(id, patch) {
    const e = state.evaluations.find(x => x.id === id);
    if (e) { Object.assign(e, patch); commit(); enqueue({ type: 'upsert', table: 'evaluations', id, doc: e }); }
  },
  removeEvaluation(id) {
    state.evaluations = state.evaluations.filter(x => x.id !== id);
    commit();
    enqueue({ type: 'delete', table: 'evaluations', id });
  },

  // Informes
  setReportMeta(ym, patch) {
    if (!state.reports) state.reports = {};
    state.reports[ym] = { ...(state.reports[ym] || { notas: '', resultados: '' }), ...patch };
    commit();
    const r = state.reports[ym];
    enqueue({ type: 'report', ym, notas: r.notas || '', resultados: r.resultados || '' });
  },

  // Datos
  async loadDemoData() {
    const data = seed();
    state = data;
    commit();
    enqueue({ type: 'wipe' });
    enqueue({ type: 'coach', doc: data.coach });
    data.swimmers.forEach(s => enqueue({ type: 'upsert', table: 'swimmers', id: s.id, doc: s }));
    data.trainings.forEach(t => enqueue({ type: 'upsert', table: 'trainings', id: t.id, doc: t }));
    data.evaluations.forEach(e => enqueue({ type: 'upsert', table: 'evaluations', id: e.id, doc: e }));
    Object.entries(data.attendance).forEach(([sid, days]) => {
      Object.keys(days).forEach(day => { if (days[day]) enqueue({ type: 'att-set', swimmerId: sid, day }); });
    });
  },
  resetAll() {
    const blank = emptyState();
    blank.coach = state.coach;     // conserva el perfil del técnico
    state = blank;
    commit();
    enqueue({ type: 'wipe' });
  },
};

export default DB;
