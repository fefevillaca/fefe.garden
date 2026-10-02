// capa — os planetoides em órbita
//
// O modelo, em uma frase: existe um anel elíptico visto quase de cima, os
// cinco destinos moram nele em ângulos fixos, e o que gira é o anel inteiro.
// Quem estiver passando na frente está em foco.
//
// Três decisões que estão no código e não são óbvias lendo-o:
//
//   1. NADA SOME. O que a órbita faz é variar tamanho, nitidez e opacidade —
//      nunca esconder. É o que preserva a regra da capa ("um destino = um
//      ícone") dentro de um movimento de carrossel. Foi a ressalva escrita em
//      `planetoides.md`, e ela é atendida aqui pela geometria, não por um
//      compromisso: com 5 peças, a mais distante ainda ocupa ~120px de tela.
//
//   2. A DERIVA MORRE NA PRIMEIRA INTERAÇÃO, e não volta. Movimento
//      automático existe pra dizer "tem mais coisa aqui atrás"; assim que a
//      pessoa entende, ele vira alvo móvel debaixo do cursor. Voltar a derivar
//      depois de N segundos parados seria pior que nunca ter derivado.
//
//   3. A PEÇA NÃO GIRA EM TORNO DO PRÓPRIO EIXO. Seria bonito e está errado:
//      a luz está pintada na foto, vindo de cima. Girar a imagem gira a luz
//      junto, e cinco peças com luzes apontando pra lados diferentes deixam
//      de ser um sistema. O que substitui é o bob — flutuação vertical, que
//      não mexe na direção da luz.

const PECAS = window.PLANETOIDES || [];
const TAU = Math.PI * 2;
const N = PECAS.length;
const PASSO = TAU / N;

// deriva: uma volta inteira em ~2min20. cada peça leva ~28s pra atravessar a
// frente. mais rápido que isso vira esteira de fábrica.
const VELOCIDADE = 0.045;   // rad/s
// A inclinação da elipse não é enfeite: quem está no fundo tem |sin| pequeno e
// portanto cai PERTO do centro da tela — mais perto que as laterais. Sem subida
// em Y isso lê como "bolinha pequena no meio", não como "bola longe". O Y é o
// que resolve a ambiguidade, junto com o blur. O valor sai do tamanho da peça,
// dentro do `desenhar`.
const ARRASTO = 230;        // px de arraste que valem um destino

const parado = matchMedia("(prefers-reduced-motion: reduce)").matches;

const orbita = document.getElementById("orbita");
const campo = document.getElementById("campo");
const dica = document.getElementById("dica");
const legenda = document.getElementById("legenda");

let giro = 0;          // ângulo do anel, em rad
let alvo = null;       // null = derivando livre; número = indo pra lá
let indice = 0;        // qual destino está engatado (pode passar de N: conta voltas)
let foco = -1;
let arrastando = null;
let ultimo = 0;

// ─── montagem ──────────────────────────────────────────────────────────────

const nos = PECAS.map((p, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "planetoide";
  b.dataset.i = i;
  b.setAttribute("aria-label", `${p.rotulo} — ${p.destino}`);

  const corpo = document.createElement("span");
  corpo.className = "corpo";

  const img = document.createElement("img");
  img.src = p.arquivo;
  img.alt = "";
  img.draggable = false;

  // O corpo medido no preparar.py normaliza o enquadramento: sem isto, uma
  // peça que saiu do gerador 12% menor dentro do quadro entra na órbita 12%
  // menor, e a tela parece ter escalas erradas em vez de peças diferentes.
  //
  // `d` é o diâmetro do círculo de mesma área, e `cx/cy` o centro de massa —
  // não a caixa do alfa. Assim o botão inteiro passa a ser a bola: o rótulo,
  // que mora a meio botão do centro, encosta na borda dela em todas as peças.
  const c = p.corpo;
  const escala = 1 / c.d;                     // em múltiplos do lado do botão
  img.style.width = (escala * 100) + "%";
  img.style.left = (50 - c.cx * escala * 100) + "%";
  img.style.top = (50 - c.cy * escala * 100) + "%";

  const rot = document.createElement("span");
  rot.className = "rotulo";
  rot.textContent = p.rotulo;

  corpo.appendChild(img);
  b.appendChild(corpo);
  b.appendChild(rot);
  orbita.appendChild(b);
  return b;
});

// ─── o laço ────────────────────────────────────────────────────────────────

function raioX() {
  // o anel usa a largura que tem, guardando meia peça de margem dos dois
  // lados pra ninguém encostar na borda da tela.
  //
  // A medida sai do offsetWidth do botão, e não de `--base`: custom property
  // declarada com clamp() volta do getComputedStyle como a string "clamp(...)"
  // literal, não resolvida — parseFloat nela dá NaN e o transform inteiro
  // morre em silêncio, empilhando as cinco peças no centro.
  const base = nos[0].offsetWidth || 200;
  return Math.max(120, (orbita.clientWidth - base * 0.9) / 2);
}

