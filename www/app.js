"use strict";

const app = document.getElementById("app");

const LEVELS = [
  { n: 1, name: "Romântico", e: "💕", c: "var(--l1)" },
  { n: 2, name: "Provocante", e: "😏", c: "var(--l2)" },
  { n: 3, name: "Quente", e: "🔥", c: "var(--l3)" },
  { n: 4, name: "Sem filtro", e: "🌶️", c: "var(--l4)" },
];

const TAGS = [
  { k: "oral", label: "Oral" },
  { k: "toy", label: "Brinquedos eróticos" },
  { k: "bondage", label: "Vendas e amarras" },
  { k: "rough", label: "Pegada forte", sub: "tapas, mordidas, puxão de cabelo" },
];

const GAMES = [
  { id: "td", e: "🎭", n: "Verdade ou Desafio", d: "O clássico, com turnos e pontos" },
  { id: "dado", e: "🎲", n: "Dado do Prazer", d: "Ação + lugar + tempo, na sorte" },
  { id: "missao", e: "⏱️", n: "Missão Relâmpago", d: "Desafios contra o relógio" },
  { id: "eununca", e: "🙊", n: "Eu Nunca", d: "Confissões dos dois lados" },
  { id: "prefere", e: "⚖️", n: "Prefere?", d: "Isso ou aquilo — e a sintonia de vocês" },
  { id: "fantasia", e: "🎬", n: "Fantasias", d: "Cenários de roleplay com papéis" },
  { id: "conexao", e: "💞", n: "Conexão", d: "Perguntas para ir mais fundo" },
  { id: "vales", e: "🎟️", n: "Vales", d: "Sorteie e guarde para usar depois" },
  { id: "surpresa", e: "✨", n: "Surpresa", d: "Qualquer carta de qualquer jogo", wide: true },
];

const CUSTOM_TYPES = {
  verdade: "Verdade",
  desafio: "Desafio",
  missao: "Missão Relâmpago",
  eununca: "Eu Nunca",
  prefere: "Prefere?",
  vale: "Vale",
};

// ---------- armazenamento ----------
const store = {
  get(k, d) {
    try { const v = localStorage.getItem("nd_" + k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem("nd_" + k, JSON.stringify(v)); } catch {}
  },
};

const S = Object.assign(
  { names: ["Você", "Amor"], levels: [1, 2], blocked: [], escalada: false, pin: "" },
  store.get("settings", {})
);
const saveS = () => store.set("settings", S);
let score = store.get("score", [0, 0]);
let favs = store.get("favs", []);
let custom = store.get("custom", []);
let wallet = store.get("wallet", []);

let turn = 0;
let drawn = 0;
const seen = {};
let locked = !!S.pin;
let timer = null;
let sintonia = [0, 0];

// ---------- utilidades ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const A = () => S.names[turn] || "Jogador 1";
const B = () => S.names[1 - turn] || "Jogador 2";
const fill = (t) => esc(t).replace(/\{a\}/g, `<u>${esc(A())}</u>`).replace(/\{b\}/g, `<u>${esc(B())}</u>`);
const plain = (t) => String(t).replace(/\{a\}/g, A()).replace(/\{b\}/g, B());
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nextTurn = () => { turn = 1 - turn; };

function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

// Confirmação dentro do app (o confirm() nativo não funciona bem no WebView)
function ask(msg, yes = "Sim", no = "Cancelar") {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = `<div class="dialog"><p>${esc(msg)}</p><div class="actions">
      <button class="btn" data-r="0">${esc(no)}</button><button class="btn primary" data-r="1">${esc(yes)}</button></div></div>`;
    ov.addEventListener("click", (e) => {
      const b = e.target.closest("[data-r]");
      if (!b && e.target !== ov) return;
      ov.remove();
      resolve(b?.dataset.r === "1");
    });
    document.body.appendChild(ov);
  });
}

const RAIN = {
  1: ["💕", "💖", "🥰", "✨", "💗"],
  2: ["😏", "💋", "💕", "✨", "😘"],
  3: ["🔥", "💋", "😈", "💦", "❤️‍🔥"],
  4: ["🌶️", "🔥", "😈", "💦", "💋"],
};

