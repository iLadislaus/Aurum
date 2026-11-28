// AURUM — уведомления на телефон. Действия владельца: key (ключ для подписки), on (запомнить устройство),
// off (забыть), test (пробное сообщение на это устройство).
// Ключи отправителя функция создаёт сама и держит в таблице push_keys, закрытой для приложения.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { newKeys, sendPush } from "./webpush.js";

const SUBJECT = "https://iladislaus.github.io/Aurum/";
// принимаем адреса только настоящих служб уведомлений
const HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
const fail = (message: string, status: number) => json({ ok: false, message }, status);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("Метод не поддерживается", 405);
  try {
    // только владелец: запрос идёт под его входом, а RLS чужим не отдаёт ни одной строки
    const auth = req.headers.get("authorization") ?? "";
    const opts = { auth: { persistSession: false, autoRefreshToken: false } };
    const own = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { ...opts, global: { headers: { Authorization: auth } } });
    const who = await own.auth.getUser(auth.replace(/^bearer\s+/i, ""));
    const mine = who.data?.user ? await own.from("merchant_brands").select("id").limit(1) : null;
    if (!mine?.data?.length) return fail("Войдите в приложение заново", 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, opts);
    const keys = async () => {
      const read = () => db.from("push_keys").select("public_key,private_key").eq("id", 1).maybeSingle();
      let r = await read();
      if (!r.error && !r.data) {
        // первый запуск; если два запроса пришли разом, остаётся ключ того, кто записал первым
        await db.from("push_keys").upsert({ id: 1, ...(await newKeys()) }, { onConflict: "id", ignoreDuplicates: true });
        r = await read();
      }
      if (r.error || !r.data) throw new Error("keys: " + (r.error?.message ?? "пусто"));
      return r.data;
    };

    const body = await req.json().catch(() => null);
    const action = String(body?.action ?? "");
    if (action === "key") return json({ ok: true, key: (await keys()).public_key });

    const endpoint = String(body?.endpoint ?? "");
    let url: URL | null = null;
    try { url = new URL(endpoint); } catch { /* не адрес */ }
    if (!url || url.protocol !== "https:" || !HOSTS.test(url.hostname) || endpoint.length > 1000) return fail("Неверный адрес устройства", 400);

    if (action === "on") {
      const p256dh = String(body?.p256dh ?? ""), secret = String(body?.auth ?? "");
      if (!/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,40}$/.test(secret)) return fail("Неверные ключи устройства", 400);
      const r = await db.from("push_subscriptions").upsert({ endpoint, p256dh, auth: secret }, { onConflict: "endpoint" });
      if (r.error) return fail("Не удалось запомнить устройство", 500);
      return json({ ok: true });
    }
    if (action === "off") {
      const r = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
      if (r.error) return fail("Не удалось выключить", 500);
      return json({ ok: true });
    }
    if (action === "test") {
      const sub = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("endpoint", endpoint).maybeSingle();
      if (!sub.data) return fail("Это устройство не подписано, включите уведомления заново", 404);
      const r = await sendPush(sub.data, { title: "Aurum", body: "Уведомления работают", tag: "test" }, await keys(), SUBJECT);
      if (r.status === 404 || r.status === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
        return fail("Подписка устарела, включите уведомления заново", 410);
      }
      if (!r.ok) {
        console.error("[PUSH]", r.status, (await r.text()).slice(0, 200));
        return fail(`Служба уведомлений ответила ошибкой ${r.status}`, 502);
      }
      return json({ ok: true });
    }
    return fail("Неизвестное действие", 400);
  } catch (e) {
    console.error("[PUSH]", e instanceof Error ? e.message : e);
    return fail("Не получилось, попробуйте позже", 500);
  }
});
