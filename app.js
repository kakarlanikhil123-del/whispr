/* ============================================================
   PART 1: HELPERS – popups, validated forms, toast, image gallery
   ============================================================ */
/* Shared helpers used by every demo site: DOM shortcuts, storage, toast, modal forms, image gallery. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) =>
  String(t).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

// ---------- Toast message ----------
let toastTimer;
function toast(message, isError) {
  let box = $("#toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    box.setAttribute("role", "status");
    document.body.append(box);
  }
  box.textContent = message;
  box.className = "on" + (isError ? " bad" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = ""), 3200);
}

// ---------- Modal dialog (Esc closes automatically) ----------
function modal(html) {
  let dlg = $("#dlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "dlg";
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
  }
  dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button>${html}`;
  if (!dlg.open) dlg.showModal();
  return dlg;
}

// ---------- Validated form in a modal (mock only: nothing is sent anywhere) ----------
// fields: [{name,label,type,options,min,max}]  check(values) may return an error string.  done(values) returns a success message.
function formModal({
  title,
  intro = "Demo only. Do not enter real credentials or personal data.",
  fields,
  button = "Submit",
  check,
  done,
}) {
  const dlg = modal(`<h2>${title}</h2><p class="hint">${intro}</p><form novalidate>${fields
    .map(
      (f) => `
    <label>${f.label}${
      f.options
        ? `<select name="${f.name}">${f.options.map((o) => `<option>${o}</option>`).join("")}</select>`
        : `<input name="${f.name}" type="${f.type || "text"}" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}>`
    }
      <span class="err" data-for="${f.name}"></span></label>`,
    )
    .join("")}
    <p class="err" data-form></p><button class="primary">${button}</button></form>`);
  $("form", dlg).onsubmit = (e) => {
    e.preventDefault();
    const values = {};
    let ok = true;
    fields.forEach((f) => {
      const v = e.target.elements[f.name].value.trim();
      values[f.name] = v;
      let msg = "";
      if (!v) msg = "This field is required.";
      else if (f.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) msg = "Enter a valid email address.";
      else if (f.type === "password" && v.length < 6) msg = "Use at least 6 characters.";
      else if (f.type === "number" && (+v < f.min || +v > f.max))
        msg = `Enter a number from ${f.min} to ${f.max}.`;
      $(`[data-for="${f.name}"]`, dlg).textContent = msg;
      if (msg) ok = false;
    });
    const problem = ok && check ? check(values) : "";
    $("[data-form]", dlg).textContent = problem || "";
    if (!ok || problem) return;
    const message = done ? done(values) : "Done.";
    dlg.innerHTML = `<button class="x" aria-label="Close" onclick="this.closest('dialog').close()">✕</button><p class="ok" role="status">${message}</p><button class="primary" onclick="this.closest('dialog').close()">Close</button>`;
  };
}

// ---------- Image gallery: multi-upload, preview, replace, remove (saved in this browser only) ----------
function Gallery({ mount, key }) {
  const root = $(mount),
    TYPES = ["image/jpeg", "image/png", "image/webp"];
  let items = store.get(key, []);
  root.innerHTML = `<div class="g-bar"><label class="g-btn">＋ Add images<input type="file" multiple accept=".jpg,.jpeg,.png,.webp" hidden></label>
    <button class="g-btn" data-clear>Remove all</button><span class="g-msg" role="status"></span></div><div class="g-grid"></div>`;
  const grid = $(".g-grid", root),
    msg = $(".g-msg", root);
  const say = (m, bad) => {
    msg.textContent = m;
    msg.className = "g-msg" + (bad ? " bad" : "");
  };

  // Shrink large photos in the browser so they fit in storage
  const shrink = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 700 / Math.max(img.width, img.height)),
            c = document.createElement("canvas");
          c.width = img.width * k;
          c.height = img.height * k;
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = () => reject(new Error(file.name + " could not be read."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error(file.name + " could not be read."));
      reader.readAsDataURL(file);
    });
  function save() {
    if (!store.set(key, items)) say("Storage is full: images last for this visit only.", true);
  }
  function render() {
    grid.innerHTML = items.length
      ? items
          .map(
            (it, i) => `<figure class="g-tile"><img src="${it.src}" alt="Uploaded image ${i + 1}">
      <figcaption><label class="g-mini">Replace<input type="file" accept=".jpg,.jpeg,.png,.webp" hidden data-replace="${it.id}"></label>
      <button class="g-mini" data-del="${it.id}">Remove</button></figcaption></figure>`,
          )
          .join("")
      : `<p class="g-empty">No images yet. Add JPG, PNG or WebP files and they appear here.</p>`;
  }
  async function add(files, replaceId) {
    const good = [...files].filter((f) => TYPES.includes(f.type)),
      bad = files.length - good.length;
    if (!good.length) return say("Only JPG, PNG and WebP images are supported.", true);
    say(`Processing ${good.length} image${good.length > 1 ? "s" : ""}…`);
    try {
      const done = await Promise.all(good.map(shrink));
      if (replaceId) items = items.map((it) => (it.id === replaceId ? { id: it.id, src: done[0] } : it));
      else done.forEach((src, n) => items.push({ id: Date.now() + n, src }));
      save();
      render();
      say(
        bad
          ? `Added ${done.length}. ${bad} file(s) skipped (unsupported type).`
          : `${replaceId ? "Replaced" : "Added"} ${done.length} image(s).`,
        !!bad,
      );
    } catch (e) {
      say(e.message, true);
    }
  }
  root.addEventListener("change", (e) => {
    if (!e.target.files || !e.target.files.length) return;
    add(e.target.files, e.target.dataset.replace ? +e.target.dataset.replace : 0);
    e.target.value = "";
  });
  root.addEventListener("click", (e) => {
    if (e.target.dataset.del) {
      items = items.filter((it) => it.id !== +e.target.dataset.del);
      save();
      render();
      say("Image removed.");
    }
    if (e.target.dataset.clear !== undefined) {
      if (!items.length) return say("Nothing to remove.", true);
      items = [];
      save();
      render();
      say("All images removed.");
    }
  });
  render();
}

// ---------- Mobile menu: any #burger toggles #menu ----------
document.addEventListener("click", (e) => {
  if (e.target.closest("#burger")) $("#menu").classList.toggle("open");
  else if (e.target.closest("#menu a")) $("#menu")?.classList.remove("open");
});


/* ============================================================
   PART 2: SITE CODE – data and features of this website
   ============================================================ */