// Animação do vale sendo usado: carimbo, rasgo ao meio e chuva de emojis
function celebrateCoupon(w) {
  return new Promise((resolve) => {
    const ov = document.createElement("div");
    ov.className = "overlay used";
    const half = (side) => `<div class="ticket ${side}">
      <small>🎟️ Vale de ${esc(S.names[w.owner])}</small><div>${esc(w.t)}</div>
      <span class="stamp">USADO!</span></div>`;
    ov.innerHTML = `<div class="used-box">
      <div class="ticket-wrap">${half("l")}${half("r")}</div>
      <p class="used-msg">${esc(S.names[w.owner])} resgatou o vale!<br><b>Aproveitem 😘</b></p>
    </div>`;
    document.body.appendChild(ov);
    const wrap = ov.querySelector(".ticket-wrap");
    const emojis = RAIN[w.l] || RAIN[1];
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      ov.classList.add("out");
      setTimeout(() => { ov.remove(); resolve(); }, 250);
    };
    setTimeout(() => { wrap.classList.add("thump"); try { navigator.vibrate?.(60); } catch {} }, 800);
    setTimeout(() => {
      wrap.classList.add("torn");
      try { navigator.vibrate?.([30, 40, 30]); } catch {}
      for (let i = 0; i < 36; i++) {
        const s = document.createElement("span");
        s.className = "drop";
        s.textContent = rand(emojis);
        s.style.left = Math.random() * 100 + "vw";
        s.style.fontSize = 20 + Math.random() * 22 + "px";
        s.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
        s.style.animationDelay = Math.random() * 0.6 + "s";
        ov.appendChild(s);
      }
      ov.addEventListener("click", close);
    }, 1500);
    setTimeout(close, 4800);
  });
}

function buzz() {
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((d) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.2);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.2);
    });
  } catch {}
}

// ---------- baralhos ----------
function activeLevels() {
  const sel = [...S.levels].sort();
  if (!S.escalada || sel.length < 2) return sel;
  return [sel[Math.min(sel.length - 1, Math.floor(drawn / 6))]];
}

function pool(type) {
  let base = [];
  if (["verdade", "desafio", "eununca", "vale"].includes(type))
    base = DATA[type].map(([l, t, tag], i) => ({ id: type + i, l, t, tag }));
  if (type === "missao") base = DATA.missao.map(([l, t, sec, tag], i) => ({ id: "m" + i, l, t, sec, tag }));
  if (type === "prefere") base = DATA.prefere.map(([l, a, b, tag], i) => ({ id: "p" + i, l, a, b, tag }));
  if (type === "fantasia") base = DATA.fantasia.map((f, i) => ({ ...f, id: "f" + i, tag: f.tags }));
  if (type === "conexao") base = DATA.conexao.map((t, i) => ({ id: "c" + i, l: 1, t }));
  const mine = custom.filter((c) => c.type === type).map((c) => {
    if (type !== "prefere") return c;
    const [a, b] = c.t.split("|");
    return { ...c, a: a.trim(), b: (b || "").trim() };
  });
  return base.concat(mine);
}

const allowedTag = (c) => !(c.tag && S.blocked.includes(c.tag));

function draw(type, opts = {}) {
  const lv = activeLevels();
  const cards = pool(type).filter((c) => (opts.anyLevel || lv.includes(c.l)) && allowedTag(c));
  if (!cards.length) return null;
  const set = (seen[type] ||= new Set());
  let fresh = cards.filter((c) => !set.has(c.id));
  if (!fresh.length) { set.clear(); fresh = cards; }
  const c = rand(fresh);
  set.add(c.id);
  if (!opts.anyLevel) drawn++;
  return { ...c, type };
}

function pickDie(list) {
  const lv = activeLevels();
  const ok = list.filter(([l, , tag]) => lv.includes(l) && !(tag && S.blocked.includes(tag)));
  return ok.length ? rand(ok) : rand(list.filter(([l]) => l === 1));
}

// ---------- favoritos ----------
const favKey = (c) => c.type + ":" + c.id;
const isFav = (c) => favs.some((f) => f.k === favKey(c));
function toggleFav(c, text) {
  if (isFav(c)) favs = favs.filter((f) => f.k !== favKey(c));
  else favs.unshift({ k: favKey(c), type: c.type, l: c.l, t: text });
  store.set("favs", favs);
  toast(isFav(c) ? "Salvo nos favoritos ❤️" : "Removido dos favoritos");
  render();
}

// ---------- navegação ----------
let cur = { name: "home", p: {} };
const hist = [];
let on = {};

