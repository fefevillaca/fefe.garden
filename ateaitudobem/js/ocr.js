// Lê prints e vídeos da tela do WhatsApp no próprio navegador.
// O leitor de texto (Tesseract) vem do jsDelivr na primeira vez. As imagens nunca saem do aparelho.
//
// Como uma tela vira conversa:
//   1. o papel de parede é a cor mais comum na borda esquerda. O que não é papel, em faixa comprida,
//      é balão, e cada balão ocupa uma faixa de linhas só dele, porque o WhatsApp nunca põe dois
//      balões lado a lado;
//   2. o balão verde encostado à direita é de quem gravou, o encostado à esquerda é do outro lado e o
//      centralizado é separador de dia ou aviso;
//   3. no vídeo, cada quadro é comparado com o anterior para saber quanto a conversa rolou. Assim
//      cada balão ganha um lugar fixo na conversa e é lido uma vez só, no quadro em que aparece
//      inteiro e mais parado;
//   4. cada balão é recortado, ampliado e passado para preto e branco com o contraste da cor dele.
//      A resposta citada no alto do balão é lida separada;
//   5. os nomes informados antes da leitura decidem de quem é cada citação e, em grupo, cada balão.

const TESSERACT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

function carregarScript(src) {
  return new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => falha(new Error("o leitor de texto não baixou. confere a internet e tenta de novo."));
    document.head.append(s);
  });
}

let leitores = null;
async function preparar(aviso) {
  if (leitores) return leitores;
  if (!window.Tesseract) { aviso("baixando o leitor de texto, só na primeira vez."); await carregarScript(TESSERACT); }
  aviso("preparando o leitor de texto.");
  const n = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
  const agendador = Tesseract.createScheduler();
  const trabalhadores = await Promise.all(Array.from({ length: n }, async () => {
    const t = await Tesseract.createWorker("por");
    // cada recorte é um balão: um bloco de texto só
    await t.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    return t;
  }));
  trabalhadores.forEach(t => agendador.addWorker(t));
  // o horário do canto é lido por um leitor que só conhece números e dois pontos
  const relogio = await Tesseract.createWorker("por");
  await relogio.setParameters({ tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789:" });
  leitores = { agendador, relogio, n };
  return leitores;
}

// ---------- cor ----------
const luzDe = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;
const ehVerde = (r, g, b) => g - r > 18 && g - b > 6 && g > 40;  // #d9fdd3, #dcf8c6, #005c4b, #1a4033
const distancia3 = (d, i, c) => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]);
const mediana = v => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

function corMaisComum(d, W, x0, x1, y0, y1, passo = 1) {
  const conta = new Map();
  for (let y = y0; y < y1; y += passo) for (let x = x0; x < x1; x += passo) {
    const i = (y * W + x) * 4;
    const k = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    const e = conta.get(k) || [0, 0, 0, 0];
    e[0] += d[i]; e[1] += d[i + 1]; e[2] += d[i + 2]; e[3]++;
    conta.set(k, e);
  }
  let m = [255, 255, 255, 1];
  for (const e of conta.values()) if (e[3] > m[3]) m = e;
  return [m[0] / m[3], m[1] / m[3], m[2] / m[3]];
}

// ---------- a tela: papel de parede, topo e barra de baixo ----------
const TOLERANCIA_PAPEL = 24;

