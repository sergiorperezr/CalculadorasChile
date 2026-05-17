// main.js — Inicialización, eventos y UI del portal
import { getIndicadores, getIPCInteranual, formatCLP, formatDecimal } from './api.js';
import {
  calcularSueldoLiquido, renderSueldoLiquido,
  calcularHipotecario, renderHipotecario,
  calcularInteresCompuesto, renderInteresCompuesto,
  calcularInteresSimple, renderInteresSimple,
  calcularInflacion, renderInflacion, renderVenceInflacion,
  calcularComparador, renderComparador,
  calcularSimulacionMensual, renderSimulacionMensual,
  calcularFiniquito, renderFiniquito,
  calcularAPV, renderAPV,
  calcularPensionAlimentos, renderPensionAlimentos,
  calcularAjusteArriendo, renderAjusteArriendo
} from './calculadoras.js';

// Estado global
let indicadores = null;
const charts = {}; // instancias de Chart.js por id de canvas

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await cargarIndicadores();
  inicializarSueldoLiquido();
  inicializarHipotecario();
  inicializarInversion();
  inicializarFiniquito();
  inicializarAPV();
  inicializarPensionAlimentos();
  inicializarAjusteArriendo();
  inicializarNavegacion();
  inicializarCopyButtons();
  inicializarPDFButtons();
});

async function cargarIndicadores() {
  const barra = document.getElementById('barra-indicadores');
  barra.innerHTML = '<span class="cargando">Cargando indicadores…</span>';

  indicadores = await getIndicadores();

  const badge = indicadores.fuente === 'fallback'
    ? '<span class="badge-fallback" title="API no disponible, usando valores de referencia">Est.</span>'
    : '';

  barra.innerHTML = `
    <span>UF hoy: <strong>$${formatCLP(indicadores.uf)}</strong>${badge}</span>
    <span class="separador-barra">|</span>
    <span>UTM: <strong>$${formatCLP(indicadores.utm)}</strong></span>
    <span class="separador-barra">|</span>
    <span>Dólar: <strong>$${formatCLP(indicadores.dolar)}</strong></span>`;

  const refUF = document.getElementById('uf-dia-ref');
  if (refUF) refUF.textContent = `$${formatCLP(indicadores.uf)}`;
}

// ─────────────────────────────────────────────
// NAVEGACIÓN STICKY
// ─────────────────────────────────────────────

function inicializarNavegacion() {
  const nav = document.getElementById('nav-principal');
  const links = nav.querySelectorAll('a[href^="#"]');

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
      }
    });
  });

  const secciones = document.querySelectorAll('.calculadora-seccion');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('activo'));
        const activo = nav.querySelector(`a[href="#${entry.target.id}"]`);
        if (activo) activo.classList.add('activo');
      }
    });
  }, { threshold: 0.3 });

  secciones.forEach(s => observer.observe(s));
}

// ─────────────────────────────────────────────
// BOTONES COPIAR
// ─────────────────────────────────────────────

function inicializarCopyButtons() {
  document.querySelectorAll('.btn-copiar').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.target);
      if (!el) return;
      const texto = el.innerText || el.textContent;
      navigator.clipboard.writeText(texto).then(() => {
        btn.textContent = '✓ Copiado';
        btn.classList.add('copiado');
        setTimeout(() => { btn.textContent = '📋 Copiar resultado'; btn.classList.remove('copiado'); }, 2000);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = '✓ Copiado';
        setTimeout(() => btn.textContent = '📋 Copiar resultado', 2000);
      });
    });
  });
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────

function mostrarError(inputId, msg) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.add('input-error');
  let err = el.parentElement.querySelector('.error-msg');
  if (!err) { err = document.createElement('span'); err.className = 'error-msg'; el.parentElement.appendChild(err); }
  err.textContent = msg;
}

function limpiarError(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.classList.remove('input-error');
  el.parentElement.querySelector('.error-msg')?.remove();
}

function leerNumero(id) {
  const val = document.getElementById(id)?.value.replace(/\./g, '').replace(',', '.');
  return parseFloat(val) || 0;
}

function mostrarResultado(id, html) {
  const el = document.getElementById(id);
  el.innerHTML = html;
  el.style.display = 'block';
}

