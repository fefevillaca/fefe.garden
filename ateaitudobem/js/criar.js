// A página de montar: a capa e a ficha da conversa, uma pergunta por vez, com o celular ao lado.
//   01 de onde vem → (nomes e arquivos) → [lendo] → 02 confere a leitura → 04 que pedaço → 05 prazo → pronto
//   01 de onde vem → (arquivo ou texto) → 03 de quem é o celular → 04 que pedaço → 05 prazo → pronto

import { lerTexto, montarConversa, tituloDoArquivo, empacotar, numerar } from "./leitura.js";
import { criarCelular, esc } from "./celular.js";
import { novaChave, trancar } from "./cripto.js";
import { guardarDona, baixarConversa } from "./local.js";
import { API, pagina, quando, falta, curta, nomeDoPrazo } from "./lugar.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const dois = n => String(n).padStart(2, "0");

const celular = criarCelular($("celular"), { dica: "prévia de como a conversa vai aparecer", placeholder: "comenta depois do link" });

let conversa = null;
let deExemplo = true;
let prazo = 86400;
let fonte = null;
let itensLidos = null; // o que a leitura de prints ou vídeo entendeu, editável
let relogioNoAr = null;

// ---------- o número da ficha ----------
const numero = String(Math.floor(Math.random() * 9000) + 1000);
const hoje = new Date();
$("fichaNumero").textContent = `nº ${numero} · ${dois(hoje.getDate())}.${dois(hoje.getMonth() + 1)}.${String(hoje.getFullYear()).slice(2)}`;
$("etiquetaNumero").textContent = `a conversa nº ${numero}`;
$("arquivoNumero").textContent = `/ arquivo ${numero}`;

