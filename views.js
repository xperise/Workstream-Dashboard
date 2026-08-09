/* ==========================================================================
   XPERISE — WORKSTREAM INTELLIGENCE v3  ·  views.js
   Toàn bộ phần vẽ. Mọi view đọc từ cùng một mảng S.view, nên bấm ở đâu cũng
   làm cả dashboard đổi theo — đó là ý nghĩa của "connected views".
   ========================================================================== */

let donutChart = null, dueChart = null, itemsTable = null;
let netMode = "dep";

/* ==========================================================================
   ĐIỀU PHỐI — chạy sau mỗi lần lọc hoặc đổi dữ liệu
   ========================================================================== */
function renderAll() {
  const d = digest(S.view);

  renderExec(d);
  renderKpis(d);
  renderQuickChips();
  renderFilterSummary();

  el("tabCountList").textContent = S.view.length;
  el("tabCountSystem").textContent = d.counts.noNext;   // số đầu mục chưa ghi bước tiếp theo

  // Chỉ vẽ tab đang mở — tránh dựng SVG cho những màn hình không ai nhìn.
  if (S.tab === "overview") { renderRiskMap(); renderTriage(); renderWorkload(d); renderDonut(d); renderDueChart(); }
  if (S.tab === "network")  renderNetwork();
  if (S.tab === "streams")  renderStreams();
  if (S.tab === "timeline") renderGantt();
  if (S.tab === "board")    renderBoard();
  if (S.tab === "list")     renderList();
  if (S.tab === "system")   renderSystem();
}

/* ==========================================================================
   TÓM TẮT ĐIỀU HÀNH + CHIP
   ========================================================================== */
function renderExec(d) {
  el("execText").innerHTML = execSentence(d);

  // Chip chỉ hiện những cảnh báo thực sự có số — không bày ra ô rỗng.
  el("execChips").innerHTML = Object.keys(FLAGS)
    .filter(k => d.counts[k] > 0)
    .map(k => `<button class="exec-chip ${S.filters.flags.includes(k) ? "is-on" : ""}" data-flag="${k}">${FLAGS[k].label}<b>${d.counts[k]}</b></button>`)
    .join("") || '<span style="font-size:12px;color:rgba(18,40,26,.55)">Không có cảnh báo nào đang mở.</span>';

  el("execChips").querySelectorAll("[data-flag]").forEach(b =>
    b.addEventListener("click", () => toggleFlag(b.dataset.flag)));
}

function renderQuickChips() {
  const dAll = digest(S.all);
  el("quickChips").innerHTML = Object.keys(FLAGS).map(k => {
    const n = dAll.counts[k];
    return `<button class="qchip ${S.filters.flags.includes(k) ? "is-on" : ""} ${n ? "" : "is-empty"}" data-flag="${k}">${FLAGS[k].label}<b>${n}</b></button>`;
  }).join("");
  el("quickChips").querySelectorAll("[data-flag]").forEach(b =>
    b.addEventListener("click", () => toggleFlag(b.dataset.flag)));
}

function renderFilterSummary() {
  if (!isFiltering()) { el("filterSummary").textContent = "Đang xem toàn bộ danh mục"; return; }
  const f = S.filters, bits = [];
  if (f.q) bits.push(`“${f.q}”`);
  if (f.pic !== "ALL") bits.push(f.pic);
  if (f.status !== "ALL") bits.push(f.status);
  if (f.priority !== "ALL") bits.push("ưu tiên " + f.priority);
  if (f.band !== "ALL") bits.push(BANDS.find(b => b.key === f.band).label);
  if (f.from || f.to) bits.push((f.from ? fmtDate(f.from) : "…") + " → " + (f.to ? fmtDate(f.to) : "…"));
  f.flags.forEach(k => bits.push(FLAGS[k].label));
  el("filterSummary").textContent = `${S.view.length}/${S.all.length} đầu mục · ${bits.join(" · ")}`;
}

/* ==========================================================================
   DẢI CHỈ SỐ — mỗi thẻ vừa là số liệu vừa là nút lọc
   ========================================================================== */
function renderKpis(d) {
  const cards = [
    { label: "Đang hoạt động", num: d.active, sub: `trên tổng ${d.total} đầu mục`,
      color: "#A855F7", meter: pct(d.active, d.total || 1), flag: null },
    { label: "Rủi ro danh mục", num: d.portfolioWRI, unit: "/100", sub: `thang 0–100 · ${d.portfolioBand.label.toLowerCase()}`,
      color: d.portfolioBand.color, meter: d.portfolioWRI, flag: null },
    { label: "Nguy cấp", num: d.counts.critical, sub: `WRI ≥ ${BANDS[0].min}`,
      color: "#E11D48", meter: pct(d.counts.critical, d.active || 1), flag: "critical" },
    { label: "Trễ hạn", num: d.counts.overdue, sub: "quá hạn chốt",
      color: "#E11D48", meter: pct(d.counts.overdue, d.active || 1), flag: "overdue" },
    { label: `Đến hạn ≤ ${THRESHOLDS.dueSoonDays} ngày`, num: d.counts.dueSoon, sub: "trong tuần tới",
      color: "#EA8C0B", meter: pct(d.counts.dueSoon, d.active || 1), flag: "dueSoon" },
    { label: "Đầy đủ dữ liệu", num: d.completeness, unit: "%", sub: `${d.cellsFilled}/${d.cellsTotal} trường tùy chọn`,
      color: d.completeness < THRESHOLDS.dataThin*100 ? "#EA8C0B" : "#0D9488", meter: d.completeness, flag: null }
  ];

  el("kpiStrip").innerHTML = cards.map(c => `
    <div class="kpi" style="border-left-color:${c.color}" ${c.flag ? `data-flag="${c.flag}"` : ""}>
      <div class="kpi-label">${esc(c.label)}</div>
      <div class="kpi-num" style="color:${c.color}">${c.num}${c.unit ? `<small>${c.unit}</small>` : ""}</div>
      <div class="kpi-sub">${esc(c.sub)}</div>
      <div class="kpi-meter"><i style="width:${Math.min(100,c.meter)}%;background:${c.color}"></i></div>
    </div>`).join("");

  el("kpiStrip").querySelectorAll("[data-flag]").forEach(k =>
    k.addEventListener("click", () => toggleFlag(k.dataset.flag)));
}

