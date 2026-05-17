// calculadoras.js — Lógica de todas las calculadoras financieras
import { formatCLP, formatDecimal } from './api.js';

// ─────────────────────────────────────────────
// CALCULADORA 1: SUELDO LÍQUIDO
// ─────────────────────────────────────────────

const TASAS = {
  afp: 0.1144,         // 10% AFP + 1.44% SIS
  salud: 0.07,         // 7% Fonasa por defecto
  cesantiaIndef: 0.006, // 0.6% trabajador contrato indefinido
  cesantiaPlazo: 0.03,  // 3.0% trabajador contrato plazo fijo
  retencionHonorarios: 0.1525 // 15.25% retención 2026
};

function calcularSueldoLiquido({ bruto, tipoContrato, tipoSalud, porcentajeIsapre, tipoContratoDuracion }) {
  if (!bruto || bruto <= 0) return null;

  if (tipoContrato === 'honorarios') {
    const retencion = bruto * TASAS.retencionHonorarios;
    const liquido = bruto - retencion;
    return {
      tipo: 'honorarios',
      bruto,
      retencion,
      liquido,
      porcentajeRetencion: TASAS.retencionHonorarios * 100
    };
  }

  // Dependiente
  const pAfp = bruto * TASAS.afp;
  const pSalud = tipoSalud === 'isapre'
    ? bruto * (porcentajeIsapre / 100)
    : bruto * TASAS.salud;
  const pCesantia = tipoContratoDuracion === 'plazo_fijo'
    ? bruto * TASAS.cesantiaPlazo
    : bruto * TASAS.cesantiaIndef;

  const totalDescuentos = pAfp + pSalud + pCesantia;
  const liquido = bruto - totalDescuentos;

  return {
    tipo: 'dependiente',
    bruto,
    afp: pAfp,
    salud: pSalud,
    cesantia: pCesantia,
    totalDescuentos,
    liquido,
    tipoSalud,
    tipoContratoDuracion
  };
}

