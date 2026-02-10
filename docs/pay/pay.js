const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

console.log("PAY.JS VERSION: CLEAN REDBOX ONLY (ADS + MILESTONE)", Date.now());

const usernameEl = document.getElementById("username");
const totalEl = document.getElementById("total");
const pctEl = document.getElementById("pct");
const remainingEl = document.getElementById("remaining");
const fillEl = document.getElementById("fill");
const statusEl = document.getElementById("status");

const amountInput = document.getElementById("amountInput");
const payBtn = document.getElementById("payBtn");
const maxBtn = document.getElementById("maxBtn");
const pills = Array.from(document.querySelectorAll(".pill"));

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const backdrop = document.querySelector(".modalBackdrop"); // if present

const TARGET = 88888;

// ---------- helpers ----------
function setStatus(msg){ if (statusEl) statusEl.textContent = msg; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function fmt(n){ return Number(n).toLocaleString("en-US"); }
function randInt(min, max){ return Math.floor(min + Math.random() * (max - min + 1)); }
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

// ---------- identity (NEW each reload) ----------
const username = makeUsername();
if (usernameEl) usernameEl.textContent = username;

// ---------- progress (session only) ----------
let total = 0;
renderProgress();
setStatus("ready");

function renderProgress(){
  if (totalEl) totalEl.textContent = fmt(total);
  const pct = clamp((total / TARGET) * 100, 0, 100);
  if (pctEl) pctEl.textContent = String(Math.floor(pct));
  if (fillEl) fillEl.style.width = `${pct}%`;
  const remaining = Math.max(0, TARGET - total);
  if (remainingEl) remainingEl.textContent = fmt(remaining);
}

// ---------- username generator ----------
function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }
function makeUsername(){
  const prefix = [
    "Nova","Lumen","Civic","Orbit","Pilot","Analog","Archive","Index","Signal","Vector","Kernel","Public","Future","Tender","Solid",
    "Astra","Verde","Claro","Azul","Brio","Noble","Vasto",
    "Écho","Rêve","Noir","Blanc","Rouge",
    "Sombra","Brisa","Fuego",
    "Klar","Stern","Wolke",
    "Vita","Roma","Aurum",
    "Σ","Λ","Δ","Ψ","Ω",
    "К","Ж","Я","Мир"
  ];
  const core = [
    "狐","猫","风","月","光","林","云","星","桥","梦","纸","金","银",
    "さくら","ゆめ","ひかり",
    "빛","달","별",
    "Atlas","Helios","Nyx",
    "Oro","Soleil","Morgen","Noche","Cielo"
  ];
  const join = ["_","-",".","~"];
  const num = ["01","07","13","21","33","55","88","144","233","404","777","999","2026"];
  const mark = ["","✨","🪙","🧿","🕯️"];
  return `${choice(prefix)}${choice(core)}${choice(join)}${choice(num)}${choice(mark)}`;
}

// ---------- presets & input ----------
pills.forEach((p) => {
  p.addEventListener("click", () => {
    pills.forEach(x => x.classList.remove("active"));
    p.classList.add("active");
    amountInput.value = String(p.dataset.amt || "");
    amountInput.focus();
  });
});

amountInput?.addEventListener("input", () => {
  amountInput.value = amountInput.value.replace(/[^\d]/g, "");
});

maxBtn?.addEventListener("click", () => {
  const need = clamp(TARGET - total, 0, 999999);
  amountInput.value = String(need || 0);
  amountInput.focus();
});

function getAmount(){
  const raw = (amountInput?.value || "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// ---------- modal: ONLY red box ----------
let modalLock = false;       // blocks popup stacking
let currentModalKind = null; // "ad" | "milestone"

function openRedBox({ lineTop, amountText, ctaText }){
  // if something already open, do nothing (prevents overlays)
  if (modalLock) return;

  modalLock = true;

  modalBody.innerHTML = `
    <div class="ad-wrap">
      <div class="ad-line ad-top">${escapeHtml(lineTop).replace(/\n/g,"<br/>")}</div>
      <div class="ad-line ad-amount">${escapeHtml(amountText)}</div>
      <button class="ad-cta" id="adCtaBtn">${escapeHtml(ctaText)}</button>
    </div>
    <button class="ad-close" id="adCloseBtn">X</button>
  `;

  modal.setAttribute("aria-hidden", "false");

  document.getElementById("adCtaBtn")?.addEventListener("click", () => closeModal(), { once:true });
  document.getElementById("adCloseBtn")?.addEventListener("click", () => closeModal(), { once:true });
}

function closeModal(){
  modal.setAttribute("aria-hidden", "true");
  modalBody.innerHTML = "";

  // if milestone was open, reset progress AFTER close
  if (currentModalKind === "milestone") {
    total = 0;
    renderProgress();
    setStatus("tier reset");
  }

  currentModalKind = null;

  setTimeout(() => { modalLock = false; }, 160);
}

// click backdrop closes too
backdrop?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ---------- Supabase client ----------
let supabase = null;
async function getSupabase(){
  if (supabase) return supabase;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// ---------- pay action ----------
payBtn?.addEventListener("click", async () => {
  const amt = getAmount();
  if (!amt) { setStatus("enter an amount"); return; }

  payBtn.disabled = true;
  setStatus("submitting…");

  try{
    const sb = await getSupabase();
    const safeUsername = (username && username.trim()) ? username.trim() : makeUsername();

    const { error } = await sb.from("donations").insert({
      username: safeUsername,
      amount: amt,
      name: safeUsername,
      phone: "",
      wish: ""
    });
    if (error) throw error;

    total += amt;
    renderProgress();
    setStatus("accepted");

    // optional same-device shrine ping
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("gongde");
      ch.postMessage({ type: "donation", username: safeUsername, amount: String(amt) });
      ch.close();
    }

    // milestone: show red box ONLY
    if (total >= TARGET) {
      // allow milestone even if ad timer is near
      modalLock = false;
      currentModalKind = "milestone";

      openRedBox({
        lineTop: "Advance to improve outcomes.\nMaintain alignment to keep momentum.",
        amountText: "$" + fmt(TARGET),
        ctaText: "CONTINUE"
      });
    }

    amountInput.value = "";
    pills.forEach(x => x.classList.remove("active"));
  } catch (e){
    console.error(e);
    setStatus("error — try again");
  } finally {
    payBtn.disabled = false;
  }
});

// ---------- ADS (random 20–40s) ----------
function scheduleAd(){
  const ms = randInt(20_000, 40_000);
  setTimeout(() => {
    showAd();
    scheduleAd();
  }, ms);
}

function showAd(){
  // don’t interrupt if a modal is already open
  if (modalLock) return;
  if (modal.getAttribute("aria-hidden") === "false") return;

  currentModalKind = "ad";

  const offer = randInt(88, 988);
  openRedBox({
    lineTop: "Advance to improve outcomes.\nMaintain alignment to keep momentum.",
    amountText: "$" + offer,
    ctaText: "MAKE OFFERING + PROGRESS FORTH"
  });
}

scheduleAd();

// back button
document.getElementById("backBtn")?.addEventListener("click", () => history.back());

// disable warn button completely
document.getElementById("warnBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
