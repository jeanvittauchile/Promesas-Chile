/* ============================================================
   domain.js — lógica de dominio pura (sin estado ni red).
   Portada fielmente desde el prototipo (store.js).
   Reglas: categoría por año, edad, niveles, parser de volumen,
   protocolos de evaluación y tipos de métrica.
   ============================================================ */

/* ---------- Categoría por año de nacimiento ---------- */
export const CAT_BY_YEAR = {
  2018: 'Infantil E', 2017: 'Infantil D', 2016: 'Infantil C',
  2015: 'Infantil A', 2014: 'Infantil B1', 2013: 'Infantil B2',
  2012: 'Juvenil A1', 2011: 'Juvenil A2', 2010: 'Juvenil B1',
  2009: 'Juvenil B2', 2008: 'Juvenil B3',
};

export function categoryFor(fechaNac) {
  if (!fechaNac) return '—';
  const y = parseInt(String(fechaNac).slice(0, 4), 10);
  if (!y) return '—';
  if (y <= 2007) return 'Mayores';
  return CAT_BY_YEAR[y] || '—';
}

export function ageFor(fechaNac) {
  if (!fechaNac) return null;
  const b = new Date(fechaNac); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

/* Devuelve el nivel 1-10 según el tiempo promedio, o null si es más lento que nivel 10 */
export function levelFor(protocol, avgTime) {
  if (!protocol || !protocol.niveles) return null;
  const ns = protocol.niveles;
  for (let i = 0; i < ns.length; i++) {
    if (avgTime <= ns[i]) return i + 1;
  }
  return null;
}

/* ---------- Volumen de la sesión ----------
   Analiza el contenido (texto libre, una serie por línea) y reparte los
   metros en: total, técnica, pateo (patada), brazos (pull) y velocidad ≤25 m.
   Notación soportada: "400", "12×25", "10x100", "3×(400 libre + 100 patada)". */
const VOL_KW = {
  pateo: /(patada|pateo|\bkick\b|aleta|piernas?\b|tabla)/i,
  brazos: /(\bbrazos\b|\bpull\b|tracci[oó]n|\bremo\b|remad|paddle|palet)/i,
  tecnica: /(t[eé]cnic|viraje|stream|onda|subacu|\bsalida|drill|ejercicio|coordinaci|deslizamiento|alineaci|posici[oó]n|cat[ck]?\s?up|punto muerto|skill)/i,
  velocidad: /(sprint|velocidad|m[aá]xim|explosiv|\bfuerte\b|all[\s-]?out|partida|reacci[oó]n)/i,
};

function classifySeg(seg, repDist) {
  const s = (seg || '').toLowerCase();
  if (VOL_KW.pateo.test(s)) return 'pateo';
  if (VOL_KW.brazos.test(s)) return 'brazos';
  if (VOL_KW.velocidad.test(s)) return (repDist != null && repDist <= 25) ? 'velocidad' : null;
  if (VOL_KW.tecnica.test(s)) return 'tecnica';
  return null;
}

function segMeters(seg) {
  const nx = String(seg).match(/(\d+)\s*[×xX*]\s*(\d+)/);
  if (nx) { const r = parseInt(nx[1], 10), d = parseInt(nx[2], 10); return { meters: r * d, repDist: d }; }
  const d = String(seg).match(/(\d+)/);
  if (d) { const v = parseInt(d[1], 10); return { meters: v, repDist: v }; }
  return { meters: 0, repDist: null };
}

export function parseVolume(contenido) {
  const out = { total: 0, tecnica: 0, pateo: 0, brazos: 0, velocidad: 0 };
  const lines = String(contenido || '').split(/\n/).map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const paren = line.match(/(\d+)\s*[×xX*]\s*\(([^)]*)\)/);
    if (paren) {
      const reps = parseInt(paren[1], 10);
      paren[2].split('+').forEach(part => {
        const { meters, repDist } = segMeters(part);
        const m = meters * reps;
        if (m > 0) { out.total += m; const c = classifySeg(part, repDist); if (c) out[c] += m; }
      });
      return;
    }
    const { meters, repDist } = segMeters(line);
    if (meters > 0) { out.total += meters; const c = classifySeg(line, repDist); if (c) out[c] += meters; }
  });
  return out;
}