function mostrarBtnCopiar(targetId) {
  document.querySelector(`.btn-copiar[data-target="${targetId}"]`).style.display = 'inline-flex';
  const pdfBtn = document.querySelector(`.btn-pdf[data-target="${targetId}"]`);
  if (pdfBtn) pdfBtn.style.display = 'inline-flex';
}

// Formato de inputs con punto de miles en tiempo real
function formatearInputPesos(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    const raw = el.value.replace(/\D/g, '');
    el.value = raw ? parseInt(raw).toLocaleString('es-CL') : '';
  });
}

// Formato para inputs dentro de un contenedor (para el comparador)
function formatearInputsPesos(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('input', () => {
      const raw = el.value.replace(/\D/g, '');
      el.value = raw ? parseInt(raw).toLocaleString('es-CL') : '';
    });
  });
}

function leerNumeroCampo(el) {
  const val = el?.value.replace(/\./g, '').replace(',', '.');
  return parseFloat(val) || 0;
}

// ─────────────────────────────────────────────
// PDF / IMPRESIÓN
// ─────────────────────────────────────────────

function imprimirSeccion(resultadoId, titulo) {
  const printArea = document.getElementById('print-area');
  const resultado = document.getElementById(resultadoId);
  if (!printArea || !resultado) return;
  printArea.innerHTML = `<h2 style="font-family:Inter,sans-serif;font-size:1.1rem;margin-bottom:1rem;color:#1a202c">${titulo}</h2>${resultado.innerHTML}`;
  window.print();
}

function inicializarPDFButtons() {
  document.querySelectorAll('.btn-pdf').forEach(btn => {
    btn.addEventListener('click', () => imprimirSeccion(btn.dataset.target, btn.dataset.titulo));
  });
}

// ─────────────────────────────────────────────
// CHART.JS — helper para crear/actualizar gráficos
// ─────────────────────────────────────────────

function crearGrafico(canvasId, wrapperId, labels, datasets) {
  if (charts[canvasId]) { charts[canvasId].destroy(); }
  const canvas = document.getElementById(canvasId);
  const wrapper = document.getElementById(wrapperId);
  if (!canvas || !wrapper) return;
  wrapper.style.display = 'block';

  charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#4a5568', font: { family: 'Inter', size: 11 }, usePointStyle: true } },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          titleColor: '#1a202c',
          bodyColor: '#4a5568',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: $${Math.round(ctx.parsed.y).toLocaleString('es-CL')}`
          }
        }
      },
      scales: {
        x: { grid: { color: '#f0f4f8' }, ticks: { color: '#718096', font: { size: 10 }, maxTicksLimit: 8 } },
        y: {
          grid: { color: '#f0f4f8' },
          ticks: {
            color: '#718096', font: { size: 10 },
            callback: v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
          }
        }
      },
      elements: { point: { radius: 0 }, line: { tension: 0.4 } },
      animation: { duration: 400 }
    }
  });
}

// Gráfico de dona para distribución del sueldo bruto
function crearGraficoSueldo(resultado) {
  if (charts['chart-sueldo']) { charts['chart-sueldo'].destroy(); }
  const canvas = document.getElementById('chart-sueldo');
  const wrapper = document.getElementById('wrapper-sueldo');
  if (!canvas || !wrapper) return;
  wrapper.style.display = 'block';

  let labels, data, colors;
  if (resultado.tipo === 'honorarios') {
    labels = [`Retención (${resultado.porcentajeRetencion.toFixed(2)}%)`, 'Sueldo líquido'];
    data = [resultado.retencion, resultado.liquido];
    colors = ['#e53e3e', '#2d7d46'];
  } else {
    labels = ['AFP + SIS (11.44%)', 'Salud (7%)', 'Cesantía', 'Sueldo líquido'];
    data = [resultado.afp, resultado.salud, resultado.cesantia, resultado.liquido];
    colors = ['#2c5282', '#3182ce', '#718096', '#2d7d46'];
  }

  charts['chart-sueldo'] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#4a5568', font: { family: 'Inter', size: 11 }, padding: 14, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: $${Math.round(ctx.parsed).toLocaleString('es-CL')}`
          }
        }
      },
      animation: { duration: 400 }
    }
  });
}