function go(name, p = {}) {
  stopTimer();
  hist.push(cur);
  cur = { name, p };
  render();
  window.scrollTo(0, 0);
}
function back() {
  stopTimer();
  if (locked || !hist.length) return false;
  cur = hist.pop();
  render();
  return true;
}
function render() {
  if (locked) return scrLock();
  (SCREENS[cur.name] || SCREENS.home)(cur.p);
}
function view(html, handlers = {}) {
  app.innerHTML = html;
  on = Object.assign({
    back: () => back(),
    swap: () => { nextTurn(); render(); },
  }, handlers);
}
app.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (el && on[el.dataset.act]) on[el.dataset.act](el, e);
});

// ---------- componentes ----------
const topBar = (title, right = "") =>
  `<div class="top"><button class="icon-btn" data-act="back">←</button><h1>${title}</h1>${right}</div>`;

const turnHtml = (label = "Vez de") =>
  `<div class="turn">${label}<b>${esc(A())}</b><button class="swap" data-act="swap">trocar vez</button></div>`;

function levelBadge(l) {
  const L = LEVELS[l - 1];
  return `<span class="badge">${L.e} ${L.name}</span>`;
}

function card(c, kicker, inner, { fav = true } = {}) {
  const L = LEVELS[(c.l || 1) - 1];
  return `<div class="card" style="--c:${L.c}">
    ${fav ? `<button class="fav" data-act="fav">${isFav(c) ? "❤️" : "🤍"}</button>` : ""}
    ${levelBadge(c.l || 1)}
    <div class="kicker">${kicker}</div>${inner}</div>`;
}

function escaladaHint() {
  if (!S.escalada || S.levels.length < 2) return "";
  const L = LEVELS[activeLevels()[0] - 1];
  return `<p class="hint">Escalada ligada: agora em ${L.e} ${L.name}. Sobe a cada 6 cartas.</p>`;
}

const emptyHtml = (title) =>
  view(`${topBar(title)}<div class="empty">Nenhuma carta para os níveis e limites escolhidos.<br><br>Ajuste os níveis na tela inicial ou adicione cartas suas em Ajustes.</div>`);

// ---------- telas ----------
const SCREENS = {};

SCREENS.home = () => {
  const lv = LEVELS.map((L) =>
    `<button class="lvl ${S.levels.includes(L.n) ? "on" : ""}" style="--c:${L.c}" data-act="lvl" data-n="${L.n}"><span class="e">${L.e}</span>${L.name}</button>`
  ).join("");
  const games = GAMES.map((g) =>
    g.wide
      ? `<button class="game wide" data-act="game" data-id="${g.id}"><span class="e">${g.e}</span><div><b>${g.n}</b><span>${g.d}</span></div></button>`
      : `<button class="game" data-act="game" data-id="${g.id}"><span class="e">${g.e}</span><b>${g.n}</b><span>${g.d}</span></button>`
  ).join("");
  view(`
    <div class="brand"><div class="logo">🔥</div><h1>Nós Dois</h1><p>${esc(S.names[0])} & ${esc(S.names[1])}</p></div>
    <div class="score">
      <div><b>${score[0]}</b><span>${esc(S.names[0])}</span></div>
      <div><b>${score[1]}</b><span>${esc(S.names[1])}</span></div>
    </div>
    <div class="section-label">Intensidade</div>
    <div class="levels">${lv}</div>
    ${escaladaHint()}
    <div class="section-label">Jogos</div>
    <div class="games">${games}</div>
    <div class="row-links">
      <button data-act="wallet">🎟️ Vales</button>
      <button data-act="favs">❤️ Favoritos</button>
      <button data-act="settings">⚙️ Ajustes</button>
    </div>`, {
    lvl: (el) => {
      const n = +el.dataset.n;
      if (S.levels.includes(n)) {
        if (S.levels.length === 1) return toast("Escolha pelo menos um nível");
        S.levels = S.levels.filter((x) => x !== n);
      } else S.levels.push(n);
      drawn = 0;
      saveS(); render();
    },
    game: (el) => go(el.dataset.id),
    wallet: () => go("wallet"),
    favs: () => go("favs"),
    settings: () => go("settings"),
  });
};

