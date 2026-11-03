// A página de quem recebe o link: destranca a conversa, mostra o celular e mantém o grupo de comentários vivo.
// O link tem a forma c#id.chave e, no link com senha, c#id.chave.token

import { desempacotar } from "./leitura.js";
import { criarCelular, esc } from "./celular.js";
import { abrirChave, trancar, destrancar } from "./cripto.js";
import { lerNome, guardarNome, guardarDona, lerDona, baixarConversa } from "./local.js";
import { API, pagina, falta, curta } from "./lugar.js";

const $ = id => document.getElementById(id);
const [id, chaveTexto, tokenNoLink] = location.hash.slice(1).split(".");
// a senha fica guardada neste navegador e sai da barra de endereço, pra não ir junto quando alguém copia o link dali
if (id && tokenNoLink) {
  guardarDona(id, tokenNoLink);
  history.replaceState(null, "", `#${id}.${chaveTexto}`);
}
const token = tokenNoLink || (id && lerDona(id));

let chave, conversa, celular, expiraEm;
let comentarios = [], total = 0, buscando = null, relogio = null, vigia = null, conferir = null;

// ---------- quando o link não abre ----------
function sumiu(desenho, titulo, texto) {
  clearInterval(relogio); clearInterval(vigia); clearInterval(conferir);
  $("destrancando").classList.add("escondido");
  $("mesa").classList.add("escondido");
  $("topoCelular").classList.add("escondido");
  $("celular").innerHTML = "";
  $("topo").classList.remove("escondido");
  document.querySelectorAll("#topo nav button, .prazo-topo").forEach(n => n.classList.add("escondido"));
  document.body.classList.remove("ver");
  $("sumiuDesenho").src = `img/${desenho}-claro.svg`;
  $("sumiuTitulo").textContent = titulo;
  $("sumiuTexto").textContent = texto;
  $("sumiu").classList.remove("escondido");
  document.title = `${titulo} · até aí tudo bem`;
}
const prazoAcabou = () => sumiu("fio-cortado", "processo arquivado. essa conversa já foi picotada.", "o prazo acabou ou quem criou o link apagou antes. ela não fica guardada em lugar nenhum, então não tem como recuperar.");

function contar() {
  const resta = expiraEm - Date.now();
  if (resta <= 0) return prazoAcabou();
  $("prazoTopo").textContent = `some em ${falta(resta)}`;
  $("prazoCelular").textContent = `some em ${falta(resta).match(/^\d+ dias?|^\S+/)[0]}`;
}

// ---------- o grupo ----------
function desenharGrupo() {
  const meu = lerNome();
  const nomes = [...new Set(comentarios.map(c => c.nome).filter(n => n && n !== meu))];
  $("grupoNomes").textContent = nomes.length
    ? `${nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0]} e você.`
    : "por enquanto, só você.";
}

async function buscarComentarios({ sempre = false } = {}) {
  if (document.hidden && !sempre) return;
  // uma busca de cada vez; quem chega no meio espera a atual e busca de novo
  while (buscando) await buscando;
  let terminar;
  buscando = new Promise(ok => terminar = ok);
  try {
    const r = await fetch(`${API}/comentarios?id=${encodeURIComponent(id)}&desde=${total}`);
    if (!r.ok) return;
    const j = await r.json();
    const novos = [];
    for (const item of j.itens) {
      try { novos.push(await destrancar(chave, item)); } catch { /* comentário que não abre com esta chave fica de fora */ }
    }
    const primeiraVez = total === 0 && !comentarios.length;
    total = j.total;
    if (novos.length) {
      comentarios = comentarios.concat(novos);
      celular.comentarios(comentarios);
      desenharGrupo();
      const deOutro = novos.filter(c => c.nome !== lerNome()).pop();
      if (deOutro && !primeiraVez) celular.avisar(`e detalhe: ${deOutro.nome} ${deOutro.audio ? "mandou um áudio" : "comentou"}.`);
    }
  } finally {
    buscando = null;
    terminar();
  }
}