// Convierte array de {mes, total, invertido} en labels + datasets para Chart.js
function puntosAChartData(puntos, labelTotal, labelInvertido) {
  const paso = Math.max(1, Math.floor(puntos.length / 60));
  const filtrados = puntos.filter((_, i) => i % paso === 0 || i === puntos.length - 1);
  const labels = filtrados.map(p => p.mes < 12 ? `Mes ${p.mes}` : `Año ${Math.round(p.mes / 12)}`);
  return {
    labels,
    datasets: [
      {
        label: labelTotal,
        data: filtrados.map(p => p.total),
        borderColor: '#2d7d46',
        backgroundColor: 'rgba(45,125,70,0.08)',
        fill: true,
        borderWidth: 2
      },
      {
        label: labelInvertido,
        data: filtrados.map(p => p.invertido),
        borderColor: '#2c5282',
        backgroundColor: 'rgba(44,82,130,0.06)',
        fill: true,
        borderWidth: 2,
        borderDash: [4, 3]
      }
    ]
  };
}

// ─────────────────────────────────────────────
// CALCULADORA 1: SUELDO LÍQUIDO
// ─────────────────────────────────────────────

function inicializarSueldoLiquido() {
  const form = document.getElementById('form-sueldo');
  const tipoContrato = document.getElementById('tipo-contrato');
  const tipoSalud = document.getElementById('tipo-salud');
  const grupoIsapre = document.getElementById('grupo-isapre');

  tipoContrato.addEventListener('change', () => {
    const esHon = tipoContrato.value === 'honorarios';
    ['grupo-salud', 'grupo-isapre', 'grupo-duracion'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = esHon ? 'none' : '';
    });
  });

  tipoSalud.addEventListener('change', () => {
    grupoIsapre.style.display = tipoSalud.value === 'isapre' ? '' : 'none';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('bruto-sueldo');
    const bruto = leerNumero('bruto-sueldo');
    if (!bruto || bruto <= 0) { mostrarError('bruto-sueldo', 'Ingresa un monto válido mayor a 0'); return; }

    const resultado = calcularSueldoLiquido({
      bruto,
      tipoContrato: tipoContrato.value,
      tipoSalud: tipoSalud.value,
      porcentajeIsapre: leerNumero('porc-isapre') || 7,
      tipoContratoDuracion: document.getElementById('duracion-contrato').value
    });

    mostrarResultado('resultado-sueldo', renderSueldoLiquido(resultado));
    crearGraficoSueldo(resultado);
    mostrarBtnCopiar('resultado-sueldo');
  });

  formatearInputPesos('bruto-sueldo');
}

// ─────────────────────────────────────────────
// CALCULADORA 2: HIPOTECARIO
// ─────────────────────────────────────────────

function inicializarHipotecario() {
  const form = document.getElementById('form-hipotecario');
  const toggleUnidad = document.getElementById('toggle-unidad');
  const labelUnidad = document.getElementById('label-unidad-hipotecario');
  let unidad = 'uf';

  toggleUnidad.addEventListener('click', () => {
    unidad = unidad === 'uf' ? 'clp' : 'uf';
    labelUnidad.textContent = unidad === 'uf' ? 'UF' : 'CLP ($)';
    toggleUnidad.textContent = unidad === 'uf' ? 'Cambiar a pesos CLP' : 'Cambiar a UF';
    limpiarError('valor-propiedad');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('valor-propiedad');
    if (!indicadores) { alert('Cargando indicadores, intenta en un momento…'); return; }

    let valorRaw = leerNumero('valor-propiedad');
    if (!valorRaw || valorRaw <= 0) { mostrarError('valor-propiedad', 'Ingresa un valor de propiedad válido'); return; }

    const valorUF = unidad === 'clp' ? valorRaw / indicadores.uf : valorRaw;
    const resultado = calcularHipotecario({
      valorUF,
      piePorc: leerNumero('pie-porc') || 20,
      tasaAnual: leerNumero('tasa-hipotecario') || 4.0,
      plazoAnos: parseInt(document.getElementById('plazo-hipotecario').value) || 20,
      valorUFDia: indicadores.uf
    });

    mostrarResultado('resultado-hipotecario', renderHipotecario(resultado));
    mostrarBtnCopiar('resultado-hipotecario');
  });

  formatearInputPesos('valor-propiedad');
}