// ---------- capa ou ficha ----------
function vista() {
  const montar = location.hash === "#montar";
  $("vistaCapa").classList.toggle("escondido", montar);
  $("vistaMontar").classList.toggle("escondido", !montar);
  document.body.classList.toggle("noite", !montar);
  if (montar && !document.querySelector(".passo.ativo")) irPara("fonte", false);
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", vista);

// ---------- os passos ----------
const PASSOS = {
  fonte: [1, "qual é a prova"],
  material: [1, "qual é a prova"],
  confere: [2, "confere a transcrição"],
  celular: [3, "titular do celular"],
  pedaco: [4, "que pedaço mostrar"],
  prazo: [5, "quanto tempo fica arquivada"]
};
const historico = [];

function irPara(passo, guardar = true) {
  const atual = document.querySelector(".passo.ativo");
  if (guardar && atual) historico.push(atual.dataset.passo);
  document.querySelectorAll(".passo").forEach(p => p.classList.toggle("ativo", p.dataset.passo === passo));
  const [n, nome] = PASSOS[passo];
  $("passoNum").textContent = `0${n} / 05 · ${nome}`;
  $("progresso").src = `img/progresso-${n}.svg`;
  $("contador").textContent = `${n} / 5`;
  mostrarFicha();
  if (passo === "prazo") contarPrazos();
  $("ficha").scrollIntoView({ block: "start", behavior: "smooth" });
}
function voltar() { const p = historico.pop(); if (p) irPara(p, false); }
document.querySelectorAll("[data-voltar]").forEach(b => b.onclick = voltar);

function mostrarFicha() {
  $("ficha").classList.remove("escondido");
  $("lendo").classList.add("escondido");
  $("pronto").classList.add("escondido");
}

document.querySelectorAll("[data-continuar]").forEach(b => b.onclick = () => {
  const atual = document.querySelector(".passo.ativo").dataset.passo;
  irPara({ confere: "pedaco", celular: "pedaco", pedaco: "prazo" }[atual]);
});

// ---------- 01 · de onde vem ----------
document.querySelectorAll("#fontes .opcao").forEach(b => b.onclick = () => {
  fonte = b.dataset.fonte;
  document.querySelectorAll("#fontes .opcao").forEach(x => x.classList.toggle("escolhida", x === b));
  const comNomes = fonte === "prints" || fonte === "video";
  $("blocoNomes").classList.toggle("escondido", !comNomes);
  $("tituloMaterial").textContent = { prints: "as partes envolvidas", video: "as partes envolvidas", arquivo: "a conversa exportada", colar: "o texto copiado" }[fonte];
  document.querySelectorAll("[data-material]").forEach(m => m.classList.toggle("escondido", m.dataset.material !== fonte));
  aviso("");
  ajustarBotaoLer();
  irPara("material");
});

function aviso(texto, erro = false) {
  const s = $("statusMaterial");
  s.textContent = texto; s.classList.toggle("erro-ficha", erro);
}

function ajustarBotaoLer() {
  const b = $("lerMaterial");
  b.classList.toggle("escondido", fonte === "arquivo");
  if (fonte === "prints") { b.textContent = prints.length === 1 ? "ler o print" : `ler os ${prints.length || ""} prints`.replace("  ", " "); b.disabled = !prints.length; }
  if (fonte === "video") { b.textContent = videos.length > 1 ? `ler os ${videos.length} vídeos` : "ler o vídeo"; b.disabled = !videos.length; }
  if (fonte === "colar") { b.textContent = "usar esse texto"; b.disabled = false; }
}

$("lerMaterial").onclick = () => {
  if (fonte === "prints") lerComLeitor((ocr, op) => ocr.lerImagens(prints.map(p => p.arquivo), op));
  if (fonte === "video" && videos.length) lerComLeitor((ocr, op) => ocr.lerVideo(videos, op));
  if (fonte === "colar") usarTexto($("textoColado").value, "");
};

document.querySelectorAll("[data-soltar]").forEach(caixa => {
  const entrada = caixa.querySelector("input");
  caixa.ondragover = e => { e.preventDefault(); caixa.classList.add("sobre"); };
  caixa.ondragleave = () => caixa.classList.remove("sobre");
  caixa.ondrop = e => {
    e.preventDefault(); caixa.classList.remove("sobre");
    entrada.dispatchEvent(Object.assign(new Event("change"), { arquivos: [...e.dataTransfer.files] }));
  };
});
const arquivosDe = e => e.arquivos || [...e.target.files];

// ---------- carregar uma conversa ----------
const paraCampo = d => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;

function carregar(mensagens, { titulo = "", eu = null, manterPeriodo = false } = {}) {
  const anterior = conversa;
  conversa = montarConversa(mensagens, { titulo, eu: eu || anterior?.eu });
  if (deExemplo) celular.comentarios([]); // os comentários de exemplo ficam com a conversa de exemplo
  deExemplo = false;

  const caixa = $("pessoas"); caixa.innerHTML = "";
  conversa.pessoas.forEach(p => {
    const b = el("button", "opcao nome" + (p === conversa.eu ? " escolhida" : ""));
    b.append(el("span", "linha-serif", esc(p)), el("span", "conta", `${conversa.conta[p].toLocaleString("pt-BR")} mensagens`));
    b.onclick = () => {
      conversa.eu = p;
      caixa.querySelectorAll(".opcao").forEach(x => x.classList.toggle("escolhida", x === b));
      atualizar();
    };
    caixa.append(b);
  });
  if (!manterPeriodo || !$("de").value) periodo(0, false);
  atualizar({ topo: !manterPeriodo });
}

function periodo(dias, redesenhar = true) {
  const ms = conversa.mensagens;
  if (!ms.length) return;
  const primeira = ms[0].quando, ultima = ms[ms.length - 1].quando;
  const de = dias ? new Date(Math.max(primeira, ultima - dias * 864e5)) : primeira;
  $("de").value = paraCampo(de); $("ate").value = paraCampo(ultima);
  document.querySelectorAll("#atalhos .atalho").forEach(b => b.classList.toggle("escolhida", +b.dataset.dias === dias));
  if (redesenhar) atualizar();
}
document.querySelectorAll("#atalhos .atalho").forEach(b => b.onclick = () => periodo(+b.dataset.dias));
$("de").onchange = $("ate").onchange = () => {
  document.querySelectorAll("#atalhos .atalho").forEach(b => b.classList.remove("escolhida"));
  atualizar();
};

function visiveis() {
  if (!conversa) return [];
  if (!$("de").value || !$("ate").value) return conversa.mensagens;
  const de = new Date($("de").value), ate = new Date($("ate").value);
  ate.setSeconds(59, 999);
  return conversa.mensagens.filter(m => m.quando >= de && m.quando <= ate);
}

function atualizar({ topo = false } = {}) {
  const lista = visiveis();
  celular.mostrar(conversa, lista, { topo });
  const n = lista.filter(m => m.tipo === "msg").length;
  $("contagemNumero").textContent = n.toLocaleString("pt-BR");
  $("contagem").textContent = n ? "mensagens nesse pedaço" : "nenhuma mensagem nesse pedaço. aumenta o período.";
  $("continuarPedaco").disabled = !n;
  $("criar").disabled = deExemplo || !n;
}

// ---------- conversa exportada e texto copiado ----------
async function carregarZip() {
  if (window.JSZip) return;
  await new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = ok; s.onerror = () => falha(new Error("esse .zip não abriu. confere a internet ou sobe só o .txt."));
    document.head.append(s);
  });
}

