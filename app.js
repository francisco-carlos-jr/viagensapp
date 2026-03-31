/**
 * Calendário de Viagens - Escala 12×36
 * Persistência: localStorage + data.json como seed
 */

(function () {
  'use strict';

  // ===== CONSTANTES =====
  const MOTORISTAS = ['CHICO', 'CLAUDINEI', 'NILTON', 'PABLO'];
  const DATA_INICIO = new Date(2026, 3, 1); // 1 de Abril de 2026
  const STORAGE_KEY = 'viagensApp_dados';
  const NOMES_MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const ANO_MIN = 2026;
  const ANO_MAX = 2035;

  // ===== ESTADO =====
  let mesAtual = new Date().getMonth();
  let anoAtual = new Date().getFullYear();
  let dados = {}; // { "2026-04-01": "CHICO", "2026-04-03": "NILTON", ... }

  // ===== ELEMENTOS DOM =====
  const telaSelecao = document.getElementById('tela-selecao');
  const telaCalendario = document.getElementById('tela-calendario');
  const selectMes = document.getElementById('select-mes');
  const selectAno = document.getElementById('select-ano');
  const btnAbrir = document.getElementById('btn-abrir-calendario');
  const btnVoltar = document.getElementById('btn-voltar');
  const btnAnterior = document.getElementById('btn-mes-anterior');
  const btnProximo = document.getElementById('btn-mes-proximo');
  const tituloMesAno = document.getElementById('titulo-mes-ano');
  const calendarioDias = document.getElementById('calendario-dias');
  const cardsMotoristas = document.getElementById('cards-motoristas');
  const tbodyResumo = document.getElementById('tbody-resumo-anual');
  const tfootResumo = document.getElementById('tfoot-resumo-anual');
  const resumoAnoLabel = document.getElementById('resumo-ano-label');

  // ===== INICIALIZAÇÃO =====
  function init() {
    carregarDados();
    preencherSelectAno();
    setSelectMesAnoAtual();
    bindEventos();
    atualizarResumoAnual();
  }

  function carregarDados() {
    const salvo = localStorage.getItem(STORAGE_KEY);
    if (salvo) {
      try {
        dados = JSON.parse(salvo);
      } catch (e) {
        dados = {};
      }
    }
  }

  function salvarDados() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  }

  function preencherSelectAno() {
    for (let a = ANO_MIN; a <= ANO_MAX; a++) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      selectAno.appendChild(opt);
    }
  }

  function setSelectMesAnoAtual() {
    selectMes.value = mesAtual;
    selectAno.value = anoAtual;
  }

  // ===== EVENTOS =====
  function bindEventos() {
    btnAbrir.addEventListener('click', abrirCalendario);
    btnVoltar.addEventListener('click', voltarSelecao);
    btnAnterior.addEventListener('click', mesAnterior);
    btnProximo.addEventListener('click', mesProximo);
    selectAno.addEventListener('change', atualizarResumoAnual);

    // Clique nas linhas do resumo anual para abrir o mês
    tbodyResumo.addEventListener('click', function (e) {
      const tr = e.target.closest('tr');
      if (tr && tr.dataset.mes !== undefined) {
        selectMes.value = tr.dataset.mes;
        abrirCalendario();
      }
    });
  }

  function abrirCalendario() {
    mesAtual = parseInt(selectMes.value);
    anoAtual = parseInt(selectAno.value);
    trocarTela(telaCalendario);
    renderizarCalendario();
    renderizarResumoMensal();
  }

  function voltarSelecao() {
    selectMes.value = mesAtual;
    selectAno.value = anoAtual;
    atualizarResumoAnual();
    trocarTela(telaSelecao);
  }

  function mesAnterior() {
    mesAtual--;
    if (mesAtual < 0) {
      mesAtual = 11;
      anoAtual--;
    }
    renderizarCalendario();
    renderizarResumoMensal();
    atualizarTitulo();
  }

  function mesProximo() {
    mesAtual++;
    if (mesAtual > 11) {
      mesAtual = 0;
      anoAtual++;
    }
    renderizarCalendario();
    renderizarResumoMensal();
    atualizarTitulo();
  }

  function trocarTela(telaDestino) {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    telaDestino.classList.add('ativa');
  }

  // ===== LÓGICA 12x36 =====
  /**
   * Verifica se uma data é dia de viagem no esquema 12x36
   * Padrão: trabalha dia 1, folga dia 2, trabalha dia 3, etc.
   * Baseado na diferença de dias a partir de DATA_INICIO
   */
  function isDiaViagem(data) {
    // Calcula a diferença em dias entre a data e DATA_INICIO
    const umDia = 24 * 60 * 60 * 1000;
    const inicio = new Date(DATA_INICIO.getFullYear(), DATA_INICIO.getMonth(), DATA_INICIO.getDate());
    const alvo = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    const diffDias = Math.round((alvo - inicio) / umDia);

    // Se diffDias < 0, a data é antes do início das viagens
    if (diffDias < 0) return false;

    // Dia de viagem: a cada 2 dias (0, 2, 4, 6, ...)
    return diffDias % 2 === 0;
  }

  function formatarData(ano, mes, dia) {
    return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  // ===== RENDERIZAÇÃO CALENDÁRIO =====
  function renderizarCalendario() {
    atualizarTitulo();
    calendarioDias.innerHTML = '';

    const primeiroDia = new Date(anoAtual, mesAtual, 1);
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay(); // 0=Dom, 1=Seg...

    const hoje = new Date();

    // Células vazias antes do dia 1
    for (let i = 0; i < diaSemanaInicio; i++) {
      const celula = criarCelulaVazia();
      calendarioDias.appendChild(celula);
    }

    // Dias do mês
    for (let d = 1; d <= diasNoMes; d++) {
      const data = new Date(anoAtual, mesAtual, d);
      const viagem = isDiaViagem(data);
      const chave = formatarData(anoAtual, mesAtual, d);
      const motorista = dados[chave] || '';
      const ehHoje = (data.getDate() === hoje.getDate() &&
                      data.getMonth() === hoje.getMonth() &&
                      data.getFullYear() === hoje.getFullYear());

      const celula = criarCelulaDia(d, viagem, motorista, chave, ehHoje);
      calendarioDias.appendChild(celula);
    }

    // Células vazias após o último dia (completar a semana)
    const totalCelulas = diaSemanaInicio + diasNoMes;
    const celulasRestantes = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);
    for (let i = 0; i < celulasRestantes; i++) {
      calendarioDias.appendChild(criarCelulaVazia());
    }
  }

  function criarCelulaVazia() {
    const div = document.createElement('div');
    div.className = 'celula-dia vazio';
    return div;
  }

  function criarCelulaDia(dia, viagem, motorista, chave, ehHoje) {
    const div = document.createElement('div');
    div.className = `celula-dia ${viagem ? 'viagem' : 'folga'}${ehHoje ? ' hoje' : ''}`;

    const numDiv = document.createElement('span');
    numDiv.className = 'numero-dia';
    numDiv.textContent = dia;
    div.appendChild(numDiv);

    if (viagem) {
      const badge = document.createElement('span');
      badge.className = 'badge-viagem';
      badge.textContent = 'Viagem';
      div.appendChild(badge);

      const select = document.createElement('select');
      select.className = 'select-motorista';
      select.id = `select-${chave}`;

      const optVazio = document.createElement('option');
      optVazio.value = '';
      optVazio.textContent = '— Motorista —';
      select.appendChild(optVazio);

      MOTORISTAS.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === motorista) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', function () {
        const valor = this.value;
        if (valor) {
          dados[chave] = valor;
        } else {
          delete dados[chave];
        }
        salvarDados();
        renderizarResumoMensal();
        atualizarBadgeMotorista(div, valor);
      });

      div.appendChild(select);

      // Badge do motorista se já atribuído
      if (motorista) {
        const mBadge = document.createElement('span');
        mBadge.className = `motorista-badge ${motorista.toLowerCase()}`;
        mBadge.textContent = motorista;
        div.appendChild(mBadge);
      }
    }

    return div;
  }

  function atualizarBadgeMotorista(celula, motorista) {
    // Remove badge existente
    const badgeExistente = celula.querySelector('.motorista-badge');
    if (badgeExistente) badgeExistente.remove();

    if (motorista) {
      const mBadge = document.createElement('span');
      mBadge.className = `motorista-badge ${motorista.toLowerCase()}`;
      mBadge.textContent = motorista;
      celula.appendChild(mBadge);
    }
  }

  function atualizarTitulo() {
    tituloMesAno.textContent = `${NOMES_MESES[mesAtual]} ${anoAtual}`;
  }

  // ===== RESUMO MENSAL =====
  function renderizarResumoMensal() {
    cardsMotoristas.innerHTML = '';

    const contagem = contarViagensMes(mesAtual, anoAtual);

    MOTORISTAS.forEach(m => {
      const card = document.createElement('div');
      card.className = `card-motorista ${m.toLowerCase()}`;

      card.innerHTML = `
        <div class="card-motorista-avatar">${m.charAt(0)}</div>
        <div class="card-motorista-info">
          <div class="card-motorista-nome">${m}</div>
          <div class="card-motorista-qtd">viagens no mês</div>
        </div>
        <div class="card-motorista-numero">${contagem[m] || 0}</div>
      `;

      cardsMotoristas.appendChild(card);
    });
  }

  function contarViagensMes(mes, ano) {
    const contagem = {};
    MOTORISTAS.forEach(m => contagem[m] = 0);

    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    for (let d = 1; d <= diasNoMes; d++) {
      const chave = formatarData(ano, mes, d);
      if (dados[chave]) {
        contagem[dados[chave]] = (contagem[dados[chave]] || 0) + 1;
      }
    }

    return contagem;
  }

  // ===== RESUMO ANUAL =====
  function atualizarResumoAnual() {
    const ano = parseInt(selectAno.value) || anoAtual;
    resumoAnoLabel.textContent = ano;

    tbodyResumo.innerHTML = '';
    tfootResumo.innerHTML = '';

    const totais = {};
    MOTORISTAS.forEach(m => totais[m] = 0);

    for (let mes = 0; mes < 12; mes++) {
      const contagem = contarViagensMes(mes, ano);
      const tr = document.createElement('tr');
      tr.dataset.mes = mes;

      let tdMes = `<td>${NOMES_MESES[mes]}</td>`;
      let tdsMotoristas = '';

      MOTORISTAS.forEach(m => {
        const val = contagem[m] || 0;
        totais[m] += val;
        const classe = val > 0 ? 'tem-valor' : '';
        tdsMotoristas += `<td><span class="contagem-valor ${classe}">${val}</span></td>`;
      });

      tr.innerHTML = tdMes + tdsMotoristas;
      tbodyResumo.appendChild(tr);
    }

    // Total
    const trTotal = document.createElement('tr');
    let tdTotal = '<td>TOTAL</td>';
    MOTORISTAS.forEach(m => {
      tdTotal += `<td>${totais[m]}</td>`;
    });
    trTotal.innerHTML = tdTotal;
    tfootResumo.appendChild(trTotal);
  }

  // ===== INICIAR =====
  document.addEventListener('DOMContentLoaded', init);
})();