// ─────────────────────────────────────────────
// CALCULADORA 3: INVERSIÓN E INFLACIÓN (5 subtabs)
// ─────────────────────────────────────────────

function inicializarInversion() {
  // ── Sistema de tabs ──
  const tabBtns = document.querySelectorAll('#interes .tab-btn');
  const tabPanels = document.querySelectorAll('#interes .tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('activo'));
      tabPanels.forEach(p => p.classList.remove('activo'));
      btn.classList.add('activo');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('activo');
    });
  });

  // ── Tab A: Interés Compuesto ──
  formatearInputPesos('capital-compuesto');
  formatearInputPesos('aporte-compuesto');

  document.getElementById('form-compuesto').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('capital-compuesto');
    const capital = leerNumero('capital-compuesto');
    if (!capital || capital <= 0) { mostrarError('capital-compuesto', 'Ingresa un capital válido'); return; }

    const r = calcularInteresCompuesto({
      capital,
      tasaAnual: leerNumero('tasa-compuesto') || 8,
      plazo: leerNumero('plazo-compuesto') || 10,
      unidad: document.getElementById('unidad-compuesto').value,
      aporteMensual: leerNumero('aporte-compuesto') || 0
    });

    mostrarResultado('resultado-compuesto', renderInteresCompuesto(r));
    mostrarBtnCopiar('resultado-compuesto');

    const { labels, datasets } = puntosAChartData(r.puntos, 'Valor con interés', 'Capital aportado');
    crearGrafico('chart-compuesto', 'wrapper-compuesto', labels, datasets);
  });

  // ── Tab B: Interés Simple ──
  formatearInputPesos('capital-simple');

  document.getElementById('form-simple').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('capital-simple');
    const capital = leerNumero('capital-simple');
    if (!capital || capital <= 0) { mostrarError('capital-simple', 'Ingresa un capital válido'); return; }

    const r = calcularInteresSimple({
      capital,
      tasaAnual: leerNumero('tasa-simple') || 8,
      plazo: leerNumero('plazo-simple') || 5,
      unidad: document.getElementById('unidad-simple').value
    });

    mostrarResultado('resultado-simple', renderInteresSimple(r));
    mostrarBtnCopiar('resultado-simple');
  });

  // ── Tab C: Inflación ──
  formatearInputPesos('nominal-inflacion');

  // Presets de tasa de inflación
  document.querySelectorAll('#presets-inflacion .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('tasa-inflacion').value = btn.dataset.valor;
      document.querySelectorAll('#presets-inflacion .preset-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      actualizarVenceInflacion();
    });
  });

  // Slider "¿vence inflación?"
  const slider = document.getElementById('slider-inversion');
  const labelTasa = document.getElementById('label-tasa-inv');
  slider.addEventListener('input', () => {
    labelTasa.textContent = `${slider.value}%`;
    actualizarVenceInflacion();
  });

  // Sincronizar preset activo cuando se escribe manualmente en tasa
  document.getElementById('tasa-inflacion').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('tasa-inflacion').value);
    document.querySelectorAll('#presets-inflacion .preset-btn').forEach(btn => {
      btn.classList.toggle('activo', parseFloat(btn.dataset.valor) === val);
    });
    actualizarVenceInflacion();
  });

  let ultimoResultadoInflacion = null;

  function actualizarVenceInflacion() {
    if (!ultimoResultadoInflacion) return;
    const tasaInv = parseFloat(slider.value) || 0;
    document.getElementById('resultado-vence').innerHTML = renderVenceInflacion(ultimoResultadoInflacion.tasaInflacion, tasaInv);
    document.getElementById('resultado-vence').style.display = 'block';
  }

  document.getElementById('form-inflacion').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('nominal-inflacion');
    const nominal = leerNumero('nominal-inflacion');
    if (!nominal || nominal <= 0) { mostrarError('nominal-inflacion', 'Ingresa un valor válido'); return; }

    const r = calcularInflacion({
      valorNominal: nominal,
      tasaInflacion: leerNumero('tasa-inflacion') || 4,
      anos: leerNumero('anos-inflacion') || 10
    });

    ultimoResultadoInflacion = r;
    mostrarResultado('resultado-inflacion', renderInflacion(r));
    mostrarBtnCopiar('resultado-inflacion');
    actualizarVenceInflacion();
  });

  // ── Tab D: Comparador de Escenarios ──
  formatearInputsPesos('.esc-capital');
  formatearInputsPesos('.esc-aporte');

  document.getElementById('btn-comparar').addEventListener('click', () => {
    const escenarios = [0, 1, 2].map(i => ({
      capital: leerNumeroCampo(document.querySelector(`.esc-capital[data-idx="${i}"]`)),
      tasa: parseFloat(document.querySelector(`.esc-tasa[data-idx="${i}"]`)?.value) || 0,
      anos: parseFloat(document.querySelector(`.esc-anos[data-idx="${i}"]`)?.value) || 0,
      aporte: leerNumeroCampo(document.querySelector(`.esc-aporte[data-idx="${i}"]`))
    }));

    const validos = escenarios.filter(s => s.capital > 0 && s.tasa > 0 && s.anos > 0);
    if (validos.length < 2) {
      alert('Completa al menos 2 escenarios con capital, tasa y años válidos.');
      return;
    }

    const resultados = calcularComparador(escenarios);
    mostrarResultado('resultado-comparador', renderComparador(escenarios, resultados));

    // Gráfico multi-línea comparativo
    const colores = ['#6366f1', '#10b981', '#f59e0b'];
    const nombres = ['Escenario A', 'Escenario B', 'Escenario C'];
    const maxMeses = Math.max(...resultados.map(r => r?.puntos?.length || 0)) - 1;
    const paso = Math.max(1, Math.floor(maxMeses / 60));
    const indices = Array.from({ length: Math.floor(maxMeses / paso) + 1 }, (_, i) => i * paso);

    const labels = indices.map(m => m < 12 ? `Mes ${m}` : `Año ${Math.round(m / 12)}`);
    const datasets = resultados.map((r, i) => {
      if (!r?.puntos) return null;
      const mapa = new Map(r.puntos.map(p => [p.mes, p.total]));
      return {
        label: nombres[i],
        data: indices.map(m => mapa.get(m) ?? r.puntos[r.puntos.length - 1]?.total ?? 0),
        borderColor: colores[i],
        backgroundColor: `${colores[i]}12`,
        fill: false,
        borderWidth: 2.5,
        pointRadius: 0
      };
    }).filter(Boolean);

    crearGrafico('chart-comparador', 'wrapper-comparador', labels, datasets);
  });

  // ── Tab E: Simulación Mensual ──
  formatearInputPesos('aporte-mensual-sim');

  // Presets de período
  const inputMeses = document.getElementById('meses-mensual-sim');
  const hintAnos = document.getElementById('hint-anos-mensual');

  document.querySelectorAll('#presets-mensual .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      inputMeses.value = btn.dataset.meses;
      hintAnos.textContent = `${(parseInt(btn.dataset.meses) / 12).toFixed(1)} años`;
      document.querySelectorAll('#presets-mensual .preset-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
    });
  });

  inputMeses.addEventListener('input', () => {
    const m = parseInt(inputMeses.value) || 0;
    hintAnos.textContent = `${(m / 12).toFixed(1)} años`;
    document.querySelectorAll('#presets-mensual .preset-btn').forEach(b => {
      b.classList.toggle('activo', parseInt(b.dataset.meses) === m);
    });
  });

  document.getElementById('form-mensual').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('aporte-mensual-sim');
    const aporte = leerNumero('aporte-mensual-sim');
    if (!aporte || aporte <= 0) { mostrarError('aporte-mensual-sim', 'Ingresa un aporte mensual válido'); return; }

    const r = calcularSimulacionMensual({
      aporteMensual: aporte,
      tasaAnual: leerNumero('tasa-mensual-sim') || 8,
      meses: leerNumero('meses-mensual-sim') || 120
    });

    mostrarResultado('resultado-mensual', renderSimulacionMensual(r));
    mostrarBtnCopiar('resultado-mensual');

    const { labels, datasets } = puntosAChartData(r.puntos, 'Valor con interés', 'Capital aportado');
    crearGrafico('chart-mensual', 'wrapper-mensual', labels, datasets);
  });
}

