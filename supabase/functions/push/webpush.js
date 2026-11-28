// Web Push без сторонних библиотек: шифрование сообщения (RFC 8291, aes128gcm) и подпись отправителя VAPID (RFC 8292).
const enc = new TextEncoder();
export const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const join = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { out.set(x, i); i += x.length; } return out; };
const hkdf = async (salt, ikm, info, bytes) => {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
};
const EC = { name: "ECDH", namedCurve: "P-256" };

// новая пара ключей отправителя: public отдаётся приложению, private (JWK) остаётся в базе
export async function newKeys() {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { public_key: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), private_key: await crypto.subtle.exportKey("jwk", k.privateKey) };
}

export async function encrypt(text, p256dh, auth) {
  const uaPublic = unb64u(p256dh);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, EC, false, []);
  const own = await crypto.subtle.generateKey(EC, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", own.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, own.privateKey, 256));
  const ikm = await hkdf(unb64u(auth), shared, join(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // одна запись: за текстом идёт байт 2 — «это последняя»
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, join(enc.encode(text), new Uint8Array([2]))));
  return join(salt, new Uint8Array([0, 0, 16, 0, asPublic.length]), asPublic, body);
}

export async function vapidHeader(endpoint, keys, subject, now = Date.now()) {
  const part = (o) => b64u(enc.encode(JSON.stringify(o)));
  const data = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })}`;
  const key = await crypto.subtle.importKey("jwk", keys.private_key, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sign = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(data));
  return `vapid t=${data}.${b64u(sign)}, k=${keys.public_key}`;
}

// отправить сообщение одному устройству; возвращает ответ службы уведомлений
export async function sendPush(sub, message, keys, subject) {
  return fetch(sub.endpoint, {
    method: "POST",
    headers: { authorization: await vapidHeader(sub.endpoint, keys, subject), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "86400", urgency: "normal" },
    body: await encrypt(JSON.stringify(message), sub.p256dh, sub.auth),
    redirect: "error",
  });
}