function desenhar(t) {
  const rx = raioX();
  const base = nos[0].offsetWidth || 200;

  // A inclinação da elipse é medida em PEÇAS, não em pixels fixos: o que ela
  // precisa garantir é que quem está no fundo apareça ACIMA de quem está na
  // frente, em vez de espiar por trás. Quase meia peça de subida para cada
  // lado faz isso. O teto por rx é pra elipse não virar círculo em tela
  // estreita, onde ela ficaria vista de cima demais.
  //
  // Com número PAR de destinos sempre há alguém exatamente atrás do foco — é
  // onde isto mais importa. Com 5 dava pra viver sem; com 6 não.
  const ry = Math.min(base * 0.45, rx * 0.3);

  // A peça encolhe até caber no espaço que a órbita dá a ela.
  //
  // `--base` no CSS é um teto, não um tamanho: quem manda no tamanho real é a
  // distância entre dois vizinhos passando pela frente, que é rx * PASSO. Sem
  // esta conta, cada destino novo aperta a órbita — com 5 sobrava espaço, com 6
  // as bolas já se encostavam no celular, e com os 9 que o Notion tem alocados
  // viraria uma pilha. Agora entra destino sem ninguém remexer no CSS.
  const cabe = Math.min(1, (rx * PASSO * 0.85) / base);

  let melhor = 0, melhorCos = -2;

  for (let i = 0; i < N; i++) {
    const a = i * PASSO + giro;
    const cos = Math.cos(a);
    const d = (1 + cos) / 2;                  // 1 = na frente, 0 = no fundo
    const s = (0.38 + 0.62 * d) * cabe;

    // PERSPECTIVA: quem está longe fecha em direção ao centro da tela.
    //
    // Sem isto, a elipse é simétrica em x, e aí duas peças caem no MESMO x
    // sempre que o número de destinos é par — com 6, `sin(60°)` e `sin(120°)`
    // são idênticos, e as duas se empilham uma na frente da outra. Não é
    // colisão de layout que se resolve empurrando; é a projeção que estava
    // errada. Órbita vista de cima não é uma elipse chapada: o lado de trás
    // aparece mais estreito, porque está mais longe do olho.
    const persp = 1 / (1 + 0.55 * (1 - d));

    const x = -Math.sin(a) * rx * persp;      // o sinal é o que faz a frente
    const y = cos * ry;                       // andar da direita pra esquerda
    const bob = parado ? 0 : Math.sin(t * 0.0006 + i * 1.7) * 5 * s;

    const el = nos[i];
    el.style.transform = `translate(${x.toFixed(1)}px, ${(y + bob).toFixed(1)}px)`;
    el.style.setProperty("--s", s.toFixed(4));
    el.style.setProperty("--d", d.toFixed(4));
    el.style.zIndex = Math.round(d * 100);

    // Rótulo de quem está no fundo vai POR CIMA da própria peça. Quem está no
    // fundo está no alto da tela, então acima dele o campo está livre; abaixo
    // dele está justamente a peça grande da frente, que engolia o texto. A
    // troca acontece na lateral da órbita, onde a peça é pequena e ninguém
    // está lendo aquele rótulo.
    const atras = d < 0.5;
    if (atras !== (el.dataset.atras === "sim")) {
      el.dataset.atras = atras ? "sim" : "";
    }

    if (cos > melhorCos) { melhorCos = cos; melhor = i; }
  }

  if (melhor !== foco) {
    if (foco >= 0) nos[foco].removeAttribute("data-foco");
    foco = melhor;
    nos[foco].dataset.foco = "sim";
    // `legenda` pode não existir se o navegador estiver servindo um index.html
    // velho de cache. Um nó que falta não pode matar o laço de animação: sem
    // esta guarda, a exceção sobe pelo `desenhar`, o requestAnimationFrame do
    // fim do `laco` nunca é chamado, e a órbita CONGELA no meio do caminho —
    // peças espalhadas, meia transparência, sem erro visível na tela. Foi
    // exatamente isso que apareceu como "o site corrompeu".
    if (legenda) legenda.textContent = PECAS[foco].rotulo;
    const [r, g, b] = PECAS[foco].tom;
    document.documentElement.style.setProperty("--tom", `rgb(${r} ${g} ${b})`);
  }
}