$("arquivoTexto").onchange = async e => {
  const arquivo = arquivosDe(e)[0];
  e.target.value = "";
  if (!arquivo) return;
  aviso("lendo o arquivo.");
  try {
    let texto;
    if (/\.zip$/i.test(arquivo.name) || arquivo.type.includes("zip")) {
      await carregarZip();
      const zip = await JSZip.loadAsync(arquivo);
      const txt = Object.values(zip.files).find(f => /\.txt$/i.test(f.name) && !f.dir);
      if (!txt) throw new Error('esse .zip veio sem a conversa dentro. exporta de novo e escolhe "Sem mídia".');
      texto = await txt.async("string");
    } else {
      texto = await arquivo.text();
    }
    usarTexto(texto, tituloDoArquivo(arquivo.name), arquivo.name);
  } catch (erro) {
    aviso(erro.message || 'esse arquivo não abriu. confere se ele saiu do "Exportar conversa" do whatsapp.', true);
  }
};

function usarTexto(texto, titulo, origem) {
  const lidas = lerTexto(texto);
  const n = lidas.filter(m => m.tipo === "msg").length;
  if (!n) return aviso("não achei mensagens nesse texto. ele precisa vir do whatsapp, com data, hora e nome em cada linha.", true);
  itensLidos = null;
  carregar(lidas, { titulo });
  aviso(origem ? `${origem} · ${n.toLocaleString("pt-BR")} mensagens` : "");
  irPara(conversa.pessoas.length > 1 ? "celular" : "pedaco");
}

// ---------- prints ----------
let prints = [];
$("arquivoPrints").onchange = e => {
  const novos = arquivosDe(e).filter(f => f.type.startsWith("image/"));
  novos.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, "pt", { numeric: true }));
  prints = prints.concat(novos.map(arquivo => ({ arquivo, url: URL.createObjectURL(arquivo) })));
  desenharMiniaturas();
  e.target.value = "";
};

function desenharMiniaturas() {
  const caixa = $("miniaturas"); caixa.innerHTML = "";
  $("blocoMiniaturas").classList.toggle("escondido", !prints.length);
  $("contaPrints").textContent = `${prints.length} · na ordem da conversa`;
  prints.forEach((p, i) => {
    const m = el("div", "miniatura");
    const img = el("img"); img.src = p.url; img.alt = `print ${i + 1}`;
    const ctl = el("div", "controles");
    const mover = (de, para) => { [prints[de], prints[para]] = [prints[para], prints[de]]; desenharMiniaturas(); };
    const antes = el("button", "", "‹"); antes.title = "mover pra antes"; antes.onclick = () => i > 0 && mover(i, i - 1);
    const tirar = el("button", "", "×"); tirar.title = "tirar"; tirar.onclick = () => { URL.revokeObjectURL(p.url); prints.splice(i, 1); desenharMiniaturas(); };
    const depois = el("button", "", "›"); depois.title = "mover pra depois"; depois.onclick = () => i < prints.length - 1 && mover(i, i + 1);
    tirar.className = "tirar";
    ctl.append(antes, el("span", "", dois(i + 1)), depois);
    m.append(img, tirar, ctl);
    caixa.append(m);
  });
  ajustarBotaoLer();
}