/* whispr demo – sample data and interactions. */

// ============================================================ 1. SAMPLE DATA
// title, creator, category, minutes, plays, day number (higher = newer), colors for the cover
const EPISODES = [
  ["Why We Laugh at Awkward Silence", "Mira Dane", "Comedy", 32, 8400, 10, "#e8623a"],
  ["Tiny Habits, Big Mornings", "Leo Park", "Wellness", 24, 6100, 9, "#3b9ed9"],
  ["The Night the Server Went Down", "Ada Kim", "Tech", 41, 9800, 8, "#7a5cf0"],
  ["Grandma's Radio Stories", "Noor Ali", "Stories", 28, 5200, 7, "#f0b44a"],
  ["Mic Check: First-Time Hosts", "Mira Dane", "Comedy", 19, 7300, 6, "#e8623a"],
  ["Breathing for Busy People", "Leo Park", "Wellness", 15, 4600, 5, "#3fb98a"],
  ["Gadgets We Regret Buying", "Ada Kim", "Tech", 36, 8800, 4, "#3b9ed9"],
  ["Letters from the Coast", "Noor Ali", "Stories", 45, 3900, 3, "#c0563a"],
];
const CREATORS = [
  ["Mira Dane", "Comedy host", "#e8623a"],
  ["Leo Park", "Wellness coach", "#3b9ed9"],
  ["Ada Kim", "Tech storyteller", "#7a5cf0"],
  ["Noor Ali", "Story curator", "#f0b44a"],
];

// Draw the hero illustration (a simple person with headphones) as an SVG picture
const FIGURE = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'><path d='M40 300 Q50 215 150 205 Q250 215 260 300z' fill='#2f9bc9'/><rect x='132' y='165' width='36' height='45' fill='#e9b08a'/><ellipse cx='150' cy='120' rx='52' ry='62' fill='#f1bf9a'/><path d='M96 112 Q100 48 152 48 Q204 48 204 112 Q188 78 150 80 Q112 80 96 112z' fill='#e8751f'/><rect x='90' y='64' width='120' height='30' rx='15' fill='#e8751f'/><path d='M92 110 Q92 52 150 52 Q208 52 208 110' stroke='#f3e8c9' stroke-width='9' fill='none'/><rect x='84' y='100' width='20' height='44' rx='10' fill='#f3e8c9'/><rect x='196' y='100' width='20' height='44' rx='10' fill='#f3e8c9'/><circle cx='132' cy='118' r='4' fill='#231012'/><circle cx='168' cy='118' r='4' fill='#231012'/><path d='M130 146 Q150 166 172 146 Q150 154 130 146z' fill='#fff' stroke='#231012' stroke-width='3'/></svg>`;
document.documentElement.style.setProperty(
  "--fig",
  `url("data:image/svg+xml,${encodeURIComponent(FIGURE)}")`,
);