// Verdade ou Desafio
SCREENS.td = (p) => {
  if (!p.card) {
    return view(`${topBar("Verdade ou Desafio")}${turnHtml()}
      <div class="stage">
        <div class="choice">
          <button class="big v" data-act="pick" data-t="verdade"><span class="e">🗣️</span>Verdade</button>
          <button class="big d" data-act="pick" data-t="desafio"><span class="e">🔥</span>Desafio</button>
        </div>
        ${escaladaHint()}
      </div>`, {
      pick: (el) => {
        const c = draw(el.dataset.t);
        if (!c) return toast("Sem cartas nesse nível/limite");
        p.card = c; render();
      },
    });
  }
  const c = p.card;
  view(`${topBar("Verdade ou Desafio")}${turnHtml()}
    <div class="stage">
      ${card(c, c.type === "verdade" ? "🗣️ Verdade" : "🔥 Desafio", `<div class="txt">${fill(c.t)}</div>`)}
      <div class="actions">
        <button class="btn" data-act="skip">Pular ↷</button>
        <button class="btn ok" data-act="done">Cumpriu ✓ <small>+${c.l}</small></button>
      </div>
    </div>`, {
    fav: () => toggleFav(c, plain(c.t)),
    skip: () => { p.card = null; nextTurn(); render(); },
    done: () => {
      score[turn] += c.l; store.set("score", score);
      p.card = null; nextTurn(); render();
    },
  });
};

// Dado do Prazer
SCREENS.dado = (p) => {
  const r = p.r;
  const lvl = r ? Math.max(r.a[0], r.p[0], r.t[0]) : 1;
  view(`${topBar("Dado do Prazer")}${turnHtml("Quem rola e faz")}
    <div class="stage">
      <div class="dice">
        <div class="die" id="d1"><small>Ação</small><span>${r ? esc(r.a[1]) : "?"}</span></div>
        <div class="die" id="d2"><small>Onde</small><span>${r ? fill(r.p[1]) : "?"}</span></div>
        <div class="die" id="d3"><small>Quanto tempo</small><span>${r ? fill(r.t[1]) : "?"}</span></div>
      </div>
      ${r ? `<p class="hint">${esc(A())} faz em ${esc(B())} · ${LEVELS[lvl - 1].e} ${LEVELS[lvl - 1].name}</p>` : `<p class="hint">Role os dados: ${esc(A())} faz em ${esc(B())}.</p>`}
      <div class="actions">
        ${r
          ? `<button class="btn" data-act="roll">Rolar de novo</button><button class="btn ok" data-act="done">Feito ✓ <small>+${lvl}</small></button>`
          : `<button class="btn primary" data-act="roll">🎲 Rolar os dados</button>`}
      </div>
    </div>`, {
    roll: () => {
      const final = { a: pickDie(DATA.dado.acoes), p: pickDie(DATA.dado.partes), t: pickDie(DATA.dado.tempos) };
      drawn++;
      const els = ["d1", "d2", "d3"].map((id) => document.getElementById(id));
      const lists = [DATA.dado.acoes, DATA.dado.partes, DATA.dado.tempos];
      els.forEach((e) => e.classList.add("rolling"));
      document.querySelectorAll(".actions button").forEach((b) => (b.disabled = true));
      const iv = setInterval(() => {
        els.forEach((e, i) => (e.querySelector("span").textContent = plain(rand(lists[i])[1])));
      }, 70);
      setTimeout(() => { clearInterval(iv); p.r = final; render(); try { navigator.vibrate?.(60); } catch {} }, 900);
    },
    done: () => {
      score[turn] += lvl; store.set("score", score);
      p.r = null; nextTurn(); render();
    },
  });
};

// Missão Relâmpago
function stopTimer() { if (timer) { clearInterval(timer.iv); timer = null; } }

SCREENS.missao = (p) => {
  if (!p.card) p.card = draw("missao");
  const c = p.card;
  if (!c) return emptyHtml("Missão Relâmpago");
  const total = c.sec || 60;
  if (p.left == null) p.left = total;
  const R = 64, C = 2 * Math.PI * R;
  view(`${topBar("Missão Relâmpago")}${turnHtml()}
    <div class="stage">
      ${card(c, "⏱️ Missão", `<div class="txt">${fill(c.t)}</div>`)}
      <div class="timer-wrap timer">
        <svg viewBox="0 0 150 150"><circle class="bgc" cx="75" cy="75" r="${R}"/><circle class="fg" id="ring" cx="75" cy="75" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p.left / total)}"/></svg>
        <div class="num" id="num">${p.left}</div>
      </div>
      <div class="actions">
        <button class="btn" data-act="next">Pular ↷</button>
        ${p.left === 0
          ? `<button class="btn ok" data-act="done">Cumpriu ✓ <small>+${c.l}</small></button>`
          : `<button class="btn primary" data-act="toggle" id="tg">${timer ? "⏸ Pausar" : p.left < total ? "▶ Continuar" : "▶ Começar"}</button>`}
      </div>
    </div>`, {
    fav: () => toggleFav(c, plain(c.t)),
    next: () => { stopTimer(); p.card = null; p.left = null; nextTurn(); render(); },
    done: () => {
      score[turn] += c.l; store.set("score", score);
      p.card = null; p.left = null; nextTurn(); render();
    },
    toggle: () => {
      if (timer) { stopTimer(); return render(); }
      timer = { iv: setInterval(() => {
        p.left--;
        const num = document.getElementById("num"), ring = document.getElementById("ring");
        if (num) num.textContent = p.left;
        if (ring) ring.setAttribute("stroke-dashoffset", C * (1 - p.left / total));
        if (p.left <= 0) { stopTimer(); buzz(); render(); }
      }, 1000) };
      render();
    },
  });
};

