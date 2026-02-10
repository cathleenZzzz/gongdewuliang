const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

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
const modalClose = document.getElementById("modalClose");
const modalX = document.getElementById("modalX");
const modalOk = document.getElementById("modalOk");

const TARGET = 88888;

// ===== identity (NEW every reload) =====
const username = makeUsername();
usernameEl.textContent = username;

// ===== progress (session only) =====
let total = 0;
renderProgress();
setStatus("ready");

function setStatus(msg){ statusEl.textContent = msg; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }
function fmt(n){ return Number(n).toLocaleString("en-US"); }

function renderProgress(){
  totalEl.textContent = fmt(total);
  const pct = clamp((total / TARGET) * 100, 0, 100);
  pctEl.textContent = String(Math.floor(pct));
  fillEl.style.width = `${pct}%`;
  const remaining = Math.max(0, TARGET - total);
  remainingEl.textContent = fmt(remaining);
}

// ===== username generator (wide pool; Chinese allowed, UI stays non-Chinese) =====
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
    // Chinese allowed
    "狐","猫","风","月","光","林","云","星","桥","梦","纸","金","银",
    // Japanese
    "さくら","ゆめ","ひかり",
    // Korean
    "빛","달","별",
    // Greek-ish tokens
    "Atlas","Helios","Nyx",
    // misc
    "Oro","Soleil","Morgen","Noche","Cielo"
  ];

  const join = ["_","-",".","~"];
  const num = ["01","07","13","21","33","55","88","144","233","404","777","999","2026"];
  const mark = ["","✨","🪙","🧿","🕯️"];

  return `${choice(prefix)}${choice(core)}${choice(join)}${choice(num)}${choice(mark)}`;
}

// ===== presets & input =====
pills.forEach((p) => {
  p.addEventListener("click", () => {
    pills.forEach(x => x.classList.remove("active"));
    p.classList.add("active");
    amountInput.value = String(p.dataset.amt || "");
    amountInput.focus();
  });
});

amountInput.addEventListener("input", () => {
  amountInput.value = amountInput.value.replace(/[^\d]/g, "");
});

maxBtn.addEventListener("click", () => {
  const need = clamp(TARGET - total, 0, 999999);
  amountInput.value = String(need || 0);
  amountInput.focus();
});

function getAmount(){
  const raw = (amountInput.value || "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

// ===== modal =====
function openModal(text){
  modalBody.textContent = text;
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.setAttribute("aria-hidden", "true");
}
function resetProgress(){
  total = 0;
  renderProgress();
  amountInput.value = "";
  pills.forEach(x => x.classList.remove("active"));
  setStatus("ready");
}
modalClose.addEventListener("click", () => { closeModal(); resetProgress(); });
modalX.addEventListener("click", () => { closeModal(); resetProgress(); });
modalOk.addEventListener("click", () => { closeModal(); resetProgress(); });

// ===== Supabase client =====
let supabase = null;
async function getSupabase(){
  if (supabase) return supabase;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// ===== pay action =====
payBtn.addEventListener("click", async () => {
  const amt = getAmount();
  if (!amt) { setStatus("enter an amount"); return; }

  payBtn.disabled = true;
  setStatus("submitting…");

  try{
    const sb = await getSupabase();

    // ✅ FIX: your column is `username`, not `name`
    const { error } = await sb.from("donations").insert({
      username: username,
      amount: amt
    });

    if (error) throw error;

    total += amt;
    renderProgress();
    setStatus("accepted");

    // optional same-device shrine ping
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("gongde");
      ch.postMessage({ type: "donation", username, amount: String(amt) });
      ch.close();
    }

    // milestone
    if (total >= TARGET) {
      openModal(
        "You have reached a new tier of stability. " +
        "Expect improved timing, better decisions, and a smoother path forward. " +
        "Maintain alignment to preserve momentum."
      );
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

// top buttons
document.getElementById("backBtn")?.addEventListener("click", () => history.back());
document.getElementById("warnBtn")?.addEventListener("click", () => {
  openModal("This terminal records commitments and reflects progress in real time.");
});