// ============================================================ 2. EPISODES: search, filter, sort
$("#cat").innerHTML = ["All categories", ...new Set(EPISODES.map((e) => e[2]))]
  .map((c) => `<option>${c}</option>`)
  .join("");
function renderEpisodes() {
  const q = $("#q").value.trim().toLowerCase(),
    cat = $("#cat").value,
    sort = $("#sort").value;
  const list = EPISODES.map((e, i) => ({ i, e })).filter(
    ({ e }) => (cat === "All categories" || e[2] === cat) && (e[0] + " " + e[1] + " " + e[2]).toLowerCase().includes(q),
  );
  list.sort((a, b) =>
    sort === "new" ? b.e[5] - a.e[5] : sort === "pop" ? b.e[4] - a.e[4] : a.e[3] - b.e[3],
  );
  $("#eps").innerHTML = list.length
    ? list
        .map(
          ({
            i,
            e,
          }) => `<article class="ep"><div class="cover" style="background:linear-gradient(135deg,${e[6]},#231012)"></div>
    <h3>${e[0]}</h3><small>${e[1]} · ${e[2]}</small><div class="meta"><span>${e[3]} min</span><span>${e[4].toLocaleString()} plays</span></div>
    <button class="play" data-play="${i}">▶ Play</button></article>`,
        )
        .join("")
    : `<p class="empty">No episodes match. Clear the search or pick another category.</p>`;
}
["q", "cat", "sort"].forEach((id) => ($("#" + id).oninput = renderEpisodes));

// ============================================================ 3. SIMULATED PLAYER (no real audio)
let current = null,
  progress = 0,
  ticking = null;
function drawPlayer() {
  const ep = EPISODES[current],
    total = ep[3] * 60,
    now = Math.floor((progress / 100) * total);
  $("#pTitle").textContent = ep[0];
  $("#pFill").style.width = progress + "%";
  $("#pTime").textContent = `${Math.floor(now / 60)}:${String(now % 60).padStart(2, "0")} / ${ep[3]}:00`;
  $("#pp").textContent = ticking ? "⏸" : "▶";
}
function togglePlay() {
  if (ticking) {
    clearInterval(ticking);
    ticking = null;
  } else
    ticking = setInterval(() => {
      progress = Math.min(100, progress + 0.5);
      if (progress >= 100) {
        clearInterval(ticking);
        ticking = null;
      }
      drawPlayer();
    }, 250);
  drawPlayer();
}
$("#eps").onclick = (e) => {
  if (e.target.dataset.play === undefined) return;
  current = +e.target.dataset.play;
  progress = 0;
  clearInterval(ticking);
  ticking = null;
  $("#player").hidden = false;
  togglePlay();
};
$("#pp").onclick = togglePlay;
$("#pClose").onclick = () => {
  clearInterval(ticking);
  ticking = null;
  $("#player").hidden = true;
};

// ============================================================ 4. CREATORS (follow, saved in this browser)
let following = store.get("wh-follow", []);
function renderCreators() {
  $("#creatorList").innerHTML = CREATORS.map(
    (
      [name, role, color],
      i,
    ) => `<div class="creator"><div class="av" style="background:${color}">${name[0]}</div>
    <b>${name}</b><br><small>${role}</small><br><button class="${following.includes(i) ? "on" : ""}" data-follow="${i}">${following.includes(i) ? "Following" : "Follow"}</button></div>`,
  ).join("");
}
$("#creatorList").onclick = (e) => {
  if (e.target.dataset.follow === undefined) return;
  const i = +e.target.dataset.follow;
  following = following.includes(i) ? following.filter((x) => x !== i) : [...following, i];
  store.set("wh-follow", following);
  renderCreators();
};

// ============================================================ 5. FORMS + START
$("#signup").onclick = () =>
  formModal({
    title: "Sign up",
    button: "Create account",
    fields: [
      { name: "name", label: "Name" },
      { name: "email", label: "Email", type: "email" },
      { name: "password", label: "Password", type: "password" },
    ],
    done: (v) => `Welcome, ${esc(v.name)}! (Demo only, no account was created.)`,
  });
$("#login").onclick = () =>
  formModal({
    title: "Login",
    button: "Log in",
    fields: [
      { name: "email", label: "Email", type: "email" },
      { name: "password", label: "Password", type: "password" },
    ],
    done: () => "Mock login successful. No server involved.",
  });
$("#joinForm").onsubmit = (e) => {
  e.preventDefault();
  const ok = /^\S+@\S+\.\S+$/.test($("#joinEmail").value);
  $("#joinMsg").textContent = ok
    ? "Thanks! This is a demo, so nothing was sent."
    : "Enter a valid email address.";
  if (ok) $("#joinEmail").value = "";
};
Gallery({ mount: "#gallery", key: "wh-gallery" });
renderEpisodes();
renderCreators();
