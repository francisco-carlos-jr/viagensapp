/**
 * Calendário de Viagens - Escala 12×36
 * Persistência: GitHub API (Contents API) para data.json compartilhado
 */

(function () {
  'use strict';

  // ===== CONSTANTES =====
  const MOTORISTAS = ['CHICO', 'CLAUDINEI', 'NILTON', 'PABLO'];
  const DATA_INICIO = new Date(2026, 3, 1); // 1 de Abril de 2026
  const CONFIG_KEY = 'viagensApp_config';
  const NOMES_MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const ANO_MIN = 2026;
  const ANO_MAX = 2035;
  const GITHUB_API = 'https://api.github.com';
  const FILE_PATH = 'data.json';

  // ===== ESTADO =====
  let mesAtual = new Date().getMonth();
  let anoAtual = new Date().getFullYear();
  let dados = {}; // { "2026-04-01": "CHICO", ... }
  let fileSha = null; // SHA do arquivo no GitHub (necessário para atualizações)
  let config = { owner: '', repo: '', token: '' };
  let salvando = false;

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

  // Modal
  const modalOverlay = document.getElementById('modal-overlay');
  const btnConfig = document.getElementById('btn-config');
  const btnFecharModal = document.getElementById('btn-fechar-modal');
  const btnSalvarConfig = document.getElementById('btn-salvar-config');
  const inputOwner = document.getElementById('input-owner');
  const inputRepo = document.getElementById('input-repo');
  const inputToken = document.getElementById('input-token');
  const configStatus = document.getElementById('config-status');

  // Sync indicator
  const syncIndicator = document.getElementById('sync-indicator');
  const syncText = document.getElementById('sync-text');

  // ===== INICIALIZAÇÃO =====
  async function init() {
    carregarConfig();
    preencherSelectAno();
    setSelectMesAnoAtual();
    bindEventos();

    if (configValida()) {
      await carregarDadosGitHub();
    } else {
      setSyncStatus('sem-config', '⚙️ Configure o GitHub');
      abrirModal();
    }

    atualizarResumoAnual();
  }

  // ===== CONFIGURAÇÃO =====
  function carregarConfig() {
    const salvo = localStorage.getItem(CONFIG_KEY);
    if (salvo) {
      try {
        config = JSON.parse(salvo);
      } catch (e) {
        config = { owner: '', repo: '', token: '' };
      }
    }
  }

  function salvarConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  function configValida() {
    return config.owner && config.repo && config.token;
  }

  function abrirModal() {
    inputOwner.value = config.owner || '';
    inputRepo.value = config.repo || '';
    inputToken.value = config.token || '';
    configStatus.className = 'config-status';
    configStatus.textContent = '';
    modalOverlay.classList.add('ativo');
  }

  function fecharModal() {
    modalOverlay.classList.remove('ativo');
  }

  async function onSalvarConfig() {
    const owner = inputOwner.value.trim();
    const repo = inputRepo.value.trim();
    const token = inputToken.value.trim();

    if (!owner || !repo || !token) {
      mostrarConfigStatus('erro', 'Preencha todos os campos.');
      return;
    }

    config = { owner, repo, token };
    salvarConfig();

    mostrarConfigStatus('', 'Testando conexão...');
    btnSalvarConfig.disabled = true;

    try {
      await carregarDadosGitHub();
      mostrarConfigStatus('sucesso', '✅ Conectado com sucesso!');
      atualizarResumoAnual();

      setTimeout(() => fecharModal(), 1200);
    } catch (err) {
      mostrarConfigStatus('erro', `❌ Erro: ${err.message}`);
    } finally {
      btnSalvarConfig.disabled = false;
    }
  }

  function mostrarConfigStatus(tipo, msg) {
    configStatus.className = `config-status ${tipo}`;
    configStatus.style.display = 'block';
    configStatus.textContent = msg;
  }

  // ===== GITHUB API =====
  function githubHeaders() {
    return {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  async function carregarDadosGitHub() {
    setSyncStatus('sincronizando', 'Carregando...');

    try {
      const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`;
      const resp = await fetch(url, { headers: githubHeaders() });

      if (resp.status === 404) {
        // Arquivo não existe ainda, criar com dados vazios
        dados = {};
        fileSha = null;
        await salvarDadosGitHub('Criação inicial do data.json');
        setSyncStatus('sincronizado', 'Sincronizado');
        return;
      }

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      const json = await resp.json();
      fileSha = json.sha;

      // Decodifica o conteúdo (base64)
      const conteudo = decodeURIComponent(
        atob(json.content).split('').map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );

      const parsed = JSON.parse(conteudo);
      dados = parsed.viagens || {};

      setSyncStatus('sincronizado', 'Sincronizado');
    } catch (err) {
      setSyncStatus('erro-sync', 'Erro de conexão');
      throw err;
    }
  }

  async function salvarDadosGitHub(mensagem) {
    if (!configValida()) {
      setSyncStatus('sem-config', '⚙️ Configure o GitHub');
      return;
    }

    if (salvando) return;
    salvando = true;
    setSyncStatus('sincronizando', 'Salvando...');

    try {
      // Primeiro, buscar SHA atual para evitar conflitos
      const urlGet = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`;
      const respGet = await fetch(urlGet, { headers: githubHeaders() });

      if (respGet.ok) {
        const jsonGet = await respGet.json();
        fileSha = jsonGet.sha;
      }

      const conteudoJson = JSON.stringify({
        motoristas: MOTORISTAS,
        dataInicio: "2026-04-01",
        viagens: dados
      }, null, 2);

      // Codifica para base64 (com suporte a UTF-8)
      const conteudoBase64 = btoa(
        encodeURIComponent(conteudoJson).replace(/%([0-9A-F]{2})/g, (_, p1) =>
          String.fromCharCode(parseInt(p1, 16))
        )
      );

      const body = {
        message: mensagem || 'Atualização de viagens',
        content: conteudoBase64,
        branch: 'main'
      };

      if (fileSha) {
        body.sha = fileSha;
      }

      const url = `${GITHUB_API}/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`;
      const resp = await fetch(url, {
        method: 'PUT',
        headers: githubHeaders(),
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.message || `HTTP ${resp.status}`);
      }

      const result = await resp.json();
      fileSha = result.content.sha;

      setSyncStatus('sincronizado', 'Sincronizado');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setSyncStatus('erro-sync', 'Erro ao salvar');
    } finally {
      salvando = false;
    }
  }

  // Debounce para não fazer muitos commits seguidos
  let salvarTimeout = null;
  function salvarDadosDebounce() {
    if (salvarTimeout) clearTimeout(salvarTimeout);
    setSyncStatus('sincronizando', 'Aguardando...');
    salvarTimeout = setTimeout(() => {
      salvarDadosGitHub('Atualização de viagens');
    }, 2000); // Espera 2 segundos após a última alteração
  }

  // ===== SYNC INDICATOR =====
  function setSyncStatus(tipo, texto) {
    syncIndicator.className = `sync-indicator visivel ${tipo}`;
    syncText.textContent = texto;
  }

  // ===== EVENTOS =====
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

  function bindEventos() {
    btnAbrir.addEventListener('click', abrirCalendario);
    btnVoltar.addEventListener('click', voltarSelecao);
    btnAnterior.addEventListener('click', mesAnterior);
    btnProximo.addEventListener('click', mesProximo);
    selectAno.addEventListener('change', atualizarResumoAnual);

    // Config
    btnConfig.addEventListener('click', abrirModal);
    btnFecharModal.addEventListener('click', fecharModal);
    btnSalvarConfig.addEventListener('click', onSalvarConfig);
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) fecharModal();
    });

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
  function isDiaViagem(data) {
    const umDia = 24 * 60 * 60 * 1000;
    const inicio = new Date(DATA_INICIO.getFullYear(), DATA_INICIO.getMonth(), DATA_INICIO.getDate());
    const alvo = new Date(data.getFullYear(), data.getMonth(), data.getDate());
    const diffDias = Math.round((alvo - inicio) / umDia);

    if (diffDias < 0) return false;
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
    const diaSemanaInicio = primeiroDia.getDay();

    const hoje = new Date();

    for (let i = 0; i < diaSemanaInicio; i++) {
      calendarioDias.appendChild(criarCelulaVazia());
    }

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
        salvarDadosDebounce();
        renderizarResumoMensal();
        atualizarBadgeMotorista(div, valor);
      });

      div.appendChild(select);

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