// Papel de parede de foto (céu, gente, textura) não tem cor dominante. Aí vale o contrário: o balão
// é que tem cor lisa, com borda nítida, e a foto quase nunca. As cores dos balões são achadas nas
// corridas longas de cor parada que começam e terminam num salto de cor (a borda do balão ou uma letra).
function coresDeBalao(px, W, topo, base) {
  const conta = new Map();
  let total = 0;
  const passo = Math.max(1, Math.round((base - topo) / 400));
  const minimo = Math.max(12, Math.round(W * 0.05));
  for (let y = topo; y < base; y += passo) {
    let x = 1;
    while (x < W - 1) {
      const i0 = (y * W + x) * 4;
      let r = px[i0], g = px[i0 + 1], b = px[i0 + 2], n = 1, fim = x + 1;
      for (; fim < W - 1; fim++) {
        const i = (y * W + fim) * 4, j = i - 4;
        const media = [r / n, g / n, b / n];
        // a compressão do whatsapp deixa um chuvisco de poucos tons dentro do balão liso
        if (distancia3(px, i, media) > 22 || distancia3(px, i, [px[j], px[j + 1], px[j + 2]]) > 14) break;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      if (n >= minimo) {
        const media = [r / n, g / n, b / n];
        const antes = distancia3(px, (y * W + x - 1) * 4, media), depois = distancia3(px, (y * W + fim) * 4, media);
        if (antes >= 30 && depois >= 30) {
          const k = (media[0] >> 3) << 10 | (media[1] >> 3) << 5 | (media[2] >> 3);
          const e = conta.get(k) || [0, 0, 0, 0];
          e[0] += media[0] * n; e[1] += media[1] * n; e[2] += media[2] * n; e[3] += n;
          conta.set(k, e); total += n;
        }
      }
      x = fim;
    }
  }
  const cores = [];
  // cor da foto que por acaso forma faixa lisa fica de fora: ela não tem o desenho de balão
  for (const e of [...conta.values()].sort((a, c) => c[3] - a[3])) {
    if (e[3] < total * 0.02 || cores.length >= 5) break;
    const cor = [e[0] / e[3], e[1] / e[3], e[2] / e[3]];
    if (cores.some(c => Math.abs(c[0] - cor[0]) + Math.abs(c[1] - cor[1]) + Math.abs(c[2] - cor[2]) < 18)) continue;
    if (temDesenhoDeBalao(px, W, topo, base, cor)) cores.push(cor);
  }
  return cores;
}

// O balão do outro lado começa sempre na mesma margem esquerda, o de quem tem o celular termina na
// mesma margem direita, e o separador de dia fica no meio. Cor de foto não respeita essas margens.
function temDesenhoDeBalao(px, W, topo, base, cor) {
  const igual = (x, y) => distancia3(px, (y * W + x) * 4, cor) < 26;
  let comCor = 0, desenho = 0, borda = 0;
  const passo = Math.max(1, Math.round((base - topo) / 300));
  for (let y = topo; y < base; y += passo) {
    let ini = -1, fim = -1, n = 0;
    for (let x = 0; x < W; x++) if (igual(x, y)) { n++; if (ini < 0) ini = x; fim = x; }
    if (n < W * 0.05) continue;
    comCor++;
    if (ini < W * 0.008 || fim > W * 0.992) borda++;
    const esquerda = ini > W * 0.012 && ini < W * 0.045 && !igual(ini - 1 - Math.round(W * 0.004), y);
    const direita = fim > W * 0.955 && fim < W * 0.99 && !igual(Math.min(W - 1, fim + 1 + Math.round(W * 0.004)), y);
    const meio = Math.abs(ini + fim - W) < W * 0.03 && fim - ini < W * 0.6;
    if (esquerda || direita || meio) desenho++;
  }
  // balão nunca encosta na borda da tela; foto encosta quase sempre
  return desenho >= 3 && desenho >= comCor * 0.25 && borda < desenho;
}

function lerTela(px, W, H) {
  const x = Math.max(1, Math.round(W * 0.012));
  const papel = corMaisComum(px, W, x, x + 1, Math.round(H * 0.25), Math.round(H * 0.8), 1);
  const naBorda = y => distancia3(px, (y * W + x) * 4, papel) < TOLERANCIA_PAPEL;
  // Papel liso é a mesma cor nas duas bordas, de cima a baixo. Se uma das bordas varia, ou se as
  // duas não batem (a foto tem uma parede lisa de um lado só), o papel é foto
  const xd = W - 1 - x;
  const papelDireita = corMaisComum(px, W, xd, xd + 1, Math.round(H * 0.25), Math.round(H * 0.8), 1);
  let liso = 0, lisoDireita = 0, vistos = 0;
  for (let y = Math.round(H * 0.25); y < H * 0.8; y += 2) {
    vistos++;
    if (naBorda(y)) liso++;
    if (distancia3(px, (y * W + xd) * 4, papelDireita) < TOLERANCIA_PAPEL) lisoDireita++;
  }
  const foto = liso < vistos * 0.6 || lisoDireita < vistos * 0.6 ||
    Math.abs(papel[0] - papelDireita[0]) + Math.abs(papel[1] - papelDireita[1]) + Math.abs(papel[2] - papelDireita[2]) > TOLERANCIA_PAPEL;
  let topo = 0, base = H;
  for (let y = 0, n = 0; y < H * 0.25; y++) { n = naBorda(y) ? n + 1 : 0; if (n === 8) { topo = y - 7; break; } }
  for (let y = H - 1, n = 0; y > H * 0.7; y--) { n = naBorda(y) ? n + 1 : 0; if (n === 8) { base = y + 8; break; } }
  if (topo < H * 0.02) topo = 0;
  // tela cheia tem sempre o topo com o nome e a barra de digitar. No iPhone novo eles são
  // translúcidos e quase da cor do papel, então vale a altura de costume
  if (H / W > 1.7) { topo = Math.max(topo, Math.round(H * 0.1)); base = Math.min(base, Math.round(H * 0.915)); }
  if (!foto) return { papel, escuro: luzDe(...papel) < 90, topo, base };
  // na foto, a cor da borda não diz onde a conversa começa; vale a altura de costume das barras
  if (H / W > 1.7) { topo = Math.round(H * 0.1); base = Math.round(H * 0.915); } else { topo = 0; base = H; }
  const baloes = coresDeBalao(px, W, topo, base);
  const cinza = baloes.find(c => !ehVerde(...c)) || papel;
  return { papel, foto: true, baloes, escuro: luzDe(...cinza) < 90, topo, base };
}

// ---------- os balões de uma tela ----------
function acharBlocos(px, W, H, tela) {
  const { papel, topo, base } = tela;
  // no papel liso, balão é o que foge da cor do papel; no papel de foto, é o que tem a cor de um balão
  const pertoDeBalao = i => { let m = 999; for (const c of tela.baloes) m = Math.min(m, distancia3(px, i, c)); return m; };
  const ehBalao = tela.foto ? i => pertoDeBalao(i) < 22 : i => distancia3(px, i, papel) >= TOLERANCIA_PAPEL;
  const forcaDe = tela.foto ? i => 60 - Math.min(pertoDeBalao(i), 60) : i => Math.min(distancia3(px, i, papel), 60);
  const corridaMinima = Math.max(6, Math.round(W * 0.025));
  // Balão é região cheia; o desenho do papel de parede e o ruído da compressão são pontos soltos.
  // Cada ponto conta como balão quando quase toda a vizinhança dele (15 × 3) foge da cor do papel.
  // A janela é baixa para não atravessar a fresta de dois pixels entre um balão e outro.
  const alto = base - topo;
  const integral = new Uint32Array((W + 1) * (alto + 1));
  const marca = new Uint8Array(W);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < W; x++) marca[x] = ehBalao(((y + topo) * W + x) * 4) ? 1 : 0;
    // No papel de foto, a letra e a resposta citada não têm a cor do balão. Como o WhatsApp nunca
    // põe dois balões lado a lado, o que fica entre dois pedaços de cor de balão na mesma linha é
    // de dentro do balão
    if (tela.foto) {
      // pedaço de cor de balão que encosta na borda da tela é foto
      const beira = Math.max(2, Math.round(W * 0.008));
      for (let s = 0; s <= beira; s++) if (marca[s]) { for (let x = s; x < W && marca[x]; x++) marca[x] = 0; break; }
      for (let s = W - 1; s >= W - 1 - beira; s--) if (marca[s]) { for (let x = s; x >= 0 && marca[x]; x--) marca[x] = 0; break; }
      let ultimoFim = -1;
      for (let x = 0; x < W;) {
        if (!marca[x]) { x++; continue; }
        let f = x; while (f < W && marca[f]) f++;
        if (f - x >= 4) {
          if (ultimoFim >= 0 && x - ultimoFim < W * 0.8) marca.fill(1, ultimoFim, x);
          ultimoFim = f;
        }
        x = f;
      }
    }
    let linha = 0;
    for (let x = 0; x < W; x++) {
      linha += marca[x];
      integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + linha;
    }
  }
  const rx = Math.max(3, Math.round(W * 0.02)), ry = 1;
  const cheio = (x, y) => {
    const xa = Math.max(0, x - rx), xb = Math.min(W, x + rx + 1), ya = Math.max(0, y - ry), yb = Math.min(alto, y + ry + 1);
    const soma = integral[yb * (W + 1) + xb] - integral[ya * (W + 1) + xb] - integral[yb * (W + 1) + xa] + integral[ya * (W + 1) + xa];
    return soma >= (xb - xa) * (yb - ya) * 0.6;
  };
  const linhas = [];
  for (let y = 0; y < alto; y++) {
    let cont = 0, verde = 0, forca = 0, primeiro = -1, ultimo = -1;
    let corrida = 0, corridaVerde = 0, corridaForca = 0, inicio = 0;
    for (let x = 0; x <= W; x++) {
      if (x < W && cheio(x, y)) {
        const i = ((y + topo) * W + x) * 4;
        if (!corrida) inicio = x;
        corrida++; corridaForca += forcaDe(i);
        if (ehVerde(px[i], px[i + 1], px[i + 2])) corridaVerde++;
      } else if (corrida) {
        if (corrida >= corridaMinima) {
          cont += corrida; verde += corridaVerde; forca += corridaForca;
          if (primeiro < 0) primeiro = inicio;
          ultimo = x - 1;
        }
        corrida = corridaVerde = corridaForca = 0;
      }
    }
    linhas.push({ cont, verde, forca: cont ? forca / cont : 0, primeiro, ultimo });
  }

  acharBlocos.linhas = linhas; // para conferência à mão
  const faixas = [];
  let atual = null;
  // Balão é retângulo: de uma linha para a outra a largura só muda devagar, nos cantos. Um salto
  // grande é outro balão colado, ou um pedaço de foto da mesma cor encostado no balão
  const salto = W * 0.06;
  linhas.forEach((l, k) => {
    const cheia = l.cont >= W * 0.045;
    const ant = linhas[k - 1];
    if (cheia && atual && tela.foto && (Math.abs(l.primeiro - ant.primeiro) > salto || Math.abs(l.ultimo - ant.ultimo) > salto)) {
      faixas.push(atual); atual = null;
    }
    if (cheia) { if (atual) atual.fim = k; else atual = { ini: k, fim: k }; }
    else if (atual) { faixas.push(atual); atual = null; }
  });
  if (atual) faixas.push(atual);

  // Dois balões colados, com a fresta borrada pela compressão: na fresta a força cai e a largura
  // encolhe, porque os cantos do balão são arredondados. Linha de texto pode perder força, mas
  // mantém a largura inteira, então só as duas coisas juntas cortam.
  const separadas = [];
  const maior = (a, b, campo) => { let m = 0; for (let j = a; j <= b; j++) m = Math.max(m, linhas[j][campo]); return m; };
  for (const f of faixas) {
    const cortes = [];
    let grupo = null;
    for (let k = f.ini + 3; k <= f.fim - 3; k++) {
      const a0 = Math.max(f.ini, k - 8), a1 = k - 3, d0 = k + 3, d1 = Math.min(f.fim, k + 8);
      const l = linhas[k];
      const forca = Math.min(maior(a0, a1, "forca"), maior(d0, d1, "forca"));
      const largura = Math.min(maior(a0, a1, "cont"), maior(d0, d1, "cont"));
      if (l.forca < forca * 0.75 && l.cont < largura * 0.92) {
        if (!grupo || k > grupo.fim + 1) { grupo = { fim: k, melhor: k }; cortes.push(grupo); }
        grupo.fim = k;
        if (l.forca < linhas[grupo.melhor].forca) grupo.melhor = k;
      }
    }
    let ini = f.ini;
    for (const c of cortes) {
      if (c.melhor - ini >= 4 && f.fim - c.melhor >= 4) { separadas.push({ ini, fim: c.melhor - 1 }); ini = c.melhor + 1; }
    }
    separadas.push({ ini, fim: f.fim });
  }

  const blocos = [];
  for (const f of separadas) {
    const y0 = topo + f.ini, y1 = topo + f.fim + 1, h = y1 - y0;
    if (h < Math.max(8, H * 0.011)) continue;
    const meio = linhas.slice(f.ini + Math.floor((f.fim - f.ini) * 0.25), f.fim - Math.floor((f.fim - f.ini) * 0.25) + 1).filter(l => l.primeiro >= 0);
    if (!meio.length) continue;
    const x0 = mediana(meio.map(l => l.primeiro)), x1 = mediana(meio.map(l => l.ultimo)) + 1, w = x1 - x0;
    // o separador "Hoje" é estreito; balão de conversa nunca é tão estreito assim
    const centrado = Math.abs((x0 + x1) / 2 - W / 2) < W * 0.07;
    if (w < W * (centrado ? 0.05 : 0.1)) continue;
    if (tela.foto && (x0 < W * 0.008 || x1 > W * 0.992)) continue;
    let cont = 0, verde = 0;
    for (let k = f.ini; k <= f.fim; k++) { cont += linhas[k].cont; verde += linhas[k].verde; }
    const fracVerde = verde / Math.max(1, cont), centro = (x0 + x1) / 2;
    let tipo = null;
    if (fracVerde > 0.3 && x1 > W * 0.85) tipo = "eu";
    else if (x0 > W * 0.12 && Math.abs(centro - W / 2) < W * 0.07 && w < W * 0.8) tipo = "aviso";
    else if (x0 < W * 0.09 && fracVerde < 0.3) tipo = "outro";
    if (tipo) blocos.push({ y0, y1, x0, x1, tipo });
  }
  return blocos;
}