// Eu Nunca
SCREENS.eununca = (p) => {
  if (!p.card) { p.card = draw("eununca"); p.v = [null, null]; }
  const c = p.card;
  if (!c) return emptyHtml("Eu Nunca");
  const voteBox = (i) => `<div class="vote"><b>${esc(S.names[i])}</b><div class="opts">
      <button class="${p.v[i] === true ? "sel" : ""}" data-act="vote" data-i="${i}" data-x="1">🙋 Já fiz</button>
      <button class="${p.v[i] === false ? "sel" : ""}" data-act="vote" data-i="${i}" data-x="0">🙅 Nunca</button>
    </div></div>`;
  let reveal = "";
  if (p.v[0] !== null && p.v[1] !== null) {
    const yes = [0, 1].filter((i) => p.v[i]);
    reveal = yes.length === 2 ? "Os dois já! Contem como foi 😏"
      : yes.length === 1 ? `${esc(S.names[yes[0]])} já fez: agora conta os detalhes!`
      : "Ninguém nunca… ainda. 😈";
    reveal = `<p class="hint" style="font-size:16px;color:var(--text)">${reveal}</p>`;
  }
  view(`${topBar("Eu Nunca")}
    <div class="stage">
      ${card(c, "🙊 Eu nunca…", `<div class="txt">${fill(c.t)}</div>`)}
      <div class="votes">${voteBox(0)}${voteBox(1)}</div>
      ${reveal}
      <div class="actions"><button class="btn primary" data-act="next">Próxima →</button></div>
    </div>`, {
    fav: () => toggleFav(c, plain(c.t)),
    vote: (el) => { p.v[+el.dataset.i] = el.dataset.x === "1"; render(); },
    next: () => { p.card = null; render(); },
  });
};

// Prefere?
SCREENS.prefere = (p) => {
  if (!p.card) p.card = draw("prefere");
  const c = p.card;
  if (!c) return emptyHtml("Prefere?");
  const total = sintonia[0] + sintonia[1];
  const pct = total ? Math.round((sintonia[0] / total) * 100) : null;
  view(`${topBar("Prefere?")}
    <div class="stage">
      <p class="hint">Escolham em segredo, contem 3, 2, 1… e apontem juntos!</p>
      <div class="or" style="position:relative">
        <div class="opt">${fill(c.a)}</div>
        <div class="vs">OU</div>
        <div class="opt">${fill(c.b)}</div>
      </div>
      <p class="hint">${pct === null ? "Se discordarem, quem perdeu a votação paga um beijo onde o outro escolher 💋" : `Sintonia de vocês: <b style="color:var(--text)">${pct}%</b> em ${total} rodadas`}</p>
      <div class="actions">
        <button class="btn" data-act="no">Discordamos 😅</button>
        <button class="btn ok" data-act="yes">Concordamos 💞</button>
      </div>
    </div>`, {
    yes: () => { sintonia[0]++; p.card = null; render(); },
    no: () => { sintonia[1]++; toast("Quem perdeu paga um beijo 💋"); p.card = null; render(); },
  });
};

