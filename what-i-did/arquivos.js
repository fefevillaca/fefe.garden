// As pastas do portfólio: uma marca = uma pasta, como no Finder dela.
// A ordem daqui é a ordem na tela. O nome da pasta também tem cara de pasta de
// trabalho (MECA_inhotim_2023), a pedido dela; o endereço (/what-i-did#meca) sai
// do `id`, pra continuar curto e não quebrar link já mandado se o nome mudar.
// `aviso` (opcional, na pasta): o que ela fez e aprendeu naquele trabalho, em
// inglês. Aparece num aviso do Mac, aquela janela de "salvar ou não salvar", toda
// vez que a pasta abre.
// A pasta também tem `data` (AAAA-MM, quando o trabalho começou) e a raiz mostra
// as pastas em ordem cronológica, da mais recente pra mais antiga, como os arquivos
// dentro delas. MECA: data do
// vídeo. Bar dos Arcos: data dos PDFs do cardápio e dos cartões. As outras: o
// arquivo mais antigo da pasta.
//
// Cada arquivo tem `nome`, `tipo`, `link` e `data` (AAAA-MM-DD, quando foi ao ar).
// Dentro da pasta os arquivos aparecem em ordem cronológica, do mais recente pro
// mais antigo, a pedido dela em 06/10/2026: a página ordena pela data, então a
// ordem aqui não importa. Arquivo sem data fica onde está. Exceção: pasta com
// `ordem: "views"` ordena pelo campo `views`, do mais visto pro menos visto. E pasta com `ordem: "lista"` fica na ordem
// escrita aqui (Netshoes, pelos episódios). O nome tem cara de arquivo de trabalho
// de verdade, sem extensão e com versão no fim (gerador_vFinal, carrossel_V1),
// a pedido dela em 05/10/2026: o ícone já diz o tipo.
//   tipo: "pdf" | "imagem" | "link" | "video" | "documento"
//   link: pra onde o clique leva (abre em outra aba). Arquivo do próprio site
//         fica em what-i-did/<pasta>/ e entra aqui com o caminho relativo.
//   capa: opcional, pra imagem e vídeo — miniatura no lugar do ícone, como o Finder faz.
//         Vídeo que mora fora (reel do Instagram) também leva capa e tipo "video":
//         aparece como vídeo na pasta e o clique abre o reel em outra aba.
//
// Pasta sem arquivo aparece vazia, igual ao Finder.
//
// `logo` (opcional, na pasta): o logo da marca gravado na pasta azul, como o Mac
// faz com pasta personalizada. É uma máscara: PNG transparente em que só o
// desenho do logo é opaco. O ponto opaco vira azul escuro, o resto some.
//
// `site` (opcional, na pasta): a pasta não abre, o clique leva direto pra esse
// endereço em outra aba. Vale pra marca cujo trabalho é o próprio site.
//
// `vista: "mesa"` (opcional, na pasta): em vez da grade de ícones, as imagens
// aparecem espalhadas e meio tortas, como impressos jogados na mesa. O clique
// abre a imagem grande por cima, como a Visualização Rápida do Mac.
//
// Netshoes e Embratur foram feitos dentro do The Summer Hunter, mas cada trabalho
// mora na pasta do cliente. Na pasta The Summer Hunter fica só o que é do próprio TSH.

const ig = (codigo) => "https://www.instagram.com/" + codigo + "/";

// uma imagem do próprio site: a miniatura e o arquivo aberto são o mesmo
const img = (pasta, arquivo, nome) =>
  ({ nome, tipo: "imagem", link: `${pasta}/${arquivo}`, capa: `${pasta}/${arquivo}` });

// Bar dos Arcos, temporada 2025: "para quem é o theatro municipal?". O cardápio
// e a foto de cada um dos nove drinks da carta autoral, tirados dos PDFs que ela
// baixou em 05/10/2026 (CARDAP_TEMP 2025_AUTORAIS_A3-v2 e POSTCARDS_TEMP_25_).
// Só o lado da foto do cartão, e em pé: no PDF a foto vem deitada.
const DRINKS = [["poroso", "poroso_foto_vFinal"], ["peri", "peri_foto_V2"],
  ["katherine", "katherine_foto_vFinal"], ["alcantara", "alcantara_foto_V3"],
  ["pra-ontem", "pra_ontem_foto_vFinal"], ["pauliceia", "pauliceia_foto_V2"],
  ["virado", "virado_foto_FINAL"], ["1911", "1911_foto_vFinal"], ["vacante", "vacante_foto_V2"]];
