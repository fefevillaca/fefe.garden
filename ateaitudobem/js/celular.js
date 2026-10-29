// A tela do celular: desenha a conversa, os comentários do grupo fictício e a barra de responder.
// A mesma peça serve à prévia de quem monta o link e à página de quem recebe.

import { ehMidia, ehApagada } from "./leitura.js";

const cores = ["#06cf9c", "#e542a3", "#7f66ff", "#d89b00", "#1fa2e0", "#f0753e", "#8ba300", "#d3396d"];
export const corDe = nome => cores[[...(nome || "?")].reduce((s, c) => s + c.charCodeAt(0), 0) % cores.length];

const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dois = n => String(n).padStart(2, "0");
const rotuloDia = d => `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
export const hora = d => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ehAudioProprio = a => typeof a === "string" && a.startsWith("data:audio/");
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const MOLDE = `
<div class="celular">
  <div class="tela">
    <div class="ilha"></div>
    <div class="status"><span data-relogio></span><span>●●● 82%</span></div>
    <div class="topo">
      <span class="voltar">‹</span>
      <div class="avatar" data-avatar></div>
      <div class="quem"><strong data-titulo></strong><span data-subtitulo></span></div>
      <button class="mais escondido" data-mais aria-label="Opções">⋮</button>
      <div class="menu escondido" data-menu></div>
    </div>
    <div class="chat" data-chat></div>
    <div class="resposta" data-resposta>
      <p class="dica" data-dica></p>
      <div class="preview-resposta" data-preview>
        <div class="citacao" data-citacao></div>
        <button class="fechar" data-cancelar aria-label="cancelar">×</button>
      </div>
      <div class="campo">
        <input data-texto placeholder="dá seu parecer" autocomplete="off" maxlength="2000">
        <button class="botao-redondo" data-acao aria-label="gravar áudio"></button>
      </div>
    </div>
    <div class="entrar escondido" data-entrar>
      <form data-form>
        <img src="img/espiral-claro.svg" alt="">
        <h2>assina a lista de presença</h2>
        <input data-nome placeholder="seu nome ou apelido" maxlength="24" autocomplete="nickname">
        <button>entrar</button>
        <p>seus comentários e áudios aparecem pra todo mundo que tem o link e somem junto com a conversa.</p>
      </form>
    </div>
  </div>
