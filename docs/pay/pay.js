const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

console.log("PAY.JS VERSION: NO_OUTCOME_MODAL + ADS", Date.now());

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
function randInt(min, max){ return Math.floor(min + Math.random() * (max - min + 1)); }

function renderProgress(){
  totalEl.textContent = fmt(total);
  const pct = clamp((total / TARGET) * 100, 0, 100);
  pctEl.textContent = String(Math.floor(pct));
  fillEl.style.width = `${pct}%`;
  const remaining = Math.max(0, TARGET - total);
  remainingEl.textContent = fmt(remaining);
}

// ===== username generator =====
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

// ===== modal: ONLY ADS use this now =====
function openModalHtml(html){
  modalBody.innerHTML = html;
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  modal.setAttribute("aria-hidden", "true");
}

// close handlers (no progress reset on close)
function handleClose(){
  closeModal();
}
modalClose?.addEventListener("click", handleClose);
modalX?.addEventListener("click", handleClose);
modalOk?.addEventListener("click", handleClose);

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

    const safeUsername =
      (typeof username === "string" && username.trim()) ? username.trim() : makeUsername();

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

    // same-device shrine ping
    if ("BroadcastChannel" in window) {
      const ch = new BroadcastChannel("gongde");
      ch.postMessage({ type: "donation", username: safeUsername, amount: String(amt) });
      ch.close();
    }

    amountInput.value = "";
    pills.forEach(x => x.classList.remove("active"));

    // ✅ milestone behavior changed: NO POPUP, just reset when reached
    if (total >= TARGET) {
      total = 0;
      renderProgress();
      setStatus("tier reset");
    }

  } catch (e){
    console.error(e);
    setStatus("error — try again");
  } finally {
    payBtn.disabled = false;
  }
});

// ===== UGLY ADS (20–40s random), never stack =====
function scheduleAd(){
  const ms = randInt(20_000, 40_000);
  setTimeout(() => {
    showAd();
    scheduleAd();
  }, ms);
}

function showAd(){
  // don’t stack popups
  if (modal.getAttribute("aria-hidden") === "false") return;

  const offer = randInt(88, 988);

  openModalHtml(`
    <div class="ad-wrap">
      <div class="ad-line ad-top">
        Advance to improve outcomes.<br/>
        Maintain alignment to keep momentum.
      </div>

      <div class="ad-line ad-amount">$${offer}</div>

      <button class="ad-cta" id="adCtaBtn">
        MAKE OFFERING + PROGRESS FORTH
      </button>
    </div>
  `);

  document.getElementById("adCtaBtn")?.addEventListener("click", () => {
    closeModal();
    amountInput?.focus?.();
  }, { once: true });
}

scheduleAd();

// back button
document.getElementById("backBtn")?.addEventListener("click", () => history.back());

// ✅ remove the warn button behavior entirely (prevents “outcome update” popup)
document.getElementById("warnBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
});
