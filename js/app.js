/* Controle de Gastos — interface. Dados ficam no localStorage do navegador. */
(() => {
  const C = Calc;
  const KEY = 'controleGastos.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCurto = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
    if (a >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
    return `R$ ${Math.round(n)}`;
  };
  const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ---------- estado ----------
  const FORMAS_PADRAO = [
    { nome: 'Pix', cartao: false }, { nome: 'Débito', cartao: false }, { nome: 'Boleto', cartao: false },
    { nome: 'Dinheiro', cartao: false }, { nome: 'Vale-refeição', cartao: false }, { nome: 'Vale-alimentação', cartao: false },
    { nome: 'Nubank', cartao: true }, { nome: 'Itaú', cartao: true }, { nome: 'C6', cartao: true }, { nome: 'Inter', cartao: true },
  ];

  // Atualizações de dados já salvos (rodam uma vez só por conta de "migracoes")
  function migrar(s) {
    s.migracoes = s.migracoes || {};
    let mudou = false;
    if (!s.migracoes.formas2) {
      for (const p of FORMAS_PADRAO) {
        const f = s.formas.find((x) => x.nome.toLowerCase() === p.nome.toLowerCase());
        if (!f) s.formas.push({ ...p });
        else if (p.cartao) f.cartao = true;
      }
      s.migracoes.formas2 = true;
      mudou = true;
    }
    return mudou;
  }

  const vazio = () => ({
    versao: 1,
    gastos: [], receitas: [], pagamentos: {}, investimentos: [],
    formas: FORMAS_PADRAO.map((f) => ({ ...f })),
    categorias: ['Moradia', 'Saúde', 'Educação', 'Alimentação', 'Transporte', 'Lazer', 'Vestuário', 'Contas', 'Outros'].map((nome) => ({ nome, limite: 0 })),
  });

  let state = carregar();
  let mesAtual = C.todayYm();

  function carregar() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = { ...vazio(), ...JSON.parse(raw) }; migrar(s); return s; }
    } catch (e) { console.warn('Não foi possível ler os dados salvos', e); }
    return vazio();
  }
  function salvar({ nuvem = true } = {}) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Não foi possível salvar no navegador (modo privado?)'); }
    if (nuvem) window.App.aoSalvar?.(state);
    render();
  }

  // ponte para o módulo de nuvem (js/nuvem.js)
  window.App = {
    getState: () => state,
    setState: (s) => { state = { ...vazio(), ...s }; const mudou = migrar(state); salvar({ nuvem: mudou }); },
    normalizar: (s) => { const x = { ...vazio(), ...s }; migrar(x); return x; },
    limpar: () => { state = vazio(); salvar({ nuvem: false }); },
    toast: (m) => toast(m),
  };

  // Dados de exemplo 100% FICTÍCIOS (valores inventados, só para demonstrar o site)
  function demo() {
    const s = vazio();
    const m0 = C.todayYm(), m1 = C.addMonths(m0, 1);
    const d = (ym, dia) => `${ym}-${String(dia).padStart(2, '0')}`;
    s.categorias = [
      { nome: 'Moradia', limite: 1500 }, { nome: 'Alimentação', limite: 900 }, { nome: 'Transporte', limite: 400 },
      { nome: 'Saúde', limite: 300 }, { nome: 'Lazer', limite: 250 }, { nome: 'Contas', limite: 0 },
    ];
    const g = (o) => ({ id: uid(), frequencia: 'mensal', parcelado: false, parcelas: 1, fim: '', obs: '', ...o });
    s.gastos = [
      g({ descricao: 'Aluguel (exemplo)', categoria: 'Moradia', tipo: 'fixo', valor: 1200, inicio: d(m0, 10), forma: 'Boleto' }),
      g({ descricao: 'Internet (exemplo)', categoria: 'Contas', tipo: 'fixo', valor: 100, inicio: d(m0, 15), forma: 'Débito' }),
      g({ descricao: 'Mercado (exemplo)', categoria: 'Alimentação', tipo: 'variavel', valor: 150, frequencia: 'semanal', inicio: d(m0, 3), forma: 'Vale-alimentação' }),
      g({ descricao: 'Academia (exemplo)', categoria: 'Saúde', tipo: 'fixo', valor: 90, inicio: d(m0, 5), forma: 'Pix' }),
      g({ descricao: 'Streaming (exemplo)', categoria: 'Lazer', tipo: 'fixo', valor: 40, inicio: d(m0, 20), forma: 'Nubank' }),
      g({ descricao: 'Seguro do carro (exemplo)', categoria: 'Transporte', tipo: 'fixo', valor: 1200, frequencia: 'anual', inicio: d(m1, 12), forma: 'Boleto' }),
      g({ descricao: 'Celular novo (exemplo)', categoria: 'Contas', tipo: 'variavel', valor: 1800, parcelado: true, parcelas: 10, inicio: d(m1, 8), forma: 'Inter' }),
    ];
    for (const x of s.gastos.slice(0, 2)) s.pagamentos[`${x.id}|${m0}`] = { valor: x.valor, data: d(m0, 10) };
    const r = (o) => ({ id: uid(), frequencia: 'mensal', inicio: d(m0, 1), fim: '', parcelado: false, ...o });
    s.receitas = [
      r({ descricao: 'Salário (exemplo)', tipo: 'receita', valor: 4000 }),
      r({ descricao: 'INSS (exemplo)', tipo: 'desconto', valor: 350 }),
      r({ descricao: 'IRRF (exemplo)', tipo: 'desconto', valor: 150 }),
    ];
    const i = (o) => ({ id: uid(), aporte: 0, taxa: 0.8, meta: 0, ...o });
    s.investimentos = [
      i({ nome: 'Reserva de emergência (exemplo)', saldo: 3000, aporte: 300, meta: 12000 }),
      i({ nome: 'Viagem (exemplo)', saldo: 800, aporte: 150, meta: 5000 }),
    ];
    s.migracoes = { formas2: true };
    return s;
  }

  // ---------- navegação ----------
  let viewAtual = 'painel';
  const sheet = $('#sheetMais');
  function irPara(view) {
    viewAtual = view;
    sheet.hidden = true;
    const noMais = ['receitas', 'investimentos', 'config'].includes(view);
    $$('button[data-view]').forEach((x) => x.classList.toggle('active', x.dataset.view === view || (x.dataset.view === 'mais' && noMais)));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    try { localStorage.setItem(KEY + '.view', view); } catch {}
    scrollTo({ top: 0 });
    render();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) { b.dataset.view === 'mais' ? (sheet.hidden = !sheet.hidden) : irPara(b.dataset.view); return; }
    if (e.target === sheet) sheet.hidden = true;
  });
  $('#fab').onclick = () => editarGasto();
  $('#prevMonth').onclick = () => { mesAtual = C.addMonths(mesAtual, -1); render(); };
  $('#nextMonth').onclick = () => { mesAtual = C.addMonths(mesAtual, 1); render(); };
  $('#todayMonth').onclick = () => { mesAtual = C.todayYm(); render(); };

  // tema
  const aplicarTema = (t) => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  try { aplicarTema(localStorage.getItem(KEY + '.tema')); } catch {}
  $('#themeBtn').onclick = () => {
    const escuro = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const novo = escuro ? 'light' : 'dark';
    aplicarTema(novo);
    try { localStorage.setItem(KEY + '.tema', novo); } catch {}
  };

  // ---------- render ----------
  function render() {
    preencherFiltros();
    ({ painel: renderPainel, gastos: renderGastos, receitas: renderReceitas, cartoes: renderCartoes,
       projecao: renderProjecao, investimentos: renderInvest, config: renderConfig })[viewAtual]();
  }

  // kpi(rótulo, valor, subtítulo, negativo?, { icon, tom: ''|'good'|'warn'|'bad'|'info', hero })
  const kpi = (label, valor, sub = '', neg = false, { icon = '', tom = '', hero = false } = {}) =>
    `<div class="kpi ${hero ? 'hero' : ''}">${icon ? `<div class="ico ${tom}"><svg><use href="#i-${icon}"/></svg></div>` : ''}
      <div class="label">${label}</div><div class="value ${neg ? 'neg' : ''}">${valor}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;

  function renderPainel() {
    $('#monthLabel').textContent = C.nomeMes(mesAtual);
    const r = C.resumoMes(state, mesAtual);
    const comprometido = r.rec.liquido ? Math.round((r.fixo / r.rec.liquido) * 100) : 0;

    if (!state.gastos.length && !state.receitas.length) {
      $('#kpis').innerHTML = '';
      $('#contasMes').innerHTML = `<tr><td class="empty">Nada cadastrado ainda.<br><br>
        <button class="btn primary" onclick="document.querySelector('[data-view=gastos]').click()">Cadastrar primeiro gasto</button>
        <button class="btn" id="demoInline">Ver com dados de exemplo</button></td></tr>`;
      $('#demoInline').onclick = () => { state = demo(); salvar(); };
      $('#catBars').innerHTML = ''; $('#fixoVar').innerHTML = ''; $('#limites').innerHTML = ''; $('#contasResumo').textContent = '';
      return;
    }

    const atrasadas = r.contas.some((c) => c.status === 'atrasado');
    $('#kpis').innerHTML = [
      kpi('Sobra prevista', brl(r.saldo), `${comprometido}% da renda vai para gastos fixos`, r.saldo < 0, { icon: 'piggy', hero: true }),
      kpi('Receita líquida', brl(r.rec.liquido), r.rec.descontos ? `bruto ${brl(r.rec.bruto)}` : '', false, { icon: 'receitas', tom: 'info' }),
      kpi('Despesas do mês', brl(r.despesas), `previsto ${brl(r.previsto)}`, false, { icon: 'down', tom: 'warn' }),
      kpi('Já pago', brl(r.pago), `${r.contas.filter((c) => c.status === 'pago').length} de ${r.contas.length} contas`, false, { icon: 'check', tom: 'good' }),
      kpi('Falta pagar', brl(r.aPagar), atrasadas ? 'há contas atrasadas' : 'tudo em dia', false, { icon: atrasadas ? 'alert' : 'clock', tom: atrasadas ? 'bad' : '' }),
    ].join('');

    $('#contasResumo').textContent = `${r.contas.length} conta(s)`;
    $('#contasMes').innerHTML = r.contas.length ? `
      <thead><tr><th></th><th>Conta</th><th>Venc.</th><th class="num">Previsto</th><th class="num">Pago</th><th>Status</th></tr></thead>
      <tbody>${r.contas.map((c) => `
        <tr data-id="${c.gasto.id}">
          <td><input type="checkbox" class="chkPago" ${c.status === 'pago' ? 'checked' : ''} aria-label="Marcar como pago"></td>
          <td><div class="conta-nome">${esc(c.gasto.descricao)} ${c.parcela ? `<span class="muted" style="font-weight:500">${c.parcela}</span>` : ''}</div>
              <div class="conta-meta">${esc(c.gasto.categoria || '')} · ${esc(c.gasto.forma || '')} <span class="tag ${c.gasto.tipo}">${c.gasto.tipo === 'fixo' ? 'Fixo' : 'Variável'}</span></div></td>
          <td>${dataBr(c.vencimento).slice(0, 5)}</td>
          <td class="num">${brl(c.previsto)}</td>
          <td class="num"><input class="pago" type="number" step="0.01" value="${c.status === 'pago' ? c.pago : ''}" placeholder="—"></td>
          <td>${statusTag(c.status, c)}</td>
        </tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td>Total</td><td></td><td class="num">${brl(r.previsto)}</td><td class="num">${brl(r.pago)}</td><td></td></tr></tfoot>`
      : `<tr><td class="empty">Nenhuma conta neste mês.</td></tr>`;

    $$('#contasMes tbody tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id, k = `${id}|${mesAtual}`;
      const c = r.contas.find((x) => x.gasto.id === id);
      tr.querySelector('.chkPago').onchange = (e) => {
        if (e.target.checked) state.pagamentos[k] = { valor: c.previsto, data: C.todayIso() };
        else delete state.pagamentos[k];
        salvar();
      };
      tr.querySelector('input.pago').onchange = (e) => {
        const v = e.target.value === '' ? null : Number(e.target.value);
        if (v == null) delete state.pagamentos[k];
        else state.pagamentos[k] = { valor: v, data: state.pagamentos[k]?.data || C.todayIso() };
        salvar();
      };
    });

    // por categoria
    const cats = Object.entries(r.porCat).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...cats.map((x) => x[1]));
    $('#catBars').innerHTML = cats.map(([n, v]) => `
      <div class="hbar" data-tip="${esc(n)}|${brl(v)}|${r.despesas ? Math.round((v / r.despesas) * 100) : 0}% das despesas">
        <span class="name">${esc(n)}</span><div class="track"><div class="fill" style="width:${(v / max) * 100}%"></div></div><span class="val">${brl(v)}</span>
      </div>`).join('') || '<p class="muted">Sem despesas.</p>';
    bindTips($('#catBars'));

    const tot = r.fixo + r.variavel;
    $('#fixoVar').innerHTML = tot ? `
      <div class="bar"><div style="flex:${r.fixo || 0.0001}"></div><div style="flex:${r.variavel || 0.0001}"></div></div>
      <div class="lbl"><span><i class="sw" style="background:var(--fixo)"></i> Fixo ${brl(r.fixo)} (${Math.round((r.fixo / tot) * 100)}%)</span>
      <span>Variável ${brl(r.variavel)} (${Math.round((r.variavel / tot) * 100)}%) <i class="sw" style="background:var(--var)"></i></span></div>` : '';

    const lim = state.categorias.filter((c) => c.limite > 0);
    $('#limites').innerHTML = lim.length ? '<h3 style="margin-top:6px">Limites por categoria</h3>' + lim.map((c) => {
      const usado = r.porCat[c.nome] || 0, pct = usado / c.limite;
      const cls = pct > 1 ? 'over' : pct > 0.85 ? 'near' : '';
      return `<div class="limit ${cls}"><div style="display:flex;justify-content:space-between"><span>${esc(c.nome)}</span>
        <span class="num">${brl(usado)} / ${brl(c.limite)} ${pct > 1 ? '· estourou ' + brl(usado - c.limite) : ''}</span></div>
        <div class="track"><div class="fill" style="width:${Math.min(100, pct * 100)}%"></div></div></div>`;
    }).join('') : '';
  }

  function statusTag(s, c) {
    if (s === 'pago') {
      const dif = C.r2(c.pago - c.previsto);
      return `<span class="status pago">✓ Pago</span>${dif ? `<div class="muted" style="font-size:11.5px">${dif > 0 ? '+' : ''}${brl(dif)}</div>` : ''}`;
    }
    return s === 'atrasado' ? '<span class="status atrasado">! Atrasado</span>' : '<span class="status pendente">○ Pendente</span>';
  }

  // ---------- gastos ----------
  function preencherFiltros() {
    const fill = (sel, opts, first) => {
      const v = sel.value;
      sel.innerHTML = `<option value="">${first}</option>` + opts.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('');
      sel.value = v;
    };
    fill($('#fFreq'), [...Object.entries(C.FREQ).map(([k, f]) => [k, f.label]), ['parcelado', 'Parcelado']], 'Toda frequência');
    fill($('#fCat'), state.categorias.map((c) => [c.nome, c.nome]), 'Toda categoria');
  }
  ['#fBusca', '#fTipo', '#fFreq', '#fCat'].forEach((s) => $(s).addEventListener('input', () => renderGastos()));

  function renderGastos() {
    const busca = $('#fBusca').value.toLowerCase(), tipo = $('#fTipo').value, freq = $('#fFreq').value, cat = $('#fCat').value;
    const hoje = C.todayYm();
    const lista = state.gastos.filter((g) =>
      (!busca || `${g.descricao} ${g.categoria} ${g.forma}`.toLowerCase().includes(busca)) &&
      (!tipo || g.tipo === tipo) && (!cat || g.categoria === cat) &&
      (!freq || (freq === 'parcelado' ? g.parcelado : !g.parcelado && g.frequencia === freq)));

    // custo mensal médio equivalente (para comparar frequências diferentes)
    const mensalEquiv = (g) => {
      if (g.parcelado) return C.valorParcela(g);
      const f = { unico: 0, semanal: 52 / 12, mensal: 1, bimestral: 1 / 2, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }[g.frequencia] ?? 1;
      return g.valor * f;
    };
    const ativo = (g) => { const f = C.mesFinal(g); return !f || f >= hoje; };

    $('#tblGastos').innerHTML = lista.length ? `
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Frequência</th><th class="num">Valor</th><th class="num">≈ por mês</th><th>Pagamento</th><th>Início</th><th>Termina</th></tr></thead>
      <tbody>${lista.map((g) => {
        const fim = C.mesFinal(g);
        return `<tr class="click" data-id="${g.id}" style="${ativo(g) ? '' : 'opacity:.55'}">
          <td>${esc(g.descricao)}</td><td>${esc(g.categoria)}</td>
          <td><span class="tag ${g.tipo}">${g.tipo === 'fixo' ? 'Fixo' : 'Variável'}</span></td>
          <td>${g.parcelado ? `${g.parcelas}x de ${brl(C.valorParcela(g))}` : C.FREQ[g.frequencia]?.label}</td>
          <td class="num">${brl(g.valor)}</td>
          <td class="num">${g.frequencia === 'unico' && !g.parcelado ? '—' : brl(mensalEquiv(g))}</td>
          <td>${esc(g.forma)}${C.ehCartao(state, g.forma) ? ' 💳' : ''}</td>
          <td>${dataBr(g.inicio)}</td>
          <td>${fim ? C.nomeMes(fim, true) : '<span class="muted">sem fim</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td colspan="5">Custo mensal recorrente dos itens ativos</td><td class="num">${brl(lista.filter(ativo).reduce((a, g) => a + mensalEquiv(g), 0))}</td><td colspan="3"></td></tr></tfoot>`
      : `<tr><td class="empty">Nenhum gasto ${state.gastos.length ? 'com esses filtros' : 'cadastrado'}.</td></tr>`;
    $$('#tblGastos tr.click').forEach((tr) => (tr.onclick = () => editarGasto(state.gastos.find((g) => g.id === tr.dataset.id))));
  }
  $('#novoGasto').onclick = () => editarGasto();

  // ---------- receitas ----------
  function renderReceitas() {
    const ym = C.todayYm();
    $('#tblReceitas').innerHTML = state.receitas.length ? `
      <thead><tr><th>Descrição</th><th>Tipo</th><th>Frequência</th><th class="num">Valor</th><th>Desde</th><th>Até</th></tr></thead>
      <tbody>${state.receitas.map((r) => `<tr class="click" data-id="${r.id}">
        <td>${esc(r.descricao)}</td><td>${r.tipo === 'desconto' ? '<span class="tag variavel">Desconto</span>' : '<span class="tag fixo">Receita</span>'}</td>
        <td>${C.FREQ[r.frequencia]?.label}</td><td class="num ${r.tipo === 'desconto' ? 'neg' : ''}">${r.tipo === 'desconto' ? '−' : ''}${brl(r.valor)}</td>
        <td>${dataBr(r.inicio)}</td><td>${r.fim ? C.nomeMes(r.fim, true) : '—'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Líquido em ${C.nomeMes(ym)}</td><td class="num">${brl(C.receitasDoMes(state, ym).liquido)}</td><td colspan="2"></td></tr></tfoot>`
      : `<tr><td class="empty">Nenhuma receita cadastrada.</td></tr>`;
    $$('#tblReceitas tr.click').forEach((tr) => (tr.onclick = () => editarReceita(state.receitas.find((r) => r.id === tr.dataset.id))));
  }
  $('#novaReceita').onclick = () => editarReceita();

  // ---------- cartões ----------
  $('#cartaoInicio').value = C.todayYm();
  $('#cartaoInicio').oninput = () => renderCartoes();
  function renderCartoes() {
    const ini = $('#cartaoInicio').value || C.todayYm();
    const { cartoes, linhas } = C.faturas(state, ini, 12);
    $('#tblFaturas').innerHTML = cartoes.length ? `
      <thead><tr><th>Fatura</th>${cartoes.map((c) => `<th class="num">${esc(c)}</th>`).join('')}<th class="num">Total</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr><td>${C.nomeMes(l.ym, true)}</td>${cartoes.map((c) => `<td class="num">${l.porCartao[c] ? brl(l.porCartao[c]) : '<span class="muted">—</span>'}</td>`).join('')}<td class="num"><b>${brl(l.total)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>12 meses</td>${cartoes.map((c) => `<td class="num">${brl(linhas.reduce((a, l) => a + l.porCartao[c], 0))}</td>`).join('')}<td class="num">${brl(linhas.reduce((a, l) => a + l.total, 0))}</td></tr></tfoot>`
      : `<tr><td class="empty">Nenhuma forma de pagamento marcada como cartão de crédito (aba Dados).</td></tr>`;

    const parc = state.gastos.filter((g) => g.parcelado).map((g) => ({ g, rest: C.restanteParcelado(g, ini) })).filter((x) => x.rest.parcelas > 0)
      .sort((a, b) => b.rest.valor - a.rest.valor);
    const totalRest = parc.reduce((a, x) => a + x.rest.valor, 0);
    $('#parceladoResumo').textContent = parc.length ? `ainda faltam ${brl(totalRest)} no total` : '';
    $('#tblParcelados').innerHTML = parc.length ? `
      <thead><tr><th>Compra</th><th>Pagamento</th><th class="num">Parcela</th><th class="num">Faltam</th><th class="num">Valor restante</th><th>Última parcela</th></tr></thead>
      <tbody>${parc.map(({ g, rest }) => `<tr class="click" data-id="${g.id}"><td>${esc(g.descricao)}</td><td>${esc(g.forma)}</td>
        <td class="num">${brl(C.valorParcela(g))}</td><td class="num">${rest.parcelas} de ${g.parcelas}</td><td class="num">${brl(rest.valor)}</td><td>${C.nomeMes(C.mesFinal(g), true)}</td></tr>`).join('')}</tbody>`
      : `<tr><td class="empty">Nenhum parcelamento em andamento.</td></tr>`;
    $$('#tblParcelados tr.click').forEach((tr) => (tr.onclick = () => editarGasto(state.gastos.find((g) => g.id === tr.dataset.id))));
  }

  // ---------- projeção ----------
  $('#projInicio').value = C.todayYm();
  $('#projInicio').oninput = () => renderProjecao();
  $('#projMeses').oninput = () => renderProjecao();
  function renderProjecao() {
    const ini = $('#projInicio').value || C.todayYm(), n = Number($('#projMeses').value);
    const L = C.projecao(state, ini, n);
    const soma = (k) => L.reduce((a, l) => a + l[k], 0);
    const rec = L.reduce((a, l) => a + l.rec.liquido, 0), desp = soma('despesas');
    const negativos = L.filter((l) => l.saldo < 0);
    const fim = L[L.length - 1];
    $('#projKpis').innerHTML = [
      kpi('Sobra acumulada', brl(fim.acumulado), `ao fim de ${C.nomeMes(fim.ym, true)}`, fim.acumulado < 0, { icon: 'piggy', hero: true }),
      kpi(`Receita em ${n} meses`, brl(rec), `média ${brl(rec / n)}/mês`, false, { icon: 'receitas', tom: 'info' }),
      kpi(`Despesas em ${n} meses`, brl(desp), `média ${brl(desp / n)}/mês`, false, { icon: 'down', tom: 'warn' }),
      kpi('Meses no vermelho', String(negativos.length), negativos.length ? negativos.map((l) => C.nomeMes(l.ym, true)).slice(0, 3).join(', ') : 'nenhum, ótimo!', negativos.length > 0,
        { icon: negativos.length ? 'alert' : 'check', tom: negativos.length ? 'bad' : 'good' }),
    ].join('');
    chartProjecao(L);
    $('#tblProj').innerHTML = `
      <thead><tr><th>Mês</th><th class="num">Receita líq.</th><th class="num">Fixos</th><th class="num">Variáveis</th><th class="num">(no cartão)</th><th class="num">Total despesas</th><th class="num">Sobra do mês</th><th class="num">Acumulado</th></tr></thead>
      <tbody>${L.map((l) => `<tr><td>${C.nomeMes(l.ym, true)}</td><td class="num">${brl(l.rec.liquido)}</td><td class="num">${brl(l.fixo)}</td><td class="num">${brl(l.variavel)}</td>
        <td class="num muted">${brl(l.cartao)}</td><td class="num">${brl(l.despesas)}</td><td class="num ${l.saldo < 0 ? 'neg' : ''}">${brl(l.saldo)}</td><td class="num ${l.acumulado < 0 ? 'neg' : ''}">${brl(l.acumulado)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${brl(rec)}</td><td class="num">${brl(soma('fixo'))}</td><td class="num">${brl(soma('variavel'))}</td><td class="num">${brl(soma('cartao'))}</td><td class="num">${brl(desp)}</td><td class="num">${brl(rec - desp)}</td><td></td></tr></tfoot>`;
  }

  // ---------- gráficos SVG (sem bibliotecas) ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function escala(vals) {
    let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    if (hi === lo) hi = lo + 1;
    const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const ticks = []; for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
    return { lo, hi, ticks };
  }

  function chartProjecao(L) {
    const el = $('#projChart');
    const W = Math.max(320, el.clientWidth || 800), H = 300, m = { t: 12, r: 12, b: 28, l: 64 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { lo, hi, ticks } = escala(L.flatMap((l) => [l.rec.liquido, l.despesas, l.acumulado]));
    const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const bw = iw / L.length, barW = Math.max(3, Math.min(18, (bw - 10) / 2));
    const x0 = (i) => m.l + i * bw + bw / 2;
    const every = Math.ceil(L.length / Math.floor(iw / 56));
    const bar = (cx, v, cor) => {
      const top = y(Math.max(v, 0)), bot = y(Math.min(v, 0)), h = Math.max(0, bot - top);
      if (!h) return '';
      const r = Math.min(4, h, barW / 2);
      return `<path fill="${cor}" d="M${cx},${bot} V${top + r} q0,-${r} ${r},-${r} H${cx + barW - r} q${r},0 ${r},${r} V${bot} Z"/>`;
    };
    const pts = L.map((l, i) => `${x0(i)},${y(l.acumulado)}`).join(' ');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas, despesas e saldo acumulado por mês">
      ${ticks.map((t) => `<line class="${t === 0 ? 'zero' : 'gridline'}" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${brlCurto(t)}</text>`).join('')}
      <g class="hls"></g>
      ${L.map((l, i) => bar(x0(i) - barW - 1, l.rec.liquido, css('--rec')) + bar(x0(i) + 1, l.despesas, css('--desp'))).join('')}
      <polyline points="${pts}" fill="none" stroke="${css('--saldo')}" stroke-width="2" stroke-linejoin="round"/>
      ${L.map((l, i) => `<circle cx="${x0(i)}" cy="${y(l.acumulado)}" r="4" fill="${css('--saldo')}" stroke="${css('--surface')}" stroke-width="2"/>`).join('')}
      ${L.map((l, i) => (i % every === 0 ? `<text x="${x0(i)}" y="${H - 8}" text-anchor="middle">${C.nomeMes(l.ym, true)}</text>` : '')).join('')}
      ${L.map((l, i) => `<rect class="hit" data-i="${i}" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${ih}"/>`).join('')}
    </svg>`;
    const hls = el.querySelector('.hls');
    el.querySelectorAll('.hit').forEach((r) => {
      const l = L[r.dataset.i];
      r.addEventListener('mousemove', (e) => {
        hls.innerHTML = `<rect class="hl" x="${r.getAttribute('x')}" y="${m.t}" width="${bw}" height="${ih}"/>`;
        showTip(e, `<b>${C.nomeMes(l.ym)}</b>
          <div class="r"><span><i class="sw s-rec"></i>Receita líquida</span><span>${brl(l.rec.liquido)}</span></div>
          <div class="r"><span><i class="sw s-desp"></i>Despesas</span><span>${brl(l.despesas)}</span></div>
          <div class="r"><span>Sobra do mês</span><span>${brl(l.saldo)}</span></div>
          <div class="r"><span><i class="sw s-saldo line"></i>Acumulado</span><span>${brl(l.acumulado)}</span></div>`);
      });
      r.addEventListener('mouseleave', () => { hls.innerHTML = ''; hideTip(); });
    });
  }

  function chartInvest(serie, ini) {
    const el = $('#invChart');
    const W = Math.max(320, el.clientWidth || 800), H = 260, m = { t: 12, r: 12, b: 28, l: 64 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { lo, hi, ticks } = escala(serie);
    const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
    const x = (i) => m.l + (i / Math.max(1, serie.length - 1)) * iw;
    const pts = serie.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const every = Math.ceil(serie.length / Math.floor(iw / 64));
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção do patrimônio investido">
      ${ticks.map((t) => `<line class="gridline" x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${brlCurto(t)}</text>`).join('')}
      <polygon points="${m.l},${y(lo)} ${pts} ${x(serie.length - 1)},${y(lo)}" fill="${css('--rec')}" opacity=".12"/>
      <polyline points="${pts}" fill="none" stroke="${css('--rec')}" stroke-width="2"/>
      ${serie.map((v, i) => (i % every === 0 ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${C.nomeMes(C.addMonths(ini, i), true)}</text>` : '')).join('')}
      <line class="cross" y1="${m.t}" y2="${m.t + ih}" stroke="${css('--text-2')}" stroke-width="1" opacity="0"/>
      <circle class="dot" r="5" fill="${css('--rec')}" stroke="${css('--surface')}" stroke-width="2" opacity="0"/>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/>
    </svg>`;
    const svg = el.querySelector('svg'), cross = el.querySelector('.cross'), dot = el.querySelector('.dot');
    el.querySelector('.hit').addEventListener('mousemove', (e) => {
      const b = svg.getBoundingClientRect();
      const px = ((e.clientX - b.left) / b.width) * W;
      const i = Math.max(0, Math.min(serie.length - 1, Math.round(((px - m.l) / iw) * (serie.length - 1))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', '.4');
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(serie[i])); dot.setAttribute('opacity', '1');
      showTip(e, `<b>${C.nomeMes(C.addMonths(ini, i))}</b><div class="r"><span>Patrimônio</span><span>${brl(serie[i])}</span></div>
        <div class="r"><span>Ganho vs. hoje</span><span>${brl(serie[i] - serie[0])}</span></div>`);
    });
    el.querySelector('.hit').addEventListener('mouseleave', () => { cross.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); hideTip(); });
  }

  // tooltip
  const tip = $('#tooltip');
  function showTip(e, html) {
    tip.innerHTML = html; tip.classList.add('show');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = e.clientX + 14, top = e.clientY + 14;
    if (left + w > innerWidth - 8) left = e.clientX - w - 14;
    if (top + h > innerHeight - 8) top = e.clientY - h - 14;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  const hideTip = () => tip.classList.remove('show');
  function bindTips(root) {
    root.querySelectorAll('[data-tip]').forEach((el) => {
      const [t, v, s] = el.dataset.tip.split('|');
      el.onmousemove = (e) => showTip(e, `<b>${t}</b><div class="r"><span>${v}</span><span>${s}</span></div>`);
      el.onmouseleave = hideTip;
    });
  }
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => (viewAtual === 'projecao' || viewAtual === 'investimentos') && render(), 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---------- investimentos ----------
  $('#invMeses').oninput = () => renderInvest();
  function renderInvest() {
    const inv = state.investimentos;
    const total = inv.reduce((a, i) => a + (Number(i.saldo) || 0), 0);
    const aporte = inv.reduce((a, i) => a + (Number(i.aporte) || 0), 0);
    const n = Number($('#invMeses').value);
    const serie = C.projecaoInvest(inv, n);
    const despMedia = C.projecao(state, C.todayYm(), 12).reduce((a, l) => a + l.despesas, 0) / 12;
    $('#invKpis').innerHTML = [
      kpi('Patrimônio hoje', brl(total), `${inv.length} aplicação(ões)`, false, { icon: 'invest', hero: true }),
      kpi('Aportes por mês', brl(aporte), '', false, { icon: 'plus', tom: 'info' }),
      kpi(`Em ${n} meses`, brl(serie[n]), `+${brl(serie[n] - total)}`, false, { icon: 'projecao', tom: 'good' }),
      kpi('Reserva cobre', despMedia ? `${(total / despMedia).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses` : '—', 'das despesas médias', false, { icon: 'shield' }),
    ].join('');
    $('#tblInvest').innerHTML = inv.length ? `
      <thead><tr><th>Nome</th><th class="num">Saldo</th><th class="num">Aporte/mês</th><th class="num">Rend. % a.m.</th><th class="num">Em ${n} meses</th><th>Meta</th></tr></thead>
      <tbody>${inv.map((i) => {
        const fut = C.projecaoInvest([i], n)[n], t = C.mesesAteMeta(i);
        const meta = Number(i.meta) ? `${brl(i.meta)} · ${t === 0 ? 'atingida ✓' : t ? 'em ' + C.nomeMes(C.addMonths(C.todayYm(), t), true) : 'não atinge'}` : '<span class="muted">—</span>';
        return `<tr class="click" data-id="${i.id}"><td>${esc(i.nome)}</td><td class="num">${brl(i.saldo)}</td><td class="num">${brl(i.aporte)}</td>
          <td class="num">${(Number(i.taxa) || 0).toLocaleString('pt-BR')}%</td><td class="num">${brl(fut)}</td><td>${meta}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="num">${brl(total)}</td><td class="num">${brl(aporte)}</td><td></td><td class="num">${brl(serie[n])}</td><td></td></tr></tfoot>`
      : `<tr><td class="empty">Nenhum investimento cadastrado.</td></tr>`;
    $$('#tblInvest tr.click').forEach((tr) => (tr.onclick = () => editarInvest(inv.find((i) => i.id === tr.dataset.id))));
    chartInvest(serie, C.todayYm());
  }
  $('#novoInvest').onclick = () => editarInvest();

  // ---------- dados / config ----------
  function renderConfig() {
    $('#listaFormas').innerHTML = state.formas.map((f, i) => `<li>${esc(f.nome)}${f.cartao ? ' 💳' : ''}<button data-i="${i}" title="Remover">×</button></li>`).join('');
    $$('#listaFormas button').forEach((b) => (b.onclick = () => { state.formas.splice(b.dataset.i, 1); salvar(); }));
    $('#tblCats').innerHTML = `<thead><tr><th>Categoria</th><th class="num">Limite mensal</th><th></th></tr></thead><tbody>${state.categorias.map((c, i) => `
      <tr><td>${esc(c.nome)}</td><td class="num"><input class="pago" type="number" min="0" step="0.01" data-i="${i}" value="${c.limite || ''}" placeholder="—"></td>
      <td><button class="btn ghost small" data-del="${i}" title="Remover">×</button></td></tr>`).join('')}</tbody>`;
    $$('#tblCats input').forEach((inp) => (inp.onchange = () => { state.categorias[inp.dataset.i].limite = Number(inp.value) || 0; salvar(); }));
    $$('#tblCats [data-del]').forEach((b) => (b.onclick = () => { state.categorias.splice(b.dataset.del, 1); salvar(); }));
  }
  $('#formForma').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target, nome = f.nome.value.trim();
    if (nome && !state.formas.some((x) => x.nome === nome)) state.formas.push({ nome, cartao: f.cartao.checked });
    f.reset(); salvar();
  };
  $('#formCat').onsubmit = (e) => {
    e.preventDefault();
    const f = e.target, nome = f.nome.value.trim();
    if (nome && !state.categorias.some((x) => x.nome === nome)) state.categorias.push({ nome, limite: Number(f.limite.value) || 0 });
    f.reset(); salvar();
  };

  const baixar = (nome, conteudo, tipo) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#exportJson').onclick = () => baixar(`controle-gastos-${C.todayIso()}.json`, JSON.stringify(state, null, 2), 'application/json');
  $('#exportCsv').onclick = () => {
    const linhas = [['Descrição', 'Categoria', 'Tipo', 'Frequência', 'Valor', 'Parcelas', 'Forma', 'Início', 'Fim']];
    for (const g of state.gastos) linhas.push([g.descricao, g.categoria, g.tipo, g.parcelado ? 'parcelado' : g.frequencia, String(g.valor).replace('.', ','), g.parcelado ? g.parcelas : '', g.forma, g.inicio, C.mesFinal(g) || '']);
    baixar('gastos.csv', '﻿' + linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
  $('#importJson').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.gastos)) throw new Error('formato inválido');
      if (!confirm('Substituir os dados atuais pelos do arquivo?')) return;
      state = { ...vazio(), ...d }; migrar(state); salvar(); toast('Backup importado');
    } catch (err) { alert('Arquivo inválido: ' + err.message); }
    e.target.value = '';
  };
  $('#loadDemo').onclick = () => { if (!state.gastos.length || confirm('Substituir seus dados pelos dados de exemplo?')) { state = demo(); salvar(); toast('Exemplo carregado'); } };
  $('#clearAll').onclick = () => { if (confirm('Apagar TODOS os dados deste navegador? Faça um backup antes.')) { state = vazio(); salvar(); toast('Dados apagados'); } };

  // ---------- modal genérico ----------
  const dlg = $('#modal');
  $('#modalCancel').onclick = () => dlg.close();
  function abrirModal({ titulo, campos, valores = {}, onSave, onDelete, calc }) {
    $('#modalTitle').textContent = titulo;
    $('#modalBody').innerHTML = campos.map((c) => {
      const v = valores[c.name] ?? c.default ?? '';
      const cls = c.full ? 'full' : '';
      if (c.type === 'select') {
        const opt = ([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
        const html = c.options.map((o) => (Array.isArray(o) ? opt(o) : o.options.length ? `<optgroup label="${esc(o.group)}">${o.options.map(opt).join('')}</optgroup>` : '')).join('');
        return `<label class="${cls}" data-f="${c.name}">${c.label}<select name="${c.name}">${html}</select></label>`;
      }
      if (c.type === 'checkbox') return `<label class="check ${cls}" data-f="${c.name}"><input type="checkbox" name="${c.name}" ${v ? 'checked' : ''}> ${c.label}</label>`;
      return `<label class="${cls}" data-f="${c.name}">${c.label}<input name="${c.name}" type="${c.type || 'text'}" ${c.step ? `step="${c.step}"` : ''} ${c.min != null ? `min="${c.min}"` : ''} ${c.required ? 'required' : ''} ${c.list ? `list="dl-${c.name}"` : ''} value="${esc(v)}" placeholder="${esc(c.placeholder || '')}">
        ${c.list ? `<datalist id="dl-${c.name}">${c.list.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</label>`;
    }).join('') + (calc ? '<div class="calc" id="calcBox"></div>' : '');
    const form = $('#modalForm');
    const ler = () => Object.fromEntries(campos.map((c) => {
      const el = form.elements[c.name];
      return [c.name, c.type === 'checkbox' ? el.checked : c.type === 'number' ? Number(el.value) || 0 : el.value.trim()];
    }));
    const atualizar = () => { if (calc) { const r = calc(ler(), form); $('#calcBox').innerHTML = r; } };
    form.oninput = atualizar; atualizar();
    $('#modalDelete').style.display = onDelete ? '' : 'none';
    $('#modalDelete').onclick = () => { if (confirm('Excluir este item?')) { onDelete(); dlg.close(); salvar(); } };
    form.onsubmit = (e) => { e.preventDefault(); onSave(ler()); dlg.close(); salvar(); };
    dlg.showModal();
    form.querySelector('input,select')?.focus();
  }

  const freqOpts = Object.entries(C.FREQ).map(([k, f]) => [k, f.label]);

  function editarGasto(g) {
    const novo = !g;
    abrirModal({
      titulo: novo ? 'Novo gasto' : 'Editar gasto',
      valores: g || { inicio: C.todayIso(), tipo: 'fixo', frequencia: 'mensal', parcelas: 2, forma: state.formas[0]?.nome },
      campos: [
        { name: 'descricao', label: 'Descrição', required: true, full: true, placeholder: 'Ex.: Aluguel' },
        { name: 'categoria', label: 'Categoria', list: state.categorias.map((c) => c.nome) },
        { name: 'tipo', label: 'Tipo', type: 'select', options: [['fixo', 'Fixo (mesmo valor sempre)'], ['variavel', 'Variável (valor muda)']] },
        { name: 'valor', label: 'Valor (R$)', type: 'number', step: '0.01', min: 0, required: true },
        { name: 'modoValor', label: 'Esse valor é', type: 'select', default: 'total', options: [['total', 'o total da compra'], ['parcela', 'o valor de cada parcela']] },
        { name: 'forma', label: 'Forma de pagamento', type: 'select', options: [
          { group: 'À vista / vales', options: state.formas.filter((f) => !f.cartao).map((f) => [f.nome, f.nome]) },
          { group: 'Cartões de crédito', options: state.formas.filter((f) => f.cartao).map((f) => [f.nome, `💳 ${f.nome}`]) },
        ] },
        { name: 'parcelado', label: 'É parcelado', type: 'checkbox', full: true },
        { name: 'parcelas', label: 'Nº de parcelas', type: 'number', min: 1, step: '1' },
        { name: 'frequencia', label: 'Frequência', type: 'select', options: freqOpts },
        { name: 'inicio', label: 'Data / 1º vencimento', type: 'date', required: true },
        { name: 'fim', label: 'Termina em (opcional)', type: 'month' },
        { name: 'obs', label: 'Observação', full: true },
      ],
      calc: (v, form) => {
        form.querySelector('[data-f=parcelas]').style.display = v.parcelado ? '' : 'none';
        form.querySelector('[data-f=frequencia]').style.display = v.parcelado ? 'none' : '';
        form.querySelector('[data-f=fim]').style.display = v.parcelado || v.frequencia === 'unico' ? 'none' : '';
        form.querySelector('[data-f=modoValor]').style.display = v.parcelado ? '' : 'none';
        if (!v.inicio || !v.valor) return 'Preencha valor e data para ver o cálculo.';
        const item = { ...v, parcelas: Math.max(1, v.parcelas || 1) };
        if (item.parcelado && item.modoValor === 'parcela') item.valor = C.r2(item.valor * item.parcelas);
        if (item.parcelado) return `<b>${item.parcelas}x de ${brl(C.valorParcela(item))}</b> = ${brl(item.valor)} · última parcela em ${C.nomeMes(C.mesFinal(item))}`;
        const anual = Array.from({ length: 12 }, (_, i) => C.valorNoMes(item, C.addMonths(v.inicio.slice(0, 7), i))).reduce((a, b) => a + b, 0);
        return item.frequencia === 'unico' ? `Pagamento único em ${C.nomeMes(v.inicio.slice(0, 7))}` : `Custa <b>${brl(anual)}</b> nos próximos 12 meses (≈ ${brl(anual / 12)}/mês)`;
      },
      onSave: (v) => {
        if (v.categoria && !state.categorias.some((c) => c.nome === v.categoria)) state.categorias.push({ nome: v.categoria, limite: 0 });
        v.parcelas = v.parcelado ? Math.max(1, v.parcelas) : 1;
        if (v.parcelado && v.modoValor === 'parcela') v.valor = C.r2(v.valor * v.parcelas);
        delete v.modoValor; // sempre guardamos o total
        if (novo) state.gastos.push({ id: uid(), ...v }); else Object.assign(g, v);
      },
      onDelete: novo ? null : () => {
        state.gastos = state.gastos.filter((x) => x !== g);
        for (const k of Object.keys(state.pagamentos)) if (k.startsWith(g.id + '|')) delete state.pagamentos[k];
      },
    });
  }

  function editarReceita(r) {
    const novo = !r;
    abrirModal({
      titulo: novo ? 'Nova receita / desconto' : 'Editar',
      valores: r || { tipo: 'receita', frequencia: 'mensal', inicio: C.todayIso() },
      campos: [
        { name: 'descricao', label: 'Descrição', required: true, full: true, placeholder: 'Ex.: Salário, IRRF, Freela' },
        { name: 'tipo', label: 'Tipo', type: 'select', options: [['receita', 'Receita (entra)'], ['desconto', 'Desconto (sai do bruto)']] },
        { name: 'valor', label: 'Valor (R$)', type: 'number', step: '0.01', min: 0, required: true },
        { name: 'frequencia', label: 'Frequência', type: 'select', options: freqOpts },
        { name: 'inicio', label: 'A partir de', type: 'date', required: true },
        { name: 'fim', label: 'Até (opcional)', type: 'month' },
      ],
      onSave: (v) => { if (novo) state.receitas.push({ id: uid(), parcelado: false, ...v }); else Object.assign(r, v); },
      onDelete: novo ? null : () => { state.receitas = state.receitas.filter((x) => x !== r); },
    });
  }

  function editarInvest(i) {
    const novo = !i;
    abrirModal({
      titulo: novo ? 'Novo investimento' : 'Editar investimento',
      valores: i || { taxa: 0.8 },
      campos: [
        { name: 'nome', label: 'Nome', required: true, full: true, placeholder: 'Ex.: Reserva de emergência' },
        { name: 'saldo', label: 'Saldo atual (R$)', type: 'number', step: '0.01' },
        { name: 'aporte', label: 'Aporte mensal (R$)', type: 'number', step: '0.01', min: 0 },
        { name: 'taxa', label: 'Rendimento (% ao mês)', type: 'number', step: '0.01' },
        { name: 'meta', label: 'Meta (R$, opcional)', type: 'number', step: '0.01', min: 0 },
      ],
      calc: (v) => {
        const t = C.mesesAteMeta(v);
        const em12 = C.projecaoInvest([v], 12)[12];
        return `Em 12 meses: <b>${brl(em12)}</b>${v.meta ? ` · meta ${t === 0 ? 'já atingida' : t ? `em ${t} meses (${C.nomeMes(C.addMonths(C.todayYm(), t), true)})` : 'não é atingida em 50 anos'}` : ''}`;
      },
      onSave: (v) => { if (novo) state.investimentos.push({ id: uid(), ...v }); else Object.assign(i, v); },
      onDelete: novo ? null : () => { state.investimentos = state.investimentos.filter((x) => x !== i); },
    });
  }

  let tt;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200); }

  // início
  try {
    const v = localStorage.getItem(KEY + '.view');
    if (v && $(`#view-${v}`)) irPara(v);
    else render();
  } catch { render(); }
})();