function renderSueldoLiquido(resultado) {
  if (!resultado) return '';

  if (resultado.tipo === 'honorarios') {
    return `
      <div class="resultado-tabla">
        <div class="fila-resultado fila-bruto">
          <span>Monto bruto (boleta)</span>
          <span>$${formatCLP(resultado.bruto)}</span>
        </div>
        <div class="fila-resultado fila-descuento">
          <span>Retención 10% PPM (${resultado.porcentajeRetencion}%)</span>
          <span class="negativo">−$${formatCLP(resultado.retencion)}</span>
        </div>
        <div class="fila-resultado fila-liquido">
          <span><strong>Líquido a recibir</strong></span>
          <span><strong>$${formatCLP(resultado.liquido)}</strong></span>
        </div>
      </div>
      <div class="explicacion">
        De tu boleta de $${formatCLP(resultado.bruto)}, recibes $${formatCLP(resultado.liquido)} pesos.
        Los $${formatCLP(resultado.retencion)} restantes son la retención provisional (${resultado.porcentajeRetencion}%)
        que el pagador entera al SII en tu nombre como pago provisional mensual.
      </div>`;
  }

  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Sueldo bruto</span>
        <span>$${formatCLP(resultado.bruto)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>AFP + SIS (${(TASAS.afp * 100).toFixed(2)}%)</span>
        <span class="negativo">−$${formatCLP(resultado.afp)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>${resultado.tipoSalud === 'isapre' ? 'Isapre' : 'Fonasa'} (${resultado.tipoSalud === 'isapre' ? formatDecimal(resultado.salud / resultado.bruto * 100) : '7.00'}%)</span>
        <span class="negativo">−$${formatCLP(resultado.salud)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Seg. Cesantía (${resultado.tipoContratoDuracion === 'plazo_fijo' ? '3.00' : '0.60'}%)</span>
        <span class="negativo">−$${formatCLP(resultado.cesantia)}</span>
      </div>
      <div class="fila-resultado fila-subtotal">
        <span>Total descuentos</span>
        <span class="negativo">−$${formatCLP(resultado.totalDescuentos)}</span>
      </div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Sueldo líquido</strong></span>
        <span><strong>$${formatCLP(resultado.liquido)}</strong></span>
      </div>
    </div>
    <div class="explicacion">
      De tu sueldo de $${formatCLP(resultado.bruto)}, recibes $${formatCLP(resultado.liquido)} pesos.
      Los $${formatCLP(resultado.totalDescuentos)} restantes van a AFP ($${formatCLP(resultado.afp)}),
      salud ($${formatCLP(resultado.salud)}) y seguro de cesantía ($${formatCLP(resultado.cesantia)}).
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 2: DIVIDENDO HIPOTECARIO
// ─────────────────────────────────────────────

const SEGUROS = {
  desgravamen: 0.000280, // 0.0280% mensual sobre saldo
  incendio: 0.000190     // 0.0190% mensual sobre valor propiedad
};

function calcularHipotecario({ valorUF, piePorc, tasaAnual, plazoAnos, valorUFDia }) {
  if (!valorUF || valorUF <= 0) return null;

  const pie = valorUF * (piePorc / 100);
  const monto = valorUF - pie; // monto a financiar en UF
  const n = plazoAnos * 12;
  const tasaMensual = tasaAnual / 100 / 12;

  // Cuota francesa (capital + intereses)
  const cuotaCapital = tasaMensual === 0
    ? monto / n
    : monto * tasaMensual / (1 - Math.pow(1 + tasaMensual, -n));

  // Seguros mensuales (en UF, calculados sobre primer mes como referencia)
  const segDesgravamen = monto * SEGUROS.desgravamen;
  const segIncendio = valorUF * SEGUROS.incendio;
  const totalSeguros = segDesgravamen + segIncendio;

  const cuotaTotal = cuotaCapital + totalSeguros;

  // Totales
  const totalPagado = cuotaCapital * n + totalSeguros * n;
  const totalIntereses = totalPagado - monto - totalSeguros * n;

  // Conversión a CLP
  const uf = valorUFDia;
  return {
    valorUF,
    pie,
    monto,
    tasaAnual,
    plazoAnos,
    n,
    cuotaCapital,
    segDesgravamen,
    segIncendio,
    totalSeguros,
    cuotaTotal,
    cuotaCapitalCLP: cuotaCapital * uf,
    cuotaTotalCLP: cuotaTotal * uf,
    totalPagado,
    totalPagadoCLP: totalPagado * uf,
    totalIntereses,
    totalInteresesCLP: totalIntereses * uf,
    uf
  };
}

function renderHipotecario(r) {
  if (!r) return '';

  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Valor propiedad</span>
        <span>${formatDecimal(r.valorUF)} UF <span class="monto-clp">($${formatCLP(r.valorUF * r.uf)})</span></span>
      </div>
      <div class="fila-resultado">
        <span>Pie (${formatDecimal(r.pie / r.valorUF * 100)}%)</span>
        <span>${formatDecimal(r.pie)} UF <span class="monto-clp">($${formatCLP(r.pie * r.uf)})</span></span>
      </div>
      <div class="fila-resultado">
        <span>Monto a financiar</span>
        <span>${formatDecimal(r.monto)} UF <span class="monto-clp">($${formatCLP(r.monto * r.uf)})</span></span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado">
        <span>Cuota capital + intereses</span>
        <span>${formatDecimal(r.cuotaCapital)} UF</span>
      </div>
      <div class="fila-resultado">
        <span>Seg. desgravamen</span>
        <span>${formatDecimal(r.segDesgravamen, 4)} UF</span>
      </div>
      <div class="fila-resultado">
        <span>Seg. incendio/sismo</span>
        <span>${formatDecimal(r.segIncendio, 4)} UF</span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Dividendo mensual total</strong></span>
        <span><strong>${formatDecimal(r.cuotaTotal)} UF<br>$${formatCLP(r.cuotaTotalCLP)} CLP</strong></span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-subtotal">
        <span>Total pagado en ${r.plazoAnos} años</span>
        <span>$${formatCLP(r.totalPagadoCLP)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Total intereses pagados</span>
        <span>$${formatCLP(r.totalInteresesCLP)}</span>
      </div>
    </div>
    <div class="explicacion">
      Por una propiedad de ${formatDecimal(r.valorUF)} UF con pie del ${formatDecimal(r.pie / r.valorUF * 100)}%,
      tu dividendo mensual sería de $${formatCLP(r.cuotaTotalCLP)} pesos (${formatDecimal(r.cuotaTotal)} UF al valor de hoy de $${formatCLP(r.uf)}).
      En ${r.plazoAnos} años pagarás $${formatCLP(r.totalInteresesCLP)} en intereses.
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 3: INVERSIÓN E INFLACIÓN
// ─────────────────────────────────────────────

// ── 3a. INTERÉS COMPUESTO ──

function calcularInteresCompuesto({ capital, tasaAnual, plazo, unidad, aporteMensual = 0 }) {
  if (!capital || capital <= 0) return null;
  const P = Number(capital);
  const r = Number(tasaAnual) / 100;
  const n = 12;
  const years = unidad === 'meses' ? Number(plazo) / 12 : Number(plazo);
  const pmt = Number(aporteMensual) || 0;

  if (r === 0) {
    const total = P + pmt * n * years;
    return { valorFinal: total, totalInvertido: total, ganancias: 0, porcentaje: 0, puntos: _buildPuntos(P, 0, pmt, years, n) };
  }

  const cf = Math.pow(1 + r / n, n * years);
  const valorFinal = P * cf + (pmt > 0 ? pmt * ((cf - 1) / (r / n)) : 0);
  const totalInvertido = P + pmt * n * years;
  const ganancias = valorFinal - totalInvertido;

  return {
    valorFinal: Math.round(valorFinal),
    totalInvertido: Math.round(totalInvertido),
    ganancias: Math.round(ganancias),
    porcentaje: Math.round((ganancias / totalInvertido) * 10000) / 100,
    multiplicador: Math.round((valorFinal / totalInvertido) * 100) / 100,
    puntos: _buildPuntos(P, r, pmt, years, n),
    years
  };
}

function _buildPuntos(P, r, pmt, years, n) {
  const totalMeses = Math.round(years * 12);
  const puntos = [];
  for (let mes = 0; mes <= totalMeses; mes++) {
    const t = mes / 12;
    let valor;
    if (r === 0) {
      valor = P + pmt * mes;
    } else {
      const cf = Math.pow(1 + r / n, n * t);
      valor = P * cf + (pmt > 0 ? pmt * ((cf - 1) / (r / n)) : 0);
    }
    puntos.push({ mes, total: Math.round(valor), invertido: Math.round(P + pmt * mes) });
  }
  return puntos;
}

function renderInteresCompuesto(r) {
  if (!r) return '';
  const porcCap = Math.min(100, Math.round((r.totalInvertido / r.valorFinal) * 100));
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Capital + aportes (total invertido)</span>
        <span>$${formatCLP(r.totalInvertido)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Ganancias por interés compuesto</span>
        <span class="positivo">+$${formatCLP(r.ganancias)}</span>
      </div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Valor final</strong></span>
        <span><strong>$${formatCLP(r.valorFinal)}</strong></span>
      </div>
      <div class="fila-resultado">
        <span>Rentabilidad total</span>
        <span class="positivo">+${formatDecimal(r.porcentaje)}% · ${formatDecimal(r.multiplicador)}× tu dinero</span>
      </div>
    </div>
    <div class="barra-composicion">
      <div class="barra-composicion-track">
        <div class="barra-cap" style="width:${porcCap}%"></div>
        <div class="barra-gan"></div>
      </div>
      <div class="barra-leyenda">
        <span class="leyenda-cap">Capital ${porcCap}%</span>
        <span class="leyenda-gan">Ganancias ${100 - porcCap}%</span>
      </div>
    </div>
    <div class="explicacion">
      Tu inversión de $${formatCLP(r.totalInvertido)} creció a $${formatCLP(r.valorFinal)} gracias al interés compuesto.
      Las ganancias de $${formatCLP(r.ganancias)} representan el ${formatDecimal(r.porcentaje)}% de lo invertido — multiplicaste tu dinero por ${formatDecimal(r.multiplicador)}.
    </div>`;
}

// ── 3b. INTERÉS SIMPLE ──

function calcularInteresSimple({ capital, tasaAnual, plazo, unidad }) {
  if (!capital || capital <= 0) return null;
  const P = Number(capital);
  const r = Number(tasaAnual) / 100;
  const years = unidad === 'meses' ? Number(plazo) / 12 : Number(plazo);
  const interes = P * r * years;
  const valorFinal = P + interes;

  // Diferencia vs compuesto bajo iguales condiciones
  const cf = Math.pow(1 + r / 12, 12 * years);
  const gananciaCompuesto = Math.round(P * cf - P);

  return {
    valorFinal: Math.round(valorFinal),
    capital: P,
    interes: Math.round(interes),
    porcentaje: Math.round((interes / P) * 10000) / 100,
    gananciaCompuesto,
    tasaAnual: Number(tasaAnual),
    years
  };
}

function renderInteresSimple(r) {
  if (!r) return '';
  const difComp = r.gananciaCompuesto - r.interes;
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Capital (P)</span>
        <span>$${formatCLP(r.capital)}</span>
      </div>
      <div class="fila-resultado">
        <span>Tasa × tiempo</span>
        <span>${formatDecimal(r.tasaAnual)}% × ${formatDecimal(r.years)} años</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Interés generado (P × r × t)</span>
        <span class="positivo">+$${formatCLP(r.interes)}</span>
      </div>
      <div class="fila-resultado">
        <span>Rentabilidad total</span>
        <span class="positivo">+${formatDecimal(r.porcentaje)}%</span>
      </div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Valor final</strong></span>
        <span><strong>$${formatCLP(r.valorFinal)}</strong></span>
      </div>
    </div>
    <div class="aviso-legal" style="margin-top:0.75rem">
      Con las mismas condiciones, el interés <strong>compuesto</strong> generaría $${formatCLP(r.gananciaCompuesto)} en ganancias
      — <strong>$${formatCLP(difComp)} más</strong> que el interés simple.
    </div>
    <div class="explicacion">
      El interés simple siempre calcula sobre el capital original ($${formatCLP(r.capital)}).
      No reinvierte las ganancias, por eso rinde menos que el compuesto a largo plazo.
    </div>`;
}

// ── 3c. INFLACIÓN ──

function calcularInflacion({ valorNominal, tasaInflacion, anos }) {
  if (!valorNominal || valorNominal <= 0) return null;
  const nominal = Number(valorNominal);
  const real = nominal / Math.pow(1 + Number(tasaInflacion) / 100, Number(anos));
  const perdida = nominal - real;
  return {
    valorNominal: nominal,
    valorReal: Math.round(real),
    perdida: Math.round(perdida),
    porcentajePerdida: Math.round((perdida / nominal) * 10000) / 100,
    tasaInflacion: Number(tasaInflacion),
    anos: Number(anos)
  };
}

function renderInflacion(r) {
  if (!r) return '';
  const poderRestante = 100 - r.porcentajePerdida;
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Valor hoy (poder adquisitivo actual)</span>
        <span>$${formatCLP(r.valorNominal)}</span>
      </div>
      <div class="fila-resultado fila-subtotal">
        <span>Pérdida por inflación (${r.tasaInflacion}% × ${r.anos} años)</span>
        <span class="negativo">−$${formatCLP(r.perdida)}</span>
      </div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Valor real en ${r.anos} años</strong></span>
        <span><strong>$${formatCLP(r.valorReal)}</strong></span>
      </div>
      <div class="fila-resultado">
        <span>Pérdida de poder adquisitivo</span>
        <span class="negativo">−${formatDecimal(r.porcentajePerdida)}%</span>
      </div>
    </div>
    <div class="barra-poder">
      <div class="barra-fila">
        <div class="barra-fila-label"><span>Poder adquisitivo hoy</span><span>100%</span></div>
        <div class="barra-track"><div class="barra-fill barra-fill-azul" style="width:100%"></div></div>
      </div>
      <div class="barra-fila">
        <div class="barra-fila-label"><span>Poder adquisitivo en ${r.anos} años</span><span>${formatDecimal(poderRestante)}%</span></div>
        <div class="barra-track"><div class="barra-fill barra-fill-rojo" style="width:${Math.max(0, poderRestante)}%"></div></div>
      </div>
    </div>
    <div class="explicacion">
      Tus $${formatCLP(r.valorNominal)} de hoy solo valdrán $${formatCLP(r.valorReal)} dentro de ${r.anos} años
      con una inflación del ${r.tasaInflacion}% anual. Perderás el ${formatDecimal(r.porcentajePerdida)}% de tu poder de compra.
    </div>`;
}

function renderVenceInflacion(tasaInflacion, tasaInversion) {
  const retornoReal = ((1 + tasaInversion / 100) / (1 + tasaInflacion / 100) - 1) * 100;
  const si = retornoReal > 0;
  return `
    <div class="vence-inflacion ${si ? 'si' : 'no'}">
      <span class="vence-icon">${si ? '✓' : '✗'}</span>
      <div>
        <strong>Inversión al ${formatDecimal(tasaInversion)}%: retorno real ${si ? '+' : ''}${formatDecimal(retornoReal)}% anual</strong><br>
        <span style="font-size:0.82rem">
          ${si
            ? `Tu inversión supera la inflación por ${formatDecimal(retornoReal)}% real anual. Estás preservando (y aumentando) tu poder adquisitivo.`
            : `Tu inversión NO supera la inflación de ${tasaInflacion}%. Estás perdiendo poder adquisitivo en términos reales.`}
        </span>
      </div>
    </div>`;
}

// ── 3d. COMPARADOR DE ESCENARIOS ──

function calcularComparador(escenarios) {
  return escenarios.map(s => {
    const r = calcularInteresCompuesto({
      capital: s.capital,
      tasaAnual: s.tasa,
      plazo: s.anos,
      unidad: 'anos',
      aporteMensual: s.aporte
    });
    return r;
  });
}

function renderComparador(escenarios, resultados) {
  const maxVal = Math.max(...resultados.map(r => r?.valorFinal || 0));
  const ganador = resultados.findIndex(r => r?.valorFinal === maxVal);
  const nombres = ['Escenario A', 'Escenario B', 'Escenario C'];
  const colores = ['th-a', 'th-b', 'th-c'];

  const filas = [
    { label: 'Capital inicial', fn: (s) => `$${formatCLP(s.capital)}` },
    { label: 'Tasa anual', fn: (s) => `${s.tasa}%` },
    { label: 'Años', fn: (s) => s.anos },
    { label: 'Aporte mensual', fn: (s) => `$${formatCLP(s.aporte)}` },
    { label: 'Total invertido', fn: (_, r) => `$${formatCLP(r.totalInvertido)}`, fromR: true },
    { label: 'Ganancias', fn: (_, r) => `+$${formatCLP(r.ganancias)}`, fromR: true, verde: true },
    { label: 'Valor final', fn: (_, r) => `$${formatCLP(r.valorFinal)}`, fromR: true, highlight: true },
    { label: 'Rentabilidad total', fn: (_, r) => `+${formatDecimal(r.porcentaje)}%`, fromR: true, verde: true },
    { label: 'Multiplicador', fn: (_, r) => `${formatDecimal(r.multiplicador)}×`, fromR: true },
  ];

  const thsHTML = escenarios.map((s, i) => `
    <th class="${colores[i]}">${nombres[i]}${ganador === i ? '<span class="badge-mejor">mejor</span>' : ''}</th>`).join('');

  const rowsHTML = filas.map(fila => `
    <tr>
      <td>${fila.label}</td>
      ${escenarios.map((s, i) => {
        const val = fila.fromR ? fila.fn(s, resultados[i]) : fila.fn(s);
        const isGanador = fila.highlight && ganador === i;
        return `<td class="${isGanador ? 'td-ganador' : fila.verde ? 'positivo' : ''}">${val}</td>`;
      }).join('')}
    </tr>`).join('');

  return `
    <table class="tabla-comparativa">
      <thead><tr><th>Métrica</th>${thsHTML}</tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <div class="explicacion" style="margin-top:0.75rem">
      El mejor escenario es <strong>${nombres[ganador]}</strong> con un valor final de
      $${formatCLP(maxVal)} — ${formatDecimal(resultados[ganador].multiplicador)}× el capital invertido.
    </div>`;
}

// ── 3e. SIMULACIÓN MENSUAL ──

function calcularSimulacionMensual({ aporteMensual, tasaAnual, meses }) {
  if (!aporteMensual || aporteMensual <= 0) return null;
  const pmt = Number(aporteMensual);
  const tasaMensual = Number(tasaAnual) / 100 / 12;
  const totalMeses = Number(meses);
  let total = 0;
  let invertido = 0;
  const puntos = [{ mes: 0, total: 0, invertido: 0 }];

  for (let mes = 1; mes <= totalMeses; mes++) {
    total = (total + pmt) * (1 + tasaMensual);
    invertido += pmt;
    puntos.push({ mes, total: Math.round(total), invertido: Math.round(invertido) });
  }

  const ganancias = total - invertido;
  return {
    valorFinal: Math.round(total),
    totalInvertido: Math.round(invertido),
    ganancias: Math.round(ganancias),
    porcentaje: Math.round((ganancias / invertido) * 10000) / 100,
    multiplicador: Math.round((total / invertido) * 100) / 100,
    puntos,
    aporteMensual: pmt,
    meses: totalMeses
  };
}

function renderSimulacionMensual(r) {
  if (!r) return '';
  const porcCap = Math.round((r.totalInvertido / r.valorFinal) * 100);
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Aporte mensual × ${r.meses} meses</span>
        <span>$${formatCLP(r.totalInvertido)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Ganancias por interés compuesto</span>
        <span class="positivo">+$${formatCLP(r.ganancias)}</span>
      </div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Valor final</strong></span>
        <span><strong>$${formatCLP(r.valorFinal)}</strong></span>
      </div>
      <div class="fila-resultado">
        <span>Rentabilidad · Multiplicador</span>
        <span class="positivo">+${formatDecimal(r.porcentaje)}% · ${formatDecimal(r.multiplicador)}×</span>
      </div>
      <div class="fila-resultado">
        <span>Aportado por año</span>
        <span>$${formatCLP(r.aporteMensual * 12)}</span>
      </div>
    </div>
    <div class="barra-composicion">
      <div class="barra-composicion-track">
        <div class="barra-cap" style="width:${porcCap}%"></div>
        <div class="barra-gan"></div>
      </div>
      <div class="barra-leyenda">
        <span class="leyenda-cap">Aportado ${porcCap}%</span>
        <span class="leyenda-gan">Intereses ${100 - porcCap}%</span>
      </div>
    </div>
    <div class="explicacion">
      Aportando $${formatCLP(r.aporteMensual)} cada mes durante ${(r.meses / 12).toFixed(1)} años,
      acumulas $${formatCLP(r.valorFinal)}. Tus aportes fueron $${formatCLP(r.totalInvertido)}
      y el interés compuesto añadió $${formatCLP(r.ganancias)} adicionales.
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 4: FINIQUITO
// ─────────────────────────────────────────────

function calcularFiniquito({ tipoContrato, motivoTermino, sueldoBruto, anosServicio, diasVacaciones, uf }) {
  if (!sueldoBruto || sueldoBruto <= 0 || !anosServicio || anosServicio <= 0) return null;

  const items = [];
  let total = 0;

  const ufValor = uf || 38500;
  // Art. 172 CT: base de cálculo de indemnización limitada a 90 UF
  const baseIndem = Math.min(sueldoBruto, 90 * ufValor);
  const sueldoDiario = sueldoBruto / 30;

  const anosCompletos = Math.floor(anosServicio);
  // Meses de la fracción del año en curso (1 decimal)
  const mesesFraccion = Math.round((anosServicio % 1) * 12 * 10) / 10;
  const mesesFraccionInt = Math.round(mesesFraccion);

  // ── 1. VACACIONES PROPORCIONALES (siempre corresponde) ──────────────────
  // 15 días hábiles/año = 1.25 días hábiles por mes trabajado (art. 67 CT)
  let diasVac, tooltipVac;
  if (diasVacaciones > 0) {
    diasVac = diasVacaciones;
    tooltipVac = `${diasVac} días pendientes ingresados × $${formatCLP(sueldoDiario)}/día`;
  } else {
    // Si terminó exactamente un año completo (fracción = 0) y tiene ≥ 1 año,
    // el año recién completado genera 15 días que se asumen no tomados
    const mesesCalc = (mesesFraccion === 0 && anosServicio >= 1) ? 12 : mesesFraccion;
    diasVac = Math.max(0, Math.round(mesesCalc * 1.25)); // 1.25 días hábiles/mes
    const descMeses = (mesesFraccion === 0 && anosServicio >= 1)
      ? '12 meses (año completado)'
      : `${mesesCalc.toFixed(1)} meses del año en curso`;
    tooltipVac = `${diasVac} días hábiles (${descMeses} × 1.25 días/mes) × $${formatCLP(sueldoDiario)}/día`;
  }
  const montoVac = Math.round(diasVac * sueldoDiario);
  items.push({ nombre: 'Vacaciones proporcionales', monto: montoVac, tooltip: tooltipVac });
  total += montoVac;

  // ── 2. INDEMNIZACIÓN POR AÑOS DE SERVICIO (art. 161 / 163 CT) ───────────
  // Solo para contratos indefinidos con ≥ 1 año de servicio
  // Motivos: necesidades de empresa o despido sin causa justificada
  const hayIndemnizacion = tipoContrato === 'indefinido'
    && anosServicio >= 1
    && (motivoTermino === 'necesidades_empresa' || motivoTermino === 'despido_sin_causa');

  let anosIndem = 0;
  if (hayIndemnizacion) {
    // Art. 163 CT: fracción superior a 6 meses se cuenta como año completo
    const aniosConFraccion = anosCompletos + (mesesFraccionInt > 6 ? 1 : 0);
    anosIndem = Math.min(aniosConFraccion, 11); // tope 11 años (art. 163 CT)

    const montoIndem = anosIndem * baseIndem;
    const fracLabel = mesesFraccionInt > 6
      ? ` + fracción de ${mesesFraccionInt} meses (>6 meses = +1 año, art. 163 CT)`
      : (mesesFraccionInt > 0 ? ` + ${mesesFraccionInt} meses (no suma año extra)` : '');
    const topeLabel = sueldoBruto > 90 * ufValor ? ` | Base limitada a 90 UF = $${formatCLP(baseIndem)}` : '';

    items.push({
      nombre: `Indemnización por años de servicio (${anosIndem} año${anosIndem !== 1 ? 's' : ''})`,
      monto: montoIndem,
      tooltip: `${anosCompletos} año${anosCompletos !== 1 ? 's' : ''}${fracLabel} × $${formatCLP(baseIndem)}${topeLabel}`
    });
    total += montoIndem;

    // Recargo 30% por despido sin causa (art. 168 CT)
    if (motivoTermino === 'despido_sin_causa') {
      const recargo = Math.round(montoIndem * 0.30);
      items.push({
        nombre: 'Recargo 30% por despido injustificado (art. 168)',
        monto: recargo,
        tooltip: `30% × $${formatCLP(montoIndem)} — Si impugnas el despido en el Juzgado Laboral puede llegar al 50% o 80%`
      });
      total += recargo;
    }
  }

  // ── 3. SUSTITUTIVO DE MES DE AVISO (art. 161 inc. 2 CT) ─────────────────
  // Aplica cuando el empleador no dio aviso con 30 días de anticipación
  const hayAviso = tipoContrato === 'indefinido'
    && (motivoTermino === 'necesidades_empresa' || motivoTermino === 'despido_sin_causa');

  if (hayAviso) {
    items.push({
      nombre: 'Sustitutivo de mes de aviso (art. 161)',
      monto: baseIndem,
      tooltip: `1 mes de sueldo si el empleador no dio aviso con 30 días de anticipación${sueldoBruto > 90 * ufValor ? ` (base = 90 UF = $${formatCLP(baseIndem)})` : ''}`
    });
    total += baseIndem;
  }

  return {
    items, total, sueldoBruto, anosServicio, anosCompletos, mesesFraccion,
    mesesFraccionInt, anosIndem, motivoTermino, tipoContrato, diasVac,
    hayIndemnizacion, hayAviso, baseIndem
  };
}

function renderFiniquito(r) {
  if (!r) return '';

  const itemsHTML = r.items.map(item => `
    <div class="fila-resultado">
      <span>${item.nombre} <span class="tooltip-hint" title="${item.tooltip}">ⓘ</span></span>
      <span>$${formatCLP(item.monto)}</span>
    </div>`).join('');

  // Aviso legal según motivo
  const avisosPorMotivo = {
    renuncia: 'ℹ️ En renuncia voluntaria solo corresponde pagar vacaciones proporcionales. No hay indemnización ni mes de aviso.',
    mutuo_acuerdo: 'ℹ️ En mutuo acuerdo la ley no exige indemnización, aunque puede pactarse voluntariamente entre las partes.',
    despido_con_causa: 'ℹ️ El despido con causa justificada (art. 160) no genera indemnización por años ni mes de aviso.'
  };

  const avisoLegal = !r.hayIndemnizacion ? avisosPorMotivo[r.motivoTermino] : null;

  // Nota sobre fracción > 6 meses
  const fracMsg = r.hayIndemnizacion && r.mesesFraccionInt > 6
    ? `<br>📌 La fracción de ${r.mesesFraccionInt} meses supera 6 meses → cuenta como año adicional en la indemnización (art. 163 CT).`
    : '';

  // Explicación principal según motivo
  const explicacion = {
    renuncia: `Tu finiquito incluye ${r.diasVac} días de vacaciones proporcionales. Al renunciar, no hay derecho a indemnización por años de servicio.`,
    mutuo_acuerdo: `Tu finiquito incluye ${r.diasVac} días de vacaciones proporcionales acordados. Puedes negociar indemnización adicional con el empleador.`,
    despido_con_causa: `Tu finiquito incluye ${r.diasVac} días de vacaciones proporcionales. Al ser despido con causa (art. 160), no corresponde indemnización.`,
    necesidades_empresa: `Con ${r.anosIndem} año${r.anosIndem !== 1 ? 's' : ''} de servicio, recibes indemnización por años más el sustitutivo de mes de aviso (si no se dio aviso previo de 30 días). Total estimado: $${formatCLP(r.total)}.`,
    despido_sin_causa: `El despido sin causa justificada incluye indemnización por ${r.anosIndem} año${r.anosIndem !== 1 ? 's' : ''} con recargo del 30% (art. 168 CT). Si impugnas el despido en el Juzgado Laboral puedes obtener un recargo del 50% o hasta el 80%.`
  };

  return `
    <div class="resultado-tabla">
      ${itemsHTML}
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Total finiquito estimado</strong></span>
        <span><strong>$${formatCLP(r.total)}</strong></span>
      </div>
    </div>
    ${avisoLegal ? `<div class="aviso-legal">${avisoLegal}</div>` : ''}
    <div class="explicacion">
      ${explicacion[r.motivoTermino] || `Tu finiquito total estimado es de $${formatCLP(r.total)}.`}
      ${fracMsg}
      <br><small>Cálculo referencial. El finiquito definitivo debe ser firmado ante notario o ministro de fe dentro de 10 días hábiles.</small>
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 5: APV — AHORRO PREVISIONAL VOLUNTARIO
// ─────────────────────────────────────────────

// Tramos IUSC 2026 (base en UTM mensuales)
// Fórmula: impuesto_UTM = base_UTM * tasa - factor
const TRAMOS_IUSC = [
  { hasta: 13.5,    tasa: 0,     factor: 0     },
  { hasta: 30,      tasa: 0.04,  factor: 0.54  },
  { hasta: 50,      tasa: 0.08,  factor: 1.74  },
  { hasta: 70,      tasa: 0.135, factor: 4.49  },
  { hasta: 90,      tasa: 0.23,  factor: 11.14 },
  { hasta: 120,     tasa: 0.304, factor: 17.80 },
  { hasta: 150,     tasa: 0.35,  factor: 23.32 },
  { hasta: Infinity, tasa: 0.40, factor: 30.82 }
];

function _calcIUSC(baseUTM) {
  if (baseUTM <= 0) return { impUTM: 0, tasaMarginal: 0 };
  const t = TRAMOS_IUSC.find(t => baseUTM <= t.hasta);
  return { impUTM: Math.max(0, baseUTM * t.tasa - t.factor), tasaMarginal: t.tasa * 100 };
}

function _proyAPV(apvMensual, bonoAnual, anos, rentPorc) {
  const r = rentPorc / 100;
  const rm = r / 12;
  const n = anos * 12;
  const fondoAPV = rm === 0 ? apvMensual * n : apvMensual * ((Math.pow(1 + rm, n) - 1) / rm);
  const fondoBono = bonoAnual === 0 ? 0
    : r === 0 ? bonoAnual * anos
    : bonoAnual * ((Math.pow(1 + r, anos) - 1) / r);
  return Math.round(fondoAPV + fondoBono);
}

function _puntosAPV(apvMensual, bonoAnual, anos, rentPorc) {
  const r = rentPorc / 100;
  const rm = r / 12;
  const pts = [];
  for (let yr = 0; yr <= anos; yr++) {
    const n = yr * 12;
    const fondo = rm === 0 ? apvMensual * n : apvMensual * ((Math.pow(1 + rm, n) - 1) / rm);
    const bono = (bonoAnual === 0 || yr === 0) ? 0
      : r === 0 ? bonoAnual * yr
      : bonoAnual * ((Math.pow(1 + r, yr) - 1) / r);
    pts.push({ year: yr, total: Math.round(fondo + bono) });
  }
  return pts;
}

function calcularAPV({ sueldoBruto, apvMensual, anos, rentabilidad, utm, uf }) {
  if (!sueldoBruto || sueldoBruto <= 0) return null;
  const pmt = Number(apvMensual) || 0;

  // Base imponible IUSC = bruto - AFP 10% - salud 7%
  const baseImponible = sueldoBruto * 0.83;
  const baseUTM = baseImponible / utm;
  const { impUTM: impUTMSinAPV, tasaMarginal } = _calcIUSC(baseUTM);

  // ── Régimen A ──
  const bonoAnual = Math.min(pmt * 12 * 0.15, 6 * utm);
  const apvOptimoA = Math.round((6 * utm) / 0.15 / 12);

  // ── Régimen B ──
  const apvMaxMes = 50 * uf;
  const apvEfectivoB = Math.min(pmt, apvMaxMes);
  const baseConBenUTM = Math.max(0, (baseImponible - apvEfectivoB) / utm);
  const { impUTM: impUTMConAPVB } = _calcIUSC(baseConBenUTM);
  const ahorroMensB = Math.round(Math.max(0, impUTMSinAPV - impUTMConAPVB) * utm);

  // ── Proyecciones ──
  const anos_ = Number(anos);
  const rent_ = Number(rentabilidad);
  const acumA = _proyAPV(pmt, bonoAnual, anos_, rent_);
  const acumB = _proyAPV(apvEfectivoB, 0, anos_, rent_);

  return {
    sueldoBruto,
    baseImponible: Math.round(baseImponible),
    tasaMarginal,
    impuestoPesos: Math.round(impUTMSinAPV * utm),
    apvMensual: pmt,
    anos: anos_,
    utm,
    uf,
    regA: {
      bonoAnual: Math.round(bonoAnual),
      apvOptimo: apvOptimoA,
      superaTope: pmt > apvOptimoA,
      acumulado: acumA,
      puntos: _puntosAPV(pmt, bonoAnual, anos_, rent_)
    },
    regB: {
      ahorroMensual: ahorroMensB,
      ahorroAnual: ahorroMensB * 12,
      acumulado: acumB,
      puntos: _puntosAPV(apvEfectivoB, 0, anos_, rent_),
      sinBeneficio: tasaMarginal === 0,
      apvEfectivo: Math.round(apvEfectivoB)
    },
    // Regla: marginal > 15% → B conviene más; < 15% → A conviene más
    recomendacion: tasaMarginal > 15 ? 'B' : 'A'
  };
}

function _descTramo(tasa) {
  const m = { 0: 'Exento (0%)', 4: '4%', 8: '8%', 13.5: '13,5%', 23: '23%', 30.4: '30,4%', 35: '35%', 40: '40%' };
  return m[tasa] ?? `${tasa}%`;
}

function renderAPV(r, regimen) {
  if (!r) return '';
  const desc = _descTramo(r.tasaMarginal);
  if (regimen === 'A') return _renderAPV_A(r, desc);
  if (regimen === 'B') return _renderAPV_B(r, desc);
  return _renderAPV_Comparar(r, desc);
}

function _renderAPV_A(r, desc) {
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Sueldo bruto mensual</span><span>$${formatCLP(r.sueldoBruto)}</span>
      </div>
      <div class="fila-resultado">
        <span>APV mensual que ahorras</span><span>$${formatCLP(r.apvMensual)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Bono estatal anual (15%)</span>
        <span class="positivo">+$${formatCLP(r.regA.bonoAnual)}</span>
      </div>
      <div class="fila-resultado">
        <span>Bono mensual equivalente</span>
        <span class="positivo">≈ +$${formatCLP(Math.round(r.regA.bonoAnual / 12))}/mes</span>
      </div>
      <div class="fila-resultado">
        <span>APV óptimo para maximizar bono estatal</span>
        <span><strong>$${formatCLP(r.regA.apvOptimo)}/mes</strong></span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Acumulado en ${r.anos} años</strong></span>
        <span><strong>$${formatCLP(r.regA.acumulado)}</strong></span>
      </div>
    </div>
    ${r.regA.superaTope ? `
    <div class="aviso-legal">
      ⚠️ Tu APV de $${formatCLP(r.apvMensual)}/mes supera el tope óptimo ($${formatCLP(r.regA.apvOptimo)}/mes).
      El exceso <strong>no recibe bono</strong>. Considera el Régimen B para el monto sobre el tope.
    </div>` : ''}
    <div class="apv-recomendacion">
      Con tu sueldo de $${formatCLP(r.sueldoBruto)}, tu tasa marginal es <strong>${desc}</strong>.
      ${r.tasaMarginal <= 15
        ? `El bono estatal del 15% supera tu ahorro tributario. <strong>El Régimen A es tu mejor opción</strong> — guarda $${formatCLP(r.regA.apvOptimo)}/mes para maximizar el bono de $${formatCLP(r.regA.bonoAnual)}/año que te regala el Estado.`
        : `Tu tasa del ${r.tasaMarginal}% supera el 15% del bono. Revisa también el Régimen B — podría ahorrarte más en impuestos.`
      }
    </div>`;
}

function _renderAPV_B(r, desc) {
  return `
    <div class="resultado-tabla">
      <div class="fila-resultado fila-bruto">
        <span>Sueldo bruto mensual</span><span>$${formatCLP(r.sueldoBruto)}</span>
      </div>
      <div class="fila-resultado">
        <span>Base imponible IUSC (bruto − AFP − salud)</span>
        <span>$${formatCLP(r.baseImponible)}</span>
      </div>
      <div class="fila-resultado">
        <span>Tramo de impuesto marginal</span>
        <span><strong>${desc}</strong></span>
      </div>
      <div class="fila-resultado">
        <span>APV efectivo Régimen B</span>
        <span>$${formatCLP(r.regB.apvEfectivo)}/mes</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Ahorro en impuesto mensual</span>
        <span class="positivo">+$${formatCLP(r.regB.ahorroMensual)}</span>
      </div>
      <div class="fila-resultado fila-descuento">
        <span>Ahorro en impuesto anual</span>
        <span class="positivo">+$${formatCLP(r.regB.ahorroAnual)}</span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Acumulado APV en ${r.anos} años</strong></span>
        <span><strong>$${formatCLP(r.regB.acumulado)}</strong></span>
      </div>
    </div>
    ${r.regB.sinBeneficio ? `
    <div class="aviso-legal">
      ⚠️ Tu base imponible está en el tramo exento (0%). El Régimen B <strong>no tiene beneficio tributario</strong>.
      El Régimen A es la única opción con beneficio real en tu caso.
    </div>` : ''}
    <div class="apv-recomendacion">
      Con tu sueldo de $${formatCLP(r.sueldoBruto)}, tu tasa marginal es <strong>${desc}</strong>.
      ${r.regB.sinBeneficio
        ? 'Estás en el tramo exento. Usa el Régimen A para recibir el bono del 15% del Estado.'
        : `El Régimen B descuenta tu APV de la base imponible — ahorras $${formatCLP(r.regB.ahorroMensual)} en impuestos cada mes, es decir, el <strong>${r.tasaMarginal}% de lo que ahorras</strong> lo recuperas de inmediato.`
      }
    </div>`;
}

function _renderAPV_Comparar(r, desc) {
  const ganA = r.regA.bonoAnual >= r.regB.ahorroAnual;
  return `
    <table class="tabla-comparativa">
      <thead>
        <tr>
          <th>Métrica</th>
          <th class="th-a">Régimen A 🏦</th>
          <th class="th-b">Régimen B 📊</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Tramo marginal</td>
          <td colspan="2" style="text-align:center;font-weight:600">${desc}</td>
        </tr>
        <tr>
          <td>Tipo de beneficio</td>
          <td>Bono estatal 15%</td>
          <td>Descuento base IUSC</td>
        </tr>
        <tr>
          <td>Beneficio mensual</td>
          <td class="${ganA ? 'td-ganador' : ''}">+$${formatCLP(Math.round(r.regA.bonoAnual / 12))}${ganA ? ' ✓' : ''}</td>
          <td class="${!ganA ? 'td-ganador' : ''}">+$${formatCLP(r.regB.ahorroMensual)}${!ganA ? ' ✓' : ''}</td>
        </tr>
        <tr>
          <td>Beneficio anual</td>
          <td class="${ganA ? 'td-ganador' : ''}">+$${formatCLP(r.regA.bonoAnual)}${ganA ? ' ✓' : ''}</td>
          <td class="${!ganA ? 'td-ganador' : ''}">+$${formatCLP(r.regB.ahorroAnual)}${!ganA ? ' ✓' : ''}</td>
        </tr>
        <tr>
          <td>APV óptimo/mes</td>
          <td>$${formatCLP(r.regA.apvOptimo)} (máx. bono)</td>
          <td>$${formatCLP(Math.round(50 * r.uf))} (50 UF)</td>
        </tr>
        <tr>
          <td>Acumulado ${r.anos} años</td>
          <td class="${r.regA.acumulado >= r.regB.acumulado ? 'td-ganador' : ''}">
            $${formatCLP(r.regA.acumulado)}${r.regA.acumulado >= r.regB.acumulado ? ' ✓' : ''}
          </td>
          <td class="${r.regB.acumulado > r.regA.acumulado ? 'td-ganador' : ''}">
            $${formatCLP(r.regB.acumulado)}${r.regB.acumulado > r.regA.acumulado ? ' ✓' : ''}
          </td>
        </tr>
      </tbody>
    </table>
    <div class="apv-recomendacion">
      Con tu sueldo de $${formatCLP(r.sueldoBruto)}, tu tasa marginal es <strong>${desc}</strong>.
      ${r.recomendacion === 'A'
        ? `<strong>Te recomendamos el Régimen A:</strong> el bono estatal del 15% ($${formatCLP(r.regA.bonoAnual)}/año) supera tu ahorro tributario en el Régimen B ($${formatCLP(r.regB.ahorroAnual)}/año). Ahorra hasta $${formatCLP(r.regA.apvOptimo)}/mes para maximizar el bono.`
        : `<strong>Te recomendamos el Régimen B:</strong> tu tasa marginal del ${r.tasaMarginal}% supera el 15% del bono estatal — cada peso que ahorras te devuelve ${r.tasaMarginal} centavos en impuestos, más que el bono del Régimen A.`
      }
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 6: PENSIÓN ALIMENTARIA
// ─────────────────────────────────────────────

const IMM_2026 = 539000; // Ingreso Mínimo Mensual vigente

function calcularPensionAlimentos({ ingresoNeto, numHijos, tipoObligado, utm }) {
  if (!ingresoNeto || ingresoNeto <= 0 || !numHijos || numHijos < 1) return null;

  const utmValor = utm || 70588;

  // Mínimos legales (Ley 14.908 art. 3)
  // 1 hijo: 40% del IMM | 2+ hijos: 30% del IMM por cada hijo
  const minimoUnitario = numHijos === 1 ? IMM_2026 * 0.40 : IMM_2026 * 0.30;
  const minimoTotal = minimoUnitario * numHijos;

  // Máximo legal: 50% del ingreso neto del obligado (art. 7 Ley 14.908)
  const maximoTotal = ingresoNeto * 0.50;

  // Rangos orientadores según práctica de tribunales chilenos
  // (sin tabla oficial — los jueces ponderan cada caso)
  const [porcMin, porcMax] = numHijos === 1 ? [0.40, 0.50]
                           : numHijos === 2 ? [0.50, 0.60]
                           : [0.60, 0.70];

  // Monto orientador total respetando mínimo y máximo legales
  const orientMinTotal = Math.max(ingresoNeto * porcMin, minimoTotal);
  const orientMaxTotal = Math.min(ingresoNeto * porcMax, maximoTotal * 1.2); // el cap legal puede superarse con fundamento

  const orientMinHijo = orientMinTotal / numHijos;
  const orientMaxHijo = orientMaxTotal / numHijos;

  // Equivalencia en UTM (para que la pensión se reajuste automáticamente cada mes)
  const utmMinHijo   = minimoUnitario / utmValor;
  const utmOrientHijo = orientMinHijo / utmValor;

  return {
    numHijos, ingresoNeto, tipoObligado, utmValor,
    minimoUnitario, minimoTotal,
    maximoTotal, maximoUnitario: maximoTotal / numHijos,
    orientMinTotal, orientMaxTotal,
    orientMinHijo, orientMaxHijo,
    utmMinHijo, utmOrientHijo,
    porcMin: porcMin * 100, porcMax: porcMax * 100
  };
}

function renderPensionAlimentos(r) {
  if (!r) return '';

  const sinIngreso = r.tipoObligado === 'sin_ingreso';

  const filaMin = r.numHijos > 1
    ? `<div class="fila-resultado"><span>Mínimo por hijo/a (30% IMM)</span><span>$${formatCLP(r.minimoUnitario)}</span></div>`
    : `<div class="fila-resultado"><span>Mínimo legal (40% IMM)</span><span>$${formatCLP(r.minimoUnitario)}</span></div>`;

  return `
    <div class="resultado-tabla">
      ${filaMin}
      <div class="fila-resultado">
        <span>Mínimo legal total (${r.numHijos} hijo${r.numHijos > 1 ? 's' : ''})</span>
        <span><strong>$${formatCLP(r.minimoTotal)}</strong></span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado">
        <span>Rango orientador por hijo/a <span class="tooltip-hint" title="Basado en práctica de tribunales de familia chilenos. No existe tabla oficial obligatoria.">ⓘ</span></span>
        <span>$${formatCLP(r.orientMinHijo)} – $${formatCLP(r.orientMaxHijo)}</span>
      </div>
      <div class="fila-resultado">
        <span>Rango orientador total (${r.porcMin}%–${r.porcMax}% del ingreso)</span>
        <span>$${formatCLP(r.orientMinTotal)} – $${formatCLP(r.orientMaxTotal)}</span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado">
        <span>Máximo legal (50% del ingreso neto)</span>
        <span>$${formatCLP(r.maximoTotal)}</span>
      </div>
      <div class="fila-resultado">
        <span>Equiv. UTM mínimo por hijo/a <span class="tooltip-hint" title="En UTM para que se reajuste automáticamente cada mes según el valor de la UTM.">ⓘ</span></span>
        <span>${formatDecimal(r.utmMinHijo, 2)} UTM</span>
      </div>
    </div>
    ${sinIngreso ? `
    <div class="aviso-legal">
      ⚠️ Sin ingreso declarado, el tribunal presume capacidad y aplica el mínimo legal ($${formatCLP(r.minimoTotal)} total). La carga de probar imposibilidad absoluta recae sobre el obligado.
    </div>` : ''}
    <div class="explicacion">
      Ingreso neto $${formatCLP(r.ingresoNeto)} → mínimo legal $${formatCLP(r.minimoTotal)} | rango orientador $${formatCLP(r.orientMinTotal)}–$${formatCLP(r.orientMaxTotal)}.
      ${r.tipoObligado === 'honorarios' ? '<br>Para obligados a honorarios, los tribunales usan el ingreso bruto declarado.' : ''}
      <br><small>Los valores son referenciales. El tribunal pondera las necesidades del menor, el ingreso de ambos padres y el nivel de vida. Consulta a un abogado de familia para tu caso específico.</small>
    </div>`;
}

// ─────────────────────────────────────────────
// CALCULADORA 7: REAJUSTE DE ARRIENDO POR IPC
// ─────────────────────────────────────────────

function calcularAjusteArriendo({ arriendoActual, variacionIPC }) {
  if (!arriendoActual || arriendoActual <= 0) return null;

  const factor = 1 + variacionIPC / 100;
  const nuevoArriendo = Math.round(arriendoActual * factor);
  const diferenciaMensual = nuevoArriendo - arriendoActual;
  const diferenciaAnual = diferenciaMensual * 12;

  return {
    arriendoActual, variacionIPC, factor,
    nuevoArriendo, diferenciaMensual, diferenciaAnual
  };
}

function renderAjusteArriendo(r) {
  if (!r) return '';

  const esSube = r.diferenciaMensual > 0;
  const esBaja = r.diferenciaMensual < 0;
  const signo = esSube ? '+' : '';

  return `
    <div class="resultado-tabla">
      <div class="fila-resultado">
        <span>Arriendo actual</span>
        <span>$${formatCLP(r.arriendoActual)}</span>
      </div>
      <div class="fila-resultado">
        <span>Variación IPC aplicada</span>
        <span>${formatDecimal(r.variacionIPC, 2)}%</span>
      </div>
      <div class="separador-tabla"></div>
      <div class="fila-resultado fila-liquido">
        <span><strong>Nuevo arriendo mensual</strong></span>
        <span><strong>$${formatCLP(r.nuevoArriendo)}</strong></span>
      </div>
      <div class="fila-resultado ${esSube ? 'fila-descuento' : ''}">
        <span>Diferencia mensual</span>
        <span class="${esSube ? 'negativo' : esBaja ? 'positivo' : ''}">${signo}$${formatCLP(Math.abs(r.diferenciaMensual))}</span>
      </div>
      <div class="fila-resultado">
        <span>Diferencia anual acumulada</span>
        <span class="${esSube ? 'negativo' : ''}">${signo}$${formatCLP(Math.abs(r.diferenciaAnual))}</span>
      </div>
    </div>
    <div class="explicacion">
      Con un IPC de ${formatDecimal(r.variacionIPC, 2)}%, el arriendo pasa de $${formatCLP(r.arriendoActual)} a $${formatCLP(r.nuevoArriendo)}.
      <br><small>⚖️ Requisitos legales (Ley 18.101): el reajuste debe estar estipulado en el contrato, aplicarse con mínimo 30 días de aviso y no puede realizarse antes de que transcurra 1 año desde el inicio del contrato. Sin cláusula de reajuste, el arrendador no puede aumentar el arriendo unilateralmente.</small>
    </div>`;
}

export {
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
};
