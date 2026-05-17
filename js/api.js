// api.js — Conexión a mindicador.cl con caché de 1 hora
// Proporciona indicadores económicos de Chile en tiempo real

const API_URL = 'https://mindicador.cl/api';
const CACHE_KEY = 'mindicador_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hora en ms

// Valores de fallback si la API falla
const FALLBACK = {
  uf: 38500,
  utm: 67294,
  dolar: 950,
  ipc: 0.4,
  tpm: 5.0
};

/**
 * Obtiene los indicadores económicos del día.
 * Usa caché local de 1 hora para evitar llamadas repetidas.
 * @returns {Promise<{uf, utm, dolar, ipc, tpm}>}
 */
async function getIndicadores() {
  // Intentar leer desde caché
  const cached = leerCache();
  if (cached) return cached;

  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const indicadores = {
      uf: data.uf?.valor ?? FALLBACK.uf,
      utm: data.utm?.valor ?? FALLBACK.utm,
      dolar: data.dolar?.valor ?? FALLBACK.dolar,
      ipc: data.ipc?.valor ?? FALLBACK.ipc,
      tpm: data.tpm?.valor ?? FALLBACK.tpm,
      fuente: 'api',
      timestamp: Date.now()
    };

    guardarCache(indicadores);
    return indicadores;

  } catch (err) {
    console.warn('API mindicador.cl no disponible, usando valores de fallback:', err.message);
    return { ...FALLBACK, fuente: 'fallback', timestamp: Date.now() };
  }
}

function leerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function guardarCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage puede estar bloqueado en algunos navegadores
  }
}

/**
 * Formatea un número al estilo chileno: punto de miles, coma decimal.
 * @param {number} n
 * @param {number} decimales
 */
function formatCLP(n, decimales = 0) {
  return Math.round(n).toLocaleString('es-CL');
}

function formatDecimal(n, decimales = 2) {
  return n.toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

// ─── IPC INTERANUAL (últimos 12 meses, compuesto) ────────────────────────────
const IPC_CACHE_KEY = 'ipc_serie_cache';
const IPC_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

async function getIPCInteranual() {
  try {
    const raw = localStorage.getItem(IPC_CACHE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Date.now() - d.timestamp < IPC_CACHE_TTL) return d;
    }
  } catch {}

  try {
    const resp = await fetch('https://mindicador.cl/api/ipc');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const serie = (data.serie || []).slice(0, 12); // últimos 12 meses
    if (serie.length < 2) throw new Error('Serie IPC insuficiente');

    // Variación compuesta: (1+r1/100)*(1+r2/100)*...-1
    const factor = serie.reduce((acc, e) => acc * (1 + (e.valor || 0) / 100), 1);
    const interanual = Math.round((factor - 1) * 10000) / 100;

    const meses = serie.slice(0, 6).map(e => ({
      fecha: new Date(e.fecha).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }),
      valor: e.valor
    }));

    const result = { interanual, meses, fuente: 'api', timestamp: Date.now() };
    try { localStorage.setItem(IPC_CACHE_KEY, JSON.stringify(result)); } catch {}
    return result;
  } catch (err) {
    console.warn('IPC interanual no disponible:', err.message);
    return { interanual: 3.5, meses: [], fuente: 'fallback', timestamp: Date.now() };
  }
}

export { getIndicadores, getIPCInteranual, formatCLP, formatDecimal, FALLBACK };
