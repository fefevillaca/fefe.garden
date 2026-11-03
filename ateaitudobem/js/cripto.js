// Tranca e destranca a conversa no próprio navegador, com AES-GCM de 256 bits.
// A chave nasce aqui, viaja só no pedaço do link depois do "#" e nunca chega ao servidor.

const b64 = {
  de(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  para(texto) {
    const s = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
};
export { b64 };

async function passar(bytes, transformacao) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(transformacao);
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

export async function novaChave() {
  const chave = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const bruta = new Uint8Array(await crypto.subtle.exportKey("raw", chave));
  return { chave, texto: b64.de(bruta) };
}

export async function abrirChave(texto) {
  return crypto.subtle.importKey("raw", b64.para(texto), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function trancar(chave, objeto) {
  const comprimido = await passar(new TextEncoder().encode(JSON.stringify(objeto)), new CompressionStream("gzip"));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, comprimido));
  const junto = new Uint8Array(iv.length + cifrado.length);
  junto.set(iv); junto.set(cifrado, iv.length);
  return b64.de(junto);
}

export async function destrancar(chave, texto) {
  const junto = b64.para(texto);
  const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: junto.subarray(0, 12) }, chave, junto.subarray(12));
  const json = await passar(new Uint8Array(aberto), new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(json));
}