// ─────────────────────────────────────────────
// CALCULADORA 4: FINIQUITO
// ─────────────────────────────────────────────

function inicializarFiniquito() {
  const form = document.getElementById('form-finiquito');

  form.addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('sueldo-finiquito');
    const sueldo = leerNumero('sueldo-finiquito');
    if (!sueldo || sueldo <= 0) { mostrarError('sueldo-finiquito', 'Ingresa un sueldo válido'); return; }

    const resultado = calcularFiniquito({
      tipoContrato: document.getElementById('tipo-contrato-finiquito').value,
      motivoTermino: document.getElementById('motivo-termino').value,
      sueldoBruto: sueldo,
      anosServicio: parseFloat(document.getElementById('anos-servicio')?.value) || 1,
      diasVacaciones: parseFloat(document.getElementById('dias-vacaciones')?.value) || 0,
      uf: indicadores?.uf || 38500
    });

    mostrarResultado('resultado-finiquito', renderFiniquito(resultado));
    mostrarBtnCopiar('resultado-finiquito');
  });

  formatearInputPesos('sueldo-finiquito');
}

// ─────────────────────────────────────────────
// CALCULADORA 5: APV
// ─────────────────────────────────────────────

function inicializarAPV() {
  formatearInputPesos('sueldo-apv');
  formatearInputPesos('apv-mensual');

  // Hint dinámico: APV óptimo para maximizar bono Régimen A
  function actualizarHintOptimo() {
    if (!indicadores) return;
    const optimo = Math.round((6 * indicadores.utm) / 0.15 / 12);
    const hint = document.getElementById('hint-apv-optimo');
    if (hint) hint.textContent = `Óptimo Régimen A: $${optimo.toLocaleString('es-CL')}/mes (máximo bono 6 UTM)`;
  }

  // Mostrar hint cuando indicadores estén listos (pueden tardar)
  const hintTimer = setInterval(() => {
    if (indicadores) { actualizarHintOptimo(); clearInterval(hintTimer); }
  }, 300);

  document.getElementById('form-apv').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('sueldo-apv');
    limpiarError('apv-mensual');

    if (!indicadores) { alert('Cargando indicadores económicos, intenta en un momento…'); return; }

    const sueldo = leerNumero('sueldo-apv');
    const apv = leerNumero('apv-mensual');

    if (!sueldo || sueldo <= 0) { mostrarError('sueldo-apv', 'Ingresa un sueldo válido'); return; }
    if (!apv || apv <= 0) { mostrarError('apv-mensual', 'Ingresa un monto APV válido'); return; }

    const regimen = document.querySelector('input[name="regimen-apv"]:checked')?.value || 'comparar';

    const r = calcularAPV({
      sueldoBruto: sueldo,
      apvMensual: apv,
      anos: leerNumero('anos-jubilacion') || 20,
      rentabilidad: leerNumero('rentabilidad-apv') || 5,
      utm: indicadores.utm,
      uf: indicadores.uf
    });

    mostrarResultado('resultado-apv', renderAPV(r, regimen));
    mostrarBtnCopiar('resultado-apv');
    _crearGraficoAPV(r, regimen);
  });
}