// ---------- quanto a conversa rolou de um quadro para o outro ----------
const FAIXAS = 24;
function assinatura(px, W, H) {
  const f = new Float32Array(H * FAIXAS);
  const larg = W / FAIXAS;
  for (let y = 0; y < H; y++) {
    for (let b = 0; b < FAIXAS; b++) {
      let s = 0, n = 0;
      for (let x = Math.floor(b * larg); x < Math.floor((b + 1) * larg); x += 2) {
        const i = (y * W + x) * 4; s += luzDe(px[i], px[i + 1], px[i + 2]); n++;
      }
      f[y * FAIXAS + b] = s / n;
    }
  }
  return f;
}

// a linha y do quadro novo mostra o que estava na linha y + s do anterior
function deslocamento(a, b, H, palpite) {
  const lo = Math.max(a.tela.topo, b.tela.topo), hi = Math.min(a.tela.base, b.tela.base);
  const alt = hi - lo;
  if (alt < 40) return null;
  const limite = Math.floor(alt * 0.8);
  const passo = Math.max(1, Math.round(H / 420));
  const custo = (s, pulo) => {
    const y0 = Math.max(lo, lo - s), y1 = Math.min(hi, hi - s);
    if (y1 - y0 < alt * 0.25) return Infinity;
    let soma = 0, n = 0;
    for (let y = y0; y < y1; y += pulo) {
      const ia = (y + s) * FAIXAS, ib = y * FAIXAS;
      for (let k = 0; k < FAIXAS; k++) soma += Math.abs(a.f[ia + k] - b.f[ib + k]);
      n++;
    }
    return soma / (n * FAIXAS);
  };
  let melhor = 0, menor = Infinity;
  const todos = [];
  for (let s = -limite; s <= limite; s += passo) {
    // quando a tela é quase toda papel, vários encaixes empatam; vale o mais perto do anterior
    const c = custo(s, passo * 2) + Math.abs(s - palpite) / alt * 0.6;
    todos.push(c);
    if (c < menor) { menor = c; melhor = s; }
  }
  let fino = melhor; menor = Infinity;
  for (let s = melhor - passo; s <= melhor + passo; s++) {
    const c = custo(s, 1);
    if (c < menor) { menor = c; fino = s; }
  }
  const tipico = mediana(todos.filter(isFinite));
  return menor < 10 && menor < tipico * 0.55 ? fino : null;
}

