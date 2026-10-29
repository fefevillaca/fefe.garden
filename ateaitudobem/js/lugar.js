// Onde mora o cofre e como se fala de data.
//
// No ar, as páginas ficam em fefe.garden/ateaitudobem (GitHub Pages, só arquivos prontos) e o cofre,
// que guarda a conversa trancada e apaga no prazo, fica na Vercel. No computador, o servidor local
// responde as duas coisas no mesmo endereço.

const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
export const API = local ? `${location.origin}/api` : "https://ate-ai-tudo-bem.vercel.app/api";

// endereço de outra página do app, ao lado desta (c, sobre)
export const pagina = nome => new URL(nome, location.href.split("#")[0]).href;

const dois = n => String(n).padStart(2, "0");
const semana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const hora = d => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
export const curta = d => `${dois(d.getDate())}/${dois(d.getMonth() + 1)} · ${hora(d)}`;

// como se fala: "hoje às 22:47", "amanhã às 21:47", "sexta às 21:47", "terça que vem às 21:47"
export function quando(d, agora = new Date()) {
  const zero = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dias = Math.round((zero(d) - zero(agora)) / 864e5);
  if (dias === 0) return `hoje às ${hora(d)}`;
  if (dias === 1) return `amanhã às ${hora(d)}`;
  if (dias > 1 && dias < 7) return `${semana[d.getDay()]} às ${hora(d)}`;
  if (dias === 7) return `${semana[d.getDay()]} que vem às ${hora(d)}`;
  return `${d.getDate()} de ${meses[d.getMonth()]}, ${hora(d)}`;
}

// contador ao vivo: "23h 40min", "2 dias e 3h", "12min"
export function falta(ms) {
  const min = Math.max(1, Math.ceil(ms / 60000));
  const d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60), m = min % 60;
  if (d) return `${d} ${d === 1 ? "dia" : "dias"}${h ? ` e ${h}h` : ""}`;
  if (h) return `${h}h ${m}min`;
  return `${m}min`;
}

export const nomeDoPrazo = s => ({ 3600: "1 hora", 86400: "24 horas", 259200: "3 dias", 604800: "7 dias" })[s] || "";