/* ==========================================================================
   BẢN ĐỒ RỦI RO — trục ngang: ngày đến hạn · trục dọc: WRI
   Vẽ bằng SVG tay để kiểm soát được vùng ngưỡng và mốc T0.
   ========================================================================== */
function renderRiskMap() {
  const W = 560, H = 330, ML = 42, MR = 58, MT = 16, MB = 42;
  const pw = W - ML - MR, ph = H - MT - MB;
  const items = S.view.filter(p => p.status !== "Done");

  if (!items.length) { el("riskMap").innerHTML = emptyBox("Không có đầu mục nào đang chạy trong bộ lọc này."); el("riskLegend").innerHTML = ""; return; }

  // Trục ngang bám theo dữ liệu thật, không cố định.
  const dayVals = items.filter(p => p._wri.daysLeft !== null).map(p => p._wri.daysLeft);
  const minD = Math.min(-2, ...(dayVals.length ? dayVals : [0]));
  const maxD = Math.max(10, ...(dayVals.length ? dayVals : [0]));
  const x = v => ML + (v - minD) / (maxD - minD || 1) * pw;
  const y = v => MT + ph - (v / 100) * ph;
  const noDueX = ML + pw + 26;   // cột riêng bên phải cho việc chưa có hạn

  // Dải nền theo ngưỡng — cho thấy ranh giới cảnh báo ngay trên bản đồ.
  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bản đồ rủi ro">`;
  BANDS.forEach((b, i) => {
    const top = i === 0 ? 100 : BANDS[i-1].min;
    svg += `<rect x="${ML}" y="${y(top)}" width="${pw}" height="${y(b.min)-y(top)}" fill="${b.soft}" opacity=".62"/>`;
    svg += `<text class="zone-label" x="${ML+7}" y="${y(top)+12}">${b.label}</text>`;
  });
  [0,25,50,75,100].forEach(v => {
    svg += `<line x1="${ML}" y1="${y(v)}" x2="${ML+pw}" y2="${y(v)}" stroke="#E3E8EC" stroke-width="1"/>`;
    svg += `<text class="axis-label" x="${ML-8}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  });

  // Mốc hôm nay
  svg += `<line x1="${x(0)}" y1="${MT}" x2="${x(0)}" y2="${MT+ph}" stroke="#A855F7" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  svg += `<text class="axis-label" x="${x(0)}" y="${MT+ph+15}" text-anchor="middle" fill="#7E22CE">T0</text>`;
  [5,10,15,20,30].filter(v => v <= maxD).forEach(v =>
    svg += `<text class="axis-label" x="${x(v)}" y="${MT+ph+15}" text-anchor="middle">+${v}d</text>`);
  svg += `<text class="axis-label" x="${noDueX}" y="${MT+ph+15}" text-anchor="middle">chưa hạn</text>`;
  svg += `<text class="axis-label" x="${ML+pw/2}" y="${H-6}" text-anchor="middle">Số ngày đến hạn</text>`;
  svg += `<text class="axis-label" transform="rotate(-90 12 ${MT+ph/2})" x="12" y="${MT+ph/2}" text-anchor="middle">Chỉ số rủi ro (WRI)</text>`;

  // Chấm: màu = ngưỡng, kích thước = mức ưu tiên
  const size = { "High": 9, "Medium": 7, "Low": 5.5 };
  items.forEach(p => {
    const cx = p._wri.daysLeft === null ? noDueX : x(p._wri.daysLeft);
    const cy = y(p._wri.score);
    const r = size[p.priority] || 6;
    svg += `<g class="dot" data-id="${esc(p.id)}"><title>${esc(p.title)} — WRI ${p._wri.score} · ${p._wri.reason}</title>
      <rect x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" rx="2.5"
            transform="rotate(45 ${cx} ${cy})" fill="${p._wri.band.color}" opacity=".92"/>
      <text class="dot-num" x="${cx}" y="${cy+3}" text-anchor="middle">${p._wri.score}</text></g>`;
  });
  svg += `</svg>`;

  el("riskMap").innerHTML = svg;
  el("riskMap").querySelectorAll(".dot").forEach(g => g.addEventListener("click", () => focusItem(g.dataset.id)));

  el("riskLegend").innerHTML =
    BANDS.map(b => `<span><i style="background:${b.color}"></i>${b.label} · ${b.min}+</span>`).join("") +
    `<span class="sep">Kích thước = mức ưu tiên</span>`;
}

function emptyBox(msg) {
  return `<div style="padding:44px 12px;text-align:center;color:var(--ink-3);font-size:12.5px">${esc(msg)}</div>`;
}

/* ==========================================================================
   5 VIỆC CẦN CHẠM TRƯỚC — xếp theo WRI, kèm lý do bị chấm cao
   ========================================================================== */
function renderTriage() {
  const top = S.view.filter(p => p.status !== "Done").slice(0, 5);
  if (!top.length) { el("triageList").innerHTML = emptyBox("Không còn việc nào đang mở."); return; }

  el("triageList").innerHTML = top.map(p => {
    const w = p._wri;
    const why = w.missing.length
      ? "Chưa có " + w.missing.map(k => WRI.data.fields.find(f => f.key === k).label.replace("Thiếu ","").toLowerCase()).join(", ")
      : (p.next_steps || "Đã có đủ dữ liệu");
    return `<li data-id="${esc(p.id)}">
      <div class="triage-body">
        <div class="triage-title">${esc(p.title)}</div>
        <div class="triage-why">${esc(why)}</div>
        <div class="triage-meta">
          <span class="pill" style="background:${w.band.soft};color:${w.band.color}">WRI ${w.score}</span>
          <span>${esc(w.reason)}</span>
          <span>${picsOf(p).map(n => avatar(n,"sm")).join("")} ${esc(picsOf(p).join(", "))}</span>
        </div>
      </div></li>`;
  }).join("");

  el("triageList").querySelectorAll("li").forEach(li =>
    li.addEventListener("click", () => focusItem(li.dataset.id)));
}

/* ==========================================================================
   TẢI THEO NGƯỜI + HHI
   ========================================================================== */
function renderWorkload(d) {
  if (!d.load.length) { el("workload").innerHTML = emptyBox("Chưa có ai được gán việc."); }
  else {
    const max = d.load[0].weight || 1;
    el("workload").innerHTML = d.load.slice(0, 8).map(o => {
      // Thanh chia đoạn theo ngưỡng rủi ro của chính các việc người đó giữ.
      const mine = S.view.filter(p => p.status !== "Done" && picsOf(p).includes(o.name));
      const segs = BANDS.map(b => ({ b, n: mine.filter(p => p._wri.band.key === b.key).length })).filter(s => s.n);
      const tot = segs.reduce((s,x) => s + x.n, 0) || 1;
      return `<div class="wl-row" data-pic="${esc(o.name)}">
        <span class="wl-name">${avatar(o.name,"sm")}<span>${esc(o.name)}</span></span>
        <span class="wl-track" style="max-width:${o.weight/max*100}%">
          ${segs.map(s => `<i style="width:${s.n/tot*100}%;background:${s.b.color}"></i>`).join("")}
        </span>
        <span class="wl-val">${o.weight % 1 ? o.weight.toFixed(1) : o.weight}</span>
      </div>`;
    }).join("");
    el("workload").querySelectorAll("[data-pic]").forEach(r =>
      r.addEventListener("click", () => setFilter("pic", S.filters.pic === r.dataset.pic ? "ALL" : r.dataset.pic)));
  }

  const tight = d.tooConcentrated;
  el("hhiValue").textContent = d.hhi.toFixed(2);
  el("hhiValue").style.color = tight ? "var(--critical)" : "var(--stable)";
  // Thanh đo phần vượt trên mức chia đều, không phải HHI thô.
  el("hhiFill").style.width = Math.min(100, Math.max(0, (d.hhiRatio - 1) / (THRESHOLDS.hhiTight - 1) * 100)) + "%";
  el("hhiFill").style.background = tight ? "var(--critical)" : "var(--stable)";
  el("hhiNote").textContent = d.owners <= 1
    ? "Chỉ một người đang giữ toàn bộ khối lượng"
    : `${d.concentration} — chia đều giữa ${d.owners} người là ${d.hhiBase.toFixed(2)}`;
}

/* ==========================================================================
   CƠ CẤU DANH MỤC — donut trạng thái + thanh ưu tiên
   ========================================================================== */
function renderDonut(d) {
  const counts = STATUSES.map(s => S.view.filter(p => p.status === s).length);
  el("donutTotal").textContent = S.view.length;

  const cfg = {
    type: "doughnut",
    data: { labels: STATUSES, datasets: [{ data: counts, backgroundColor: STATUSES.map(s => STATUS_COLOR[s]), borderColor: "#fff", borderWidth: 3, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "72%",
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; },
      onClick: (e, els, ch) => { if (els.length) setFilter("status", S.filters.status === ch.data.labels[els[0].index] ? "ALL" : ch.data.labels[els[0].index]); },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label}: ${c.parsed}` } } }
    }
  };
  if (donutChart) { donutChart.data = cfg.data; donutChart.update(); }
  else donutChart = new Chart(el("statusDonut"), cfg);

  el("statusLegend").innerHTML = STATUSES.map((s,i) =>
    `<span><i style="background:${STATUS_COLOR[s]}"></i>${s} · ${counts[i]}</span>`).join("");

  const maxP = Math.max(1, ...PRIORITIES.map(p => S.view.filter(x => x.priority === p).length));
  el("prioBars").innerHTML = PRIORITIES.map(pr => {
    const n = S.view.filter(x => x.priority === pr).length;
    return `<div class="prio-row" data-prio="${pr}">
      <span>${pr}</span>
      <span class="prio-track"><i style="width:${n/maxP*100}%;background:${PRIORITY_COLOR[pr]}"></i></span>
      <b>${n}</b></div>`;
  }).join("");
  el("prioBars").querySelectorAll("[data-prio]").forEach(r =>
    r.addEventListener("click", () => setFilter("priority", S.filters.priority === r.dataset.prio ? "ALL" : r.dataset.prio)));
}

/* ==========================================================================
   MẬT ĐỘ ĐẾN HẠN — dồn theo khung thời gian, tô màu theo mức khẩn
   ========================================================================== */
function renderDueChart() {
  const buckets = [
    { label: "Trễ hạn",  color: "#E11D48", test: d => d !== null && d < 0 },
    { label: "Tuần này", color: "#EA8C0B", test: d => d !== null && d >= 0 && d <= 7 },
    { label: "2 tuần",   color: "#A855F7", test: d => d !== null && d > 7 && d <= 14 },
    { label: "30 ngày",  color: "#C9A6F5", test: d => d !== null && d > 14 && d <= 30 },
    { label: "Sau đó",   color: "#CBD5D0", test: d => d !== null && d > 30 },
    { label: "Chưa hạn", color: "#8A968F", test: d => d === null }
  ];
  const active = S.view.filter(p => p.status !== "Done");
  const data = buckets.map(b => active.filter(p => b.test(p._wri.daysLeft)).length);

  const cfg = {
    type: "bar",
    data: { labels: buckets.map(b => b.label), datasets: [{ data, backgroundColor: buckets.map(b => b.color), borderRadius: 5, maxBarThickness: 34 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; },
      onClick: (e, els) => {
        if (!els.length) return;
        const i = els[0].index;
        if (i === 0) toggleFlag("overdue");
        else if (i === 1) toggleFlag("dueSoon");
      },
      scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1, font: { size: 10 } }, grid: { color: "#EDF1F4" }, border: { display: false } } },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.parsed.y} đầu mục` } } }
    }
  };
  if (dueChart) { dueChart.data = cfg.data; dueChart.update(); }
  else dueChart = new Chart(el("dueChart"), cfg);

  el("dueNote").textContent = data[0] || data[1]
    ? "Cột đỏ và cam là phần cần quyết định trong tuần này."
    : "Không có đầu mục nào đến hạn trong tuần.";
}