// Os balões inteiros dos dois quadros votam no encaixe: um balão com a mesma altura, largura e lado
// nos dois quadros diz quanto a conversa subiu. O formato dos balões quase não se repete, então o
// voto acerta mesmo quando a tela tem pouca textura. A assinatura das linhas só refina o número.
function deslocamentoPorBaloes(a, b, H) {
  const tol = Math.max(3, Math.round(H * 0.005));
  const inteiros = q => q.blocos.filter(x => x.y0 > q.tela.topo + 2 && x.y1 < q.tela.base - 2);
  const A = inteiros(a), B = inteiros(b);
  const votos = [];
  for (const p of A) for (const q of B) {
    if (p.tipo !== q.tipo) continue;
    if (Math.abs((p.y1 - p.y0) - (q.y1 - q.y0)) > tol) continue;
    if (Math.abs(p.x0 - q.x0) > tol * 2 || Math.abs(p.x1 - q.x1) > tol * 2) continue;
    const s = p.y0 - q.y0;
    const grupo = votos.find(v => Math.abs(v.s - s) <= tol);
    if (grupo) { grupo.n++; grupo.soma += s; } else votos.push({ s, n: 1, soma: s });
  }
  votos.sort((x, y) => y.n - x.n);
  if (!votos.length) return null;
  if (votos[1] && votos[1].n === votos[0].n) return null; // empate: deixa para a textura
  if (votos[0].n < 2 && Math.min(A.length, B.length) > 1) return null;
  const centro = Math.round(votos[0].soma / votos[0].n);
  // refina pela assinatura das linhas, perto do que os balões disseram
  const lo = Math.max(a.tela.topo, b.tela.topo), hi = Math.min(a.tela.base, b.tela.base);
  let melhor = centro, menor = Infinity;
  for (let s = centro - tol; s <= centro + tol; s++) {
    const y0 = Math.max(lo, lo - s), y1 = Math.min(hi, hi - s);
    if (y1 - y0 < 20) continue;
    let soma = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      const ia = (y + s) * FAIXAS, ib = y * FAIXAS;
      for (let k = 0; k < FAIXAS; k++) soma += Math.abs(a.f[ia + k] - b.f[ib + k]);
      n++;
    }
    if (soma / n < menor) { menor = soma / n; melhor = s; }
  }
  return melhor;
}

// ---------- percorre os quadros e guarda cada balão uma vez ----------
function recortar(tela, b, W, H, info) {
  const m = 3;
  const x0 = Math.max(0, b.x0 - m), y0 = Math.max(0, b.y0 - m);
  const x1 = Math.min(W, b.x1 + m), y1 = Math.min(H, b.y1 + m);
  const c = document.createElement("canvas");
  c.width = x1 - x0; c.height = y1 - y0;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(tela, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  if (info?.foto) taparFoto(ctx, c.width, c.height, info.baloes);
  return c;
}

// No papel de foto, o que sobra da foto em volta do balão (a margem e os cantos arredondados) vira
// letra torta na leitura. Cada linha é pintada com a cor do balão, de fora para dentro, até a borda dele.
function taparFoto(ctx, w, h, cores) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const perto = i => { let m = 999, k = 0; cores.forEach((c, j) => { const v = distancia3(d, i, c); if (v < m) { m = v; k = j; } }); return [m, k]; };
  const votos = cores.map(() => 0);
  for (let y = Math.floor(h * 0.3); y < h * 0.7; y += 2) for (let x = 0; x < w; x += 3) { const [v, k] = perto((y * w + x) * 4); if (v < 22) votos[k]++; }
  const cor = cores[votos.indexOf(Math.max(...votos))];
  if (!cor) return;
  const pintar = i => { d[i] = cor[0]; d[i + 1] = cor[1]; d[i + 2] = cor[2]; };
  for (let y = 0; y < h; y++) {
    let x = 0;
    for (; x < w && perto((y * w + x) * 4)[0] >= 22; x++) pintar((y * w + x) * 4);
    if (x >= w) continue;
    for (let z = w - 1; z > x && perto((y * w + z) * 4)[0] >= 22; z--) pintar((y * w + z) * 4);
  }
  ctx.putImageData(img, 0, 0);
}

async function percorrer(proximo, { quadrosMinimos = 1 } = {}) {
  const baloes = [];
  const quadrosPorTrecho = new Map();
  let anterior = null, pos = 0, palpite = 0, segmento = 0, fundo = 0, viuConversa = false;
  for (;;) {
    const quadro = await proximo();
    if (!quadro) break;
    const { tela } = quadro;
    // vídeo novo começa trecho novo: o encaixe com o anterior fica para a junção por texto
    if (quadro.quebra) anterior = null;
    const W = tela.width, H = tela.height;
    const px = tela.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const info = lerTela(px, W, H);
    const blocos = acharBlocos(px, W, H, info);
    // quadro sem balão nenhum (Central de Controle, outro app, a transição) fica de fora
    if (!blocos.some(b => b.tipo !== "aviso")) { anterior = null; continue; }
    const atual = { f: assinatura(px, W, H), tela: info, W, H, blocos };
    let s = null;
    if (anterior && anterior.W === W && anterior.H === H) {
      s = deslocamentoPorBaloes(anterior, atual, H);
      if (s == null) s = deslocamento(anterior, atual, H, palpite);
    }
    if (s != null) { pos += s; palpite = s; }
    else if (viuConversa) { segmento++; pos = fundo + H * 3; palpite = 0; }
    depuracao.registro?.push({ s, pos, segmento, blocos: blocos.length });
    anterior = atual; viuConversa = true;
    quadrosPorTrecho.set(segmento, (quadrosPorTrecho.get(segmento) || 0) + 1);

    const regiao = info.base - info.topo;
    const tolY = Math.max(8, H * 0.012), tolH = Math.max(5, H * 0.01);
    for (const b of blocos) {
      fundo = Math.max(fundo, pos + b.y1);
      if (b.y0 <= info.topo + 2 || b.y1 >= info.base - 2) continue; // cortado pela borda
      const noTopo = b.y0 < info.topo + regiao * 0.1;
      const A0 = pos + b.y0, h = b.y1 - b.y0;
      // nota baixa é melhor: quadro parado, longe do topo (separador flutuante) e do pé (botão de descer)
      const nota = Math.abs(s ?? 0) + (noTopo ? 40 : 0) + (b.y1 > info.topo + regiao * 0.86 ? 25 : 0);
      const igual = baloes.find(e => e.segmento === segmento && e.tipo === b.tipo && Math.abs(e.A0 - A0) <= tolY && Math.abs(e.h - h) <= tolH);
      if (!igual) {
        baloes.push({ segmento, A0, h, tipo: b.tipo, foto: !!info.foto, vezes: 1, larguraTela: W, alturaTela: H, yMin: b.y0, yMax: b.y0, foraDoTopo: !noTopo, instancias: [{ recorte: recortar(tela, b, W, H, info), nota, y: b.y0 }] });
        continue;
      }
      // guarda até três versões, de lugares diferentes da tela, para ler a melhor
      igual.vezes++;
      igual.yMin = Math.min(igual.yMin, b.y0); igual.yMax = Math.max(igual.yMax, b.y0);
      if (!noTopo) igual.foraDoTopo = true;
      const perto = igual.instancias.find(i => Math.abs(i.y - b.y0) < 8);
      if (perto) {
        if (perto.nota <= nota) continue;
        Object.assign(perto, { recorte: recortar(tela, b, W, H, info), nota });
      } else {
        igual.instancias.push({ recorte: recortar(tela, b, W, H, info), nota, y: b.y0 });
      }
      igual.instancias.sort((x, y) => x.nota - y.nota);
      igual.instancias.length = Math.min(igual.instancias.length, 3);
    }
  }
  // Na conversa, dois balões nunca dividem a mesma altura. Quando dois registros se sobrepõem, um
  // deles é pedaço passageiro (o separador flutuante cortou o balão naquele quadro) e fica o que
  // apareceu em mais quadros. No vídeo, trecho de poucos quadros é a entrada ou a saída da conversa.
  const aceitos = [];
  for (const b of [...baloes].sort((a, c) => c.vezes - a.vezes || c.h - a.h)) {
    if ((quadrosPorTrecho.get(b.segmento) || 0) < quadrosMinimos) continue;
    // o separador de dia de verdade anda com a conversa; o que flutua no topo fica parado enquanto ela passa
    if (b.tipo === "aviso" && !b.foraDoTopo && b.yMax - b.yMin < 15) continue;
    const bate = aceitos.some(a => a.segmento === b.segmento &&
      Math.min(a.A0 + a.h, b.A0 + b.h) - Math.max(a.A0, b.A0) > Math.min(a.h, b.h) * 0.25);
    if (!bate) aceitos.push(b);
  }
  aceitos.sort((a, b) => a.segmento - b.segmento || a.A0 - b.A0);
  if (depuracao.registro) depuracao.baloes = aceitos;
  return aceitos;
}

