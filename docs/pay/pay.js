// docs/pay/pay.js

const $ = (id) => document.getElementById(id);

const amtGrid = $("amtGrid");
const customAmt = $("customAmt");
const nameInput = $("nameInput");
const phoneInput = $("phoneInput");
const wishInput = $("wishInput");
const payBtn = $("payBtn");
const statusEl = $("status");
const miniUser = $("miniUser");
const closeBtn = $("closeBtn");

const LS_USER = "gongde_user_v2";

// ===== Supabase (we'll fill later in Step 5) =====
const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";      // e.g. "https://xxxx.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw"; // public anon key

function makeUser() {
  const a = Math.random().toString(16).slice(2, 6).toUpperCase();
  const b = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `善信_${a}${b}`;
}

const username = localStorage.getItem(LS_USER) || makeUser();
localStorage.setItem(LS_USER, username);
miniUser.textContent = `匿名用户: ${username}`;

function setSelectedButton(btn) {
  document.querySelectorAll(".amt").forEach((b) => b.classList.remove("selected"));
  if (btn) btn.classList.add("selected");
}

function parseAmount() {
  const selected = document.querySelector(".amt.selected");
  const picked = selected?.dataset?.amt ? Number(selected.dataset.amt) : null;

  const custom = Number(String(customAmt.value || "").replace(/[^\d.]/g, ""));
  const useCustom = Number.isFinite(custom) && custom > 0;

  const amt = useCustom ? custom : picked;
  if (!Number.isFinite(amt) || amt <= 0) return null;

  // clamp to 2 decimals
  return Math.round(amt * 100) / 100;
}

// button select behavior
amtGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".amt");
  if (!btn) return;
  setSelectedButton(btn);
  // if user clicks a preset, clear custom
  if (btn.dataset.amt) customAmt.value = "";
});

// typing custom amount unselects presets
customAmt.addEventListener("input", () => {
  if (String(customAmt.value || "").trim().length > 0) {
    setSelectedButton(null);
  }
});

closeBtn?.addEventListener("click", () => {
  // just a fake close for now
  statusEl.textContent = "（已关闭弹窗：演示）";
});

// ===== Post donation (demo now, supabase later) =====
async function postDonation({ username, amount, name, phone, wish }) {
  // Demo mode: no backend
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: true, mode: "demo" };
  }

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await supabase.from("donations").insert({
    username,
    amount,
    name,
    phone,
    wish,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "supabase" };
}

// ===== Pay =====
payBtn.addEventListener("click", async () => {
  const amount = parseAmount();
  if (amount == null) {
    statusEl.textContent = "请选择金额或输入金额。";
    return;
  }

  const name = (nameInput.value || "").trim() || username;
  const phone = (phoneInput.value || "").trim();
  const wish = (wishInput.value || "").trim();

  payBtn.disabled = true;
  statusEl.textContent = "正在唤起微信支付…（演示）";

  const res = await postDonation({ username, amount, name, phone, wish });

  if (!res.ok) {
    statusEl.textContent = `失败：${res.error || "未知错误"}`;
    payBtn.disabled = false;
    return;
  }

  statusEl.textContent =
    res.mode === "supabase"
      ? "支付成功。功德已记录，将显像于主殿。"
      : "支付成功（演示模式）。已向主殿广播。";

  // Local broadcast (for testing): shrine listens on "gongde"
  if ("BroadcastChannel" in window) {
    const chan = new BroadcastChannel("gongde");
    chan.postMessage({ type: "donation", username: name, amount });
    chan.close();
  }

  setTimeout(() => {
    payBtn.disabled = false;
  }, 700);
});