/* ==========================================================================
   MẠNG LƯỚI PHỤ THUỘC
   Chưa có liên kết nào được xác nhận thì app không bịa ra đường găng — nó đưa
   ra các liên kết GỢI Ý kèm bằng chứng để người dùng duyệt.
   ========================================================================== */
function suggestLinks() {
  const out = [];
  const stop = new Set(["the","and","for","with","xperise","model","final","initial","current","new","đầu","mục","của","cho","và"]);

  S.view.forEach(a => S.view.forEach(b => {
    if (a.id === b.id) return;

    // Bằng chứng 1 — ghi chú của A nhắc tới một từ đặc trưng trong tiêu đề B.
    const note = (String(a.next_steps||"") + " " + String(a.description||"")).toLowerCase();
    if (note.trim()) {
      const words = String(b.title||"").toLowerCase().split(/[^\p{L}\p{N}]+/u)
        .filter(w => w.length > 4 && !stop.has(w));
      const hit = words.find(w => note.includes(w));
      if (hit) { out.push({ from: b.id, to: a.id, kind: "note", evidence: `Ghi chú của “${a.title}” có nhắc “${hit}”` }); return; }
    }

    // Bằng chứng 2 — cùng luồng và hạn của A sớm hơn hạn của B.
    if (a._stream.name === b._stream.name && a._stream.name !== STREAM_FALLBACK) {
      const ea = toDate(a.timeline_end), eb = toDate(b.timeline_end);
      if (ea && eb && ea < eb) {
        out.push({ from: a.id, to: b.id, kind: "stream",
                   evidence: `Luồng ${a._stream.name} · ${fmtDate(a.timeline_end)} → ${fmtDate(b.timeline_end)}` });
      }
    }
  }));

  // Bỏ trùng, giữ tối đa 6 gợi ý mạnh nhất.
  const seen = new Set();
  return out.filter(l => { const k = l.from + ">" + l.to; if (seen.has(k)) return false; seen.add(k); return true; })
            .sort((a,b) => (a.kind === "note" ? -1 : 1) - (b.kind === "note" ? -1 : 1))
            .slice(0, 6);
}