// ---------- vídeo ----------
// vários vídeos entram como os prints: na ordem da conversa, e o pedaço repetido entre um e outro
// entra uma vez só
let videos = [];
$("arquivoVideo").onchange = e => {
  const novos = arquivosDe(e).filter(f => f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
  e.target.value = "";
  novos.sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name, "pt", { numeric: true }));
  videos = videos.concat(novos);
  desenharVideos();
};

function desenharVideos() {
  const lista = $("listaVideos"); lista.innerHTML = "";
  $("blocoVideos").classList.toggle("escondido", !videos.length);
  $("contaVideos").textContent = videos.length > 1 ? `${videos.length} · na ordem da conversa` : "";
  videos.forEach((v, i) => {
    const li = el("li");
    const mover = (de, para) => { [videos[de], videos[para]] = [videos[para], videos[de]]; desenharVideos(); };
    const antes = el("button", "", "‹"); antes.title = "mover pra antes"; antes.onclick = () => i > 0 && mover(i, i - 1);
    const depois = el("button", "", "›"); depois.title = "mover pra depois"; depois.onclick = () => i < videos.length - 1 && mover(i, i + 1);
    const tirar = el("button", "", "×"); tirar.title = "tirar"; tirar.onclick = () => { videos.splice(i, 1); desenharVideos(); };
    const nome = el("span", "nome"); nome.textContent = v.name; // nome de arquivo entra como texto, nunca como html
    li.append(el("span", "num", dois(i + 1)), nome, antes, depois, tirar);
    lista.append(li);
  });
  ajustarBotaoLer();
}

// ---------- a leitura ----------
function nomesInformados() {
  const dona = $("nomeDona").value.trim();
  const outros = $("nomeContato").value.split(",").map(n => n.trim()).filter(Boolean);
  return { dona, outros };
}

const frases = [
  "procurando os balões nos prints.",
  "autenticando os balões.",
  "separando o verde do branco.",
  "conferindo firma de cada horário.",
  "tirando o que se repete entre um print e outro.",
  "calma, ainda tem balão pra ler."
];

async function lerComLeitor(tarefa) {
  const nomes = nomesInformados();
  if (!nomes.dona || !nomes.outros.length) {
    aviso("antes de ler, diz quem é titular do celular e quem é a outra parte. é assim que a leitura sabe de quem é cada balão.", true);
    (nomes.dona ? $("nomeContato") : $("nomeDona")).focus();
    return;
  }
  $("ficha").classList.add("escondido");
  $("lendo").classList.remove("escondido");
  window.scrollTo(0, 0);
  let k = 0;
  const frase = $("fraseLeitura");
  frase.textContent = frases[0];
  const giro = setInterval(() => {
    frase.style.opacity = 0;
    setTimeout(() => { k = (k + 1) % frases.length; frase.textContent = frases[k]; frase.style.opacity = 1; }, 400);
  }, 3200);
  try {
    const ocr = await import("./ocr.js");
    const r = await tarefa(ocr, {
      nomes,
      progresso: f => { $("barraLeitura").style.width = `${Math.round((f || 0) * 100)}%`; },
      aviso: t => { $("estadoLeitura").textContent = t; }
    });
    const n = r.itens.filter(i => i.tipo === "msg").length;
    if (!n) throw new Error(fonte === "video" ? (videos.length > 1 ? "não achei balões de conversa nesses vídeos. confere se são do whatsapp e tenta de novo." : "não achei balões de conversa nesse vídeo. confere se é do whatsapp e tenta de novo.") : "não achei balões de conversa nesses prints. confere se são do whatsapp e tenta de novo.");
    itensLidos = r.itens;
    desenharRevisao();
    await aplicarRevisao({ manterPeriodo: false });
    aviso(`até aí, tudo bem. li ${n} mensagens. confere a transcrição aqui embaixo antes de criar o link.`);
    irPara("confere");
  } catch (erro) {
    mostrarFicha();
    aviso(erro.message || "a leitura parou no meio. tenta de novo.", true);
  } finally {
    clearInterval(giro);
    $("barraLeitura").style.width = "0";
  }
}

