import "./style.css";
import { auth, showsApi, inventoryApi, ordersApi, hall } from "./api/store.js";
import { createAuditorium } from "./scenes/Auditorium.js";

const app = document.querySelector("#app");
let auditorium = null;
let mapTimer = null;
const sel = new Set();
let ctx = { showId: null, time: null, holdId: null, orderId: null };

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const d = document.createElement("div");
  d.className = "toast"; d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}
function nav() {
  const u = auth.user();
  const h = location.hash || "#/";
  const link = (href, label) => `<a href="${href}" class="${h.startsWith(href) && href !== "#/" ? "active" : ""}">${label}</a>`;
  return `<header class="nav"><div class="nav-inner">
    <a class="brand" href="#/">OrderFlow <span>Theatre</span></a>
    <nav class="nav-links">
      ${link("#/book", "Book")} ${link("#/orders", "My Orders")} ${link("#/admin", "Manage")}
      ${u ? `<a href="#/orders">${esc(u.email.split("@")[0])}</a><a href="#/logout">Logout</a>` : `<a href="#/login">Login</a>`}
    </nav></div></header>`;
}
const foot = `<footer class="footer">OrderFlow demo · Gateway + Kafka + Redis + Postgres (mock mode until backend runs) · <a href="#/admin">Add your movies</a></footer>`;

