// Fortune Terminal — pay.js (no explicit platform / religion text)

const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

// ===== UI refs
const usernameEl = document.getElementById("username");
const totalEl = document.getElementById("total");
const pctEl = document.getElementById("pct");
const remainingEl = document.getElementById("remaining");
const fillEl = document.getElementById("fill");
const statusEl = document.getElementById("status");

const amountInput = document.getElementById("amountInput");
const payBtn = document.getElementById("payBtn");
const maxBtn = document.getElementById("maxBtn");

const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const modalX = document.getElementById("modalX");
const modalOk = document.getElementById("modalOk");

const pills = Array.from(document.querySelectorAll(".pill"));

const TARGET = 88888;

// ===== identity: NEW every reload
const username = makeUsername();
usernameEl.textContent = username;

// ===== progress (session only; reload resets)
let total = 0;
renderProgress();

// ===== helpers
function fmt(n){
  return Number(n).toLocaleString("en-US");
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function setStatus(msg){
  statusEl.textContent = msg;
}

// ===== username generator (mixed scripts)
function choice(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

function makeUsername(){
  const a = [
    "Nova","Hyper","Soft","Prime","Ultra","Cloud","Bright","Kind","Meta","Vector","Lumen","Civic","Future","Good","Plus","Zen",
    "Σ","Λ","Δ","Ψ","Ω","К","Ж","Я"
  ];
  const b = [
    "狐","猫","桃","风","月","光","林","纸","金","银","雨","梦","城","星","桥","云",
    "さくら","ゆめ","ひかり","まつり",
    "빛","달","별"
  ];
  const c = ["_","-",".","~"];
  const d = ["01","07","13","21","33","55","88","144","233","404","777","999"];
  const e = ["🪙","✨","🧧","🌙","🕯️","🫧","🧿"];

  // e.g. "Lumen猫~88🪙"
  return `${choice(a)}${choice(b)}${choice(c)}${choice(d)}${(Math.random() < 0.35 ? choice(e) : "")}`;
}

// ===== input + presets
pills.forEach((p) => {
  p.addEventListener("click", () => {
    pills.forEach(x => x.classList.remove("active"));
    p.classList.add("active");
    amountInput.value = p.dataset.amt;
    amountInput.focus();
  });
});

maxBtn.addEventListener("click", () => {
  // “Max” = remaining to hit target (cap at 99999 to avoid silly huge)
  const need = clamp(TARGET - total, 0, 99999);
  amountInput.value = String(need || 0);
  amountInput.focus();
});

amountInput.addEventListener("input", () => {
  // keep numeric only
  amountInput.value = amountInput.value.replace(/[^\d]/g, "");
});

function getAmount(){
  const raw = (amountInput.value || "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// ===== modal
function openModal(text){
  modalBody.textContent = text;
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.setAttribute("aria-hidden", "true");
}
modalClose.addEventListener("click", () => { closeModal(); resetProgress(); });
modalX.addEventListener("click", () => { closeModal(); resetProgress(); });
modalOk.addEventListener("click", () => { closeModal(); resetProgress(); });

function resetProgress(){
  total = 0;
  renderProgress();
  amountInput.value = "";
  pills.forEach(x => x.classList.remove("active"));
  setStatus("ready");
}

// ===== Supabase client (ESM)
let supabase = null;
async function getSupabase(){
  if (supabase) return supabase;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// ===== pay action
payBtn.addEventListener("click", async () => {
  const amt = getAmount();
  if (!amt) {
    setStatus("enter a number");
    return;
  }

  payBtn.disabled = true;
  setStatus("submitting…");

  try{
    // insert to Supabase
    const sb = await getSupabase();
    const { error } = await sb.from("donations").insert({
      name: username,
      amount: amt
    });

    if (error) throw error;

    // local progress update
    total += amt;
    renderProgress();

    // broadcast to shrine same-device (optional)
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("gongde");
      ch.postMessage({ type: "donation", username, amount: String(amt) });
      ch.close();
    }

    setStatus("accepted");

    // threshold
    if (total >= TARGET) {
      openModal(
        "Your trajectory has been upgraded. Expect smoother decisions, higher-quality outcomes, and a more optimized tomorrow. " +
        "Continue to align with beneficial systems."
      );
      // (reset happens on close)
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

function renderProgress(){
  totalEl.textContent = fmt(total);

  const pct = clamp((total / TARGET) * 100, 0, 100);
  pctEl.textContent = String(Math.floor(pct));
  fillEl.style.width = `${pct}%`;

  const remaining = Math.max(0, TARGET - total);
  remainingEl.textContent = fmt(remaining);
}

// optional back/info buttons (no navigation assumptions)
document.getElementById("backBtn")?.addEventListener("click", () => history.back());
document.getElementById("warnBtn")?.addEventListener("click", () => {
  openModal("This terminal improves your outlook through consistent micro-commitments. Results may feel immediate.");
});