</div>`;

const LIMITE_AUDIO = 120;
// o microfone e o enviar são desenho, não emoji: dentro do celular vale o WhatsApp, e o dele é ícone
const MICROFONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 18v4" stroke="currentColor" stroke-width="2"/></svg>';
const ENVIAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 20.5 21 12 3 3.5l.01 6.6L15 12 3.01 13.9z"/></svg>';
const PARAR = '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect width="12" height="12"/></svg>';

export function criarCelular(raiz, opcoes = {}) {
  raiz.innerHTML = MOLDE;
  const q = nome => raiz.querySelector(`[data-${nome}]`);
  const chat = q("chat"), texto = q("texto"), acao = q("acao"), dica = q("dica");
  const preview = q("preview"), citacao = q("citacao"), entrar = q("entrar");

  let conversa = null, lista = [], comentarios = [], respondendo = null, acaoPendente = null;
  const dicaPadrao = opcoes.dica || "toca num balão pra comentar";
  const placeholder = opcoes.placeholder || "dá seu parecer";

  q("relogio").textContent = hora(new Date());
  dica.textContent = dicaPadrao;
  texto.placeholder = placeholder;
  acao.innerHTML = MICROFONE;
  if (!opcoes.aoComentar) { texto.disabled = true; acao.disabled = true; }

  // menu de opções do topo
  if (opcoes.menu?.length) {
    const menu = q("menu"), mais = q("mais");
    mais.classList.remove("escondido");
    opcoes.menu.forEach(item => {
      const b = el("button", item.perigo ? "perigo" : "", esc(item.rotulo));
      b.onclick = () => { menu.classList.add("escondido"); item.acao(); };
      menu.append(b);
    });
    mais.onclick = e => { e.stopPropagation(); menu.classList.toggle("escondido"); };
    document.addEventListener("click", () => menu.classList.add("escondido"));
  }

  // ---------- desenho ----------
  function onda(n = 28) {
    const w = el("div", "onda");
    for (let i = 0; i < n; i++) { const b = el("i"); b.style.height = (6 + Math.round(Math.abs(Math.sin(i * 1.7)) * 18)) + "px"; w.append(b); }
    return w;
  }

  function corDaCitacao(autor) { return autor === conversa.eu ? "#06cf9c" : corDe(autor); }

  // o comentário do grupo: um recado em papel de cartão, com o nome na máquina de escrever
  function balaoComentario(c, indice) {
    const original = conversa.mensagens.find(m => m.id === c.sobre);
    const linha = el("div", "linha-msg comentario");
    const r = el("div", "recado");
    r.append(el("div", "quem-comentou", `${esc(c.nome)} · ${hora(new Date(c.criadoEm))}`));
    if (original) r.append(el("div", "sobre", `${esc(original.autor || "")} · ${esc(original.texto)}`));
    // o comentário chega de quem tem o link, então nada dele vira html: o áudio só vale se veio
    // gravado dentro do próprio comentário, e a duração entra como texto, no formato 0:00
    if (c.audio && !ehAudioProprio(c.audio)) {
      r.append(el("div", "fala", "áudio que não abriu"));
    } else if (c.audio) {
      const a = el("div", "audio"); a.dataset.comentario = indice;
      const play = el("button", "play", "▶"); play.setAttribute("aria-label", "ouvir");
      const w = onda();
      const duracao = el("span", "duracao");
      duracao.textContent = /^\d{1,2}:\d{2}$/.test(c.duracao) ? c.duracao : "0:00";
      a.append(play, w, duracao);
      let tocador = null;
      play.onclick = () => {
        if (tocador && !tocador.paused) { tocador.pause(); return; }
        tocador = tocador || new Audio(c.audio);
        tocador.onplay = () => { w.classList.add("tocando"); play.textContent = "❚❚"; };
        tocador.onpause = tocador.onended = () => { w.classList.remove("tocando"); play.textContent = "▶"; };
        tocador.play();
      };
      r.append(a);
    } else {
      r.append(el("div", "fala", esc(c.texto)));
    }
    linha.append(r);
    return linha;
  }

  function desenharTopo() {
    const outros = conversa.pessoas.filter(p => p !== conversa.eu);
    const grupo = outros.length > 1;
    const nome = grupo ? (conversa.titulo || "Grupo") : (outros[0] || conversa.titulo || "Conversa");
    q("titulo").textContent = nome;
    const avatar = q("avatar");
    avatar.textContent = [...nome][0]?.toUpperCase() || "?";
    avatar.style.background = grupo ? "#9aa5ab" : corDe(nome);
    q("subtitulo").textContent = grupo ? ["você", ...outros].join(", ") : "toque aqui para dados do contato";
  }

  function desenhar({ manterRolagem = true } = {}) {
    if (!conversa) return;
    const rolagem = chat.scrollTop;
    desenharTopo();
    const grupo = conversa.pessoas.filter(p => p !== conversa.eu).length > 1;
    const porMensagem = new Map();
    comentarios.forEach((c, i) => {
      if (!porMensagem.has(c.sobre)) porMensagem.set(c.sobre, []);
      porMensagem.get(c.sobre).push([c, i]);
    });

    chat.innerHTML = "";
    if (!lista.length) chat.append(el("div", "sistema", "<span>nenhuma mensagem nesse pedaço</span>"));
    let diaAnterior = "", autorAnterior = null;
    const frag = document.createDocumentFragment();
    for (const m of lista) {
      const dia = rotuloDia(m.quando);
      if (dia !== diaAnterior) { frag.append(el("div", "data", `<span>${dia}</span>`)); diaAnterior = dia; autorAnterior = null; }
      if (m.tipo === "sistema") { frag.append(el("div", "sistema", `<span>${esc(m.texto)}</span>`)); autorAnterior = null; continue; }

      const minha = m.autor === conversa.eu;
      const linha = el("div", "linha-msg " + (minha ? "meu" : "outro") + (m.autor !== autorAnterior ? " novo-autor" : ""));
      const b = el("div", "balao" + (respondendo === m.id ? " selecionado" : ""));
      if (grupo && !minha && m.autor !== autorAnterior) {
        const a = el("span", "autor", esc(m.autor)); a.style.color = corDe(m.autor); b.append(a);
      }
      if (m.citacao) {
        // a resposta citada, como o WhatsApp mostra no alto do balão
        const cit = el("div", "citacao", `<b>${esc(m.citacao.autor || "")}</b><p>${esc(m.citacao.texto || "")}</p>`);
        cit.style.setProperty("--cor", m.citacao.autor ? corDaCitacao(m.citacao.autor) : "#8696a0");
        b.append(cit);
      }
      if (ehMidia(m.texto)) b.append(el("span", "midia", "mídia que não veio na exportação"));
      else if (ehApagada(m.texto)) b.append(el("span", "midia", "🚫 Esta mensagem foi apagada"));
      else b.append(document.createTextNode(m.texto));
      b.append(el("span", "hora", hora(m.quando)));
      if (opcoes.aoComentar) b.onclick = () => responder(m.id);
      linha.append(b);
      frag.append(linha);
      (porMensagem.get(m.id) || []).forEach(([c, i]) => frag.append(balaoComentario(c, i)));
      autorAnterior = m.autor;
    }
    chat.append(frag);
    if (manterRolagem) chat.scrollTop = rolagem;
  }

  // ---------- comentar ----------
  function responder(id) {
    respondendo = id;
    const m = conversa.mensagens.find(x => x.id === id);
    citacao.innerHTML = `<b>sobre a mensagem de ${esc(m.autor || "")}</b><p>${esc(m.texto)}</p>`;
    preview.classList.add("ativo"); dica.style.display = "none";
    desenhar(); texto.focus();
  }
  function cancelar() {
    respondendo = null; preview.classList.remove("ativo");
    dica.textContent = dicaPadrao; dica.style.display = ""; desenhar();
  }
  q("cancelar").onclick = cancelar;

  function avisar(frase) { dica.textContent = frase; dica.style.display = ""; }

  function comNome(fn) {
    if (opcoes.nome?.()) return fn();
    acaoPendente = fn; entrar.classList.remove("escondido"); q("nome").focus();
  }
  q("form").onsubmit = e => {
    e.preventDefault();
    opcoes.definirNome?.(q("nome").value.trim() || "alguém");
    entrar.classList.add("escondido");
    if (acaoPendente) { const f = acaoPendente; acaoPendente = null; f(); }
  };

  async function publicar(conteudo) {
    const c = { ...conteudo, sobre: respondendo, nome: opcoes.nome(), criadoEm: Date.now() };
    cancelar();
    try {
      await opcoes.aoComentar(c);
    } catch (e) {
      avisar(e.message || "a gente não conseguiu publicar o comentário. tenta de novo.");
    }
  }

  texto.oninput = () => { acao.innerHTML = texto.value.trim() ? ENVIAR : MICROFONE; };
  texto.onkeydown = e => { if (e.key === "Enter") enviarTexto(); };
  function enviarTexto() {
    const t = texto.value.trim();
    if (!t) return;
    if (!respondendo) return avisar("primeiro toca no balão que você quer comentar.");
    comNome(() => { publicar({ texto: t }); texto.value = ""; acao.innerHTML = MICROFONE; });
  }

  let gravador = null, relogioGravacao = null;
  acao.onclick = () => {
    if (texto.value.trim()) return enviarTexto();
    if (gravador) { gravador.stop(); return; }
    if (!respondendo) return avisar("primeiro toca no balão que você quer comentar em áudio.");
    comNome(gravar);
  };

  async function gravar() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return avisar("o microfone tá bloqueado. libera nas permissões do navegador e tenta de novo.");
    }
    const tipo = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
    const pedacos = [], inicio = Date.now();
    gravador = new MediaRecorder(stream, { ...(tipo && { mimeType: tipo }), audioBitsPerSecond: 32000 });
    gravador.ondataavailable = e => e.data.size && pedacos.push(e.data);
    gravador.onstop = () => {
      clearInterval(relogioGravacao);
      stream.getTracks().forEach(t => t.stop());
      gravador = null; acao.classList.remove("gravando"); acao.innerHTML = MICROFONE;
      texto.disabled = false; texto.placeholder = placeholder;
      const seg = Math.max(1, Math.round((Date.now() - inicio) / 1000));
      const leitor = new FileReader();
      leitor.onload = () => publicar({ audio: leitor.result, duracao: `${Math.floor(seg / 60)}:${dois(seg % 60)}` });
      leitor.readAsDataURL(new Blob(pedacos, { type: pedacos[0]?.type || tipo || "audio/webm" }));
    };
    gravador.start();
    acao.classList.add("gravando"); acao.innerHTML = PARAR;
    texto.disabled = true;
    relogioGravacao = setInterval(() => {
      const s = Math.round((Date.now() - inicio) / 1000);
      texto.placeholder = `gravando ${Math.floor(s / 60)}:${dois(s % 60)} de 2:00 · toca no ■ pra mandar`;
      if (s >= LIMITE_AUDIO) gravador?.stop();
    }, 250);
  }

  // ---------- o arquivo para baixar ----------
  function htmlParaBaixar() {
    const tela = raiz.querySelector(".celular").cloneNode(true);
    tela.querySelectorAll("[data-resposta], [data-entrar], [data-menu], [data-mais]").forEach(n => n.remove());
    tela.querySelectorAll(".balao.selecionado").forEach(n => n.classList.remove("selecionado"));
    tela.querySelectorAll(".audio[data-comentario]").forEach(n => {
      const c = comentarios[+n.dataset.comentario];
      const audio = document.createElement("audio");
      audio.controls = true; audio.preload = "none"; audio.src = c.audio;
      n.replaceWith(audio);
    });
    return tela.outerHTML;
  }

  return {
    mostrar(c, visiveis, { topo = true } = {}) {
      conversa = c; lista = visiveis || c.mensagens;
      if (respondendo && !lista.some(m => m.id === respondendo)) cancelar();
      desenhar({ manterRolagem: !topo });
      if (topo) chat.scrollTop = 0;
    },
    comentarios(novos) { comentarios = novos; desenhar(); },
    adicionar(c) { comentarios.push(c); desenhar(); },
    rolarParaUltimoComentario() {
      const todos = chat.querySelectorAll(".comentario");
      todos[todos.length - 1]?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    avisar,
    htmlParaBaixar
  };
}
