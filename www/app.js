/* Mudae APK — lógica offline-first + multiplayer opcional (Firebase).
 * Sem build: app vanilla. Troque firebase-config.js pelos seus dados para ativar o online.
 */
const $ = (s) => document.querySelector(s);
const LS_KEY = "mudae_apk_v1";
const RARITY_WEIGHT = { D: 45, C: 30, B: 18, A: 10, S: 5, SS: 2, SSS: 1 };
const KAKERA = { D: 3, C: 6, B: 12, A: 30, S: 80, SS: 200, SSS: 500 };
const MAX_ROLLS = 10, REGEN_MS = 3 * 60 * 1000, CLAIM_MS = 30 * 1000, CHAR_COOLDOWN_MS = 50 * 1000;
const DAILY_MS = 20 * 60 * 60 * 1000, DAILY_REWARD = 500;

let CHARS = [];
let byId = {};
let state = load() || fresh();
let current = null, claimDeadline = 0, claimTimerInt = null, currentCanMarry = false;

function fresh() {
  return { nickname: "Player" + Math.floor(Math.random() * 900 + 100),
    kakera: 50, harem: [], wishlist: [], rolls: MAX_ROLLS,
    lastRegen: Date.now(), lastDaily: 0, history: [], cd: {} };
}
function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; } }
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function placeholder(name) {
  const ini = (name || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#7c3aed'/><stop offset='1' stop-color='#ec4899'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='50%' y='54%' font-size='180' text-anchor='middle' fill='white' font-family='Arial' font-weight='bold'>${ini}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
window.imgFail = function (el) { el.onerror = null; const n = el.dataset.name || "?"; el.src = placeholder(n); };

function regen() {
  const now = Date.now();
  const elapsed = now - (state.lastRegen || now);
  const gain = Math.floor(elapsed / REGEN_MS);
  if (gain > 0) { state.rolls = Math.min(MAX_ROLLS, state.rolls + gain); state.lastRegen += gain * REGEN_MS; save(); }
}
function weightedPick() {
  const pool = [], w = [];
  for (const c of CHARS) { pool.push(c); w.push(Math.max(1, RARITY_WEIGHT[c.rarity] ?? 12)); }
  let tot = w.reduce((a, b) => a + b, 0), r = Math.random() * tot;
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function earnKakera(c, reason) {
  const v = KAKERA[c.rarity] ?? 10;
  state.kakera += v;
  pushHist(`${c.emoji} ${c.name} → +${v}💠 (${reason})`);
  save(); renderWallet();
}
function pushHist(t) { state.history.unshift(new Date().toLocaleTimeString() + " " + t); state.history = state.history.slice(0, 30); }

// ---------- ROLL ----------
function doRoll() {
  regen();
  if (state.rolls <= 0) { setStatus("Sem 🎲! Aguarde recarregar ou compre na loja."); return; }
  const c = weightedPick();
  if (!c) return;
  const now = Date.now();
  const last = state.cd[c.id] || 0;
  const inCd = now - last < CHAR_COOLDOWN_MS;
  state.rolls -= 1;
  // só atualiza o cooldown quando o roll foi válido (igual ao bot: bloqueado não renova)
  current = c;
  currentCanMarry = false;
  clearInterval(claimTimerInt);
  $("#claimTimer").classList.add("hidden");
  const owned = state.harem.includes(c.id);
  showCard(c, { owned, inCd });
  if (owned) {
    setStatus(`Você já casou com ${c.name} — converta em kakera 💠.`);
    $("#btnMarry").disabled = true; $("#btnKakera").classList.remove("hidden");
  } else if (inCd) {
    const s = Math.ceil((CHAR_COOLDOWN_MS - (now - last)) / 1000);
    setStatus(`⏳ ${c.name} em cooldown (${s}s). Aguarde para poder casar — igual ao bot.`);
    $("#btnMarry").disabled = true; $("#btnKakera").classList.remove("hidden");
    $("#btnKakera").textContent = `💠 Pegar kakera em vez de esperar`;
  } else {
    state.cd[c.id] = now;
    setStatus(`Reaja com 💍 em até 30s para casar!`);
    startClaim(c);
  }
  pushHist(`🎲 ${c.emoji} ${c.name} (${c.series}) [${c.rarity}]`);
  save(); renderWallet(); renderHistory();
}
function showCard(c, opts = {}) {
  const img = $("#rollImg");
  img.dataset.name = c.name; img.onerror = () => imgFail(img); img.src = c.image || placeholder(c.name); img.alt = c.name;
  $("#rollRarity").textContent = c.rarity; $("#rollRarity").className = "rarity " + c.rarity;
  $("#rollName").textContent = `${c.emoji} ${c.name}`;
  $("#rollSeries").textContent = `${c.series} • vale ${KAKERA[c.rarity] ?? 10}💠 • ${c.img_src === "fandom" ? "imagem wiki (pode falhar → placeholder)" : "imagem AniList"}`;
}
function setStatus(t) { $("#rollStatus").textContent = t; }
function startClaim(c) {
  clearInterval(claimTimerInt);
  currentCanMarry = true;
  claimDeadline = Date.now() + CLAIM_MS;
  $("#btnMarry").disabled = false; $("#btnKakera").classList.add("hidden");
  $("#claimTimer").classList.remove("hidden");
  claimTimerInt = setInterval(() => {
    const s = Math.ceil((claimDeadline - Date.now()) / 1000);
    if (s <= 0) { clearInterval(claimTimerInt); $("#claimTimer").classList.add("hidden");
      $("#btnMarry").disabled = true;
      currentCanMarry = false;
      if (current && !state.harem.includes(current.id)) {
        $("#btnKakera").classList.remove("hidden");
        $("#btnKakera").textContent = `💠 +kakera`;
        setStatus(`${current.name} fugiu! Converta o encontro em kakera 💠.`);
      }
      return;
    }
    $("#claimSecs").textContent = s;
  }, 500);
}
function doMarry() {
  if (!current) return;
  if (!currentCanMarry) { setStatus("Esse personagem está em cooldown. Dê outro ROLL."); return; }
  if (Date.now() > claimDeadline) { setStatus("Tempo esgotado."); currentCanMarry = false; return; }
  if (state.harem.includes(current.id)) { setStatus("Você já está casado com essa pessoa."); return; }
  // checagem multiplayer (se online, bloqueia se outro dono)
  if (window._fbClaimed && window._fbClaimed[current.id] && window._fbClaimed[current.id] !== state.nickname) {
    setStatus(`💔 ${current.name} já está casado com ${window._fbClaimed[current.id]} (global).`);
    return;
  }
  state.harem.push(current.id);
  clearInterval(claimTimerInt); $("#claimTimer").classList.add("hidden");
  $("#btnMarry").disabled = true;
  currentCanMarry = false;
  setStatus(`💍 Você casou com ${current.name} (${current.series})!`);
  pushHist(`💍 Casou com ${current.name}`);
  if (window._fbMarry) window._fbMarry(current).catch(() => {});
  save(); renderAll();
}

// ---------- RENDER ----------
function cell(c) {
  const owned = state.harem.includes(c.id), wished = state.wishlist.includes(c.id);
  const d = document.createElement("div"); d.className = "cell";
  d.innerHTML = `<img loading="lazy" data-name="${c.name.replace(/"/g, "")}" src="${c.image}" alt="">
    <div class="pad"><b>${c.emoji} ${c.name}</b>
    <span class="badge">${c.rarity}</span><span class="badge">${c.series.slice(0, 14)}</span>
    ${owned ? "💍" : ""}${wished ? "⭐" : ""}</div>`;
  const img = d.querySelector("img"); img.onerror = () => imgFail(img);
  d.onclick = () => openModal(c);
  return d;
}
function renderWallet() { regen(); $("#rollsBadge").textContent = `🎲 ${state.rolls}`; $("#kakeraBadge").textContent = `💠 ${state.kakera}`; }
function renderHistory() { $("#history").innerHTML = state.history.map(h => `<li>${h}</li>`).join("") || "<li class='muted'>Nenhum roll ainda.</li>"; }
function renderHarem() {
  const g = $("#haremGrid"); g.innerHTML = "";
  $("#haremCount").textContent = state.harem.length;
  state.harem.map(id => byId[id]).filter(Boolean).forEach(c => g.appendChild(cell(c)));
  if (!state.harem.length) g.innerHTML = "<p class='muted'>Vazio. Dê ROLL e case com 💍.</p>";
}
function renderSearch() {
  const q = ($("#searchInput").value || "").toLowerCase();
  const fs = $("#filterSeries").value, fr = $("#filterRarity").value;
  const fw = $("#filterWish").checked, fo = $("#filterOwned").checked;
  const g = $("#searchGrid"); g.innerHTML = "";
  let list = CHARS.filter(c =>
    (!q || c.name.toLowerCase().includes(q) || c.series.toLowerCase().includes(q)) &&
    (!fs || c.series === fs) && (!fr || c.rarity === fr) &&
    (!fw || state.wishlist.includes(c.id)) && (!fo || state.harem.includes(c.id)));
  list.slice(0, 120).forEach(c => g.appendChild(cell(c)));
  if (!list.length) g.innerHTML = "<p class='muted'>Nada encontrado.</p>";
  else if (list.length > 120) g.innerHTML += `<p class='muted'>Mostrando 120 de ${list.length}.</p>`;
}
function renderRank() {
  const score = state.harem.length * 10 + state.kakera;
  const ss = state.harem.map(id => byId[id]).filter(c => c && (c.rarity === "SS" || c.rarity === "SSS")).length;
  $("#rankLocal").innerHTML = `<li><b>${state.nickname}</b> — ${state.harem.length} casamentos • ${ss} SS/SSS • ${state.kakera}💠 • score ${score}</li>`;
  const d = new Date(state.lastDaily + DAILY_MS - Date.now());
  $("#dailyInfo").textContent = Date.now() >= state.lastDaily + DAILY_MS ? "Daily disponível!" : `Próximo daily em ${d.getHours()}h${String(d.getMinutes()).padStart(2, "0")}.`;
}
function renderWish() {
  const g = $("#wishGrid"); g.innerHTML = "";
  $("#wishCount").textContent = state.wishlist.length;
  state.wishlist.map(id => byId[id]).filter(Boolean).forEach(c => g.appendChild(cell(c)));
  if (!state.wishlist.length) g.innerHTML = "<p class='muted'>Toque num personagem → ⭐ Wishlist.</p>";
}
function renderAll() { renderWallet(); renderHistory(); renderHarem(); renderSearch(); renderRank(); renderWish(); }

// ---------- MODAL ----------
let modalChar = null;
function openModal(c) {
  modalChar = c;
  const img = $("#mImg"); img.dataset.name = c.name; img.onerror = () => imgFail(img); img.src = c.image || placeholder(c.name);
  $("#mName").textContent = `${c.emoji} ${c.name}`;
  $("#mMeta").textContent = `${c.series} • ${c.rarity} • ${KAKERA[c.rarity] ?? 10}💠`;
  const owner = (window._fbClaimed && window._fbClaimed[c.id]) || (state.harem.includes(c.id) ? state.nickname + " (você)" : null);
  $("#mOwner").textContent = owner ? `💍 Casado com ${owner}` : "💔 Solteiro";
  $("#mWish").textContent = state.wishlist.includes(c.id) ? "★ Na wishlist" : "⭐ Wishlist";
  $("#modal").classList.remove("hidden");
}

// ---------- INIT ----------
async function init() {
  // tabs
  document.querySelectorAll(".tabbar button").forEach(b => b.onclick = () => {
    document.querySelectorAll(".tabbar button").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); $("#screen-" + b.dataset.tab).classList.add("active");
  });
  $("#btnRoll").onclick = doRoll;
  $("#btnMarry").onclick = doMarry;
  $("#btnKakera").onclick = () => { if (current) { earnKakera(current, "encontro"); $("#btnKakera").classList.add("hidden"); setStatus("Kakera resgatada!"); renderAll(); } };
  ["searchInput", "filterSeries", "filterRarity", "filterWish", "filterOwned"].forEach(id => $("#" + id).addEventListener("input", renderSearch));
  $("#mClose").onclick = () => $("#modal").classList.add("hidden");
  $("#modal").onclick = (e) => { if (e.target.id === "modal") $("#modal").classList.add("hidden"); };
  $("#mWish").onclick = () => {
    if (!modalChar) return;
    const i = state.wishlist.indexOf(modalChar.id);
    if (i >= 0) state.wishlist.splice(i, 1); else state.wishlist.push(modalChar.id);
    save(); openModal(modalChar); renderWish(); renderSearch();
  };
  $("#mDivorce").onclick = () => {
    if (!modalChar) return;
    state.harem = state.harem.filter(id => id !== modalChar.id);
    if (window._fbDivorce) window._fbDivorce(modalChar).catch(() => {});
    save(); $("#modal").classList.add("hidden"); renderAll();
  };
  $("#btnSaveNick").onclick = () => { state.nickname = ($("#nickInput").value || state.nickname).slice(0, 20); save(); renderRank(); };
  $("#btnDaily").onclick = () => {
    if (Date.now() < state.lastDaily + DAILY_MS) { renderRank(); return; }
    state.lastDaily = Date.now(); state.kakera += DAILY_REWARD; pushHist(`🎁 Daily +${DAILY_REWARD}💠`); save(); renderAll();
  };
  $("#btnShopRolls").onclick = () => {
    if (state.kakera < 150) return alert("Kakera insuficiente (150💠).");
    state.kakera -= 150; state.rolls = Math.min(99, state.rolls + 3); save(); renderAll();
  };
  $("#btnShopReset").onclick = () => {
    if (state.kakera < 50) return alert("Kakera insuficiente (50💠).");
    state.kakera -= 50; state.cd = {}; save(); renderAll();
  };
  $("#btnWipe").onclick = () => { if (confirm("Apagar tudo?")) { state = fresh(); save(); renderAll(); } };
  // trade por código
  $("#btnTradeExport").onclick = async () => {
    const code = btoa(unescape(encodeURIComponent(JSON.stringify({ n: state.nickname, h: state.harem })))).slice(0, 2000);
    await navigator.clipboard?.writeText(code).catch(() => {});
    prompt("Seu código de troca (copiado se possível):", code);
  };
  $("#btnShowImport").onclick = () => { $("#tradeBox").classList.remove("hidden"); $("#tradeRow").classList.remove("hidden"); };
  $("#btnTradeImport").onclick = () => {
    try {
      const obj = JSON.parse(decodeURIComponent(escape(atob($("#tradeBox").value.trim()))));
      const novo = (obj.h || []).filter(id => byId[id] && !state.harem.includes(id));
      state.harem.push(...novo); pushHist(`🔀 Importou ${novo.length} de ${obj.n || "amigo"}`); save(); renderAll();
    } catch { alert("Código inválido."); }
  };

  // dados
  try {
    const r = await fetch("./characters.json");
    CHARS = await r.json();
  } catch { $("#rollSeries").textContent = "Erro ao carregar characters.json"; return; }
  byId = Object.fromEntries(CHARS.map(c => [c.id, c]));
  const series = [...new Set(CHARS.map(c => c.series))].sort();
  series.forEach(s => { const o = document.createElement("option"); o.textContent = s; $("#filterSeries").appendChild(o); });
  $("#nickInput").value = state.nickname;
  renderAll();
  setInterval(renderWallet, 15000);
  initFirebase();
}

// ---------- FIREBASE OPCIONAL ----------
function initFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.includes("SUA_")) { $("#fbStatus").textContent = "Status: offline solo (sem config)."; return; }
  // carrega compat via CDN só quando configurado
  const load = (src) => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  (async () => {
    try {
      await load("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
      await load("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
      await load("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
      firebase.initializeApp(cfg);
      const db = firebase.firestore();
      await firebase.auth().signInAnonymously();
      $("#fbStatus").textContent = "Status: online 🌐 (Firestore conectado).";
      $("#onlineDot").classList.add("on");
      window._fbClaimed = {};
      db.collection("claims").onSnapshot(snap => {
        window._fbClaimed = {};
        snap.forEach(d => window._fbClaimed[d.id] = d.data().owner);
      });
      window._fbMarry = (c) => db.collection("claims").doc(c.id).set({ owner: state.nickname, at: Date.now(), series: c.series, rarity: c.rarity });
      window._fbDivorce = (c) => db.collection("claims").doc(c.id).delete();
      db.collection("players").doc(state.nickname).set({ harem: state.harem.length, kakera: state.kakera, at: Date.now() }, { merge: true });
      db.collection("players").orderBy("harem", "desc").limit(10).onSnapshot(snap => {
        $("#rankGlobal").innerHTML = ""; snap.forEach(d => { const li = document.createElement("li"); li.textContent = `${d.id} — ${d.data().harem} casamentos • ${d.data().kakera}💠`; $("#rankGlobal").appendChild(li); });
      });
    } catch (e) { $("#fbStatus").textContent = "Firebase falhou: " + e.message; }
  })();
}

document.addEventListener("DOMContentLoaded", init);