// Fantasias
SCREENS.fantasia = (p) => {
  if (!p.card) p.card = draw("fantasia");
  const c = p.card;
  if (!c) return emptyHtml("Fantasias");
  view(`${topBar("Fantasias")}
    <div class="stage">
      ${card(c, "🎬 " + esc(c.t), `
        <div class="sub" style="color:var(--text);font-size:16px;margin-top:0">${fill(c.s)}</div>
        <div class="roles">
          <div><b>${esc(A())}</b>${esc(c.ra)}</div>
          <div><b>${esc(B())}</b>${esc(c.rb)}</div>
        </div>
        <div class="quote">${fill(c.f)}</div>`)}
      <p class="hint">Combinem uma palavra de segurança antes. Quem fala a primeira frase: ${esc(A())}.</p>
      <div class="actions">
        <button class="btn" data-act="swap">⇄ Trocar papéis</button>
        <button class="btn primary" data-act="next">Outra →</button>
      </div>
    </div>`, {
    fav: () => toggleFav(c, `${c.t}: ${plain(c.s)}`),
    next: () => { p.card = null; render(); },
  });
};

// Conexão
SCREENS.conexao = (p) => {
  if (!p.card) p.card = draw("conexao", { anyLevel: true });
  const c = p.card;
  view(`${topBar("Conexão")}${turnHtml("Responde primeiro")}
    <div class="stage">
      ${card(c, "💞 Conexão", `<div class="txt">${fill(c.t)}</div><div class="sub">Depois, ${esc(B())} responde também.</div>`)}
      <div class="actions"><button class="btn primary" data-act="next">Próxima →</button></div>
    </div>`, {
    fav: () => toggleFav(c, c.t),
    next: () => { p.card = null; nextTurn(); render(); },
  });
};

// Vales
SCREENS.vales = (p) => {
  if (!p.card) p.card = draw("vale");
  const c = p.card;
  if (!c) return emptyHtml("Vales");
  view(`${topBar("Vales", `<button class="icon-btn" data-act="wallet">🎟️</button>`)}
    <div class="stage">
      ${card(c, "🎟️ Vale", `<div class="txt">${fill(c.t)}</div>`)}
      <p class="hint">Guarde o vale para quem vai poder usar quando quiser.</p>
      <div class="actions">
        <button class="btn" data-act="give" data-i="0">Para ${esc(S.names[0])}</button>
        <button class="btn" data-act="give" data-i="1">Para ${esc(S.names[1])}</button>
      </div>
      <div class="actions"><button class="btn primary" data-act="next">Sortear outro 🎲</button></div>
    </div>`, {
    fav: () => toggleFav(c, c.t),
    wallet: () => go("wallet"),
    give: (el) => {
      wallet.unshift({ id: uid(), t: plain(c.t), l: c.l, owner: +el.dataset.i, at: Date.now() });
      store.set("wallet", wallet);
      toast(`Vale guardado para ${S.names[+el.dataset.i]} 🎟️`);
      p.card = null; render();
    },
    next: () => { p.card = null; render(); },
  });
};

SCREENS.wallet = (p) => {
  p.tab ??= 0;
  const mine = wallet.filter((w) => w.owner === p.tab);
  view(`${topBar("Vales guardados")}
    <div class="tabs">
      <button class="${p.tab === 0 ? "on" : ""}" data-act="tab" data-i="0">${esc(S.names[0])} (${wallet.filter((w) => w.owner === 0).length})</button>
      <button class="${p.tab === 1 ? "on" : ""}" data-act="tab" data-i="1">${esc(S.names[1])} (${wallet.filter((w) => w.owner === 1).length})</button>
    </div>
    <div class="list">
      ${mine.length ? mine.map((w) => `<div class="item"><div class="t">${LEVELS[w.l - 1].e} ${esc(w.t)}<span class="m">${new Date(w.at).toLocaleDateString("pt-BR")}</span></div><button class="btn small ok" data-act="use" data-id="${w.id}">Usar</button></div>`).join("")
        : `<div class="empty">Nenhum vale guardado ainda.<br>Sorteie alguns no jogo Vales 🎟️</div>`}
    </div>`, {
    tab: (el) => { p.tab = +el.dataset.i; render(); },
    use: async (el) => {
      const w = wallet.find((x) => x.id === el.dataset.id);
      if (!w || !(await ask(`Usar agora o “${w.t}”?`, "Usar 🎟️"))) return;
      wallet = wallet.filter((x) => x.id !== w.id);
      store.set("wallet", wallet);
      await celebrateCoupon(w);
      render();
    },
  });
};

