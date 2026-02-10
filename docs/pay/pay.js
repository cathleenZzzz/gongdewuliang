// docs/pay/pay.js
const $ = (id) => document.getElementById(id);

const userEl = $("user");
const balEl = $("balance");
const amtEl = $("amount");
const statusEl = $("status");
const donateBtn = $("donate");

const adModal = $("adModal");
const closeAd = $("closeAd");

const LS_USER = "gongde_user_v1";
const LS_DONATED = "gongde_donated_v1";

// ===== Username =====
function makeUser() {
  const a = Math.random().toString(16).slice(2, 6).toUpperCase();
  const b = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `善信_${a}${b}`;
}
const username = localStorage.getItem(LS_USER) || makeUser();
localStorage.setItem(LS_USER, username);
userEl.textContent = username;

// ===== Balance (fake) =====
let balance = 10000.0;
balEl.textContent = `¥ ${balance.toFixed(2)}`;

// ===== Ads =====
let adsEnabled = localStorage.getItem(LS_DONATED) !== "yes";
let adTimer = null;

function showAd() {
  if (!adsEnabled) return;
  adModal.classList.remove("hidden");
}

function hideAd() {
  adModal.classList.add("hidden");
}

function scheduleNextAd() {
  if (!adsEnabled) return;
  const ms = (10 + Math.random() * 10) * 1000; // 10–20s
  clearTimeout(adTimer);
  adTimer = setTimeout(() => {
    showAd();
    scheduleNextAd();
  }, ms);
}

closeAd.addEventListener("click", hideAd);
scheduleNextAd();

// ===== Supabase optional hookup =====
// You will paste your keys later. Until then, it stays in DEMO MODE.
const SUPABASE_URL = ""; // e.g. "https://xxxx.supabase.co"
const SUPABASE_ANON_KEY = ""; // "eyJhbGciOi..."

async function postDonationToBackend({ username, amount }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: true, mode: "demo" };
  }

  // Import via CDN (works on GitHub Pages)
  // jsDelivr shows current versions; pin if you want.
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"); :contentReference[oaicite:0]{index=0}
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await supabase.from("donations").insert({
    username,
    amount: Number(amount),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "supabase" };
}

// ===== Donation flow =====
function parseAmount(v) {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  if (n > 999999) return null;
  return Math.round(n * 100) / 100;
}

document.querySelectorAll(".q").forEach((btn) => {
  btn.addEventListener("click", () => {
    amtEl.value = btn.dataset.amt || "";
    amtEl.focus();
  });
});

donateBtn.addEventListener("click", async () => {
  const amt = parseAmount(amtEl.value);
  if (amt == null) {
    statusEl.textContent = "请输入有效金额。";
    return;
  }

  donateBtn.disabled = true;
  statusEl.textContent = "处理中…";

  // Fake balance decrease
  balance = Math.max(0, balance - amt);
  balEl.textContent = `¥ ${balance.toFixed(2)}`;

  const res = await postDonationToBackend({ username, amount: amt });

  if (!res.ok) {
    statusEl.textContent = `失败：${res.error || "未知错误"}`;
    donateBtn.disabled = false;
    return;
  }

  // Stop ads after first successful “donation”
  adsEnabled = false;
  localStorage.setItem(LS_DONATED, "yes");
  clearTimeout(adTimer);
  hideAd();

  statusEl.textContent =
    res.mode === "supabase"
      ? "供奉成功。已同步至主殿。"
      : "供奉成功（演示模式）。";

  // In same-device cases, broadcast to any open shrine tab
  if ("BroadcastChannel" in window) {
    const chan = new BroadcastChannel("gongde");
    chan.postMessage({ type: "donation", username, amount: amt });
    chan.close();
  }

  // tiny “receipt” delay then re-enable for multiple donations
  setTimeout(() => {
    donateBtn.disabled = false;
    amtEl.value = "";
    amtEl.focus();
  }, 600);
});