const arcos = [
  img("bar-dos-arcos", "cardapio.webp", "cardapio_autorais_A3_v2"),
  img("bar-dos-arcos", "cardapio-capa.webp", "cardapio_verso_A3_v2"),
  ...DRINKS.map(([a, n]) => img("bar-dos-arcos", `${a}-foto.webp`, n)),
];

window.PASTAS = [
  { nome: "MECA_inhotim_2023", id: "meca", data: "2023-09", logo: "meca/logo-mascara.png", arquivos: [
    // MECA Inhotim 2023. O arquivo original, em 1080p (55 MB): a versão leve ficava
    // borrada em tela grande e ela preferiu a nitidez. A capa é um quadro do vídeo.
    { nome: "boca_com_boca_inhotim_EXPORT_vFinal", tipo: "video",
      link: "meca/boca-com-boca.mp4", capa: "meca/boca-com-boca-capa.webp" },
  ] },
  { nome: "netshoes_websérie_corrida_2025", id: "netshoes", data: "2025-05", 
    aviso: "“What nobody is saying about what everybody is talking about.” I love briefs that ask exactly that, which was the case with running in 2025: creators couldn't stop talking about it and every brand wanted in, so the topic had already turned into a cliché online. I joined O que eu penso quando eu corro (What I think about when I run) halfway through, precisely because the series was slipping into that same cliché. So I went back and re-interviewed the runners to uncover each one's own subjectivity, shaping every episode to stand on its own while still adding up to the whole, with footage shot in different cities by very different videomakers stitched into one cohesive, harmonious series.",
    // na ordem dos episódios, do 1 ao 8 e o resumo no fim, a pedido dela em 06/10/2026
    ordem: "lista", logo: "netshoes/logo-mascara.png", arquivos: [
    // websérie "O que eu penso quando eu corro?", 2025: oito episódios, um por sexta
    { nome: "ep01_o_que_eu_penso_quando_eu_corro_vFinal", data: "2025-05-23", tipo: "video", capa: "netshoes/ep01-o-que-eu-penso-quando-eu-corro-vfinal-capa.webp", link: ig("reel/DKACirINHAq") },
    { nome: "ep02_thiago_mota_V2", data: "2025-05-30", tipo: "video", capa: "netshoes/ep02-thiago-mota-v2-capa.webp", link: ig("reel/DKSC3huNwdR") },
    { nome: "ep03_ellen_valias_V2", data: "2025-06-06", tipo: "video", capa: "netshoes/ep03-ellen-valias-v2-capa.webp", link: ig("reel/DKkECFGM2Bv") },
    { nome: "ep04_bernardo_lamarca_vFinal", data: "2025-06-13", tipo: "video", capa: "netshoes/ep04-bernardo-lamarca-vfinal-capa.webp", link: ig("reel/DK2GENaMUnn") },
    { nome: "ep05_deborah_santos_vFinal", data: "2025-06-20", tipo: "video", capa: "netshoes/ep05-deborah-santos-vfinal-capa.webp", link: ig("reel/DLIHojVO0JA") },
    { nome: "ep06_marcio_souza_V3", data: "2025-06-27", tipo: "video", capa: "netshoes/ep06-marcio-souza-v3-capa.webp", link: ig("reel/DLaJLPdMKul") },
    { nome: "ep07_thays_fonseca_FINAL", data: "2025-07-04", tipo: "video", capa: "netshoes/ep07-thays-fonseca-final-capa.webp", link: ig("reel/DLsKxoRM3PH") },
    { nome: "ep08_rino_magnoni_V3", data: "2025-07-11", tipo: "video", capa: "netshoes/ep08-rino-magnoni-v3-capa.webp", link: ig("reel/DL-MU1XsBxj") },
    { nome: "resumo_temporada_FINAL", data: "2025-07-18", tipo: "video", capa: "netshoes/resumo-temporada-final-capa.webp", link: ig("reel/DMQacfgs4rf") },
  ] },
  { nome: "brasileiragem_campanha_2026", id: "brasileiragem", data: "2026-06", 
    aviso: "I worked on Brasileiragem from the campaign's conceptual foundation to its final tactical delivery, deepening my take on how to make institutional communication truly pop and reach the general public, well beyond those who already follow the topic or traditional media. It has also taught me a lot about working with an asynchronous team from very different backgrounds, with plenty of room to experiment with AI, from data intelligence and vibe coding to content and graphic solutions. Getting my hands dirty is what I enjoy most, so seeing a website, a verbal identity, an art generator and a card deck I made come to life in a few months has been super rewarding.",
    logo: "brasileiragem/logo-mascara.png", arquivos: [
    // os itens que ela escolheu em 05/10/2026
    { nome: "gerador_vFinal", data: "2026-06-08", tipo: "link", capa: "brasileiragem/gerador-vfinal-capa.webp", link: "https://brasilfazmelhor.com.br/gerador" },
    { nome: "baralhos_V2", data: "2026-09-21", tipo: "link", capa: "brasileiragem/baralhos-v2-capa.webp", link: "https://brasilfazmelhor.com.br/baralhos" },
    { nome: "newsletter_substack_V3", data: "2026-09-28", tipo: "link", capa: "brasileiragem/newsletter-substack-v3-capa.webp", link: "https://substack.com/@brfazmelhor" },
    { nome: "post_lançamento_loc_astrid_v13", data: "2026-06-13", tipo: "video", capa: "brasileiragem/post-lancamento-loc-astrid-v13-capa.webp", link: ig("p/DZh8PMmRCyd") },
    { nome: "carrossel_muito_nossa_V1", data: "2026-08-28", tipo: "imagem", capa: "brasileiragem/carrossel-muito-nossa-v1-capa.webp", link: ig("p/DcmPFS3gmAN") },
    { nome: "artigo_brasil_ta_na_moda_FINAL", data: "2026-09-30", tipo: "video", capa: "brasileiragem/artigo-brasil-ta-na-moda-final-capa.webp", link: ig("p/Dd65HGopFLX") },
    { nome: "artigo_midia_ninja_vfinal_agora_vai", data: "2026-09-02", tipo: "link", capa: "brasileiragem/artigo-midia-ninja-vfinal-agora-vai-capa.webp",
      link: "https://midianinja.org/opiniao/da-pra-importar-soft-power/" },
  ] },
  // TSH é a única pasta ranqueada por visualização, a pedido dela em 06/10/2026: o que
  // performou melhor vem primeiro. `views` tirado do Instagram/YouTube nessa data.
  { nome: "TSH_conteúdos_2025", id: "the-summer-hunter", data: "2025-06", 
    aviso: "Working on these pieces was a rich creative and research experience, especially since, as I like to joke, before joining The Summer Hunter my main editorial reference was The Summer Hunter itself. Once inside the team, I had to sharpen my eye for emerging behaviors and everything that makes the platform so cherished by its audience and by brands. When we decided to turn TSH's own content into a video series, the challenge was finding topics I could genuinely speak about as a creator while keeping TSH's voice, which also meant stepping in front of the camera for the first time. My biggest takeaway was learning to tell perfectionism apart from what social-first content actually needs.",
    ordem: "views", logo: "the-summer-hunter/logo-mascara.png", arquivos: [
    { nome: "juventude_tem_data_pra_acabar_vFinal", data: "2025-07-28", views: 75092, tipo: "video", capa: "the-summer-hunter/juventude-tem-data-pra-acabar-vfinal-capa.webp", link: ig("p/DMqt4ULPGLG") },
    { nome: "falar_português_valen_bandeira_V2", data: "2025-08-04", views: 84088, tipo: "video", capa: "the-summer-hunter/falar-portugues-valen-bandeira-v2-capa.webp", link: ig("p/DM82Un9vqQk") },
    { nome: "chuveiro_elétrico_vFinal", data: "2025-08-07", views: 12540, tipo: "video", capa: "the-summer-hunter/chuveiro-eletrico-vfinal-capa.webp", link: ig("p/DNEeUqaP0J6") },
    { nome: "os_que_esperam_e_os_que_chegam_V3", data: "2025-08-08", views: 39050, tipo: "video", capa: "the-summer-hunter/os-que-esperam-e-os-que-chegam-v3-capa.webp", link: ig("p/DNHD6QUP3Kz") },
    { nome: "sexo_na_agenda_vFinal", data: "2025-08-19", views: 91083, tipo: "video", capa: "the-summer-hunter/sexo-na-agenda-vfinal-capa.webp", link: ig("p/DNjUQBtPoL7") },
    { nome: "pedir_desculpas_v2", data: "2025-08-21", views: 31152, tipo: "video", capa: "the-summer-hunter/pedir-desculpas-v2-capa.webp", link: ig("p/DNofKAEuKL9") },
    { nome: "bateria_social_FINAL", data: "2025-08-26", views: 27411, tipo: "video", capa: "the-summer-hunter/bateria-social-final-capa.webp", link: ig("p/DN1VeAfXCb1") },
    { nome: "desenrola_c6_fest_apple_podcast_V4", data: "2025-06-17", views: 118, tipo: "video",
      capa: "the-summer-hunter/desenrola-c6-fest-capa.webp",
      link: "https://www.youtube.com/watch?v=bFybCwaVggY" },
  ] },
  // Bradesco Principal com Selton Mello, outubro de 2025: ela escreveu os roteiros
  { nome: "bradesco_principal_selton_2025", id: "bradesco-principal", data: "2025-10",
    aviso: "Two hours to shoot everything, a talent who requires an impeccable finish and a social-first piece for a premium bank. That was the challenge of bringing Selton Mello and Bradesco Principal together. As the scriptwriter of this content series, I built every script from the start around that time limit, projecting the final look of each piece so it would live up to the expectations of everyone involved. Though I believe ideas are born in words (read: the script), loving every stage of the audiovisual process is what made me “the guy for this job.”",
    logo: "bradesco-principal/logo-mascara.png", arquivos: [
    { nome: "selton_bradesco_principal_vFinal", data: "2025-10-27", tipo: "video",
      capa: "bradesco-principal/selton-capa.webp",
      link: "https://www.instagram.com/reel/DQUEvdnEewR/" },
  ] },
  { nome: "embratur_publis_2026", id: "embratur", data: "2026-01", 
    aviso: "Our partnership with Embratur at The Summer Hunter began with static content, and when videos came up we researched the stories only video could tell, landing on one about music and another about movies (what a surprise). What moved me most was getting to know the people who actually make culture happen in Brazil, the below-the-line folks behind truly relevant and innovative movements. The challenge was turning a travel outlet known for natural landscapes into one about cultural landscapes, for a very institutional brand. I worked on it from pitching the idea to the final export, wearing many hats along the way, as small guerrilla crews do, from scriptwriting and interviewing guests to graphics and soundtrack. Being part of the full 360 was f*cking joyful.",
    logo: "embratur/logo-mascara.png", arquivos: [
    { nome: "roliúde_nordestina_vFinal", data: "2026-01-23", tipo: "video", link: ig("reel/DT3SvBHjvI9"),
      capa: "embratur/roliude-capa.webp" },
    { nome: "jazz_subúrbio_carioca_V2", data: "2026-02-03", tipo: "video", link: ig("reel/DUTxJe6Eb4y"),
      capa: "embratur/jazz-capa.webp" },
  ] },
  { nome: "bar_dos_arcos_temp_2025", id: "bar-dos-arcos", data: "2025-04", 
    aviso: "As head of marketing at Grupo Vegas, I looked after six venues with different communication rhythms. At Bar dos Arcos, we created a drink menu as a tribute to the Theatro Municipal, at once the most and least obvious idea for a bar that lives inside it. Our surprisingly close relationship with Fundação Sustenidos enriched the research with stories never opened to the public, which became part of all our communication, like the drink names and descriptions on this menu. Making a menu is a balancing act between brand and operations, reconciling the interests of the whole team, such as the head bartender and the operations manager. Since a menu is such an everyday object, we rarely notice how much goes into it, so that became the most interesting part for me. I also love how simply the art direction brought the theatre's small details to life, just by placing the glasses in architectural nooks people tend to walk past.",
    logo: "bar-dos-arcos/logo-mascara.png", vista: "mesa", arquivos: arcos },
];