// Surpresa: carta de qualquer jogo de ação
SCREENS.surpresa = (p) => {
  if (!p.card) p.card = draw(rand(["verdade", "desafio", "desafio", "missao", "eununca"]));
  const c = p.card;
  if (!c) return emptyHtml("Surpresa");
  const kick = { verdade: "🗣️ Verdade", desafio: "🔥 Desafio", missao: `⏱️ Missão · ${c.sec}s`, eununca: "🙊 Eu nunca… (os dois respondem)" }[c.type];
  view(`${topBar("Surpresa")}${turnHtml()}
    <div class="stage">
      ${card(c, kick, `<div class="txt">${fill(c.t)}</div>`)}
      <div class="actions">
        <button class="btn" data-act="skip">Pular ↷</button>
        <button class="btn ok" data-act="done">Cumpriu ✓ <small>+${c.l}</small></button>
      </div>
    </div>`, {
    fav: () => toggleFav(c, plain(c.t)),
    skip: () => { p.card = null; nextTurn(); render(); },
    done: () => {
      score[turn] += c.l; store.set("score", score);
      p.card = null; nextTurn(); render();
    },
  });
};

SCREENS.favs = () => {
  view(`${topBar("Favoritos")}
    <div class="list">
      ${favs.length ? favs.map((f) => `<div class="item"><div class="t">${LEVELS[(f.l || 1) - 1].e} ${esc(f.t)}<span class="m">${esc(f.type)}</span></div><button class="icon-btn" data-act="rm" data-k="${esc(f.k)}">✕</button></div>`).join("")
        : `<div class="empty">Toque no 🤍 de qualquer carta para salvar aqui.</div>`}
    </div>`, {
    rm: (el) => { favs = favs.filter((f) => f.k !== el.dataset.k); store.set("favs", favs); render(); },
  });
};

SCREENS.settings = (p) => {
  const sw = (on) => `<div class="switch ${on ? "on" : ""}"></div>`;
  view(`${p.first ? `<div class="brand"><div class="logo">🔥</div><h1>Nós Dois</h1><p>Vamos configurar o jogo de vocês</p></div>` : topBar("Ajustes")}
    <div class="two field">
      <div><label>Jogador 1</label><input id="n0" value="${esc(S.names[0])}" maxlength="20"></div>
      <div><label>Jogador 2</label><input id="n1" value="${esc(S.names[1])}" maxlength="20"></div>
    </div>

    <div class="section-label">Ritmo</div>
    <div class="toggle" data-act="esc"><span>Escalada automática<small>Começa no nível mais leve escolhido e esquenta a cada 6 cartas</small></span>${sw(S.escalada)}</div>

    <div class="section-label">Limites (o que pode aparecer)</div>
    ${TAGS.map((t) => `<div class="toggle" data-act="tag" data-k="${t.k}"><span>${t.label}${t.sub ? `<small>${t.sub}</small>` : ""}</span>${sw(!S.blocked.includes(t.k))}</div>`).join("")}

    ${p.first ? "" : `
    <div class="section-label">Privacidade</div>
    <div class="field two">
      <input id="pin" type="password" inputmode="numeric" maxlength="4" placeholder="${S.pin ? "PIN ativo ••••" : "PIN de 4 dígitos"}">
      <div class="actions"><button class="btn small" data-act="pin">Salvar</button>${S.pin ? `<button class="btn small" data-act="nopin">Remover</button>` : ""}</div>
    </div>

    <div class="section-label">Conteúdo</div>
    <div class="row-links" style="margin-top:0">
      <button data-act="custom">✍️ Minhas cartas (${custom.length})</button>
      <button data-act="reset">🔄 Zerar placar</button>
    </div>`}

    <div style="height:16px"></div>
    <button class="btn primary" data-act="save" style="width:100%">${p.first ? "Começar 🔥" : "Salvar"}</button>
    <p class="hint" style="margin-top:14px">Tudo fica só neste celular. Nada é enviado para a internet.<br>Qualquer carta pode ser pulada, sempre.</p>`, {
    esc: () => { S.escalada = !S.escalada; drawn = 0; saveS(); keepNames(); render(); },
    tag: (el) => {
      const k = el.dataset.k;
      S.blocked = S.blocked.includes(k) ? S.blocked.filter((x) => x !== k) : [...S.blocked, k];
      saveS(); keepNames(); render();
    },
    pin: () => {
      const v = document.getElementById("pin").value;
      if (!/^\d{4}$/.test(v)) return toast("O PIN precisa ter 4 números");
      S.pin = v; saveS(); keepNames(); toast("PIN ativado 🔒"); render();
    },
    nopin: () => { S.pin = ""; saveS(); keepNames(); toast("PIN removido"); render(); },
    custom: () => { keepNames(); go("custom"); },
    reset: async () => {
      if (!(await ask("Zerar o placar dos dois?", "Zerar"))) return;
      score = [0, 0]; store.set("score", score); toast("Placar zerado");
    },
    save: () => {
      keepNames();
      store.set("setupDone", true);
      if (p.first) { cur = { name: "home", p: {} }; render(); } else back();
    },
  });
};