async function Home() {
  const shows = await showsApi.list();
  return `${nav()}<main class="main">
    <h1>Now showing</h1>
    <p class="muted">Pick a film, choose seats in 3D, pay mock, watch the event timeline. Every button works — no dead links.</p>
    <div class="grid">${shows.map((s) => `<div class="card">
      <div style="font-size:40px">${esc(s.poster || "🎬")}</div>
      <h3>${esc(s.title)}</h3>
      <p class="muted">${esc(s.genre || "")} · ${s.durationMin || 120} min · ₹${s.price}</p>
      <div class="row">${(s.times || []).map((t) => `<a class="btn btn-gold" href="#/book?show=${s.id}&time=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>
      <p><a href="#/show/${s.id}">Details →</a></p>
    </div>`).join("") || `<p class="muted">No movies yet. <a href="#/admin">Add one</a>.</p>`}</div>
  </main>${foot}`;
}

async function ShowDetail(id) {
  const shows = await showsApi.list();
  const s = shows.find((x) => x.id === id);
  if (!s) return `${nav()}<main class="main"><h1>Not found</h1><p><a class="btn" href="#/">Back home</a></p></main>${foot}`;
  return `${nav()}<main class="main">
    <p><a href="#/">← All shows</a></p>
    <h1>${esc(s.poster || "🎬")} ${esc(s.title)}</h1>
    <p class="muted">${esc(s.genre || "")} · ${s.durationMin || 120} min · ₹${s.price} per seat</p>
    <div class="row">${(s.times || []).map((t) => `<a class="btn btn-gold" href="#/book?show=${s.id}&time=${encodeURIComponent(t)}">Book ${esc(t)}</a>`).join("")}</div>
  </main>${foot}`;
}

function Login() {
  return `${nav()}<main class="main"><h1>Login</h1>
    <p class="muted">Simple email login (mock JWT now, real JWT from gateway later).</p>
    <form class="form" id="f-login">
      <label>Email</label><input id="in-email" type="email" required placeholder="you@mail.com" />
      <div style="height:12px"></div>
      <button class="btn btn-gold" type="submit">Get OTP-less login →</button>
    </form></main>${foot}`;
}

async function Book(q) {
  const shows = await showsApi.list();
  const show = shows.find((x) => x.id === q.get("show")) || shows[0];
  if (!show) return `${nav()}<main class="main"><h1>No shows</h1><p><a class="btn" href="#/admin">Add a movie first</a></p></main>${foot}`;
  const time = q.get("time") || show.times[0];
  ctx.showId = show.id; ctx.time = time;
  sel.clear();
  return `${nav()}<main class="main wide">
    <p class="muted"><a href="#/">Shows</a> / ${esc(show.title)}</p>
    <div class="steps">
      <span class="step on">1 · Seats</span><span class="step-arrow">→</span>
      <span class="step">2 · Payment</span><span class="step-arrow">→</span>
      <span class="step">3 · Done</span>
    </div>
    <div class="card movie-head">
      <div class="movie-poster">${esc(show.poster || "🎬")}</div>
      <div>
        <h1 style="margin:0">${esc(show.title)}</h1>
        <p class="muted" style="margin:4px 0 10px">${esc(show.genre || "")} · ${show.durationMin || 120} min · ₹${show.price} / seat · Standard rows 1–5 · Premium 6–7 · VIP row 8</p>
        <div class="row" id="time-chips">${(show.times || []).map((t) => `<button class="btn time-chip ${t === time ? "on" : ""}" data-time="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      </div>
    </div>
    <div class="legend">
      <span class="chip"><i class="sw avail"></i>Available</span>
      <span class="chip"><i class="sw sel"></i>Selected</span>
      <span class="chip"><i class="sw held"></i>Held</span>
      <span class="chip"><i class="sw sold"></i>Booked</span>
      <span class="chip"><i class="sw vip"></i>VIP row</span>
    </div>
    <div id="stage-wrap">
      <div>
        <div class="cam-bar">
          <button class="btn on" data-view="default">🏛 Default</button>
          <button class="btn" data-view="top">🦅 Top</button>
          <button class="btn" data-view="front">🎬 Screen</button>
          <button class="btn" data-view="side">📐 Side</button>
          <button class="btn" id="btn-pov">👁 Seat view</button>
          <button class="btn" id="btn-focus">🎯 Focus seat</button>
          <button class="btn" id="btn-best">⭐ Best seats</button>
          <button class="btn" id="btn-mode">🌙 Cinematic</button>
        </div>
        <canvas class="hall" id="hall"></canvas>
        <p class="muted">Drag to orbit · wheel to zoom toward cursor · single-click selects · double-click flies to a seat.</p>
        <div class="nav2d">
          <div class="map-wrap">
            <canvas id="minimap" width="440" height="300"></canvas>
            <p class="muted">🗺 Minimap — click anywhere to fly the camera there · white arrow is you</p>
          </div>
          <div class="pad" aria-label="Move camera">
            <span></span><button class="btn" data-pan="0,-1.6" aria-label="Move toward screen">▲</button><span></span>
            <button class="btn" data-pan="-1.6,0" aria-label="Move left">◀</button><button class="btn" data-dolly="0.8" aria-label="Zoom in">＋</button><button class="btn" data-pan="1.6,0" aria-label="Move right">▶</button>
            <span></span><button class="btn" data-pan="0,1.6" aria-label="Move back">▼</button><button class="btn" data-dolly="1.25" aria-label="Zoom out">－</button>
          </div>
        </div>
      </div>
      <div><div class="card summary">
        <h3 style="margin-top:0">Your seats <span class="badge" id="sel-count">0</span></h3>
        <div id="sel-chips"><p class="muted">Nothing picked yet — tap the glowing recliners in 3D, or auto-pick below.</p></div>
        <div class="row autopick">
          <select id="ap-count" aria-label="How many seats">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === 2 ? "selected" : ""}>${n} seat${n > 1 ? "s" : ""}</option>`).join("")}</select>
          <button class="btn" id="btn-auto">✨ Auto-pick best</button>
          <button class="btn btn-ghost" id="btn-clear">Clear</button>
        </div>
        <div class="total-row"><span class="muted">Total</span><b id="sel-total">₹0</b></div>
        <button class="btn btn-gold big" id="btn-hold" disabled>Continue to Payment →</button>
        <p class="muted" id="hold-hint">Select at least 1 seat to continue. Hold lasts 5 min once you continue.</p>
        <details class="a11y-list">
          <summary>Browse all seats as a list (screen-reader friendly)</summary>
          <div class="seat-list" id="seat-list"><p class="muted">Loading seats…</p></div>
        </details>
      </div></div>
    </div></main>${foot}`;
}

async function mountBook(q) {
  const canvas = document.querySelector("#hall");
  if (!canvas) return;
  const { seats } = await inventoryApi.seatMap(ctx.showId, ctx.time);
  const shows0 = JSON.parse(localStorage.getItem("oft_state_v1")).shows;
  const show0 = shows0.find((s) => s.id === ctx.showId) || {};
  const unit = show0.price || 299;
  const list = document.querySelector("#seat-list");
  const chips = document.querySelector("#sel-chips");
  const holdBtn = document.querySelector("#btn-hold");

  const paint = () => {
    document.querySelector("#sel-count").textContent = sel.size;
    document.querySelector("#sel-total").textContent = "₹" + sel.size * unit;
    holdBtn.disabled = sel.size === 0;
    document.querySelector("#hold-hint").textContent = sel.size === 0
      ? "Select at least 1 seat to continue. Hold lasts 5 min once you continue."
      : `${sel.size} seat${sel.size > 1 ? "s" : ""} · ${esc(ctx.time)} show · seats are held for 5 min on continue.`;
    if (sel.size === 0) {
      chips.innerHTML = `<p class="muted">Nothing picked yet — tap the glowing recliners in 3D, or auto-pick below.</p>`;
    } else {
      chips.innerHTML = [...sel].sort().map((id) => {
        const cat = auditorium?.seatInfo(id)?.category || "";
        return `<span class="seat-chip" title="${esc(cat)}">${esc(id)}<small>${esc(cat.split(" ")[0])}</small><button data-unseat="${id}" aria-label="Remove ${id}">×</button></span>`;
      }).join("");
    }
    list.innerHTML = seats.map((s) => {
      const taken = s.status !== "FREE";
      const cls = sel.has(s.id) ? "sel" : taken ? "taken" : "";
      return `<button data-seat="${s.id}" class="${cls}" ${taken ? "disabled" : ""}>${s.id}</button>`;
    }).join("");
  };
  const sync3D = () => auditorium.refresh(seats);
  const toggle = (id) => { sel.has(id) ? sel.delete(id) : sel.add(id); sync3D(); paint(); };

  paint();
  auditorium = createAuditorium(canvas, {
    rows: hall.ROWS, cols: hall.COLS, seatMap: seats, selected: sel, price: unit,
    movieTitle: show0.title, moviePoster: show0.poster,
    onToggle: (id, isDouble) => { toggle(id); if (!isDouble) toast(sel.has(id) ? id + " added ✓" : id + " removed"); },
    onFocus: (id) => toast("Flying to " + id + " — orbit around it, single-click to select"),
  });
  document.querySelector("#btn-focus").onclick = () => {
    const first = [...sel].sort()[0];
    if (!first) { toast("Double-click any seat (even back corners) to fly the camera to it"); return; }
    auditorium.focusSeat(first);
  };
  // showtime switcher: reload seat map for the new time, same movie
  document.querySelectorAll(".time-chip").forEach((b) => (b.onclick = async () => {
    if (b.dataset.time === ctx.time) return;
    ctx.time = b.dataset.time; sel.clear(); ctx.holdId = null;
    document.querySelectorAll(".time-chip").forEach((x) => x.classList.toggle("on", x === b));
    try {
      const r = await inventoryApi.seatMap(ctx.showId, ctx.time);
      seats.splice(0, seats.length, ...r.seats);
      sync3D(); paint();
      toast("Switched to " + ctx.time + " show");
    } catch (e) { toast(e.message); }
  }));
  chips.onclick = (e) => {
    const b = e.target.closest("[data-unseat]");
    if (!b) return;
    toggle(b.dataset.unseat);
  };
  document.querySelector("#btn-auto").onclick = () => {
    const n = Number(document.querySelector("#ap-count").value) || 2;
    const ids = auditorium.recommendBest(n).filter((id) => !sel.has(id));
    if (!ids.length) { toast("Those best seats are already yours ✓"); return; }
    ids.forEach((id) => sel.add(id));
    sync3D(); paint();
    toast("Picked " + ids.join(", ") + " — best view in the house");
  };
  document.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => {
    auditorium.setView(b.dataset.view);
    document.querySelectorAll("[data-view]").forEach((x) => x.classList.remove("on"));
    b.classList.add("on");
  }));
  document.querySelector("#btn-pov").onclick = () => {
    const first = [...sel][0];
    if (!first) { toast("Select a seat first, then preview its view"); return; }
    auditorium.viewFromSeat(first);
    toast("Screen preview from " + first + " — orbit to look around, Default to return");
  };
  document.querySelector("#btn-best").onclick = () => {
    const ids = auditorium.recommendBest(3);
    toast(ids.length ? "Best view: " + ids.join(", ") + " (glowing gold — click to select)" : "No free seats together up front");
  };
  const modeBtn = document.querySelector("#btn-mode");
  modeBtn.onclick = () => {
    const dark = auditorium.toggleCinematic();
    modeBtn.textContent = dark ? "💡 Bright select" : "🌙 Cinematic";
    toast(dark ? "Cinematic mode — dimmed house lights" : "Bright selection mode");
  };
  document.querySelector("#btn-clear").onclick = () => {
    sel.clear(); auditorium.refresh(seats); paint(); toast("Selection cleared");
  };
  list.onclick = (e) => {
    const b = e.target.closest("[data-seat]");
    if (!b || b.disabled) return;
    const id = b.dataset.seat;
    sel.has(id) ? sel.delete(id) : sel.add(id);
    auditorium.refresh(seats); paint();
  };
  document.querySelector("#btn-hold").onclick = async () => {
    try {
      if (!auth.user()) { location.hash = "#/login"; return; }
      const hold = await inventoryApi.hold(ctx.showId, ctx.time, [...sel]);
      ctx.holdId = hold.holdId;
      toast("Held! Going to checkout…");
      location.hash = "#/checkout";
    } catch (err) { toast(err.message); }
  };
  // D-pad: visible buttons so nobody has to discover gestures/keys
  document.querySelectorAll("[data-pan]").forEach((b) => (b.onclick = () => {
    const [dx, dz] = b.dataset.pan.split(",").map(Number);
    auditorium.panBy(dx, dz);
  }));
  document.querySelectorAll("[data-dolly]").forEach((b) => (b.onclick = () => auditorium.dolly(Number(b.dataset.dolly))));
  // Minimap: live top-down dots + camera arrow, click to fly there
  const mmap = document.querySelector("#minimap");
  const mg = mmap.getContext("2d");
  const MW = 440, MH = 300;
  const mX = (x) => 16 + ((x + 9) / 18.5) * (MW - 32);
  const mZ = (z) => 14 + ((z + 7.5) / 20) * (MH - 28);
  const DOT = { SEL: "#00ff9d", SOLD: "#b03a3a", HELD: "#e8a13c", FREE: "#2fd27f" };
  const drawMap = () => {
    mg.clearRect(0, 0, MW, MH);
    mg.strokeStyle = "#3a3054"; mg.lineWidth = 2;
    mg.strokeRect(mX(-9.6), mZ(-8), mX(9.6) - mX(-9.6), mZ(12.6) - mZ(-8));
    mg.fillStyle = "#e8b34b";
    mg.fillRect(mX(-5.5), mZ(-7.6), mX(5.5) - mX(-5.5), 8); // screen
    mg.fillStyle = "#a99fc0"; mg.font = "11px sans-serif"; mg.textAlign = "center";
    mg.fillText("SCREEN", MW / 2, mZ(-7.6) - 4);
    for (const d of auditorium.getSeatDots()) {
      mg.beginPath(); mg.arc(mX(d.x), mZ(d.z), d.st === "SEL" ? 5 : 3.4, 0, 7);
      mg.fillStyle = DOT[d.st] || DOT.FREE; mg.fill();
      if (d.vip) { mg.strokeStyle = "#e8b34b"; mg.lineWidth = 1.4; mg.stroke(); }
      if (d.st === "SEL") { mg.strokeStyle = "#fff"; mg.lineWidth = 1.6; mg.stroke(); }
    }
    const v = auditorium.getView();
    mg.strokeStyle = "#fff"; mg.lineWidth = 2.4;
    mg.beginPath(); mg.moveTo(mX(v.cx), mZ(v.cz)); mg.lineTo(mX(v.tx), mZ(v.tz)); mg.stroke();
    mg.fillStyle = "#fff";
    mg.beginPath(); mg.arc(mX(v.cx), mZ(v.cz), 4.5, 0, 7); mg.fill();
  };
  drawMap();
  if (mapTimer) clearInterval(mapTimer);
  mapTimer = setInterval(() => { if (document.querySelector("#minimap")) drawMap(); }, 300);
  mmap.onclick = (e) => {
    const r = mmap.getBoundingClientRect();
    const px = (e.clientX - r.left) * (MW / r.width);
    const py = (e.clientY - r.top) * (MH / r.height);
    auditorium.focusPoint(((px - 16) / (MW - 32)) * 18.5 - 9, ((py - 14) / (MH - 28)) * 20 - 7.5);
  };
  // first-visit coach mark (once per session)
  try {
    if (!sessionStorage.getItem("oft_nav_tip")) {
      sessionStorage.setItem("oft_nav_tip", "1");
      setTimeout(() => toast("New here? Click the 🗺 minimap or double-click any seat to fly there"), 600);
    }
  } catch {}
}

function Checkout() {
  return `${nav()}<main class="main"><h1>Checkout</h1>
    <div class="card form">
      <p>Show: <b>${esc(ctx.showId || "")}</b> · ${esc(ctx.time || "")}</p>
      <p>Seats: <b>${[...sel].join(", ") || "—"}</b></p>
      <p class="muted">Hold: ${esc(ctx.holdId || "none — go back to Book first")}</p>
      <label><input type="checkbox" id="ck-fail" style="width:auto" /> Simulate payment failure (to test retry UX)</label>
      <div class="row" style="margin-top:12px">
        <button class="btn btn-gold" id="btn-pay">Pay mock →</button>
        <a class="btn" href="#/book?show=${ctx.showId}&time=${encodeURIComponent(ctx.time || "")}">← Change seats</a>
      </div>
    </div></main>${foot}`;
}

async function mountCheckout() {
  document.querySelector("#btn-pay").onclick = async () => {
    try {
      const fail = document.querySelector("#ck-fail").checked;
      const order = await ordersApi.create({ holdId: ctx.holdId, email: auth.user()?.email, failPayment: fail });
      ctx.orderId = order.orderId;
      location.hash = "#/track/" + order.orderId;
    } catch (e) { toast(e.message); }
  };
}

async function Track(id) {
  let o;
  try { o = await ordersApi.get(id); }
  catch { return `${nav()}<main class="main"><h1>Order not found</h1><p><a class="btn" href="#/book">Book again</a></p></main>${foot}`; }
  return `${nav()}<main class="main">
    <p><a href="#/orders">← My orders</a></p>
    <h1>Booking ${esc(o.orderId)} <span class="badge ok">${esc(o.status)}</span></h1>
    <p class="muted">${esc(o.showId)} · ${esc(o.time)} · Seats ${esc((o.seats || []).join(", "))} · ₹${o.total}</p>
    <div class="timeline">${(o.timeline || []).map((t) => `<div><span class="dot ${t.on ? "on" : ""}"></span><b>${esc(t.k)}</b> <span class="muted">${esc(t.at)}</span></div>`).join("")}</div>
    <div class="row"><a class="btn btn-gold" href="#/book">Book another →</a><a class="btn" href="#/">Home</a></div>
    <p class="muted">In prod this timeline is Kafka: order.created → inventory.reserved → payment.completed → notify.send.</p>
  </main>${foot}`;
}

async function Orders() {
  const u = auth.user();
  if (!u) return `${nav()}<main class="main"><h1>My orders</h1><p class="muted">Login to see bookings.</p><p><a class="btn btn-gold" href="#/login">Login →</a></p></main>${foot}`;
  const list = await ordersApi.mine();
  return `${nav()}<main class="main"><h1>My orders</h1>
    ${list.map((o) => `<div class="card"><div class="row"><b>${esc(o.orderId)}</b><span class="badge ok">${esc(o.status)}</span><span class="muted">₹${o.total}</span><a class="btn" href="#/track/${o.orderId}">Track →</a></div>
    <p class="muted">${esc(o.showId)} · ${esc(o.time)} · ${(o.seats || []).join(", ")}</p></div>`).join("") || `<p class="muted">No bookings yet. <a href="#/book">Book now →</a></p>`}
  </main>${foot}`;
}

async function Admin() {
  const shows = await showsApi.list();
  return `${nav()}<main class="main"><h1>Manage movies</h1>
    <p class="muted">Easy CRUD — same shape as backend <code>POST /api/shows</code>. Add yours here; booking pages update instantly.</p>
    <div class="grid">${shows.map((s) => `<div class="card">
      <h3>${esc(s.poster || "🎬")} ${esc(s.title)}</h3>
      <p class="muted">${esc(s.id)} · ₹${s.price} · ${(s.times || []).join(", ")}</p>
      <div class="row"><button class="btn btn-danger" data-del="${s.id}">Delete</button>
      <a class="btn" href="#/book?show=${s.id}&time=${encodeURIComponent((s.times || ["18:00"])[0])}">Book →</a></div>
    </div>`).join("")}</div>
    <h2>Add movie</h2>
    <form class="form" id="f-add">
      <label>Title</label><input id="a-title" required placeholder="e.g. Interstellar" />
      <label>Price (₹)</label><input id="a-price" type="number" value="299" min="1" />
      <label>Times (comma separated)</label><input id="a-times" value="18:00, 21:30" />
      <label>Emoji poster</label><input id="a-poster" value="🎬" />
      <div style="height:12px"></div><button class="btn btn-gold" type="submit">Add movie →</button>
    </form></main>${foot}`;
}

async function mountAdmin() {
  document.querySelector("#f-add").onsubmit = async (e) => {
    e.preventDefault();
    const title = document.querySelector("#a-title").value.trim();
    if (!title) return;
    await showsApi.create({
      title, poster: document.querySelector("#a-poster").value || "🎬",
      price: Number(document.querySelector("#a-price").value) || 299,
      times: document.querySelector("#a-times").value.split(",").map((s) => s.trim()).filter(Boolean),
      genre: "Custom", durationMin: 120,
    });
    toast("Movie added"); render();
  };
  document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
    await showsApi.remove(b.dataset.del); toast("Deleted"); render();
  }));
}

async function render() {
  auditorium?.dispose(); auditorium = null;
  if (mapTimer) { clearInterval(mapTimer); mapTimer = null; }
  const h = location.hash || "#/";
  const [path, qs] = h.slice(1).split("?");
  const q = new URLSearchParams(qs || "");
  const seg = path.split("/").filter(Boolean);
  let html = "";
  if (path === "/" || path === "") html = await Home();
  else if (seg[0] === "show") html = await ShowDetail(seg[1]);
  else if (seg[0] === "book") html = await Book(q);
  else if (seg[0] === "checkout") html = Checkout();
  else if (seg[0] === "track") html = await Track(seg[1]);
  else if (seg[0] === "orders") html = await Orders();
  else if (seg[0] === "admin") html = await Admin();
  else if (seg[0] === "login") html = Login();
  else if (seg[0] === "logout") { auth.logout(); location.hash = "#/"; return; }
  else html = `${nav()}<main class="main"><h1>Lost in the lobby?</h1><p><a class="btn btn-gold" href="#/">Back to shows →</a></p></main>${foot}`;
  app.innerHTML = html;
  if (seg[0] === "login") document.querySelector("#f-login").onsubmit = async (e) => {
    e.preventDefault();
    try { await auth.login(document.querySelector("#in-email").value.trim()); toast("Logged in"); location.hash = "#/book"; }
    catch (err) { toast(err.message); }
  };
  if (seg[0] === "book") mountBook(q);
  if (seg[0] === "checkout") mountCheckout();
  if (seg[0] === "admin") mountAdmin();
  window.scrollTo(0, 0);
}

addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/";
render();