/* Volumen efectivo de un entrenamiento: usa el ajuste manual si existe, o el cálculo automático. */
export function volumenFor(t) {
  if (t && t.volumen && t.volumen.manual) {
    const v = t.volumen;
    return { total: +v.total || 0, tecnica: +v.tecnica || 0, pateo: +v.pateo || 0, brazos: +v.brazos || 0, velocidad: +v.velocidad || 0, manual: true };
  }
  return { ...parseVolume(t ? t.contenido : ''), manual: false };
}

/* ---------- Protocolos de evaluación ---------- */
export const PROTOCOLS = [
  {
    id: 'libre', nombre: 'Estilo Libre', set: '10 × 100 mts Libres @ 2:20', repeticiones: 10, distancia: 100, ciclo: 140,
    foco: [
      'Controlando cantidad de brazadas por tramo',
      'Respiración bilateral',
      'Utilización de brazos y piernas — estrategia de nado',
      'Aproximación a la vuelta + tiempo de giro de cabeza',
      'Vueltas + salida en streamline + 5 ondas subacuático',
      'Coordinación salida última patada delfín con patada estilo + primera brazada sin respirar',
      'Estrategia de llegada últimos 5 mts + toque en pared',
    ],
  },
  {
    id: 'combinado', nombre: 'Estilo Combinado', set: '10 × 100 mts Combinado @ 2:50', repeticiones: 10, distancia: 100, ciclo: 170,
    foco: [
      'Controlando cantidad de brazadas por tramo',
      'Dominar la respiración para mantener el cuerpo alineado',
      'Utilización de brazos y piernas — estrategia de nado',
      'Aproximación a la vuelta + tiempo de giro mano-cabeza',
      'Vueltas + salida en streamline + 5 ondas subacuático',
      'Coordinación salida última patada delfín con patada estilo + primera brazada',
      'Estrategia de llegada últimos 5 mts + toque en pared',
    ],
  },
  {
    id: 'prueba', nombre: 'Preparación de la prueba', set: '1 × 200 mts Combinado (situación de competencia)', repeticiones: 1, distancia: 200,
    foco: [
      'Controlando cantidad de brazadas por tramo',
      'Utilización de brazos y piernas — estrategia de nado',
      'Aproximación a vueltas + salida en streamline',
      'Puesta en práctica de la estrategia (planteo del nadador)',
      'Estrategia de llegada últimos 5 mts + toque en pared',
    ],
  },
  {
    id: 'mariposa', nombre: 'Estilo Mariposa', set: '2 × 100 mts Mariposa', repeticiones: 2, distancia: 100,
    foco: [
      'Controlando cantidad de brazadas por tramo',
      'Realizar de 2 a 3 brazadas por respiración',
      'Aproximación a la vuelta + toque pared + rodillas al pecho antes de girar',
      'Estrategia de llegada últimos 5 mts + toque en pared',
    ],
  },
  {
    id: 'salida15', nombre: 'Tiempo de salida a 15 mts', set: 'Reacción → cabeza pasa los 15 mts',
    compuesta: true, tiempoLabel: 'Tiempo total (reacción → 15 mts)', metricas: ['subacuatico', 'brazadas'],
    repeticiones: 1, distancia: 15,
    foco: [
      'Tiempo total desde la reacción hasta que la cabeza pasa los 15 mts',
      'Cantidad de movimientos subacuáticos en la salida',
      'Cantidad de brazadas hasta los 15 mts',
      'Salida en streamline + coordinación última patada delfín con primera brazada',
    ],
  },
  {
    id: 'viraje', nombre: 'Tiempo de viraje 5 a 15 mts', set: 'Tramo 5 mts antes → 15 mts después del viraje',
    compuesta: true, tiempoLabel: 'Tiempo total (5 → 15 mts)', metricas: ['brazadas', 'patadas'],
    repeticiones: 1, distancia: 10,
    foco: [
      'Tiempo total del tramo de 5 a 15 mts en torno al viraje',
      'Cantidad de brazadas en el tramo',
      'Cantidad de patadas subacuáticas',
      'Aproximación a la vuelta + tiempo de giro + salida en streamline',
    ],
  },
  /* ---- Protocolos con sistema de niveles ---- */
  {
    id: 'crol8x400',
    nombre: '8×400 mts Crol',
    set: '8 × 400 mts Crol / 20 seg pausa',
    repeticiones: 8, distancia: 400, ciclo: null, pausa: 20,
    foco: [
      'Mantener ritmo constante en las 8 repeticiones',
      'Control de brazadas por tramo de 50 mts',
      'Optimización de vueltas y streamline en distancia larga',
      'Distribución de esfuerzo a lo largo de la serie',
    ],
    niveles: [275, 280, 295, 310, 325, 340, 355, 370, 385, 400],
  },
  {
    id: 'patada1000',
    nombre: '1000 mts Patada Crol',
    set: '1000 mts Patada Crol continuo (10 × 100 mts)',
    repeticiones: 1, distancia: 1000, ciclo: null, pausa: 0, lapDistancia: 100,
    foco: [
      'Eficiencia y potencia de la patada crol continua',
      'Posición horizontal del cuerpo en el agua',
      'Ritmo constante a lo largo de los 1000 mts',
      'Nivel basado en el tiempo promedio por cada 100 mts',
    ],
    niveles: [105, 120, 135, 150, 165, 180, 195, 210, 225, 240],
  },
  {
    id: 'comb10x200',
    nombre: '10×200 mts Combinado',
    set: '10 × 200 mts Combinado / 40 seg pausa',
    repeticiones: 10, distancia: 200, ciclo: null, pausa: 40,
    foco: [
      'Dominio de los 4 estilos en distancia media',
      'Transiciones fluidas entre mariposa, espalda, pecho y libre',
      'Mantener ritmo constante a lo largo de la serie',
      'Control de brazadas y alineación corporal',
    ],
    niveles: [195, 210, 225, 240, 255, 270, 285, 300, 315, 330],
  },
  {
    id: 'patada10x100',
    nombre: '10×100 mts Patada Crol',
    set: '10 × 100 mts Patada Crol / 1 min pausa',
    repeticiones: 10, distancia: 100, ciclo: null, pausa: 60,
    foco: [
      'Eficiencia de la patada crol en repeticiones cortas',
      'Posición horizontal del cuerpo en el agua',
      'Progresión técnica y de ritmo a lo largo de la serie',
      'Nivel basado en el tiempo promedio por 100 mts',
    ],
    niveles: [105, 120, 135, 150, 165, 180, 195, 210, 225, 240],
  },
];