function keepNames() {
  const n0 = document.getElementById("n0"), n1 = document.getElementById("n1");
  if (n0) S.names[0] = n0.value.trim() || "Jogador 1";
  if (n1) S.names[1] = n1.value.trim() || "Jogador 2";
  saveS();
}

SCREENS.custom = (p) => {
  p.type ??= "desafio";
  view(`${topBar("Minhas cartas")}
    <div class="field"><label>Tipo</label><select id="ct">${Object.entries(CUSTOM_TYPES).map(([k, v]) => `<option value="${k}" ${k === p.type ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="field two">
      <div><label>Nível</label><select id="cl">${LEVELS.map((L) => `<option value="${L.n}">${L.e} ${L.name}</option>`).join("")}</select></div>
      <div ${p.type === "missao" ? "" : "hidden"}><label>Segundos</label><input id="cs" type="number" inputmode="numeric" value="60" min="5" max="600"></div>
    </div>
    <div class="field"><label>Texto</label><textarea id="cx" placeholder="${p.type === "prefere" ? "Opção A | Opção B" : "Use {a} para quem joga e {b} para o par. Ex.: {a} beija {b}…"}"></textarea></div>
    <button class="btn primary" data-act="add" style="width:100%">Adicionar carta</button>
    <div class="section-label">Cartas criadas</div>
    <div class="list">
      ${custom.length ? custom.map((c) => `<div class="item"><div class="t">${LEVELS[c.l - 1].e} ${esc(c.t)}<span class="m">${CUSTOM_TYPES[c.type]}${c.sec ? ` · ${c.sec}s` : ""}</span></div><button class="icon-btn" data-act="rm" data-id="${c.id}">✕</button></div>`).join("")
        : `<div class="empty">Nenhuma ainda. Criem as de vocês!</div>`}
    </div>`, {
    add: () => {
      const type = document.getElementById("ct").value;
      const t = document.getElementById("cx").value.trim();
      if (!t) return toast("Escreva o texto da carta");
      if (type === "prefere" && !t.includes("|")) return toast("Separe as opções com |");
      const c = { id: "u" + uid(), type, l: +document.getElementById("cl").value, t };
      if (type === "missao") c.sec = Math.max(5, +document.getElementById("cs").value || 60);
      custom.unshift(c); store.set("custom", custom);
      toast("Carta adicionada ✍️");
      p.type = type; render();
    },
    rm: (el) => { custom = custom.filter((c) => c.id !== el.dataset.id); store.set("custom", custom); render(); },
  });
  document.getElementById("ct").addEventListener("change", (e) => { p.type = e.target.value; render(); });
};

// ---------- PIN ----------
function scrLock() {
  let typed = "";
  const draw = () => {
    app.innerHTML = `<div class="lock">
      <div class="brand"><div class="logo">🔒</div><h1>Nós Dois</h1></div>
      <div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < typed.length ? "f" : ""}"></i>`).join("")}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => k === "" ? "<span></span>" : `<button data-act="k" data-k="${k}">${k}</button>`).join("")}</div>
    </div>`;
  };
  on = {
    k: (el) => {
      const k = el.dataset.k;
      typed = k === "⌫" ? typed.slice(0, -1) : (typed + k).slice(0, 4);
      if (typed.length === 4) {
        if (typed === S.pin) { locked = false; return render(); }
        typed = "";
        try { navigator.vibrate?.(150); } catch {}
        draw(); app.querySelector(".dots").classList.add("shake");
        return;
      }
      draw();
    },
  };
  draw();
}

// Bloqueia de novo ao sair do app
document.addEventListener("visibilitychange", () => {
  if (document.hidden && S.pin) { stopTimer(); locked = true; render(); }
});

// Botão voltar do Android (Capacitor)
try {
  const CapApp = window.Capacitor?.Plugins?.App;
  CapApp?.addListener("backButton", () => { if (!back()) CapApp.exitApp(); });
} catch {}

// ---------- início ----------
if (!store.get("setupDone", false)) cur = { name: "settings", p: { first: true } };
render();
