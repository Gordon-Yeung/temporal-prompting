/* Compare + Adjudicate screen. Relies on helpers from app.js (window.CoderApp). */
(function () {
  const { CATS, el, esc, api } = window.CoderApp;

  const pct = (x) => (x == null ? "—" : (x * 100).toFixed(0) + "%");
  const num2 = (x) => (x == null ? "—" : x.toFixed(2));

  let current = null;   // last compare response
  const adj = {};       // turn -> {categories:[], other_label, note, confidence, include, resolution, source}

  async function populateCoders() {
    const vid = el("#cmp-transcript").value;
    if (!vid) return;
    let coders = [];
    try { coders = await api(`/api/coders/${vid}`); } catch (e) {}
    const human = coders.filter((c) => c !== "adjudicated");
    const opts = human.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    el("#cmp-a").innerHTML = opts;
    el("#cmp-b").innerHTML = opts;
    if (human.length > 1) el("#cmp-b").selectedIndex = 1;
    el("#cmp-llm").checked = coders.includes("llm");
  }

  function renderStats(stats) {
    const b = stats.binary, c = stats.category;
    const cards = [
      ["Both flagged", b.both],
      ["Only A", b.a_only],
      ["Only B", b.b_only],
      ["Raw agreement", pct(b.raw_agreement)],
      ["Cohen's κ", num2(b.cohen_kappa)],
      ["PABAK", num2(b.pabak)],
      ["Positive agreement", pct(b.positive_agreement)],
      ["Category Jaccard", c.mean_jaccard == null ? "—" : num2(c.mean_jaccard)],
    ].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");

    const perCat = Object.entries(c.per_category || {}).map(([cat, v]) =>
      `${cat}: ${v.both}✓ / ${v.a_only}A / ${v.b_only}B`).join(" &nbsp;·&nbsp; ") || "—";

    el("#cmp-stats").innerHTML = cards + `
      <div class="caveat">
        Over ${b.n} teacher turns, coders both flagged ${b.both}.
        Cohen's κ is deflated when flags are rare — read <b>positive agreement</b>
        (${pct(b.positive_agreement)}) and <b>PABAK</b> (${num2(b.pabak)}) alongside it,
        not in isolation.
        <br/>Per-category (both✓ / A-only / B-only): ${perCat}
      </div>`;
  }

  function codeCol(title, s) {
    if (!s) return `<div class="col empty"><h4>${title}</h4>not flagged</div>`;
    const cats = (s.categories || []).join(", ") + (s.other_label ? ` (${esc(s.other_label)})` : "");
    return `<div class="col"><h4>${title}</h4>
      <div><b>${esc(cats) || "—"}</b> <span class="muted">[${esc(s.confidence || "")}]</span></div>
      ${s.note ? `<div class="muted">${esc(s.note)}</div>` : ""}
      ${s.verbatim_quote ? `<div class="quote">${esc(s.verbatim_quote)}</div>` : ""}
    </div>`;
  }

  function prefillAdj(row) {
    const a = row.a, b = row.b;
    let categories = [];
    if (a && b) categories = [...new Set([...(a.categories || []), ...(b.categories || [])])];
    else if (a) categories = [...(a.categories || [])];
    else if (b) categories = [...(b.categories || [])];
    const note = (a && a.note) || (b && b.note) || "";
    const confidence = (a && a.confidence) || (b && b.confidence) || "medium";
    adj[row.turn] = {
      turn: row.turn, speaker: row.speaker, categories, other_label: "",
      note, confidence, verbatim_quote: (a && a.verbatim_quote) || (b && b.verbatim_quote) || row.text,
      include: true, resolution: row.status, source: [row.a && "a", row.b && "b"].filter(Boolean),
      scene_id: `t${row.turn}`,
    };
  }

  function renderAdj(row) {
    const s = adj[row.turn];
    const cats = CATS.map(([c]) =>
      `<label class="${s.categories.includes(c) ? "on" : ""}" data-c="${c}">
        <input type="checkbox" ${s.categories.includes(c) ? "checked" : ""}/> ${c}</label>`).join("");
    return `<div class="adj" data-turn="${row.turn}">
      <label class="check"><input type="checkbox" class="adj-include" ${s.include ? "checked" : ""}/>
        include in adjudicated.json</label>
      <div class="cats">${cats}</div>
      <textarea class="adj-note" placeholder="Adjudicated note">${esc(s.note)}</textarea>
    </div>`;
  }

  function renderRows(resp) {
    const html = resp.rows.map((row) => {
      prefillAdj(row);
      const statusLabel = { agree: "agree", category_mismatch: "category mismatch", a_only: "only A", b_only: "only B" }[row.status];
      const cols = codeCol("Coder A", row.a) + codeCol("Coder B", row.b) +
        (resp.has_llm ? codeCol("LLM", row.llm) : `<div class="col empty"><h4>LLM</h4>not loaded</div>`);
      const ctx = row.context.map((c) =>
        `<div class="t ${c.turn === row.turn ? "center" : ""}"><b>${c.turn} ${esc(c.speaker)}:</b> ${esc(c.text)}</div>`).join("");
      return `<div class="cmp-row ${row.status}" data-turn="${row.turn}">
        <div class="head">
          <span class="status">${statusLabel}</span>
          <span class="muted">turn ${row.turn} · ${esc(row.speaker)}</span>
          <button class="context-toggle" type="button">show context ±3</button>
        </div>
        <div class="context hidden">${ctx}</div>
        <div class="cols">${cols}</div>
        ${renderAdj(row)}
      </div>`;
    }).join("");
    el("#cmp-rows").innerHTML = html || `<p class="muted">No flagged turns from either coder.</p>`;
    el("#adj-bar").classList.toggle("hidden", resp.rows.length === 0);

    // wire per-row controls
    el("#cmp-rows").querySelectorAll(".cmp-row").forEach((node) => {
      const turn = Number(node.dataset.turn);
      node.querySelector(".context-toggle").addEventListener("click", (e) => {
        const c = node.querySelector(".context");
        c.classList.toggle("hidden");
        e.target.textContent = c.classList.contains("hidden") ? "show context ±3" : "hide context";
      });
      node.querySelector(".adj-include").addEventListener("change", (e) => { adj[turn].include = e.target.checked; });
      node.querySelector(".adj-note").addEventListener("input", (e) => { adj[turn].note = e.target.value; });
      node.querySelectorAll(".adj .cats label").forEach((l) => {
        l.addEventListener("click", () => {
          const cb = l.querySelector("input");
          // click bubbles from the input too; normalize after event settles
          setTimeout(() => {
            const on = cb.checked;
            l.classList.toggle("on", on);
            const c = l.dataset.c;
            const set = new Set(adj[turn].categories);
            if (on) set.add(c); else set.delete(c);
            adj[turn].categories = [...set];
            adj[turn].resolution = "modified";
          }, 0);
        });
      });
    });
  }

  async function runCompare() {
    const vid = el("#cmp-transcript").value;
    const a = el("#cmp-a").value, b = el("#cmp-b").value;
    if (!a || !b) { alert("Need two coders. Code a transcript first (or import LLM)."); return; }
    if (a === b) { alert("Pick two different coders."); return; }
    const llm = el("#cmp-llm").checked ? "1" : "0";
    try {
      const resp = await api(`/api/compare/${vid}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&llm=${llm}`);
      current = resp;
      Object.keys(adj).forEach((k) => delete adj[k]);
      renderStats(resp.stats);
      renderRows(resp);
    } catch (e) { alert(e.message); }
  }

  async function importLlm() {
    const vid = el("#cmp-transcript").value;
    try {
      const r = await api(`/api/import-llm/${vid}`, { method: "POST" });
      alert(`Imported ${r.scenes} LLM scenes from ${r.source_run}.`);
      await populateCoders();
      el("#cmp-llm").checked = true;
    } catch (e) { alert(e.message); }
  }

  async function saveAdjudicated() {
    const vid = el("#cmp-transcript").value;
    const scenes = Object.values(adj).filter((s) => s.include && s.categories.length);
    try {
      const r = await api(`/api/adjudicated/${vid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes }),
      });
      el("#adj-status").textContent = `Saved adjudicated.json (${r.scenes} scenes) ${new Date().toLocaleTimeString()}`;
    } catch (e) { el("#adj-status").textContent = "Save failed: " + e.message; }
  }

  window.Compare = {
    onEnter() { populateCoders(); },
  };

  el("#cmp-transcript").addEventListener("change", populateCoders);
  el("#cmp-run").addEventListener("click", runCompare);
  el("#cmp-import-llm").addEventListener("click", importLlm);
  el("#adj-save").addEventListener("click", saveAdjudicated);
})();