function renderNetwork() {
  const items = S.view;
  const box = el("network");
  if (!items.length) { box.innerHTML = emptyBox("Không có đầu mục nào trong bộ lọc này."); el("criticalPath").innerHTML = ""; el("netLegend").innerHTML = ""; return; }

  const W = 560, H = 400, cx = W/2, cy = H/2;

  if (netMode === "own") {
    // Chế độ sở hữu: người ở giữa, việc quay quanh — thấy ngay ai đang gánh gì.
    const owners = [...new Set(items.flatMap(picsOf))];
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    const oPos = {};
    owners.forEach((o, i) => {
      const ang = (i / owners.length) * Math.PI * 2 - Math.PI/2;
      oPos[o] = { x: cx + Math.cos(ang)*105, y: cy + Math.sin(ang)*105 };
    });
    items.forEach((p, i) => {
      const ang = (i / items.length) * Math.PI * 2 - Math.PI/2;
      const px = cx + Math.cos(ang)*168, py = cy + Math.sin(ang)*168;
      picsOf(p).forEach(o => {
        if (oPos[o]) svg += `<line x1="${oPos[o].x}" y1="${oPos[o].y}" x2="${px}" y2="${py}" stroke="#E3E8EC" stroke-width="1"/>`;
      });
      const r = p.priority === "High" ? 11 : p.priority === "Medium" ? 9 : 7;
      svg += `<g class="node" data-id="${esc(p.id)}"><title>${esc(p.title)} — WRI ${p._wri.score}</title>
        <rect x="${px-r}" y="${py-r}" width="${r*2}" height="${r*2}" rx="3" transform="rotate(45 ${px} ${py})" fill="${p._wri.band.color}"/></g>`;
    });
    owners.forEach(o => {
      const n = items.filter(p => picsOf(p).includes(o)).length;
      svg += `<g class="node" data-pic="${esc(o)}"><title>${esc(o)} — ${n} đầu mục</title>
        <circle cx="${oPos[o].x}" cy="${oPos[o].y}" r="15" fill="#fff" stroke="${colorFor(o)}" stroke-width="2"/>
        <text class="node-count" x="${oPos[o].x}" y="${oPos[o].y+3}">${esc(initials(o))}</text>
        <text class="node-label" x="${oPos[o].x}" y="${oPos[o].y+27}">${esc(o.split(" ").slice(-1)[0])}</text></g>`;
    });
    box.innerHTML = svg + `</svg>`;
    box.querySelectorAll("[data-pic]").forEach(g => g.addEventListener("click", () => setFilter("pic", g.dataset.pic)));
  } else {
    // Chế độ phụ thuộc: bố trí theo luồng, mỗi luồng một cụm.
    const groups = {};
    items.forEach(p => (groups[p._stream.name] = groups[p._stream.name] || []).push(p));
    const names = Object.keys(groups);
    const pos = {};
    let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

    names.forEach((nm, gi) => {
      const ga = (gi / names.length) * Math.PI * 2 - Math.PI/2;
      const gx = cx + Math.cos(ga)*118, gy = cy + Math.sin(ga)*118;
      groups[nm].forEach((p, i) => {
        const a = (i / Math.max(1, groups[nm].length)) * Math.PI * 2;
        const rr = groups[nm].length > 1 ? 52 : 0;
        pos[p.id] = { x: gx + Math.cos(a)*rr, y: gy + Math.sin(a)*rr };
      });
      svg += `<text class="node-label" x="${gx}" y="${gy - 68}" style="font-weight:700;fill:var(--ink-3)">${esc(nm)}</text>`;
    });

    const links = S.links.length ? S.links : suggestLinks();
    const confirmed = S.links.length > 0;
    links.forEach(l => {
      const a = pos[l.from], b = pos[l.to];
      if (!a || !b) return;
      svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${confirmed ? "#A855F7" : "#CBD5D0"}"
              stroke-width="${confirmed ? 2 : 1}" ${confirmed ? "" : 'stroke-dasharray="3 3"'}/>`;
    });

    items.forEach(p => {
      const q = pos[p.id]; if (!q) return;
      const r = p.priority === "High" ? 11 : p.priority === "Medium" ? 9 : 7;
      const deps = links.filter(l => l.from === p.id).length;
      svg += `<g class="node" data-id="${esc(p.id)}"><title>${esc(p.title)} — WRI ${p._wri.score} · ${deps} việc phía sau</title>
        <rect x="${q.x-r}" y="${q.y-r}" width="${r*2}" height="${r*2}" rx="3" transform="rotate(45 ${q.x} ${q.y})" fill="${p._wri.band.color}"/>
        ${deps ? `<circle cx="${q.x+r+4}" cy="${q.y-r-2}" r="6" fill="#fff" stroke="#A855F7"/><text class="node-count" x="${q.x+r+4}" y="${q.y-r+1}">${deps}</text>` : ""}</g>`;
    });
    box.innerHTML = svg + `</svg>`;
  }

  box.querySelectorAll("[data-id]").forEach(g => g.addEventListener("click", () => focusItem(g.dataset.id)));

  el("netLegend").innerHTML = BANDS.map(b => `<span><i style="background:${b.color}"></i>${b.label}</span>`).join("") +
    `<span class="sep">Kích thước = ưu tiên · Vòng tròn nhỏ = số việc phụ thuộc phía sau</span>`;
  el("netNote").textContent = netMode === "own"
    ? "Đường nối = quan hệ sở hữu. Bấm vào một người để lọc cả dashboard theo người đó."
    : (S.links.length ? "Đường liền = liên kết đã xác nhận." : "Đường đứt nét = liên kết mới ở mức gợi ý, chưa được xác nhận.");

  renderCriticalPath();
}

function renderCriticalPath() {
  const box = el("criticalPath");

  if (!S.links.length) {
    const sug = suggestLinks();
    if (!sug.length) { box.innerHTML = emptyBox("Chưa tìm thấy dấu hiệu phụ thuộc nào giữa các đầu mục hiện có."); return; }

    box.innerHTML = `<p class="card-foot" style="margin:0 0 12px">Chưa có liên kết phụ thuộc nào được xác nhận, nên chưa dựng được đường găng. Dưới đây là các liên kết được gợi ý — kèm bằng chứng — để anh duyệt.</p>` +
      sug.map((l, i) => {
        const a = S.all.find(x => x.id === l.from), b = S.all.find(x => x.id === l.to);
        if (!a || !b) return "";
        return `<div class="link-item">
          <div class="link-pair">${esc(a.title)}<span class="arrow">→</span>${esc(b.title)}</div>
          <div class="link-ev">${esc(l.evidence)}</div>
          <div class="link-actions">
            <span class="ev-tag">${l.kind === "note" ? "có căn cứ trong dữ liệu" : "cùng luồng, theo thứ tự ngày"}</span>
            <button class="btn btn-ghost btn-sm" data-link="${i}">Xác nhận liên kết</button>
          </div></div>`;
      }).join("");

    box.querySelectorAll("[data-link]").forEach(b =>
      b.addEventListener("click", () => confirmLink(sug[+b.dataset.link])));
    return;
  }

  // Đã có liên kết → dựng chuỗi dài nhất theo tổng WRI.
  const chain = longestChain();
  box.innerHTML = `<p class="card-foot" style="margin:0 0 12px">Chuỗi dài nhất trong mạng phụ thuộc — trễ một mắt xích là trễ cả chuỗi.</p>` +
    chain.map((p, i) => `<div class="link-item" data-id="${esc(p.id)}" style="cursor:pointer">
      <div class="link-pair">${i+1}. ${esc(p.title)}</div>
      <div class="link-ev">${esc(picsOf(p).join(", "))} · ${p.timeline_end ? fmtDate(p.timeline_end) : "chưa có hạn"}</div>
      <div class="link-actions"><span class="pill" style="background:${p._wri.band.soft};color:${p._wri.band.color}">WRI ${p._wri.score}</span></div>
    </div>`).join("");
  box.querySelectorAll("[data-id]").forEach(d => d.addEventListener("click", () => focusItem(d.dataset.id)));
}

function longestChain() {
  const next = {};
  S.links.forEach(l => (next[l.from] = next[l.from] || []).push(l.to));
  const memo = {}, busy = {};
  const walk = id => {
    if (memo[id]) return memo[id];
    if (busy[id]) return [id];        // gặp vòng lặp thì dừng, không đệ quy vô hạn
    busy[id] = true;
    const kids = next[id] || [];
    let best = [];
    kids.forEach(k => { const c = walk(k); if (c.length > best.length) best = c; });
    busy[id] = false;
    return (memo[id] = [id].concat(best));
  };
  let best = [];
  S.view.forEach(p => { const c = walk(p.id); if (c.length > best.length) best = c; });
  return best.map(id => S.all.find(x => x.id === id)).filter(Boolean);
}

async function confirmLink(link) {
  S.links.push(link);
  if (S.hasBlockedBy && !S.demo) {
    const target = S.all.find(x => x.id === link.to);
    const arr = (target.blocked_by || []).concat([link.from]);
    const { error } = await S.sb.from("projects").update({ blocked_by: arr }).eq("id", link.to);
    if (error) { toast("Không lưu được liên kết: " + error.message, "err"); S.links.pop(); return; }
    target.blocked_by = arr;
    toast("Đã lưu liên kết lên Supabase", "ok");
  } else {
    toast("Đã ghi nhận liên kết trong phiên này. Chạy SQL ở tab Dữ liệu & hệ thống để lưu vĩnh viễn.", "ok");
  }
  renderNetwork();
}

/* ==========================================================================
   LUỒNG CHIẾN LƯỢC
   ========================================================================== */
function renderStreams() {
  const groups = {};
  S.view.forEach(p => (groups[p._stream.name] = groups[p._stream.name] || []).push(p));
  const names = Object.keys(groups).sort((a,b) => avgWri(groups[b]) - avgWri(groups[a]));

  if (!names.length) { el("streamList").innerHTML = emptyBox("Không có đầu mục nào trong bộ lọc này."); return; }

  el("streamList").innerHTML = names.map(nm => {
    const list = groups[nm].slice().sort((a,b) => b._wri.score - a._wri.score);
    const wri = Math.round(avgWri(list));
    const band = bandOf(wri);

    // Chủ lực: ai giữ nhiều nhất trong luồng này và giữ bao nhiêu phần trăm.
    const load = {};
    list.forEach(p => picsOf(p).forEach(n => { load[n] = (load[n]||0) + 1/picsOf(p).length; }));
    const owners = Object.entries(load).sort((a,b) => b[1]-a[1]);
    const totalW = owners.reduce((s,x) => s+x[1], 0) || 1;
    const lead = owners[0];

    // Mốc gần nhất: hạn chốt sớm nhất còn lại trong luồng.
    const upcoming = list.filter(p => p.timeline_end && p.status !== "Done")
                         .sort((a,b) => toDate(a.timeline_end) - toDate(b.timeline_end))[0];
    const late = list.filter(FLAGS.overdue.test).length;

    return `<div class="stream-card" style="border-left-color:${band.color}">
      <div class="stream-head">
        <div>
          <span class="eyebrow">Luồng chiến lược</span>
          <h3 class="stream-name">${esc(nm)} ${list.some(p => p._stream.inferred) ? '<span class="tilde">~</span>' : ""}</h3>
        </div>
        <div class="stream-badges">
          <span class="pill" style="background:${band.soft};color:${band.color}">WRI ${wri}</span>
          <span class="pill plain" style="background:var(--surface-2);color:var(--ink-2)">${list.length} đầu mục</span>
        </div>
      </div>

      <div class="stream-stats">
        <div class="stat-box">
          <div class="stat-label">Chủ lực</div>
          <div class="stat-val">${lead ? esc(lead[0]) : "Chưa gán"}</div>
          <div class="stat-sub">${lead ? Math.round(lead[1]/totalW*100) + "% tỷ trọng" : "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Mốc gần nhất</div>
          <div class="stat-val">${upcoming ? fmtDate(upcoming.timeline_end) : "Chưa có hạn"}</div>
          <div class="stat-sub">${upcoming ? esc(upcoming.title.slice(0,42)) : "—"}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Trễ hạn</div>
          <div class="stat-val" style="color:${late ? "var(--critical)" : "var(--ink)"}">${late}</div>
          <div class="stat-sub">${late ? "cần xử lý ngay" : "đang đúng lịch"}</div>
        </div>
      </div>

      ${list.map(p => `<div class="stream-item" data-id="${esc(p.id)}">
        ${picsOf(p).slice(0,2).map(n => avatar(n,"sm")).join("")}
        <span class="grow">${esc(p.title)}</span>
        <span class="pill" style="background:${p._wri.band.soft};color:${p._wri.band.color}">${p._wri.score}</span>
      </div>`).join("")}
    </div>`;
  }).join("");

  el("streamList").querySelectorAll("[data-id]").forEach(r =>
    r.addEventListener("click", () => focusItem(r.dataset.id)));
}
function avgWri(list) { return list.length ? list.reduce((s,p) => s + p._wri.score, 0) / list.length : 0; }

/* ==========================================================================
   DÒNG THỜI GIAN
   ========================================================================== */
function renderGantt() {
  const items = S.view.slice().sort((a,b) => {
    const ea = toDate(a.timeline_end), eb = toDate(b.timeline_end);
    if (!ea && !eb) return 0; if (!ea) return 1; if (!eb) return -1;
    return ea - eb;
  });
  if (!items.length) { el("gantt").innerHTML = emptyBox("Không có đầu mục nào trong bộ lọc này."); return; }

  // Khung thời gian bám dữ liệu thật, đệm thêm vài ngày hai đầu.
  const dates = items.flatMap(p => [toDate(p.timeline_start), toDate(p.timeline_end)]).filter(Boolean);
  const now = today0();
  const min = new Date(Math.min(now, ...dates)); min.setDate(min.getDate() - 6);
  const max = new Date(Math.max(now, ...dates)); max.setDate(max.getDate() + 8);
  const span = Math.max(1, daysBetween(min, max));
  const posOf = d => daysBetween(min, d) / span * 100;

  // Vạch tháng
  let ticks = "";
  const m = new Date(min.getFullYear(), min.getMonth() + 1, 1);
  while (m <= max) {
    const left = posOf(m);
    ticks += `<div class="month-tick" style="left:${left}%"></div><div class="month-name" style="left:${left}%">Th${m.getMonth()+1} ${m.getFullYear()}</div>`;
    m.setMonth(m.getMonth() + 1);
  }
  const nowLeft = posOf(now);

  el("gantt").innerHTML = `
    <div class="gantt-head">
      <div class="gantt-label"><span class="lbl" style="margin:0">Đầu mục</span></div>
      <div class="gantt-lane" style="height:22px">${ticks}
        <div class="now-line" style="left:${nowLeft}%"></div>
        <div class="now-flag" style="left:${nowLeft}%">NOW</div>
      </div>
    </div>` +
    items.map(p => {
      const s = toDate(p.timeline_start), e = toDate(p.timeline_end);
      const c = p._wri.band.color;
      let bar;
      if (s && e) {
        const l = posOf(s), w = Math.max(1.2, posOf(e) - posOf(s));
        bar = `<div class="gantt-bar" style="left:${l}%;width:${w}%;background:${c};opacity:.85" title="${fmtDate(p.timeline_start)} → ${fmtDate(p.timeline_end)}"></div>`;
      } else if (e) {
        bar = `<div class="gantt-diamond" style="left:${posOf(e)}%;background:${c}" title="Hạn chốt ${fmtDate(p.timeline_end)}"></div>`;
      } else {
        bar = `<div class="gantt-nodate" style="left:${nowLeft}%;width:${Math.max(8, 96-nowLeft)}%">chưa có hạn</div>`;
      }
      return `<div class="gantt-row" data-id="${esc(p.id)}">
        <div class="gantt-label">
          <div class="gantt-title">${esc(p.title)}</div>
          <div class="gantt-meta">${esc(picsOf(p).join(", "))} · ${e ? fmtDate(p.timeline_end) : "Chưa có hạn"}</div>
        </div>
        <div class="gantt-lane">${ticks}<div class="now-line" style="left:${nowLeft}%;opacity:.32"></div>${bar}</div>
      </div>`;
    }).join("");

  el("gantt").querySelectorAll("[data-id]").forEach(r =>
    r.addEventListener("click", () => focusItem(r.dataset.id)));
}

/* ==========================================================================
   BẢNG ĐIỀU HÀNH — kéo thả đổi trạng thái
   ========================================================================== */
function renderBoard() {
  el("boardNote").textContent = S.demo
    ? "Đang ở chế độ dữ liệu mẫu — thay đổi chỉ tồn tại trong phiên này"
    : "Thay đổi được lưu ngay lên Supabase";

  el("board").innerHTML = STATUSES.map(st => {
    const list = S.view.filter(p => p.status === st);
    return `<div class="col" data-status="${st}">
      <div class="col-head">
        <span class="col-name"><i style="background:${STATUS_COLOR[st]}"></i>${st}</span>
        <span class="col-count">${list.length}</span>
      </div>
      ${list.length ? list.map(p => `
        <div class="kcard" draggable="true" data-id="${esc(p.id)}" style="border-left-color:${p._wri.band.color}">
          <div class="kcard-title">${esc(p.title)}</div>
          <div class="kcard-meta">
            ${picsOf(p).slice(0,2).map(n => avatar(n,"sm")).join("")}
            <span>${esc(picsOf(p)[0] || "Chưa gán")}</span>
            <span class="pill" style="background:${p._wri.band.soft};color:${p._wri.band.color}">${p._wri.score}</span>
            <span>${esc(p._wri.reason)}</span>
          </div></div>`).join("") : '<div class="col-empty">—</div>'}
    </div>`;
  }).join("");

  el("board").querySelectorAll(".kcard").forEach(c => {
    c.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", c.dataset.id); c.classList.add("dragging"); });
    c.addEventListener("dragend", () => c.classList.remove("dragging"));
    c.addEventListener("dblclick", () => focusItem(c.dataset.id));
  });
  el("board").querySelectorAll(".col").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("is-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("is-over"));
    col.addEventListener("drop", e => {
      e.preventDefault(); col.classList.remove("is-over");
      updateStatus(e.dataTransfer.getData("text/plain"), col.dataset.status);
    });
  });
}

/* ==========================================================================
   DANH SÁCH
   ========================================================================== */
function renderList() {
  el("listCount").textContent = S.view.length;

  const rows = S.view.map(p => ({
    id: p.id, p,
    title: p.title || "", wri: p._wri.score, pic: p.pic || "",
    due: p.timeline_end || "9999-12-31",
    priority: { "High":1, "Medium":2, "Low":3 }[p.priority] || 9,
    status: { "Open":1, "In Progress":2, "Done":3 }[p.status] || 9,
    next: p.next_steps || ""
  }));

  if (!itemsTable) {
    itemsTable = new DataTable("#itemsTable", {
      data: rows, pageLength: 25, order: [[1, "desc"]],
      columns: [
        { data: "title", render: (v, t, r) => t !== "display" ? v :
          `<div class="t-title" data-open="${esc(r.id)}">${esc(v)}</div>` +
          (r.p.description ? `<div class="t-desc">${esc(String(r.p.description).slice(0,90))}</div>` : "") },
        { data: "wri", render: (v, t, r) => t !== "display" ? v : (() => {
            const b = r.p._wri.band;
            return `<span class="wri-cell"><span class="pill" style="background:${b.soft};color:${b.color}">${v}</span>
              <span class="wri-bar"><i style="width:${v}%;background:${b.color}"></i></span></span>`;
          })() },
        { data: "pic", render: (v, t) => t !== "display" ? v : (v
            ? `<span class="pic-cell">${v.split(",").map(n => avatar(n.trim(),"sm")).join("")}<span>${esc(v)}</span></span>`
            : '<span class="t-muted">Chưa gán</span>') },
        { data: "due", render: (v, t, r) => t !== "display" ? v : (r.p.timeline_end
            ? `<div>${fmtDate(r.p.timeline_end)}</div><div class="due-rel" style="color:${r.p._wri.band.color}">${esc(r.p._wri.reason)}</div>`
            : '<span class="t-muted">Chưa có hạn</span>') },
        { data: "priority", render: (v, t, r) => t !== "display" ? v :
          `<span class="pill" style="background:${PRIORITY_COLOR[r.p.priority]}1F;color:${PRIORITY_COLOR[r.p.priority]}">${esc(r.p.priority||"—")}</span>` },
        { data: "status", render: (v, t, r) => t !== "display" ? v :
          `<span class="pill" style="background:${STATUS_COLOR[r.p.status]}1F;color:${STATUS_COLOR[r.p.status]}">${esc(r.p.status||"—")}</span>` },
        { data: "next", render: (v, t) => t !== "display" ? v :
          (v ? `<div class="t-next">${esc(v)}</div>` : '<span class="t-muted">Chưa có bước tiếp theo</span>') },
        { data: "id", orderable: false, searchable: false,
          render: v => `<button class="icon-btn" data-open="${esc(v)}" title="Sửa"><i class="bi bi-pencil"></i></button>` }
      ],
      language: {
        info: "Đang xem _START_–_END_ trên _TOTAL_",
        infoEmpty: "Không có đầu mục nào", zeroRecords: "Không có đầu mục nào khớp bộ lọc.",
        emptyTable: "Chưa có đầu mục nào.", paginate: { first:"Đầu", last:"Cuối", next:"Sau", previous:"Trước" }
      }
    });
    $("#itemsTable tbody").on("click", "[data-open]", function () { focusItem(this.getAttribute("data-open")); });
  } else {
    itemsTable.clear().rows.add(rows).draw(false);
  }
}

/* ==========================================================================
   DỮ LIỆU & HỆ THỐNG
   ========================================================================== */
function renderSystem() {
  const d = digest(S.view);

  /* Chất lượng dữ liệu */
  el("qualityGrid").innerHTML = d.quality.map(q => {
    const color = q.pct >= 80 ? "var(--stable)" : q.pct >= 40 ? "var(--high)" : "var(--critical)";
    const shown = q.missingItems.slice(0, 6);
    return `<div class="q-card">
      <div class="q-head"><span class="q-name">${esc(q.label)}</span><span class="q-pct" style="color:${color}">${q.pct}<small>%</small></span></div>
      <div class="q-bar"><i style="width:${q.pct}%;background:${color}"></i></div>
      <div class="q-sub">${q.filled}/${q.total} đã điền</div>
      <div class="q-miss">${shown.map(p => `<div data-open="${esc(p.id)}">· ${esc(p.title)}</div>`).join("")}
        ${q.missingItems.length > 6 ? `<div class="q-more">+${q.missingItems.length-6} nữa</div>` : ""}</div>
    </div>`;
  }).join("");
  el("qualityGrid").querySelectorAll("[data-open]").forEach(x =>
    x.addEventListener("click", () => focusItem(x.dataset.open)));

  /* Trạng thái kết nối — nói thật cái gì đang chạy tạm, cái gì đã lưu */
  const conns = [
    { name: "Luồng chiến lược", on: S.hasStream, off: "Đang suy ra từ tiêu đề, chưa lưu vào cơ sở dữ liệu", onTxt: "Đã có cột `stream`, luồng được lưu cùng đầu mục" },
    { name: "Liên kết phụ thuộc", on: S.hasBlockedBy, off: "Liên kết chỉ tồn tại trong phiên này", onTxt: "Đã có cột `blocked_by`, liên kết được lưu vĩnh viễn" },
    { name: "Tiến độ %", on: S.hasProgress, off: "Chưa bật — tiến độ đang suy ra từ trạng thái", onTxt: "Đã có cột `progress`" },
    { name: "Đồng bộ tức thời", on: S.realtime, off: "Chưa bật — cần tải lại để thấy thay đổi của người khác", onTxt: "Đang chạy, mọi người thấy thay đổi ngay" }
  ];
  el("connGrid").innerHTML = conns.map(c => `
    <div class="conn-card">
      <span class="conn-dot" style="background:${c.on ? "var(--stable)" : "var(--line)"}"></span>
      <div class="conn-name">${esc(c.name)}</div>
      <div class="conn-state">${esc(c.on ? c.onTxt : c.off)}</div>
    </div>`).join("");

  el("connNote").textContent = conns.every(c => c.on)
    ? "Toàn bộ lớp kết nối đã bật. Dữ liệu luồng và liên kết được chia sẻ cho cả đội."
    : "Dán đoạn SQL này vào Supabase → SQL Editor → Run, rồi tải lại trang. App tự nhận cột mới và chuyển sang lưu trong cơ sở dữ liệu, không cần sửa code.";
  el("sqlBlock").textContent = SQL_CONNECTED;

  /* Bảng công thức — dựng thẳng từ object WRI, nên sửa công thức là bảng đổi theo */
  el("formulaIntro").textContent =
    `WRI cộng ${Object.keys(WRI).length - 1} thành phần độc lập rồi giới hạn ở ${WRI.cap}. Đầu mục đã Done luôn bằng 0. ` +
    `Thành phần thứ tư — thiếu dữ liệu — có ý tính điểm phạt: một đầu mục không ghi bước tiếp theo là một đầu mục không ai điều hành được, ` +
    `và độ lệch rủi ro thật chỉ khắc phục được bằng cách nhập liệu.`;

  const blocks = [
    { t: WRI.schedule.label, max: WRI.schedule.max, rows:
      [[WRI.schedule.noDue.label, WRI.schedule.noDue.points], [WRI.schedule.overdue.label, WRI.schedule.overdue.points]]
      .concat(WRI.schedule.ladder.map(s => [s.label, s.points]))
      .concat([[WRI.schedule.beyond.label, WRI.schedule.beyond.points]]) },
    { t: WRI.priority.label, max: WRI.priority.max, rows: Object.entries(WRI.priority.points) },
    { t: WRI.status.label,   max: WRI.status.max,   rows: Object.entries(WRI.status.points) },
    { t: WRI.data.label,     max: WRI.data.max,     rows: WRI.data.fields.map(f => [f.label, f.points]) }
  ];

  el("formulaGrid").innerHTML = blocks.map((b, i) => `
    <div class="f-card">
      <div class="f-head"><span class="f-name">${i+1} · ${esc(b.t)}</span><span class="f-range">0–${b.max}</span></div>
      ${b.rows.map(([k, v]) => `<div class="f-row"><span>${esc(k)}</span><b>+${v}</b></div>`).join("")}
    </div>`).join("");

  el("bandLegend").innerHTML = BANDS.map((b, i) => {
    const hi = i === 0 ? 100 : BANDS[i-1].min - 1;
    return `<span><i style="background:${b.color}"></i>${b.label} · ${b.min}–${hi}</span>`;
  }).join("");
}

/* Nút chuyển chế độ mạng lưới */
document.addEventListener("click", e => {
  const b = e.target.closest("#netMode .seg-btn");
  if (!b) return;
  netMode = b.dataset.mode;
  document.querySelectorAll("#netMode .seg-btn").forEach(x => x.classList.toggle("is-active", x === b));
  renderNetwork();
});
