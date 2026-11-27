// AURUM — загрузка своего логотипа: картинка уходит в ветку «logos» репозитория (приложение не пересобирается),
// а в merchant_brands появляется запись «+файл», по которой он виден в списке.
// Секрет AURUM_GITHUB_TOKEN: fine-grained ключ только на этот репозиторий, Contents: Read and write.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REPO = "iLadislaus/Aurum";
const BRANCH = "logos";
const MAX_BYTES = 150 * 1024;
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
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const who = await db.auth.getUser(auth.replace(/^bearer\s+/i, ""));
    const own = who.data?.user ? await db.from("merchant_brands").select("id").limit(1) : null;
    if (!own?.data?.length) return fail("Войдите в приложение заново", 401);

    const token = Deno.env.get("AURUM_GITHUB_TOKEN");
    if (!token) return fail("Ключ GitHub ещё не добавлен в секреты Supabase", 500);

    const body = await req.json().catch(() => null);
    const image = String(body?.image ?? "");
    const name = String(body?.name ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
    // принимаем только небольшой JPEG
    if (!/^\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(image)) return fail("Нужна картинка JPEG", 400);
    if (image.length * 0.75 > MAX_BYTES) return fail("Картинка слишком большая", 400);

    const gh = (path: string, init: RequestInit = {}) =>
      fetch(`https://api.github.com/repos/${REPO}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "aurum-logo", "x-github-api-version": "2022-11-28" },
      });
    const denied = (s: number) => (s === 401 || s === 403 ? "GitHub не принял ключ: проверьте права и срок действия" : `GitHub ответил ошибкой ${s}`);

    // ветка создаётся один раз от main
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    if (ref.status === 404) {
      const main = await gh("/git/ref/heads/main");
      if (!main.ok) return fail(denied(main.status), 502);
      const sha = (await main.json()).object.sha;
      const made = await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
      if (!made.ok && made.status !== 422) return fail(denied(made.status), 502);
    } else if (!ref.ok) return fail(denied(ref.status), 502);

    const file = `u-${Date.now()}-${crypto.randomUUID().slice(0, 6)}.jpg`;
    const put = await gh(`/contents/logos/${file}`, { method: "PUT", body: JSON.stringify({ message: `Логотип ${file}`, content: image, branch: BRANCH }) });
    if (!put.ok) return fail(denied(put.status), 502);

    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/logos/${file}`;
    const row = { pattern: `+${file}`, logo_url: url, domain: name || null };
    const saved = await db.from("merchant_brands").insert(row);
    if (saved.error) return fail("Картинка загружена, но не записалась в базу", 500);
    return json({ ok: true, row });
  } catch (e) {
    console.error("[LOGO]", e instanceof Error ? e.message : e);
    return fail("Не удалось загрузить логотип", 500);
  }
});