// ---------- 02 · confere a leitura ----------
const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
let espera = null;
const depoisDeDigitar = () => { clearTimeout(espera); espera = setTimeout(() => aplicarRevisao(), 250); };

function desenharRevisao() {
  const caixa = $("revisao"); caixa.innerHTML = "";
  let n = 0;
  itensLidos.forEach((it, i) => {
    const tirar = el("button", "tirar", "×"); tirar.title = "tirar";
    tirar.onclick = () => { itensLidos.splice(i, 1); desenharRevisao(); aplicarRevisao(); };
    if (it.tipo === "dia" || it.tipo === "sistema") {
      const linha = el("div", `linha-rev ${it.tipo}`);
      linha.append(document.createTextNode(it.tipo === "dia" ? `${it.data.getDate()} de ${meses[it.data.getMonth()]} de ${it.data.getFullYear()}` : it.texto), tirar);
      return caixa.append(linha);
    }
    const linha = el("div", "linha-rev");
    const lado = el("button", "lado" + (it.lado === "eu" ? " eu" : ""), it.lado === "eu" ? "▶" : "◀");
    lado.title = "trocar de lado";
    lado.onclick = () => { it.lado = it.lado === "eu" ? "outro" : "eu"; desenharRevisao(); aplicarRevisao(); };
    const texto = el("textarea"); texto.value = it.texto; texto.rows = Math.max(1, Math.ceil(it.texto.length / 42));
    texto.oninput = () => { it.texto = texto.value; depoisDeDigitar(); };
    const hora = el("input"); hora.value = it.hora || ""; hora.placeholder = "--:--"; hora.maxLength = 5;
    hora.oninput = () => { if (/^\d{1,2}:\d{2}$/.test(hora.value)) { it.hora = hora.value.padStart(5, "0"); depoisDeDigitar(); } };
    linha.append(el("span", "n", String(++n).padStart(3, "0")), lado, texto, hora, tirar);
    if (it.citacao) {
      const citado = el("div", "citado", `<span>${esc(it.citacao.autor || "citação")} · ${esc(it.citacao.texto)}</span>`);
      const semCitacao = el("button", "", "×"); semCitacao.title = "tirar a citação";
      semCitacao.onclick = () => { it.citacao = null; desenharRevisao(); aplicarRevisao(); };
      citado.append(semCitacao);
      linha.append(citado);
    }
    caixa.append(linha);
  });
}

async function aplicarRevisao({ manterPeriodo = true } = {}) {
  if (!itensLidos) return;
  const { paraMensagens } = await import("./ocr.js");
  const nomes = nomesInformados();
  nomes.dona = nomes.dona || "Eu";
  nomes.outros = nomes.outros.filter(n => n !== nomes.dona);
  const mensagens = paraMensagens(itensLidos.filter(i => i.tipo !== "msg" || i.texto.trim()), nomes);
  carregar(mensagens, { titulo: nomes.outros.length > 1 ? nomes.outros.join(", ") : "", eu: nomes.dona, manterPeriodo });
}
$("nomeDona").oninput = $("nomeContato").oninput = depoisDeDigitar;

// ---------- 05 · o prazo e o link ----------
function contarPrazos() {
  const agora = Date.now();
  document.querySelectorAll("#prazos .opcao").forEach(b => {
    b.querySelector("[data-quando]").textContent = `some ${quando(new Date(agora + +b.dataset.prazo * 1000))}`;
  });
}
document.querySelectorAll("#prazos .opcao").forEach(b => b.onclick = () => {
  prazo = +b.dataset.prazo;
  document.querySelectorAll("#prazos .opcao").forEach(x => x.classList.toggle("escolhida", x === b));
});

function nomesDaConversa() {
  const p = conversa.pessoas;
  return p.length <= 2 ? p.join(" e ") : `${p.slice(0, -1).join(", ")} e ${p[p.length - 1]}`;
}