// ---------- leitura de cada balão ----------
// amplia o recorte e passa para preto e branco: a letra é o que fica do lado oposto ao fundo
function paraLeitura(origem, x, y, w, h, escala, tapar = null) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 4 || h < 4) return null;
  const margem = 16;
  const c = document.createElement("canvas");
  c.width = Math.round(w * escala) + margem * 2; c.height = Math.round(h * escala) + margem * 2;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(origem, x, y, w, h, margem, margem, c.width - margem * 2, c.height - margem * 2);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  // a conta olha só o miolo: a margem ainda está vazia e entraria como preto
  const hist = new Uint32Array(256);
  let total = 0;
  for (let py = margem; py < c.height - margem; py++) for (let px = margem; px < c.width - margem; px++) {
    const i = (py * c.width + px) * 4;
    hist[Math.round(luzDe(d[i], d[i + 1], d[i + 2]))]++; total++;
  }
  let fundo = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[fundo]) fundo = v;
  const percentil = p => { let s = 0; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= total * p) return v; } return 255; };
  const escuro = percentil(0.02), claro = percentil(0.98);
  const letraClara = claro - fundo > fundo - escuro;
  const limiar = fundo + ((letraClara ? claro : escuro) - fundo) * 0.4;
  for (let i = 0; i < d.length; i += 4) {
    const p = i / 4, px = p % c.width, py = (p / c.width) | 0;
    const dentro = px >= margem && py >= margem && px < c.width - margem && py < c.height - margem;
    const l = luzDe(d[i], d[i + 1], d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = dentro && (letraClara ? l > limiar : l < limiar) ? 0 : 255;
  }
  ctx.putImageData(img, 0, 0);
  if (tapar) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(margem + (tapar.x0 - x) * escala, margem + (tapar.y0 - y) * escala, (tapar.x1 - tapar.x0) * escala, (tapar.y1 - tapar.y0) * escala);
  }
  return c;
}

async function lerPedaco(agendador, origem, x, y, w, h, escala, tapar) {
  const c = paraLeitura(origem, x, y, w, h, escala, tapar);
  if (!c) return { texto: "", confianca: 0 };
  const { data } = await agendador.addJob("recognize", c);
  return { texto: data.text || "", confianca: data.confidence || 0 };
}

// A resposta citada é uma caixa no alto do balão com uma barrinha de cor viva à esquerda, da cor de
// quem foi citado. Nenhum fundo de balão tem cor tão viva, então a barrinha marca a caixa.
function acharCitacao(c, larguraTela) {
  const W = c.width, H = c.height;
  if (H < 30) return null;
  const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const xa = 2, xb = Math.min(W, Math.round(3 + larguraTela * 0.05));
  const naBarra = [];
  for (let y = 0; y < H; y++) {
    let tem = false;
    for (let x = xa; x < xb && !tem; x++) {
      const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      tem = Math.max(r, g, b) - Math.min(r, g, b) > 70 && luzDe(r, g, b) > 60;
    }
    naBarra.push(tem);
  }
  let ini = -1, fim = -1;
  for (let y = 0; y < H; y++) {
    if (naBarra[y]) { if (ini < 0) { if (y > H * 0.5) break; ini = y; } fim = y; }
    else if (ini >= 0 && y - fim > 2) break;
  }
  if (ini < 0 || fim - ini < H * 0.12 || fim > H * 0.9) return null;
  // a caixa começa logo depois da barrinha
  let x0 = xb;
  for (let x = xa; x < Math.min(W, xb + 10); x++) {
    const i = (Math.round((ini + fim) / 2) * W + x) * 4;
    if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 70) x0 = x + 2;
  }
  return { x0, y0: Math.max(0, ini - 1), x1: W - 4, y1: Math.min(H, fim + 2) };
}

const normalizar = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const essencia = s => normalizar(s || "").replace(/[^a-z]+/g, "");
const chave = s => normalizar(s || "").replace(/[^a-z0-9]+/g, "");

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) * 0.3) return Infinity;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    anterior = atual;
  }
  return anterior[b.length];
}

function acharNome(linha, nomes) {
  const l = essencia(linha);
  if (!l) return null;
  for (const nome of nomes) {
    const n = essencia(nome);
    if (!n) continue;
    if (l === n || l.startsWith(n) || (n.length >= 4 && distancia(l.slice(0, n.length + 2), n) <= Math.max(1, n.length * 0.25))) return nome;
  }
  return null;
}

const linhasDe = texto => texto.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(l => /[\p{L}\p{N}?!]/u.test(l));