export const METRIC_TYPES = {
  cronometro: { label: 'Cronómetro', sub: 'Tiempos por vuelta (laps)', icon: 'timer', color: '#00C0E2' },
  brazadas: { label: 'Brazadas', sub: 'Conteo de brazadas por tramo', icon: 'arm', color: '#1FA971' },
  subacuatico: { label: 'Mov. subacuáticos', sub: 'Conteo de ondas subacuáticas', icon: 'wave', color: '#7B5BD6' },
  patadas: { label: 'Patadas subacuáticas', sub: 'Conteo de patadas subacuáticas', icon: 'wave', color: '#E0793B' },
  compuesta: { label: 'Prueba compuesta', sub: 'Tiempo + conteos por intento', icon: 'timer', color: '#159B8C' },
};

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- Pruebas y tiempos de referencia Oro Sudamericano ---------- */
export const PRUEBAS = [
  '50m Libre', '50m Espalda', '50m Pecho', '50m Mariposa',
  '100m Libre', '100m Espalda', '100m Pecho', '100m Mariposa',
  '200m Libre', '200m Espalda', '200m Pecho', '200m Mariposa', '200m Combinado',
  '400m Libre', '400m Combinado', '800m Libre', '1500m Libre',
];

const EVENT_KEY = {
  '50m Libre': '50 Free', '50m Espalda': '50 Back', '50m Pecho': '50 Breast', '50m Mariposa': '50 Fly',
  '100m Libre': '100 Free', '100m Espalda': '100 Back', '100m Pecho': '100 Breast', '100m Mariposa': '100 Fly',
  '200m Libre': '200 Free', '200m Espalda': '200 Back', '200m Pecho': '200 Breast', '200m Mariposa': '200 Fly',
  '200m Combinado': '200 IM', '400m Libre': '400 Free', '400m Combinado': '400 IM',
  '800m Libre': '800 Free', '1500m Libre': '1500 Free',
};

