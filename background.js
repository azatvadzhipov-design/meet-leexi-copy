/* Meet + Leexi (1-click)
 * Клик по иконке -> открывает новый Google Meet -> ловит итоговый URL ->
 * создаёт meeting_event в Leexi с to_record:true -> бот сам подключается.
 */
importScripts("config.js"); // -> self.LEEXI_CONFIG

const LEEXI_BASE = "https://public-api.leexi.ai/v1";
const LEEXI_ENDPOINT = LEEXI_BASE + "/meeting_events";
const LEEXI_USERS_ENDPOINT = LEEXI_BASE + "/users";
// Код Meet вида abc-defg-hij (3-4-3 строчные буквы)
const MEET_CODE_RE = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[?#].*)?$/;
const WAIT_TIMEOUT_MS = 60000;

chrome.action.onClicked.addListener(() => {
  startFlow().catch((e) => setBadge("ERR", "#c0392b", "Сбой: " + e.message));
});

async function startFlow() {
  setBadge("…", "#888888", "Создаю Meet…");
  const tab = await chrome.tabs.create({ url: "https://meet.google.com/new", active: true });
  const tabId = tab.id;

  const meetingUrl = await waitForMeetUrl(tabId, WAIT_TIMEOUT_MS);
  if (!meetingUrl) {
    setBadge("!", "#c0392b", "Не удалось получить ссылку Meet (таймаут / не залогинен в Work?)");
    return;
  }

  await copyToClipboard(tabId, meetingUrl); // ссылка-приглашение сразу в буфер обмена

  try {
    await inviteLeexi(meetingUrl);
    setBadge("✓", "#16a34a", "Leexi приглашён · ссылка скопирована: " + meetingUrl);
    toast(tabId, "🎙️ Leexi приглашён · ссылка скопирована 📋", false);
  } catch (e) {
    setBadge("ERR", "#c0392b", "Ссылка скопирована, но Leexi не приглашён: " + e.message);
    toast(tabId, "📋 Ссылка скопирована · Leexi НЕ приглашён: " + e.message, true);
  }
}

// Ждём, пока вкладка с /new зарезолвится в реальный URL встречи.
function waitForMeetUrl(tabId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(val);
    };
    const check = (url) => {
      const m = url && url.match(MEET_CODE_RE);
      if (m) finish(url.split(/[?#]/)[0]);
    };
    const listener = (id, changeInfo, tab) => {
      if (id !== tabId) return;
      check(changeInfo.url || (tab && tab.url));
    };
    chrome.tabs.onUpdated.addListener(listener);
    // вдруг URL уже готов к моменту подписки
    chrome.tabs.get(tabId, (t) => { if (!chrome.runtime.lastError && t) check(t.url); });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

function authHeader(C) {
  return "Basic " + btoa(`${C.key_id}:${C.key_secret}`);
}

// user_uuid берём из config (если задан вручную), иначе находим по
// organizer-email через GET /v1/users и кешируем в chrome.storage.
async function resolveUserUuid(C) {
  if (C.user_uuid) return C.user_uuid;
  const email = (C.organizer || "").trim().toLowerCase();
  if (!email) throw new Error("В config.js не задан organizer (email)");

  const cached = await chrome.storage.local.get(["leexi_user_uuid", "leexi_user_email"]);
  if (cached.leexi_user_uuid && cached.leexi_user_email === email) return cached.leexi_user_uuid;

  const res = await fetch(LEEXI_USERS_ENDPOINT, {
    headers: { "Authorization": authHeader(C), "Accept": "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error("users HTTP " + res.status + " " + text.slice(0, 200));

  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data.data || []);
  const me = list.find((u) => (u.email || "").toLowerCase() === email);
  if (!me) throw new Error("В Leexi нет пользователя с email " + C.organizer);

  await chrome.storage.local.set({ leexi_user_uuid: me.uuid, leexi_user_email: email });
  return me.uuid;
}

async function inviteLeexi(meetingUrl) {
  const C = self.LEEXI_CONFIG;
  if (!C.key_id || !C.key_secret) throw new Error("не заполнены key_id / key_secret в config.js");
  const userUuid = await resolveUserUuid(C);
  const start = new Date(); start.setMilliseconds(0);
  const end = new Date(start.getTime() + C.meeting_minutes * 60000);

  const body = {
    meeting_url: meetingUrl,
    user_uuid: userUuid,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    owned: true,
    internal: !!C.internal,
    to_record: true,
    organizer: C.organizer,
    title: C.title,
  };

  const res = await fetch(LEEXI_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": authHeader(C),
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error("HTTP " + res.status + " " + text.slice(0, 300));
  return text;
}

function setBadge(text, color, title) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
  if (title) chrome.action.setTitle({ title });
  if (text && text !== "…") setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
}

// Кладём ссылку-приглашение в буфер обмена через активную вкладку Meet.
function copyToClipboard(tabId, text) {
  return chrome.scripting
    .executeScript({
      target: { tabId },
      func: (t) => {
        try {
          const ta = document.createElement("textarea");
          ta.value = t;
          ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          let ok = false;
          try { ok = document.execCommand("copy"); } catch (e) {}
          ta.remove();
          if (!ok && navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
        } catch (e) {
          if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
        }
      },
      args: [text],
    })
    .catch(() => {});
}

// Небольшой тост прямо на странице Meet — наглядная обратная связь.
function toast(tabId, message, isError) {
  chrome.scripting
    .executeScript({
      target: { tabId },
      func: (msg, err) => {
        const d = document.createElement("div");
        d.textContent = msg;
        Object.assign(d.style, {
          position: "fixed", top: "16px", right: "16px", zIndex: "2147483647",
          padding: "12px 16px", borderRadius: "10px",
          font: "600 14px -apple-system,system-ui,sans-serif", color: "#fff",
          background: err ? "#d33" : "#16a34a", boxShadow: "0 6px 20px rgba(0,0,0,.28)",
        });
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 6000);
      },
      args: [message, !!isError],
    })
    .catch(() => {});
}
