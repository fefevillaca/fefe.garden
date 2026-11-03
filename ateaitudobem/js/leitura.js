// Lê o texto que o WhatsApp gera quando a pessoa exporta a conversa ou copia mensagens.
//   exportar no iPhone:  [20/10/2026, 21:47:03] Nome: texto
//   exportar no Android: 20/10/2026 21:47 - Nome: texto
//   copiar e colar:      [21:47, 20/10/2026] Nome: texto

const exportada = /^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?)?\]?\s*(?:-\s)?(.*)$/;
const copiada = /^\[(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp]\.?\s?[Mm]\.?)?,\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]\s*(.*)$/;

export function limparTexto(bruto) {
  return bruto.replace(/\r/g, "")
    .replace(/[‎‏‪-‮﻿]/g, "")
    .replace(/[  ]/g, " ");
}

function quando(d, mes, a, h, min, s, ampm) {
  a = +a < 100 ? 2000 + +a : +a;
  h = +h;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return new Date(a, +mes - 1, +d, h, +min, +(s || 0));
}

export function lerTexto(bruto) {
  const saida = [];
  for (const linha of limparTexto(bruto).split("\n")) {
    let m, data, resto;
    if ((m = linha.match(copiada))) {
      const [, h, min, ampm, d, mes, a, r] = m;
      data = quando(d, mes, a, h, min, 0, ampm); resto = r;
    } else if ((m = linha.match(exportada))) {
      const [, d, mes, a, h, min, s, ampm, r] = m;
      data = quando(d, mes, a, h, min, s, ampm); resto = r;
    } else {
      if (saida.length && linha.trim() !== "") saida[saida.length - 1].texto += "\n" + linha;
      continue;
    }
    const pos = resto.indexOf(": ");
    if (pos > 0 && pos < 60) saida.push({ quando: data, autor: resto.slice(0, pos).trim(), texto: resto.slice(pos + 2), tipo: "msg" });
    else saida.push({ quando: data, autor: null, texto: resto, tipo: "sistema" });
  }
  // o aviso de criptografia do próprio WhatsApp não interessa aqui
  return numerar(saida.filter(m => !(m.tipo === "sistema" && /criptografia de ponta|end-to-end encrypted/i.test(m.texto))));
}

export const numerar = lista => lista.map((m, i) => ({ ...m, id: i + 1 }));

export const ehMidia = t => /^(<?m[ií]dia oculta>?|<media omitted>|imagem ocultada|[aá]udio ocultado|v[ií]deo ocultado|figurinha omitida|gif omitido|documento omitido|sticker omitted|image omitted|audio omitted|video omitted|<anexado:.*>|.*\(arquivo anexado\))$/i.test(t.trim());
export const ehApagada = t => /^(esta mensagem foi apagada|mensagem apagada|você apagou esta mensagem|this message was deleted)\.?$/i.test(t.trim());

// a conversa pronta para mostrar e guardar
// { titulo, eu, pessoas: [nomes], mensagens: [{ id, quando, autor, texto, tipo }] }
export function montarConversa(mensagens, { titulo = "", eu = null } = {}) {
  const conta = {};
  mensagens.forEach(m => { if (m.autor) conta[m.autor] = (conta[m.autor] || 0) + 1; });
  const pessoas = Object.keys(conta).sort((a, b) => conta[b] - conta[a]);
  if (!eu || !pessoas.includes(eu)) eu = pessoas.find(p => titulo && p !== titulo) || pessoas[1] || pessoas[0] || null;
  return { titulo, eu, pessoas, conta, mensagens };
}

export function tituloDoArquivo(nome) {
  const t = (nome || "").replace(/\.(txt|zip)$/i, "")
    .replace(/^(conversa do whatsapp com|whatsapp chat with|whatsapp chat -)\s*/i, "").trim();
  return t && !/^_?chat$/i.test(t) ? t : "";
}

// formato compacto que vai cifrado para o servidor
export function empacotar(conversa) {
  const { titulo, eu, pessoas, mensagens } = conversa;
  return {
    v: 1, titulo, eu, pessoas,
    m: mensagens.map(m => {
      const linha = [m.quando.getTime(), m.autor == null ? -1 : pessoas.indexOf(m.autor), m.texto];
      if (m.citacao) linha.push([m.citacao.autor || "", m.citacao.texto || ""]);
      return linha;
    })
  };
}

export function desempacotar(pacote) {
  const { titulo, eu, pessoas } = pacote;
  const mensagens = pacote.m.map(([t, a, texto, cit], i) => ({
    id: i + 1, quando: new Date(t), autor: a < 0 ? null : pessoas[a], texto, tipo: a < 0 ? "sistema" : "msg",
    ...(cit && { citacao: { autor: cit[0], texto: cit[1] } })
  }));
  return montarConversa(mensagens, { titulo, eu });
}