$("criar").onclick = async () => {
  const botao = $("criar");
  botao.disabled = true; botao.textContent = "trancando a conversa";
  $("statusPrazo").textContent = "";
  try {
    const mensagens = numerar(visiveis());
    const criadoEm = Date.now();
    const pacote = { ...empacotar({ ...conversa, mensagens }), c: criadoEm };
    const { chave, texto: chaveTexto } = await novaChave();
    const dados = await trancar(chave, pacote);
    botao.textContent = "subindo trancada";
    const r = await fetch(`${API}/conversas`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ dados, prazo })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || "a gente não conseguiu guardar a conversa. tenta de novo daqui a pouco.");
    guardarDona(j.id, j.token);
    const leitura = `${pagina("c")}#${j.id}.${chaveTexto}`;
    const expira = new Date(j.expiraEm);
    $("linkLeitura").value = leitura;
    $("linkDona").value = `${leitura}.${j.token}`;
    const convite = `nem te conto. abre aí e me fala o que acha. o link some em ${nomeDoPrazo(prazo)}.\n${leitura}`;
    $("mandarWhats").href = `https://wa.me/?text=${encodeURIComponent(convite)}`;
    // abre o link de mandar: este navegador já lembra a senha, e o endereço copiado da barra não leva o poder de apagar
    $("abrirLink").href = leitura;
    $("expiraTexto").textContent = `a conversa saiu daqui trancada e some ${quando(expira)}.`;
    $("emprestimo").innerHTML = [
      ["conversa", nomesDaConversa()],
      ["emprestada em", curta(new Date(criadoEm))],
      ["devolver até", curta(expira)],
      ["quem pegou", "quem tiver o link"]
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("");
    $("ficha").classList.add("escondido");
    $("pronto").classList.remove("escondido");
    window.scrollTo(0, 0);
    clearInterval(relogioNoAr);
    const noAr = () => { $("avisoPrevia").textContent = `no ar · some em ${falta(j.expiraEm - Date.now())}`; };
    noAr(); relogioNoAr = setInterval(noAr, 30000);
  } catch (erro) {
    $("statusPrazo").textContent = erro.message;
  } finally {
    botao.textContent = "criar o link";
    botao.disabled = deExemplo;
  }
};

document.querySelectorAll("[data-copiar]").forEach(b => b.onclick = async () => {
  const campo = $(b.dataset.copiar);
  try { await navigator.clipboard.writeText(campo.value); } catch { campo.select(); document.execCommand("copy"); }
  b.textContent = "copiado"; setTimeout(() => b.textContent = "copiar", 1500);
});

$("baixar").onclick = () => baixarConversa(celular.htmlParaBaixar(), $("celular").querySelector("[data-titulo]").textContent);
$("outraConversa").onclick = () => { location.hash = "#montar"; location.reload(); };

// ---------- conversa de exemplo, inventada ----------
const exemplo = `[17/10/2026, 19:02:11] Rafa: oi, tá livre amanhã?
[17/10/2026, 19:05:40] Lu: tô sim! a gente ia no aniversário da Bia, lembra?
[17/10/2026, 19:40:02] Rafa: ah verdade
[17/10/2026, 19:41:15] Rafa: então, sobre isso
[17/10/2026, 19:41:50] Lu: ?
[18/10/2026, 11:18:03] Rafa: desculpa sumir ontem, fiquei sem bateria
[18/10/2026, 11:18:30] Rafa: acho que a gente precisa conversar
[18/10/2026, 11:20:12] Lu: pode falar
[18/10/2026, 11:34:44] Rafa: não é você, sou eu. tô numa fase de me encontrar
[18/10/2026, 11:35:20] Lu: você se encontrou no story da Carol ontem às 2 da manhã?
[18/10/2026, 11:52:09] Rafa: não é nada disso`;
conversa = montarConversa(lerTexto(exemplo), { titulo: "Rafa", eu: "Lu" });
celular.mostrar(conversa);
celular.comentarios([
  { sobre: 9, nome: "mari", texto: "sem bateria às 19:41 e online à 1h?", criadoEm: new Date(2026, 9, 18, 21, 40).getTime() },
  { sobre: 10, nome: "ana", audio: "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=", duracao: "0:14", criadoEm: new Date(2026, 9, 18, 21, 43).getTime() }
]);
$("criar").disabled = true;
vista();