function laco(t) {
  const dt = Math.min(0.05, (t - ultimo) / 1000) || 0;
  ultimo = t;

  if (alvo === null) {
    if (!parado) giro -= VELOCIDADE * dt;
  } else if (!arrastando) {
    // aproximação exponencial: chega rápido e encosta devagar, sem overshoot
    giro += (alvo - giro) * (1 - Math.exp(-dt * 7));
  }

  // O rAF é reagendado ANTES de desenhar, e o desenho vai num try. Um erro
  // dentro do quadro fica sendo um erro no console — não o fim da animação.
  // Laço que morre por exceção deixa a tela num estado meio-montado que não
  // parece bug de código, parece arquivo corrompido.
  requestAnimationFrame(laco);
  try {
    desenhar(t);
  } catch (e) {
    console.error("quadro perdido:", e);
  }
}

// ─── interação ─────────────────────────────────────────────────────────────

function engatar() {
  // sai da deriva sem pulo: adota como destino aquele que já estava mais perto
  if (alvo === null) {
    indice = Math.round(-giro / PASSO);
    alvo = -indice * PASSO;
    dica.hidden = true;
  }
}

function ir(passos) {
  engatar();
  indice += passos;
  alvo = -indice * PASSO;
}

function irPara(i) {
  engatar();
  // escolhe a volta mais curta até aquele destino, em vez do índice absoluto
  const atual = ((indice % N) + N) % N;
  let delta = i - atual;
  if (delta > N / 2) delta -= N;
  if (delta < -N / 2) delta += N;
  ir(delta);
}

// As páginas que já estão no ar. Destino fora daqui ainda só avisa. Quando
// todas existirem, isto some e cada planetoide pode nascer como <a href>, que
// é o certo pra link (abrir em nova aba, colar, indexar).
const NO_AR = new Set(["/who-am-i", "/what-i-do", "/notes"]);

function entrar(i) {
  const p = PECAS[i];
  if (NO_AR.has(p.destino)) { location.href = p.destino + "/"; return; }
  dica.hidden = false;
  dica.textContent = `→ ${p.destino} — coming soon`;
  clearTimeout(entrar._t);
  entrar._t = setTimeout(() => { dica.textContent = ""; }, 2200);
}

nos.forEach((el, i) => {
  // O lateral está pequeno, desfocado e em movimento — clicar nele por engano
  // levaria pra página errada. Então lateral CENTRALIZA e o do centro ENTRA.
  // A regra não precisa ser explicada: a nitidez já a ensina.
  el.addEventListener("click", () => (i === foco ? entrar(i) : irPara(i)));
  // Tab tem que arrastar a órbita junto, senão o foco do teclado fica num
  // botão que a pessoa não está vendo
  el.addEventListener("focus", () => { if (i !== foco) irPara(i); });
});

addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") { ir(1); e.preventDefault(); }
  else if (e.key === "ArrowLeft") { ir(-1); e.preventDefault(); }
  else if (e.key === "Home") { engatar(); indice = 0; alvo = 0; e.preventDefault(); }
});

let rodaEm = 0;
addEventListener("wheel", (e) => {
  const agora = performance.now();
  if (agora - rodaEm < 200) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(d) < 4) return;
  rodaEm = agora;
  ir(d > 0 ? 1 : -1);
}, { passive: true });

campo.addEventListener("pointerdown", (e) => {
  engatar();
  arrastando = { x: e.clientX, giro0: giro, moveu: false };
  campo.classList.add("arrastando");
});

campo.addEventListener("pointermove", (e) => {
  if (!arrastando) return;
  const dx = e.clientX - arrastando.x;
  if (Math.abs(dx) > 3 && !arrastando.moveu) {
    arrastando.moveu = true;
    // A captura só entra DEPOIS que virou arraste de verdade. Capturar já no
    // pointerdown parece inofensivo e não é: com o ponteiro capturado, o
    // navegador dispara o `click` no elemento que capturou — o campo — e não
    // no planetoide. O clique simplesmente parava de existir, sem erro nenhum
    // no console.
    campo.setPointerCapture(e.pointerId);
  }
  giro = arrastando.giro0 + (dx / ARRASTO) * PASSO;
});

function soltar(e) {
  if (!arrastando) return;
  const moveu = arrastando.moveu;
  arrastando = null;
  campo.classList.remove("arrastando");
  if (e && e.pointerId != null) {
    try { campo.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  indice = Math.round(-giro / PASSO);   // encosta no destino mais próximo
  alvo = -indice * PASSO;
  // arraste que virou clique não deve disparar navegação
  if (moveu) nos.forEach((n) => (n.style.pointerEvents = "none"));
  setTimeout(() => nos.forEach((n) => (n.style.pointerEvents = "")), 0);
}
campo.addEventListener("pointerup", soltar);
campo.addEventListener("pointercancel", soltar);

requestAnimationFrame((t) => { ultimo = t; laco(t); });