function _crearGraficoAPV(r, regimen) {
  const wrapper = document.getElementById('wrapper-apv');
  const canvas = document.getElementById('chart-apv');
  if (!canvas || !wrapper) return;

  // Seleccionar hitos de años para no saturar el eje X
  const paso = r.anos <= 10 ? 1 : r.anos <= 20 ? 2 : 5;
  const anosHito = [];
  for (let yr = 0; yr <= r.anos; yr += paso) anosHito.push(yr);
  if (anosHito[anosHito.length - 1] !== r.anos) anosHito.push(r.anos);

  const labels = anosHito.map(yr => `Año ${yr}`);
  const mapaA = new Map(r.regA.puntos.map(p => [p.year, p.total]));
  const mapaB = new Map(r.regB.puntos.map(p => [p.year, p.total]));

  const datasets = [];
  if (regimen !== 'B') {
    datasets.push({
      label: 'Régimen A (APV + bono)',
      data: anosHito.map(yr => mapaA.get(yr) ?? 0),
      backgroundColor: 'rgba(99,102,241,0.72)',
      borderColor: '#6366f1',
      borderWidth: 1.5,
      borderRadius: 4
    });
  }
  if (regimen !== 'A') {
    datasets.push({
      label: 'Régimen B (solo APV)',
      data: anosHito.map(yr => mapaB.get(yr) ?? 0),
      backgroundColor: 'rgba(16,185,129,0.72)',
      borderColor: '#10b981',
      borderWidth: 1.5,
      borderRadius: 4
    });
  }

  if (charts['chart-apv']) { charts['chart-apv'].destroy(); }
  wrapper.style.display = 'block';

  charts['chart-apv'] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#4a5568', font: { family: 'Inter', size: 11 }, usePointStyle: true } },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          titleColor: '#1a202c',
          bodyColor: '#4a5568',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: $${Math.round(ctx.parsed.y).toLocaleString('es-CL')}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#718096', font: { size: 10 } } },
        y: {
          grid: { color: '#f0f4f8' },
          ticks: {
            color: '#718096', font: { size: 10 },
            callback: v => v >= 1e9 ? `$${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`
          }
        }
      },
      animation: { duration: 400 }
    }
  });
}

