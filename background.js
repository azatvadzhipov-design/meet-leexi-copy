/* Meet + Leexi (1-click)
 * Click the toolbar icon -> open a new Google Meet -> capture the final URL ->
 * copy the invite link to the clipboard -> create a meeting_event in Leexi with
 * to_record:true so the note-taker bot joins automatically.
 */
importScripts("config.js"); // -> self.LEEXI_CONFIG

const LEEXI_BASE = "https://public-api.leexi.ai/v1";
const LEEXI_ENDPOINT = LEEXI_BASE + "/meeting_events";
const LEEXI_USERS_ENDPOINT = LEEXI_BASE + "/users";
// Google Meet code like abc-defg-hij (3-4-3 lowercase letters)
const MEET_CODE_RE = /^https:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[?#].*)?$/;
const WAIT_TIMEOUT_MS = 60000;

chrome.action.onClicked.addListener(() => {
  startFlow().catch((e) => setBadge("ERR", "#c0392b", "Failed: " + e.message));
});

async function startFlow() {
  setBadge("…", "#888888", "Creating Meet…");
  const tab = await chrome.tabs.create({ url: "https://meet.google.com/new", active: true });
  const tabId = tab.id;

  const meetingUrl = await waitForMeetUrl(tabId, WAIT_TIMEOUT_MS);
  if (!meetingUrl) {
    setBadge("!", "#c0392b", "Could not get the Meet link (timeout / not signed in?)");
    return;
  }

  await copyToClipboard(tabId, meetingUrl); // put the invite link on the clipboard right away

  try {
    await inviteLeexi(meetingUrl);
    setBadge("✓", "#16a34a", "Leexi invited · link copied: " + meetingUrl);
    toast(tabId, "🎙️ Leexi invited · link copied 📋", false);
  } catch (e) {
    setBadge("ERR", "#c0392b", "Link copied, but Leexi not invited: " + e.message);
    toast(tabId, "📋 Link copied · Leexi NOT invited: " + e.message, true);
  }
}

// Wait until the /new tab resolves to a real meeting URL.
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
    // in case the URL is already resolved by the time we subscribe
    chrome.tabs.get(tabId, (t) => { if (!chrome.runtime.lastError && t) check(t.url); });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

function authHeader(C) {
  return "Basic " + btoa(`${C.key_id}:${C.key_secret}`);
}

// Resolve user_uuid: use the config value if set, otherwise look it up by the
// organizer email via GET /v1/users and cache it in chrome.storage.
async function resolveUserUuid(C) {
  if (C.user_uuid) return C.user_uuid;
  const email = (C.organizer || "").trim().toLowerCase();
  if (!email) throw new Error("organizer (email) is not set in config.js");

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
  if (!me) throw new Error("No Leexi user with email " + C.organizer);

  await chrome.storage.local.set({ leexi_user_uuid: me.uuid, leexi_user_email: email });
  return me.uuid;
}

async function inviteLeexi(meetingUrl) {
  const C = self.LEEXI_CONFIG;
  if (!C.key_id || !C.key_secret) throw new Error("key_id / key_secret are empty in config.js");
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

// Copy the invite link to the clipboard via the active Meet tab.
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

// Small toast on the Meet page for quick visual feedback.
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

function setBadge(text, color, title) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
  if (title) chrome.action.setTitle({ title });
  if (text && text !== "…") setTimeout(() => chrome.action.setBadgeText({ text: "" }), 8000);
}