const ORO_SUD_JUV_B = {
  F: {
    '50 Free': '00:26.04', '50 Back': '00:29.60', '50 Breast': '00:32.37', '50 Fly': '00:26.55',
    '100 Free': '00:56.21', '100 Back': '01:03.95', '100 Breast': '01:11.29', '100 Fly': '00:59.96',
    '200 Free': '02:01.22', '200 Back': '02:15.77', '200 Breast': '02:38.57', '200 Fly': '02:15.22',
    '200 IM': '02:18.50', '400 Free': '04:18.27', '400 IM': '04:52.34', '800 Free': '08:54.68',
  },
  M: {
    '50 Free': '00:22.88', '50 Back': '00:25.30', '50 Breast': '00:29.22', '50 Fly': '00:24.31',
    '100 Free': '00:49.92', '100 Back': '00:54.58', '100 Breast': '01:04.04', '100 Fly': '00:54.47',
    '200 Free': '02:50.62', '200 Back': '02:00.30', '200 Breast': '02:16.23', '200 Fly': '02:04.00',
    '200 IM': '02:05.66', '400 Free': '04:03.18', '400 IM': '04:28.45', '1500 Free': '15:30.62',
  },
};

export function parseSwimTime(t) {
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d+):(\d+)\.(\d+)$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / Math.pow(10, m[3].length);
  const m2 = s.match(/^(\d+)\.(\d+)$/);
  if (m2) return parseInt(m2[1], 10) + parseInt(m2[2], 10) / Math.pow(10, m2[2].length);
  return null;
}

export function goldTimeFor(prueba, genero, fechaNac) {
  if (!prueba || !genero || !fechaNac) return null;
  const key = EVENT_KEY[prueba];
  if (!key) return null;
  const y = parseInt(String(fechaNac).slice(0, 4), 10);
  if (y >= 2008 && y <= 2010) return ORO_SUD_JUV_B[genero]?.[key] ?? null;
  return null;
}

export function proximityPct(swimmerTime, goldTime) {
  const sw = parseSwimTime(swimmerTime);
  const gd = parseSwimTime(goldTime);
  if (!sw || !gd) return null;
  return Math.round((gd / sw) * 1000) / 10;
}