// ─────────────────────────────────────────────
// CALCULADORA 6: PENSIÓN ALIMENTARIA
// ─────────────────────────────────────────────

function inicializarPensionAlimentos() {
  formatearInputPesos('ingreso-pension');

  document.getElementById('form-pension').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('ingreso-pension');
    const ingreso = leerNumero('ingreso-pension');
    if (!ingreso || ingreso <= 0) { mostrarError('ingreso-pension', 'Ingresa un ingreso neto válido'); return; }

    const r = calcularPensionAlimentos({
      ingresoNeto: ingreso,
      numHijos: parseInt(document.getElementById('hijos-pension').value) || 1,
      tipoObligado: document.getElementById('tipo-obligado-pension').value,
      utm: indicadores?.utm || 70588
    });

    mostrarResultado('resultado-pension', renderPensionAlimentos(r));
    mostrarBtnCopiar('resultado-pension');
  });
}

// ─────────────────────────────────────────────
// CALCULADORA 7: REAJUSTE ARRIENDO IPC
// ─────────────────────────────────────────────

function inicializarAjusteArriendo() {
  formatearInputPesos('arriendo-actual');

  document.querySelectorAll('#presets-ipc .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('variacion-ipc').value = btn.dataset.valor;
      document.querySelectorAll('#presets-ipc .preset-btn').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
    });
  });

  document.getElementById('variacion-ipc').addEventListener('input', () => {
    const val = parseFloat(document.getElementById('variacion-ipc').value);
    document.querySelectorAll('#presets-ipc .preset-btn').forEach(b =>
      b.classList.toggle('activo', parseFloat(b.dataset.valor) === val)
    );
  });

  // IPC interanual real desde API
  getIPCInteranual().then(data => {
    const hint = document.getElementById('hint-ipc-actual');
    if (!hint) return;
    const est = data.fuente === 'fallback' ? ' (estimado)' : '';
    hint.textContent = `IPC interanual últimos 12 meses: ${data.interanual.toFixed(2)}%${est} — fuente: mindicador.cl / INE`;
  });

  document.getElementById('form-arriendo').addEventListener('submit', e => {
    e.preventDefault();
    limpiarError('arriendo-actual');
    const arriendo = leerNumero('arriendo-actual');
    if (!arriendo || arriendo <= 0) { mostrarError('arriendo-actual', 'Ingresa un monto de arriendo válido'); return; }

    const variacion = parseFloat(document.getElementById('variacion-ipc').value) || 0;
    const r = calcularAjusteArriendo({ arriendoActual: arriendo, variacionIPC: variacion });
    mostrarResultado('resultado-arriendo', renderAjusteArriendo(r));
    mostrarBtnCopiar('resultado-arriendo');
  });
}