async function comentar(c) {
  const dados = await trancar(chave, c);
  const r = await fetch(`${API}/comentarios`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, dados })
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) return prazoAcabou();
  if (!r.ok) throw new Error(j.erro || "a gente não conseguiu publicar o comentário. tenta de novo.");
  await buscarComentarios({ sempre: true });
  celular.rolarParaUltimoComentario();
}

async function apagar() {
  if (!confirm("apagar agora?\n\na conversa, os comentários e os áudios somem pra todo mundo, inclusive pra você. não tem como desfazer.")) return;
  const r = await fetch(`${API}/conversas?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-dona": token } });
  if (!r.ok) { const j = await r.json().catch(() => ({})); return celular.avisar(j.erro || "a gente não conseguiu apagar. tenta de novo."); }
  sumiu("fio-fim", "conversa apagada.", "a conversa, os comentários e os áudios sumiram agora. o link não abre mais pra ninguém.");
}

const baixar = () => baixarConversa(celular.htmlParaBaixar(), $("celular").querySelector("[data-titulo]").textContent);

// ---------- abrir ----------
async function abrir() {
  if (!id || !chaveTexto) {
    return sumiu("fio-cortado", "esse link chegou pela metade.", "a chave fica depois do #. pede pra quem mandou copiar o link inteiro de novo.");
  }
  let resposta;
  try {
    resposta = await fetch(`${API}/conversas?id=${encodeURIComponent(id)}`);
  } catch {
    return sumiu("fio-cortado", "sem internet.", "não deu pra falar com o site. confere a conexão e abre o link de novo.");
  }
  if (resposta.status === 404) return prazoAcabou();
  if (!resposta.ok) return sumiu("fio-cortado", "o site não respondeu.", "o problema é do lado de cá. tenta abrir o link de novo daqui a pouco.");
  const { dados, expiraEm: expira } = await resposta.json();
  expiraEm = expira;
  let pacote;
  try {
    chave = await abrirChave(chaveTexto);
    pacote = await destrancar(chave, dados);
    conversa = desempacotar(pacote);
  } catch {
    return sumiu("fio-cortado", "essa chave não abre a conversa.", "o link chegou cortado ou mexido. pede pra quem mandou copiar o link inteiro de novo.");
  }

  const menu = [
    { rotulo: "baixar uma cópia", acao: baixar },
    { rotulo: "como funciona", acao: () => window.open(pagina("sobre"), "_blank", "noopener") }
  ];
  if (token) menu.push({ rotulo: "apagar agora", acao: apagar, perigo: true });

  celular = criarCelular($("celular"), { aoComentar: comentar, nome: lerNome, definirNome: n => { guardarNome(n); desenharGrupo(); }, menu });
  celular.mostrar(conversa);

  const p = conversa.pessoas;
  $("emprestimo").innerHTML = [
    ["conversa", p.length <= 2 ? p.join(" e ") : `${p.slice(0, -1).join(", ")} e ${p[p.length - 1]}`],
    ...(pacote.c ? [["emprestada em", curta(new Date(pacote.c))]] : []),
    ["devolver até", curta(new Date(expiraEm))],
    ["quem pegou", "quem tiver o link"]
  ].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("");
  $("navBaixar").onclick = baixar;
  if (token) { $("navApagar").classList.remove("escondido"); $("navApagar").onclick = apagar; }

  $("destrancando").classList.add("escondido");
  $("topo").classList.remove("escondido");
  $("topoCelular").classList.remove("escondido");
  $("mesa").classList.remove("escondido");
  document.title = `${$("celular").querySelector("[data-titulo]").textContent} · até aí tudo bem`;
  contar();
  desenharGrupo();
  relogio = setInterval(contar, 30000);
  await buscarComentarios({ sempre: true });
  vigia = setInterval(buscarComentarios, 4000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) buscarComentarios(); });
  // quem criou pode ter apagado antes do prazo
  conferir = setInterval(async () => {
    const r = await fetch(`${API}/conversas?id=${encodeURIComponent(id)}&so=prazo`).catch(() => null);
    if (r?.status === 404) prazoAcabou();
  }, 60000);
}

// colar outro link na mesma aba só troca o pedaço depois do #, e isso não recarrega a página sozinho
window.addEventListener("hashchange", () => location.reload());

abrir();
