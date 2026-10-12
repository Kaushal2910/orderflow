// Store: mock-first, gateway-ready. Same function names the Spring backend exposes.
// Set VITE_GATEWAY_URL in .env to talk to real backend; otherwise fully usable offline.
const GW = import.meta.env.VITE_GATEWAY_URL || "";
const LS_KEY = "oft_state_v1";

const seedShows = () => [
  { id: "show-dune", title: "Dune: Part Two", genre: "Sci-Fi", durationMin: 166, price: 349, times: ["18:00", "21:30"], poster: "🏜️" },
  { id: "show-batman", title: "The Batman", genre: "Action", durationMin: 176, price: 299, times: ["17:00", "20:30"], poster: "🦇" },
  { id: "show-ghibli", title: "Spirited Away (4K)", genre: "Anime", durationMin: 125, price: 249, times: ["15:00", "19:00"], poster: "🐉" },
];

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const s = { shows: seedShows(), holds: {}, orders: [], sold: {}, user: null };
  localStorage.setItem(LS_KEY, JSON.stringify(s));
  return s;
}
function save(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
const state = load();
const persist = () => save(state);

export const auth = {
  user: () => state.user,
  async login(email) {
    if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
    if (GW) {
      const r = await fetch(GW + "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) throw new Error("Login failed");
      const j = await r.json();
      state.user = { email: j.email, token: j.token };
      persist();
      return state.user;
    }
    // mock JWT (real backend returns real JWT with same shape)
    const token = "mock." + btoa(email + ":" + Date.now()) + ".sig";
    state.user = { email, token };
    persist();
    return state.user;
  },
  logout() { state.user = null; persist(); },
  headers(extra = {}) {
    const h = { "Content-Type": "application/json", ...extra };
    if (state.user?.token) h["Authorization"] = "Bearer " + state.user.token;
    return h;
  },
};

export const showsApi = {
  list: async () => {
    if (GW) { const r = await fetch(GW + "/api/shows"); if (r.ok) return r.json(); }
    return state.shows;
  },
  // easy CRUD for you to add movies at last
  create: async (s) => {
    const show = { id: "show-" + Date.now(), ...s };
    state.shows.push(show); persist(); return show;
  },
  update: async (id, patch) => {
    const i = state.shows.findIndex((x) => x.id === id);
    if (i < 0) throw new Error("Show not found");
    state.shows[i] = { ...state.shows[i], ...patch }; persist(); return state.shows[i];
  },
  remove: async (id) => { state.shows = state.shows.filter((x) => x.id !== id); persist(); },
};

const ROWS = 8, COLS = 15;
export const hall = { ROWS, COLS };
const seatId = (r, c) => `R${r + 1}C${c + 1}`;

export const inventoryApi = {
  seatMap: async (showId, time) => {
    if (GW) {
      const r = await fetch(`${GW}/api/inventory?showId=${showId}&time=${time}`, { headers: auth.headers() });
      if (r.ok) return r.json();
    }
    const key = showId + "@" + time;
    const sold = state.sold[key] || [];
    const held = Object.values(state.holds).filter((h) => h.showId === showId && h.time === time && h.expiresAt > Date.now()).flatMap((h) => h.seats);
    const seats = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const id = seatId(r, c);
      seats.push({ id, row: r + 1, col: c + 1, status: sold.includes(id) ? "SOLD" : held.includes(id) ? "HELD" : "FREE" });
    }
    return { showId, time, seats };
  },
  hold: async (showId, time, seats) => {
    if (!state.user) throw new Error("Login first.");
    if (!seats.length) throw new Error("Pick at least 1 seat.");
    if (GW) {
      const r = await fetch(GW + "/api/inventory/hold", { method: "POST", headers: auth.headers(), body: JSON.stringify({ showId, time, seats }) });
      if (!r.ok) throw new Error("Hold failed: " + r.status);
      return r.json();
    }
    const { seats: map } = await inventoryApi.seatMap(showId, time);
    const blocked = seats.filter((s) => map.find((m) => m.id === s)?.status !== "FREE");
    if (blocked.length) throw new Error("Already taken: " + blocked.join(", "));
    const holdId = "hold-" + Math.random().toString(36).slice(2, 9);
    state.holds[holdId] = { holdId, showId, time, seats, email: state.user.email, expiresAt: Date.now() + 5 * 60 * 1000 };
    persist();
    return state.holds[holdId];
  },
};

export const ordersApi = {
  // idempotent: same Idempotency-Key returns same order, never double-books
  create: async ({ holdId, email, failPayment = false }) => {
    const key = ordersApi._key || (ordersApi._key = crypto.randomUUID());
    if (GW) {
      const r = await fetch(GW + "/api/orders", { method: "POST", headers: auth.headers({ "Idempotency-Key": key }), body: JSON.stringify({ holdId, email, failPayment }) });
      if (!r.ok) throw new Error("Order failed: " + (await r.text()));
      return r.json();
    }
    const hold = state.holds[holdId];
    if (!hold || hold.expiresAt < Date.now()) throw new Error("Hold expired. Hold seats again.");
    const show = state.shows.find((s) => s.id === hold.showId);
    const total = hold.seats.length * (show?.price || 299);
    if (failPayment) throw new Error("Mock payment declined (toggle off to succeed).");
    const order = {
      orderId: "ord-" + Math.random().toString(36).slice(2, 9),
      idempotencyKey: key, holdId, email,
      showId: hold.showId, time: hold.time, seats: hold.seats,
      total, status: "NOTIFIED",
      timeline: [
        { k: "CREATED", at: new Date().toISOString(), on: true },
        { k: "SEAT_RESERVED", at: new Date().toISOString(), on: true },
        { k: "PAID", at: new Date().toISOString(), on: true },
        { k: "NOTIFIED", at: new Date().toISOString(), on: true },
      ],
    };
    const skey = hold.showId + "@" + hold.time;
    state.sold[skey] = [...(state.sold[skey] || []), ...hold.seats];
    delete state.holds[holdId];
    state.orders.unshift(order);
    ordersApi._key = null; // new key for next order
    persist();
    return order;
  },
  get: async (id) => {
    if (GW) { const r = await fetch(GW + "/api/orders/" + id, { headers: auth.headers() }); if (r.ok) return r.json(); }
    const o = state.orders.find((x) => x.orderId === id);
    if (!o) throw new Error("Order not found");
    return o;
  },
  mine: async () => {
    if (GW && state.user) { const r = await fetch(GW + "/api/orders?email=" + state.user.email, { headers: auth.headers() }); if (r.ok) return r.json(); }
    return state.user ? state.orders.filter((o) => o.email === state.user.email) : [];
  },
};
