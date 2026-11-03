// Lembretes deste navegador: o nome no grupo e o poder de apagar os links que você criou.
// Se o navegador bloquear o armazenamento, tudo continua funcionando, só não lembra.

export function ler(chave) {
  try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
}
export function guardar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {}
}

export const lerNome = () => ler("nome") || "";
export const guardarNome = nome => guardar("nome", nome);

export function guardarDona(id, token) {
  const donas = ler("donas") || {};
  donas[id] = token;
  guardar("donas", donas);
}
export const lerDona = id => (ler("donas") || {})[id] || null;

export function baixar(conteudo, nome, tipo = "text/html;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export const fatia = t => (t || "conversa").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "conversa";

// a conversa vira um arquivo .html que abre sozinho, sem internet, com os comentários e áudios dentro
export async function baixarConversa(htmlCelular, titulo) {
  const css = await fetch(new URL("estilo.css", document.baseURI)).then(r => r.text());
  const agora = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const quando = `${agora.getDate()} de ${meses[agora.getMonth()]}, ${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  const seguro = String(titulo).replace(/[<>&"]/g, "");
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${seguro} · até aí tudo bem</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=Courier+Prime&family=Instrument+Serif&family=Inter:wght@400;600&display=swap">
<style>${css}
.copia { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 16px; }
.copia p { font: 12px/1.5 var(--maquina); color: var(--suave); margin: 0; text-align: center; max-width: 420px; }</style></head>
<body><div class="copia"><p>cópia baixada em ${quando}. este arquivo fica só com quem baixou e não some no prazo.</p>
${htmlCelular}</div></body></html>`;
  baixar(html, `conversa-${fatia(titulo)}.html`);
}