// todo balão termina no horário, então número no fim da última linha é horário mesmo sem os dois pontos
const horaNoFimDoBalao = /(?:^|\s)([01]?\d|2[0-3])\s?[:.;,'’]?\s?([0-5]\d)\d?[^\p{L}\d]{0,6}$/u;
function tirarHora(linhas, verde) {
  for (let k = linhas.length - 1; k >= Math.max(0, linhas.length - 2); k--) {
    const m = linhas[k].match(horaNoFim) || (verde && linhas[k].match(horaSemPontos)) || (k === linhas.length - 1 && linhas[k].match(horaNoFimDoBalao));
    if (!m) continue;
    let hh = +m[1];
    if (m[3]) { const pm = /p/i.test(m[3]); if (pm && hh < 12) hh += 12; if (!pm && hh === 12) hh = 0; }
    linhas[k] = linhas[k].slice(0, m.index).trim();
    if (!linhas[k]) linhas.splice(k, 1);
    // horário lido torto (11:84) sai do texto do mesmo jeito, só não vira horário
    return hh < 24 && +m[2] < 60 ? `${String(hh).padStart(2, "0")}:${m[2]}` : null;
  }
  return null;
}

// O canto do horário fica embaixo à direita. Vindo da direita, a leitura atravessa o horário e os
// tiques de lido e para no primeiro espaço vazio largo, que é o respiro antes da última palavra.
function cantoDoHorario(b) {
  const c = b.recorte, W = c.width, H = c.height;
  const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const alt = Math.max(6, Math.round(b.alturaTela * 0.024));
  const y0 = Math.max(0, H - 3 - alt), y1 = H - 3;
  const luzFundo = luzDe(...corMaisComum(d, W, 3, W - 3, y0, y1, 1));
  const diferente = (x, y) => { const i = (y * W + x) * 4; return Math.abs(luzDe(d[i], d[i + 1], d[i + 2]) - luzFundo) > 45; };
  // a sombra e a borda do balão atravessam a linha inteira; texto nunca ocupa a linha toda
  const linhas = [];
  for (let y = y0; y < y1; y++) {
    let n = 0;
    for (let x = 3; x < W - 3; x++) if (diferente(x, y)) n++;
    if (n < (W - 6) * 0.6) linhas.push(y);
  }
  const temLetra = x => linhas.some(y => diferente(x, y));
  const lacuna = Math.max(4, Math.round(b.larguraTela * 0.016));
  const limite = Math.max(3, W - 4 - b.larguraTela * (b.tipo === "eu" ? 0.22 : 0.17));
  let x = W - 4;
  while (x > limite && !temLetra(x)) x--;
  let inicio = x, vazio = 0;
  for (; x > limite; x--) {
    if (temLetra(x)) { inicio = x; vazio = 0; }
    else if (++vazio >= lacuna) break;
  }
  return { x0: Math.max(0, inicio - 2), y0, x1: W - 3, y1 };
}

async function lerHorario(relogio, b, canto) {
  const c = paraLeitura(b.recorte, canto.x0, canto.y0, canto.x1 - canto.x0, canto.y1 - canto.y0, Math.min(5, Math.max(2, 2000 / b.larguraTela)));
  if (!c) return null;
  const { data } = await relogio.recognize(c);
  const m = (data.text || "").replace(/\s/g, "").match(/([01]?\d|2[0-3]):?([0-5]\d)/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

async function lerBalao(b, nomes, { agendador, relogio }) {
  const c = b.recorte, W = c.width, H = c.height;
  const escala = Math.min(3.5, Math.max(1, 1000 / b.larguraTela));
  if (b.tipo === "aviso") {
    const lido = await lerPedaco(agendador, c, 0, 0, W, H, escala);
    const linha = linhasDe(lido.texto).join(" ");
    const data = interpretarData(linha);
    if (data) return { tipo: "dia", data, confianca: lido.confianca };
    return linha.replace(/[^\p{L}]/gu, "").length >= 3 ? { tipo: "sistema", texto: linha, confianca: lido.confianca } : null;
  }
  const verde = b.tipo === "eu";
  const canto = cantoDoHorario(b);
  const caixa = acharCitacao(c, b.larguraTela);
  let citacao = null, linhas, confianca = 0;
  const horaLida = lerHorario(relogio, b, canto);
  if (caixa) {
    const [cit, antes, corpo] = await Promise.all([
      lerPedaco(agendador, c, caixa.x0, caixa.y0, caixa.x1 - caixa.x0, caixa.y1 - caixa.y0, escala),
      caixa.y0 > H * 0.18 ? lerPedaco(agendador, c, 0, 0, W, caixa.y0, escala) : { texto: "" },
      lerPedaco(agendador, c, 0, caixa.y1, W, H - caixa.y1, escala, canto)
    ]);
    const lc = linhasDe(cit.texto);
    if (lc.length) {
      let autor = acharNome(lc[0], ["Você", nomes.dona, ...nomes.outros]);
      if (autor) lc.shift();
      if (autor === "Você") autor = nomes.dona;
      citacao = { autor: autor || "", texto: lc.join(" ") };
    }
    linhas = [...linhasDe(antes.texto || ""), ...linhasDe(corpo.texto)];
    confianca = corpo.confianca;
  } else {
    const corpo = await lerPedaco(agendador, c, 0, 0, W, H, escala, canto);
    linhas = linhasDe(corpo.texto);
    confianca = corpo.confianca;
  }
  // se algum pedaço do horário escapou do canto tapado, sai aqui também
  const horaDoTexto = tirarHora(linhas, verde);
  const horaDoCanto = await horaLida;
  const hora = horaDoCanto || horaDoTexto;
  let autor = null;
  if (!verde && nomes.outros.length > 1 && linhas.length > 1) {
    autor = acharNome(linhas[0], nomes.outros);
    if (autor) linhas.shift();
  }
  let texto = linhas.join(" ").replace(/\s+/g, " ").trim()
    // restos de tique e de borda que grudam no começo e no fim
    .replace(/^(?:[vV|/\\]\s+)+/, "").replace(/(?:\s*[,;|'`´]){2,}\s*$/, "").replace(/\s+[vV|]$/, "").trim();
  if (/^[^\p{L}]*\d{1,2}:\d{2}[^\p{L}]*$/u.test(texto)) texto = "🎤 Áudio";
  // resto sem letra (o botão de descer, um pedaço de reação) não é mensagem
  // ("?" com horário fica: é mensagem curta de verdade)
  const miolo = texto.replace(/[^\p{L}\p{N}?!]/gu, "").length;
  if (!citacao && (miolo === 0 || (miolo < 2 && !hora))) return null;
  return { tipo: "msg", lado: b.tipo, autor, texto, hora, horaDoCanto, citacao, confianca };
}

// lê as versões guardadas e fica com a de maior confiança; o horário é o que mais se repete
async function lerMelhor(b, nomes, leitor) {
  const lidos = (await Promise.all(b.instancias.map(i => lerBalao({ ...b, recorte: i.recorte }, nomes, leitor)))).filter(Boolean);
  if (!lidos.length) return null;
  lidos.sort((x, y) => y.confianca - x.confianca);
  const melhor = { ...lidos[0] };
  if (melhor.tipo === "msg") {
    const conta = {};
    lidos.forEach(l => { if (l.horaDoCanto) conta[l.horaDoCanto] = (conta[l.horaDoCanto] || 0) + 1; });
    const [maisVista] = Object.entries(conta).sort((x, y) => y[1] - x[1])[0] || [];
    if (maisVista && conta[maisVista] > 1) melhor.hora = maisVista;
    if (!melhor.citacao) melhor.citacao = lidos.find(l => l.citacao)?.citacao || null;
  }
  // leitura que nem a melhor versão entende é resto de imagem
  if (melhor.confianca < 35 && melhor.tipo !== "dia") return null;
  // No papel de foto, um pedaço da foto pode ter cara de balão. Balão de verdade tem horário no
  // canto; sem horário, só fica a leitura bem firme
  if (b.foto && melhor.tipo === "msg" && !melhor.hora && melhor.confianca < 50) return null;
  if (b.foto && melhor.tipo === "sistema" && melhor.confianca < 75) return null;
  delete melhor.confianca; delete melhor.horaDoCanto;
  return melhor;
}

async function lerBaloes(baloes, nomes, { progresso, aviso }) {
  const leitor = await preparar(aviso);
  aviso(`lendo ${baloes.length} balões com toda a imparcialidade possível.`);
  let feitos = 0;
  const lidos = await Promise.all(baloes.map(async b => {
    const r = await lerMelhor(b, nomes, leitor);
    progresso(++feitos / baloes.length);
    return r && { ...r, segmento: b.segmento };
  }));
  // trechos que a comparação de quadros não conseguiu emendar entram pela junção por texto
  let itens = [];
  const porSegmento = new Map();
  lidos.filter(Boolean).forEach(i => { if (!porSegmento.has(i.segmento)) porSegmento.set(i.segmento, []); porSegmento.get(i.segmento).push(i); });
  for (const trecho of porSegmento.values()) itens = juntar(itens, trecho.map(({ segmento, ...i }) => i));
  return { itens: corrigirHoras(itens), contato: "" };
}

// Dentro de um mesmo dia o horário só anda para a frente. Horário fora da ordem foi lido torto:
// primeiro tenta manter os minutos e trocar só a hora (o leitor confunde o 1 do começo com 0, e
// 01:14 depois de 10:53 é 11:14); se não couber, fica o horário da mensagem de cima.
function corrigirHoras(itens) {
  const minutos = h => +h.slice(0, 2) * 60 + +h.slice(3);
  const texto = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  let dia = [];
  const fechar = () => {
    let antes = null;
    for (let k = 0; k < dia.length; k++) {
      let t = minutos(dia[k].hora);
      if (antes == null) {
        // o primeiro do dia não tem anterior: é conferido contra os três seguintes. Só sobe, porque o
        // leitor erra para menos (troca o 1 do começo por 0)
        const prox = dia.slice(k + 1, k + 4).map(i => minutos(i.hora)).sort((a, b) => a - b);
        const meio = prox.length ? prox[Math.floor((prox.length - 1) / 2)] : null;
        if (meio != null && meio - t > 120) {
          const h = Math.floor(meio / 60), mm = t % 60;
          t = [h * 60 + mm, (h - 1) * 60 + mm].find(v => v <= meio && v >= 0) ?? meio;
          dia[k].hora = texto(t);
        }
        antes = t; continue;
      }
      // o teto é o meio dos três horários seguintes que não voltam no tempo: um horário lido alto
      // demais passa de todos eles, e um lido baixo demais fica antes do anterior
      const seguintes = dia.slice(k + 1).map(i => minutos(i.hora)).filter(v => v >= antes).slice(0, 3).sort((a, b) => a - b);
      const teto = seguintes.length ? seguintes[Math.floor((seguintes.length - 1) / 2)] : Infinity;
      if (t >= antes && t <= teto) { antes = t; continue; }
      const h = Math.floor(antes / 60), mm = t % 60;
      const opcao = [h * 60 + mm, (h + 1) * 60 + mm].find(v => v >= antes && v <= teto && v < 1440);
      const certo = opcao ?? antes;
      dia[k].hora = texto(certo);
      antes = certo;
    }
    dia = [];
  };
  for (const it of itens) {
    if (it.tipo === "dia") fechar();
    else if (it.tipo === "msg" && it.hora) dia.push(it);
  }
  fechar();
  return itens;
}

function normalizarNomes(nomes = {}) {
  const dona = (nomes.dona || "").trim() || "Eu";
  const outros = (Array.isArray(nomes.outros) ? nomes.outros : String(nomes.outros || "").split(","))
    .map(n => n.trim()).filter(Boolean);
  return { dona, outros: outros.length ? outros : ["Contato"] };
}

// ---------- datas e horas ----------
const semana = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const mesesCurtos = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function interpretarData(texto, hoje = new Date()) {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const t = normalizar(texto).replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 32) return null;
  if (t === "hoje" || t === "today") return base;
  if (t === "ontem" || t === "yesterday") return new Date(base - 864e5);
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  m = t.match(/(\d{1,2}) de ([a-z]{3,})(?: de (\d{4}))?/);
  if (m) {
    const mes = mesesCurtos.indexOf(m[2].slice(0, 3));
    if (mes >= 0) {
      let d = new Date(m[3] ? +m[3] : base.getFullYear(), mes, +m[1]);
      if (!m[3] && d > base) d = new Date(d.getFullYear() - 1, mes, +m[1]);
      return d;
    }
  }
  const dia = semana.findIndex(s => t.startsWith(s));
  if (dia >= 0 && t.length < 16) {
    const volta = (base.getDay() - dia + 7) % 7 || 7;
    return new Date(base - volta * 864e5);
  }
  return null;
}

// o horário fecha o balão. Os tiques de lido viram lixo na leitura (vv, YY, //, 0vv, ".", ","),
// então tudo que não é letra depois do horário sai junto
const tique = "[✓✔√vVwWJjyY/\\\\|]";
const lixo = "(?:[✓✔√vVwWJjyY/\\\\|&»+,.:;()<>~*'\"`´^-]|\\s)";
const horaNoFim = new RegExp(`(?:^|\\s)(?:editada\\s+)?(\\d{1,2})[:.;](\\d{2})(?:\\s*([ap])\\.?\\s?m\\.?)?(?:\\s?\\d(?=${lixo}*${tique}))?${lixo}{0,7}$`, "i");
// às vezes o leitor come os dois pontos; nos balões verdes os tiques denunciam que é horário
const horaSemPontos = new RegExp(`(?:^|\\s)(\\d{2})(\\d{2})(?=${lixo}*${tique})${lixo}{1,7}$`);

// ---------- juntar trechos que não emendaram pelos quadros ----------
function parecidos(a, b) {
  if (a.tipo !== b.tipo) return false;
  if (a.tipo === "dia") return +a.data === +b.data;
  if (a.tipo === "msg" && a.lado !== b.lado) return false;
  const x = essencia(a.texto), y = essencia(b.texto);
  if (!x || !y) return chave(a.texto) === chave(b.texto) && (!a.hora || !b.hora || a.hora === b.hora);
  if (x === y) return true;
  const [curto, longo] = x.length < y.length ? [x, y] : [y, x];
  if (curto.length >= 8 && longo.includes(curto)) return true;
  return longo.length >= 5 && distancia(x, y) <= longo.length * 0.2;
}

// Cada item novo procura um parecido no que já foi lido e vota no encaixe
// (a posição dele lá menos a posição dele aqui). O encaixe com mais votos decide o que é repetido.
// Encaixe negativo quer dizer que o pedaço novo começa antes do que já foi lido (o vídeo do começo
// da conversa subiu depois): o que vem antes entra na frente.
export function juntar(acumulado, novos) {
  const b = novos.filter(i => i.tipo !== "msg" || i.texto);
  if (!acumulado.length) return b;
  const votos = new Map();
  b.forEach((item, j) => {
    for (let i = 0; i < acumulado.length; i++) {
      if (parecidos(acumulado[i], item)) votos.set(i - j, (votos.get(i - j) || 0) + (item.tipo === "dia" ? 0.5 : 1));
    }
  });
  let encaixe = null, melhor = 0;
  for (const [d, v] of votos) if (v > melhor || (v === melhor && d > encaixe)) { encaixe = d; melhor = v; }
  if (encaixe == null || melhor < Math.min(2, b.filter(i => i.tipo === "msg").length)) {
    const dia = [...acumulado].reverse().find(i => i.tipo === "dia");
    const resto = b[0]?.tipo === "dia" && dia && +b[0].data === +dia.data ? b.slice(1) : b;
    return acumulado.concat(resto);
  }
  const antes = encaixe < 0 ? b.slice(0, -encaixe) : [];
  const juntos = antes.concat(acumulado);
  encaixe += antes.length;
  b.forEach((n, j) => {
    if (j < antes.length) return;
    const i = encaixe + j;
    if (i >= juntos.length) { juntos.push(n); return; }
    const a = juntos[i];
    if (n.tipo !== "msg" || a.tipo !== "msg") return;
    if (parecidos(a, n)) {
      const maisInteiro = essencia(n.texto).length > essencia(a.texto).length;
      juntos[i] = { ...a, texto: maisInteiro ? n.texto : a.texto, hora: a.hora || n.hora, autor: a.autor || n.autor, citacao: a.citacao || n.citacao };
    } else if (!a.hora && n.hora && a.lado === n.lado) {
      juntos[i] = n;
    }
  });
  return juntos.filter((it, k) => !(it.tipo === "dia" && juntos[k - 1]?.tipo === "dia" && +juntos[k - 1].data === +it.data));
}

// ---------- itens viram mensagens ----------
export function paraMensagens(itens, nomesInformados) {
  const nomes = normalizarNomes(nomesInformados);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  let dia = itens.find(i => i.tipo === "dia")?.data || hoje;
  let ultima = "00:00";
  const saida = [];
  for (const it of itens) {
    if (it.tipo === "dia") { dia = it.data; continue; }
    const h = it.hora || ultima; ultima = h;
    const [hh, mm] = h.split(":").map(Number);
    const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hh, mm);
    if (it.tipo === "sistema") { saida.push({ quando, autor: null, texto: it.texto, tipo: "sistema" }); continue; }
    const autor = it.lado === "eu" ? nomes.dona : (it.autor || nomes.outros[0]);
    const m = { quando, autor, texto: it.texto, tipo: "msg" };
    if (it.citacao && (it.citacao.texto || it.citacao.autor)) m.citacao = { autor: it.citacao.autor || "", texto: it.citacao.texto };
    saida.push(m);
  }
  return saida.map((m, i) => ({ ...m, id: i + 1 }));
}

// ---------- prints ----------
export async function lerImagens(fontes, { nomes, progresso = () => {}, aviso = () => {} } = {}) {
  const n = normalizarNomes(nomes);
  const lerJunto = preparar(aviso); // o leitor vai baixando enquanto as telas são analisadas
  aviso("procurando os balões nos prints.");
  let k = 0;
  const tela = document.createElement("canvas");
  const baloes = await percorrer(async () => {
    if (k >= fontes.length) return null;
    const bmp = await createImageBitmap(fontes[k++]);
    tela.width = bmp.width; tela.height = bmp.height;
    tela.getContext("2d", { willReadFrequently: true }).drawImage(bmp, 0, 0);
    bmp.close?.();
    progresso(0.3 * k / fontes.length);
    return { tela };
  });
  await lerJunto;
  if (!baloes.length) return { itens: [], contato: "" };
  return lerBaloes(baloes, n, { progresso: p => progresso(0.3 + 0.7 * p), aviso });
}

// ---------- vídeo da tela ----------
function ir(video, t) {
  return new Promise(ok => { video.onseeked = () => ok(); video.currentTime = t; });
}

function abrirVideo(arquivo) {
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  const url = URL.createObjectURL(arquivo);
  video.src = url;
  return new Promise((ok, falha) => {
    video.onloadeddata = async () => {
      // vídeo gravado no navegador às vezes chega sem duração até ir ao fim
      if (!isFinite(video.duration)) { await ir(video, 1e7); await ir(video, 0); }
      ok({ video, url });
    };
    video.onerror = () => { URL.revokeObjectURL(url); falha(new Error(`o vídeo ${arquivo.name} não abriu neste navegador. tenta no chrome ou no safari.`)); };
  });
}

// aceita um vídeo ou vários, na ordem da conversa
export async function lerVideo(arquivos, { nomes, progresso = () => {}, aviso = () => {} } = {}) {
  const lista = Array.isArray(arquivos) ? arquivos : [arquivos];
  const n = normalizarNomes(nomes);
  const lerJunto = preparar(aviso);
  const abertos = [];
  try {
    for (const arquivo of lista) abertos.push(await abrirVideo(arquivo));
  } catch (erro) { abertos.forEach(a => URL.revokeObjectURL(a.url)); throw erro; }
  const total = abertos.reduce((s, a) => s + a.video.duration, 0);
  const tela = document.createElement("canvas");
  const ctx = tela.getContext("2d", { willReadFrequently: true });
  const passo = Math.max(0.15, total / 700);
  let k = 0, t = 0, visto = 0, quebra = false;
  const porcento = () => Math.round(100 * Math.min(1, (visto + t) / total));
  const qual = () => lista.length > 1 ? ` ${k + 1} de ${lista.length}` : "";
  aviso(`assistindo o vídeo${qual()} · 0%`);
  const baloes = await percorrer(async () => {
    for (;;) {
      if (k >= abertos.length) return null;
      const { video } = abertos[k];
      if (t <= video.duration) break;
      visto += video.duration; k++; t = 0; quebra = true;
    }
    const { video } = abertos[k];
    const W = video.videoWidth, H = video.videoHeight;
    if (tela.width !== W || tela.height !== H) { tela.width = W; tela.height = H; }
    await ir(video, Math.min(t, video.duration - 0.02));
    ctx.drawImage(video, 0, 0, W, H);
    progresso(0.55 * porcento() / 100);
    aviso(`assistindo o vídeo${qual()} · ${Math.round(100 * Math.min(1, t / video.duration))}%`);
    t += passo;
    const q = { tela, quebra };
    quebra = false;
    return q;
  }, { quadrosMinimos: 4 });
  abertos.forEach(a => URL.revokeObjectURL(a.url));
  await lerJunto;
  if (!baloes.length) throw new Error(lista.length > 1
    ? "não achei a conversa nesses vídeos. grava de novo rolando devagar, com uma pausa em cada tela."
    : "não achei a conversa nesse vídeo. grava de novo rolando devagar, com uma pausa em cada tela.");
  return lerBaloes(baloes, n, { progresso: p => progresso(0.55 + 0.45 * p), aviso });
}

// para conferir à mão o que a leitura enxerga
export const depuracao = { registro: null, baloes: null };
export { cantoDoHorario, paraLeitura };
export function analisarQuadro(tela) {
  const W = tela.width, H = tela.height;
  const px = tela.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const info = lerTela(px, W, H);
  const blocos = acharBlocos(px, W, H, info);
  return { info, blocos, linhas: acharBlocos.linhas };
}
