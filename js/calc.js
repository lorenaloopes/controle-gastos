/* Regras de cálculo — funções puras, sem DOM. */
const Calc = (() => {
  const FREQ = {
    unico:      { label: 'Única vez',  passo: 0 },
    semanal:    { label: 'Semanal',    passo: null },
    mensal:     { label: 'Mensal',     passo: 1 },
    bimestral:  { label: 'Bimestral',  passo: 2 },
    trimestral: { label: 'Trimestral', passo: 3 },
    semestral:  { label: 'Semestral',  passo: 6 },
    anual:      { label: 'Anual',      passo: 12 },
  };

  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  // "2027-03" <-> índice de mês absoluto
  const ymToIdx = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + (m - 1); };
  const idxToYm = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  const dateToIdx = (d) => ymToIdx(d.slice(0, 7));
  const addMonths = (ym, n) => idxToYm(ymToIdx(ym) + n);
  const todayYm = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const todayIso = () => { const d = new Date(); return `${todayYm()}-${String(d.getDate()).padStart(2, '0')}`; };

  const nomeMes = (ym, curto = false) => {
    const [y, m] = ym.split('-').map(Number);
    const s = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: curto ? 'short' : 'long', year: 'numeric' });
    return curto ? s.replace('.', '').replace(' de ', '/') : s.replace(' de ', ' de ');
  };

  // Quantas vezes um item recorrente acontece no mês (0, 1 ou 4/5 para semanal)
  function vezesNoMes(item, ym) {
    if (!item.inicio) return 0;
    const m = ymToIdx(ym), s = dateToIdx(item.inicio);
    if (m < s) return 0;
    if (item.fim && m > ymToIdx(item.fim)) return 0;

    if (item.parcelado) {
      const n = Math.max(1, Number(item.parcelas) || 1);
      return m < s + n ? 1 : 0;
    }
    const f = item.frequencia || 'mensal';
    if (f === 'unico') return m === s ? 1 : 0;
    if (f === 'semanal') {
      const [y, mo] = ym.split('-').map(Number);
      const ini = new Date(item.inicio + 'T00:00:00');
      const diaSemana = ini.getDay();
      const ultimoDia = new Date(y, mo, 0).getDate();
      let c = 0;
      for (let d = 1; d <= ultimoDia; d++) {
        const dt = new Date(y, mo - 1, d);
        if (dt.getDay() === diaSemana && dt >= ini) c++;
      }
      return c;
    }
    const passo = FREQ[f]?.passo || 1;
    return (m - s) % passo === 0 ? 1 : 0;
  }

  // Valor de uma parcela; a última absorve o arredondamento
  function valorParcela(item, ym) {
    const n = Math.max(1, Number(item.parcelas) || 1);
    const p = r2(item.valor / n);
    if (ym && ymToIdx(ym) === dateToIdx(item.inicio) + n - 1) return r2(item.valor - p * (n - 1));
    return p;
  }

  function valorNoMes(item, ym) {
    const v = vezesNoMes(item, ym);
    if (!v) return 0;
    if (item.parcelado) return valorParcela(item, ym);
    return r2(v * (Number(item.valor) || 0));
  }

  function numeroParcela(item, ym) {
    return ymToIdx(ym) - dateToIdx(item.inicio) + 1;
  }

  function vencimentoNoMes(item, ym) {
    const dia = Number(item.inicio.slice(8, 10)) || 1;
    const [y, m] = ym.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    return `${ym}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
  }

  // Fim de um gasto parcelado (YYYY-MM)
  function mesFinal(item) {
    if (item.parcelado) return addMonths(item.inicio.slice(0, 7), Math.max(1, item.parcelas) - 1);
    if (item.frequencia === 'unico') return item.inicio.slice(0, 7);
    return item.fim || null;
  }

  // Saldo devedor de um parcelado a partir de um mês (inclusive)
  function restanteParcelado(item, aPartirDe) {
    if (!item.parcelado) return { parcelas: 0, valor: 0 };
    const s = dateToIdx(item.inicio), n = Math.max(1, item.parcelas);
    const de = Math.max(ymToIdx(aPartirDe), s);
    let valor = 0, parcelas = 0;
    for (let i = de; i < s + n; i++) { valor += valorParcela(item, idxToYm(i)); parcelas++; }
    return { parcelas, valor: r2(valor) };
  }

  const ehCartao = (state, forma) => !!state.formas.find((f) => f.nome === forma && f.cartao);

  // Todas as contas (ocorrências) de um mês, com status de pagamento
  function contasDoMes(state, ym) {
    const hoje = todayIso();
    const out = [];
    for (const g of state.gastos) {
      const previsto = valorNoMes(g, ym);
      if (!previsto) continue;
      const pg = state.pagamentos[`${g.id}|${ym}`];
      const venc = vencimentoNoMes(g, ym);
      out.push({
        gasto: g,
        previsto,
        pago: pg ? r2(pg.valor) : 0,
        dataPagamento: pg?.data || '',
        status: pg ? 'pago' : venc < hoje ? 'atrasado' : 'pendente',
        vencimento: venc,
        parcela: g.parcelado ? `${numeroParcela(g, ym)}/${g.parcelas}` : '',
        cartao: ehCartao(state, g.forma),
      });
    }
    return out.sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.gasto.descricao.localeCompare(b.gasto.descricao));
  }

  function receitasDoMes(state, ym) {
    let bruto = 0, descontos = 0;
    for (const r of state.receitas) {
      const v = valorNoMes(r, ym);
      if (r.tipo === 'desconto') descontos += v; else bruto += v;
    }
    return { bruto: r2(bruto), descontos: r2(descontos), liquido: r2(bruto - descontos) };
  }

  // Resumo de um mês: usa o valor pago quando houver, senão o previsto
  function resumoMes(state, ym) {
    const contas = contasDoMes(state, ym);
    const rec = receitasDoMes(state, ym);
    let previsto = 0, pago = 0, aPagar = 0, efetivo = 0, fixo = 0, variavel = 0, cartao = 0;
    const porCat = {};
    for (const c of contas) {
      const real = c.status === 'pago' ? c.pago : c.previsto;
      previsto += c.previsto;
      efetivo += real;
      if (c.status === 'pago') pago += c.pago; else aPagar += c.previsto;
      if (c.gasto.tipo === 'fixo') fixo += real; else variavel += real;
      if (c.cartao) cartao += real;
      const cat = c.gasto.categoria || 'Sem categoria';
      porCat[cat] = (porCat[cat] || 0) + real;
    }
    return {
      ym, contas, rec,
      previsto: r2(previsto), pago: r2(pago), aPagar: r2(aPagar), despesas: r2(efetivo),
      fixo: r2(fixo), variavel: r2(variavel), cartao: r2(cartao),
      saldo: r2(rec.liquido - efetivo),
      porCat,
    };
  }

  function projecao(state, inicio, meses) {
    let acumulado = 0;
    const linhas = [];
    for (let i = 0; i < meses; i++) {
      const ym = addMonths(inicio, i);
      const r = resumoMes(state, ym);
      acumulado = r2(acumulado + r.saldo);
      linhas.push({ ...r, acumulado });
    }
    return linhas;
  }

  function faturas(state, inicio, meses) {
    const cartoes = state.formas.filter((f) => f.cartao).map((f) => f.nome);
    const linhas = [];
    for (let i = 0; i < meses; i++) {
      const ym = addMonths(inicio, i);
      const porCartao = Object.fromEntries(cartoes.map((c) => [c, 0]));
      for (const g of state.gastos) {
        if (!cartoes.includes(g.forma)) continue;
        porCartao[g.forma] = r2(porCartao[g.forma] + valorNoMes(g, ym));
      }
      linhas.push({ ym, porCartao, total: r2(Object.values(porCartao).reduce((a, b) => a + b, 0)) });
    }
    return { cartoes, linhas };
  }

  // Patrimônio: saldo * (1 + taxa) + aporte, mês a mês
  function projecaoInvest(invs, meses) {
    const serie = [];
    let saldos = invs.map((i) => Number(i.saldo) || 0);
    serie.push(r2(saldos.reduce((a, b) => a + b, 0)));
    for (let t = 1; t <= meses; t++) {
      saldos = saldos.map((s, k) => s * (1 + (Number(invs[k].taxa) || 0) / 100) + (Number(invs[k].aporte) || 0));
      serie.push(r2(saldos.reduce((a, b) => a + b, 0)));
    }
    return serie;
  }

  function mesesAteMeta(inv) {
    const meta = Number(inv.meta) || 0, taxa = (Number(inv.taxa) || 0) / 100, ap = Number(inv.aporte) || 0;
    let s = Number(inv.saldo) || 0;
    if (!meta || s >= meta) return s >= meta && meta ? 0 : null;
    for (let t = 1; t <= 600; t++) { s = s * (1 + taxa) + ap; if (s >= meta) return t; }
    return null;
  }

  return {
    FREQ, r2, ymToIdx, idxToYm, addMonths, todayYm, todayIso, nomeMes,
    vezesNoMes, valorNoMes, valorParcela, mesFinal, restanteParcelado,
    contasDoMes, receitasDoMes, resumoMes, projecao, faturas, projecaoInvest, mesesAteMeta, ehCartao,
  };
})();

if (typeof module !== 'undefined') module.exports = Calc;