/* ---------- Datos de demostración (mismos del prototipo) ---------- */
export function seed() {
  const dar = [
    ['Martín Fuentes Rojas', '24.815.302-7', '2012-03-14', 'M', 'martin.fuentes@mail.com', 'Carolina Rojas', 'caro.rojas@mail.com', '+56 9 8123 4567', 'Club Náutico Valdivia', 'Av. Picarte 1820, Valdivia', 'Colegio San Luis'],
    ['Valentina Soto Méndez', '25.102.778-K', '2011-07-02', 'F', 'valen.soto@mail.com', 'Patricia Méndez', 'patricia.m@mail.com', '+56 9 9234 1122', 'Club Náutico Valdivia', 'Los Robles 455, Valdivia', 'Instituto Salesiano'],
    ['Benjamín Cárcamo Díaz', '25.330.991-2', '2013-11-21', 'M', 'benja.carcamo@mail.com', 'Rodrigo Cárcamo', 'r.carcamo@mail.com', '+56 9 7345 6677', 'Escuela Delfines', 'Yungay 980, Valdivia', 'Colegio Alemán'],
    ['Josefa Vidal Pérez', '24.998.110-5', '2010-05-09', 'F', 'jose.vidal@mail.com', 'Marcela Pérez', 'm.perez@mail.com', '+56 9 6456 7788', 'Club Náutico Valdivia', 'General Lagos 233, Valdivia', 'Liceo Santa María'],
    ['Tomás Aravena Lillo', '25.450.223-9', '2014-09-30', 'M', 'tomas.aravena@mail.com', 'Felipe Aravena', 'f.aravena@mail.com', '+56 9 5567 8899', 'Escuela Delfines', 'Beauchef 120, Valdivia', 'Colegio San Luis'],
    ['Isidora Núñez Salas', '24.770.665-1', '2009-12-18', 'F', 'isi.nunez@mail.com', 'Andrea Salas', 'a.salas@mail.com', '+56 9 4678 9900', 'Club Náutico Valdivia', 'Errázuriz 760, Valdivia', 'Instituto Salesiano'],
    ['Agustín Reyes Mora', '25.560.114-8', '2012-08-25', 'M', 'agustin.reyes@mail.com', 'Claudia Mora', 'c.mora@mail.com', '+56 9 3789 0011', 'Escuela Delfines', 'Independencia 410, Valdivia', 'Colegio Alemán'],
    ['Florencia Pino Tapia', '25.210.443-6', '2011-02-11', 'F', 'flor.pino@mail.com', 'Sergio Pino', 's.pino@mail.com', '+56 9 2890 1122', 'Club Náutico Valdivia', 'Chacabuco 1540, Valdivia', 'Liceo Santa María'],
  ];
  const ben = [
    ['Lucas Herrera Bravo', '25.640.778-4', '2012-06-19', 'M', 'lucas.h@mail.com', 'Daniela Bravo', 'd.bravo@mail.com', '+56 9 8011 2233', 'Club Osorno', 'Mackenna 50, Osorno', 'Colegio Inmaculada'],
    ['Antonia Gallardo Ríos', '25.119.882-0', '2011-10-05', 'F', 'anto.gallardo@mail.com', 'Pablo Gallardo', 'p.gallardo@mail.com', '+56 9 8122 3344', 'Club Puerto Montt', 'Urmeneta 320, Pto Montt', 'Liceo San Felipe'],
    ['Matías Espinoza Vera', '25.388.201-3', '2013-04-27', 'M', 'matias.e@mail.com', 'Lorena Vera', 'l.vera@mail.com', '+56 9 8233 4455', 'Club Osorno', 'Bilbao 770, Osorno', 'Colegio Inmaculada'],
    ['Catalina Muñoz Lagos', '24.905.337-7', '2010-01-30', 'F', 'cata.munoz@mail.com', 'Jorge Muñoz', 'j.munoz@mail.com', '+56 9 8344 5566', 'Club Puerto Montt', 'Antonio Varas 88, Pto Montt', 'Liceo San Felipe'],
    ['Vicente Toro Castro', '25.701.556-9', '2014-12-08', 'M', 'vicente.t@mail.com', 'Paula Castro', 'p.castro@mail.com', '+56 9 8455 6677', 'Club Osorno', 'Cochrane 145, Osorno', 'Colegio Inmaculada'],
    ['Emilia Sandoval Paredes', '25.044.910-2', '2009-09-14', 'F', 'emilia.s@mail.com', 'Cristián Sandoval', 'c.sandoval@mail.com', '+56 9 8566 7788', 'Club Puerto Montt', 'Egaña 410, Pto Montt', 'Liceo San Felipe'],
    ['Joaquín Vargas Leiva', '25.477.223-1', '2012-11-02', 'M', 'joaquin.v@mail.com', 'Verónica Leiva', 'v.leiva@mail.com', '+56 9 8677 8899', 'Club Osorno', 'Freire 980, Osorno', 'Colegio Inmaculada'],
    ['Trinidad Campos Rojas', '25.233.667-5', '2011-05-22', 'F', 'trini.campos@mail.com', 'Héctor Campos', 'h.campos@mail.com', '+56 9 8788 9900', 'Club Puerto Montt', 'Benavente 220, Pto Montt', 'Liceo San Felipe'],
    ['Ignacio Fuentealba Soto', '25.602.118-8', '2013-07-16', 'M', 'ignacio.f@mail.com', 'Marcela Soto', 'm.soto2@mail.com', '+56 9 8899 0011', 'Club Osorno', 'Prat 615, Osorno', 'Colegio Inmaculada'],
    ['Maite Carrasco Díaz', '24.860.445-6', '2010-08-03', 'F', 'maite.c@mail.com', 'Rodrigo Carrasco', 'r.carrasco@mail.com', '+56 9 8910 1122', 'Club Puerto Montt', 'Guillermo Gallardo 75, Pto Montt', 'Liceo San Felipe'],
    ['Gaspar Riquelme Núñez', '25.715.990-0', '2014-03-29', 'M', 'gaspar.r@mail.com', 'Francisca Núñez', 'f.nunez@mail.com', '+56 9 9011 2233', 'Club Osorno', 'Eleuterio Ramírez 410, Osorno', 'Colegio Inmaculada'],
    ['Amanda Cortés Vega', '25.158.774-3', '2011-12-11', 'F', 'amanda.c@mail.com', 'Sebastián Cortés', 's.cortes@mail.com', '+56 9 9122 3344', 'Club Puerto Montt', 'Talca 305, Pto Montt', 'Liceo San Felipe'],
  ];
  const mk = (a, group) => ({
    id: uid(), group,
    nombre: a[0], rut: a[1], fechaNacimiento: a[2], genero: a[3],
    correo: a[4], tutor: a[5], correoTutor: a[6], telefono: a[7],
    club: a[8], direccion: a[9], colegio: a[10],
    activo: true, justificacion: '', creado: a[2],
  });
  const swimmers = [...dar.map(s => mk(s, 'DAR')), ...ben.map(s => mk(s, 'BEN'))];

  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const dOff = (n) => { const x = new Date(today); x.setDate(x.getDate() + n); return x; };
  const trainings = [
    { id: uid(), fecha: iso(today), titulo: 'Técnica de viraje y streamline', grupo: 'DAR', tipo: 'Técnica', duracion: 90, ubicacion: 'Piscina Olímpica Valdivia', contenido: '400 nado suave + movilidad\n8×50 viraje con 5 ondas subacuático\n10×100 libre @2:20 control de brazadas\n200 vuelta a la calma' },
    { id: uid(), fecha: iso(dOff(-1)), titulo: 'Resistencia aeróbica', grupo: 'DAR', tipo: 'Aeróbico', duracion: 100, ubicacion: 'Piscina Olímpica Valdivia', contenido: '600 calentamiento mixto\n3×(400 libre + 100 patada)\n300 combinado suave' },
    { id: uid(), fecha: iso(dOff(2)), titulo: 'Velocidad y salidas', grupo: 'DAR', tipo: 'Velocidad', duracion: 80, ubicacion: 'Piscina Olímpica Valdivia', contenido: '500 progresivo\n12×25 sprint con salida\n6×50 mariposa control brazadas\n200 suave' },
    { id: uid(), fecha: iso(dOff(4)), titulo: 'Preparación de prueba 200 combinado', grupo: 'DAR', tipo: 'Específico', duracion: 90, ubicacion: 'Piscina Olímpica Valdivia', contenido: 'Calentamiento competición\n1×200 combinado situación de competencia\nAnálisis de estrategia por tramo' },
  ];

  const attendance = {};
  const darIds = swimmers.filter(s => s.group === 'DAR').map(s => s.id);
  const ym = today.toISOString().slice(0, 7);
  const sessionDays = [];
  for (let d = 1; d <= today.getDate(); d++) {
    const dt = new Date(today.getFullYear(), today.getMonth(), d);
    const wd = dt.getDay();
    if (wd === 1 || wd === 3 || wd === 5) sessionDays.push(`${ym}-${String(d).padStart(2, '0')}`);
  }
  darIds.forEach((id, i) => {
    attendance[id] = {};
    sessionDays.forEach((day, j) => { attendance[id][day] = !((i + j) % 7 === 0); });
  });

  const evaluations = [
    {
      id: uid(), fecha: iso(dOff(-18)), protocolo: 'libre', metrica: 'cronometro',
      swimmerIds: [darIds[0], darIds[1], darIds[3]], tecnico: 'Coach Promesas',
      notas: 'Primer control del mes. Base de referencia.',
      data: {
        [darIds[0]]: { laps: [88.4, 89.0, 88.8, 89.5, 90.2, 90.0, 90.9, 91.5, 92.3, 93.6], total: 904.2 },
        [darIds[1]]: { laps: [90.1, 90.6, 90.4, 91.2, 91.9, 91.7, 92.6, 93.0, 93.9, 95.0], total: 920.4 },
        [darIds[3]]: { laps: [86.8, 87.2, 87.0, 87.6, 88.3, 88.1, 88.9, 89.4, 90.2, 91.5], total: 885.0 },
      },
    },
    {
      id: uid(), fecha: iso(dOff(-10)), protocolo: 'libre', metrica: 'cronometro',
      swimmerIds: [darIds[0], darIds[1], darIds[3]], tecnico: 'Coach Promesas',
      notas: 'Mejora en el sostenimiento del ritmo respecto al control anterior.',
      data: {
        [darIds[0]]: { laps: [86.9, 87.4, 87.2, 87.8, 88.4, 88.2, 89.0, 89.6, 90.3, 91.4], total: 886.2 },
        [darIds[1]]: { laps: [89.0, 89.5, 89.3, 90.0, 90.7, 90.5, 91.3, 91.8, 92.6, 93.7], total: 908.4 },
        [darIds[3]]: { laps: [85.5, 85.9, 85.7, 86.2, 86.9, 86.7, 87.4, 87.9, 88.6, 89.7], total: 870.5 },
      },
    },
    {
      id: uid(), fecha: iso(dOff(-2)), protocolo: 'libre', metrica: 'cronometro',
      swimmerIds: [darIds[0], darIds[1]], tecnico: 'Coach Promesas',
      notas: 'Buen control de ritmo en repeticiones 1-6, leve caída al final.',
      data: {
        [darIds[0]]: { laps: [85.2, 86.1, 85.9, 86.4, 87.0, 86.8, 87.5, 88.1, 88.9, 90.2], total: 872.1 },
        [darIds[1]]: { laps: [88.5, 89.0, 88.7, 89.4, 90.1, 90.0, 90.8, 91.2, 92.0, 93.1], total: 902.8 },
      },
    },
    {
      id: uid(), fecha: iso(dOff(-2)), protocolo: 'libre', metrica: 'brazadas',
      swimmerIds: [darIds[0], darIds[3]], tecnico: 'Coach Promesas',
      notas: 'Mantiene 16-17 brazadas por tramo de 50, objetivo bajar a 15.',
      data: { [darIds[0]]: { tramos: [16, 16, 17, 16, 17, 17, 18, 17, 18, 19] }, [darIds[3]]: { tramos: [15, 15, 16, 15, 16, 16, 16, 17, 17, 18] } },
    },
    {
      id: uid(), fecha: iso(dOff(-6)), protocolo: 'salida15', metrica: 'compuesta',
      swimmerIds: [darIds[0], darIds[1], darIds[3]], tecnico: 'Coach Promesas',
      notas: 'Control de salida. Trabajar la coordinación delfín-estilo.',
      data: {
        [darIds[0]]: { intentos: [{ tiempo: 7.2, subacuatico: 4, brazadas: 6 }, { tiempo: 7.0, subacuatico: 5, brazadas: 6 }] },
        [darIds[1]]: { intentos: [{ tiempo: 7.6, subacuatico: 3, brazadas: 7 }] },
        [darIds[3]]: { intentos: [{ tiempo: 6.8, subacuatico: 5, brazadas: 5 }, { tiempo: 6.7, subacuatico: 5, brazadas: 5 }] },
      },
    },
  ];

  return {
    coach: { nombre: 'Coach Promesas', rol: 'Entrenador Jefe', region: 'Los Ríos', programa: 'Promesas Chile Natación', email: 'tecnico@promesaschile.cl' },
    swimmers, trainings, attendance, evaluations,
    bajas: [],
    reports: {},
  };
}

export function emptyState() {
  return {
    coach: { nombre: '', rol: 'Entrenador', region: '', programa: 'Promesas Chile Natación', email: '' },
    swimmers: [], trainings: [], attendance: {}, evaluations: [], bajas: [], reports: {},
  };
}
