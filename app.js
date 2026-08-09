/* ==========================================================================
   XPERISE — WORKSTREAM INTELLIGENCE v3  ·  app.js
   Lõi: cấu hình, công thức, trạng thái, bộ lọc, tóm tắt điều hành, CRUD.
   Không cần đăng nhập. Chạy thuần từ file:// (script cổ điển, không ES module).
   ========================================================================== */

/* ==========================================================================
   1. CẤU HÌNH
   Để trống 2 dòng dưới → app chạy bằng DỮ LIỆU MẪU để anh xem trước giao diện.
   Điền vào → app đọc/ghi thẳng bảng `projects` trên Supabase.
   ========================================================================== */
const SUPABASE_URL = "https://eovueumhcjxfptezqado.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdnVldW1oY2p4ZnB0ZXpxYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjI3MjEsImV4cCI6MjEwMTYzODcyMX0.KZ1ARr-sz-BkPaoiF_iDduvaNa_appDZUTSkKgLmB6w";

/* ==========================================================================
   2. THAM SỐ ĐIỀU CHỈNH ĐƯỢC
   Toàn bộ app đọc từ đây — sửa ở đây là mọi nơi đổi theo, kể cả bảng giải
   thích công thức ở tab "Dữ liệu & hệ thống". Không có số nào bị chôn cứng
   trong phần vẽ giao diện.
   ========================================================================== */

/* --- 2.1. Công thức chỉ số rủi ro WRI (0–100) --------------------------- */
const WRI = {
  // Thành phần 1 — áp lực lịch. Mỗi bậc là "còn ≤ N ngày thì cộng bao nhiêu".
  schedule: {
    label: "Áp lực lịch", max: 60,
    noDue: { label: "Không có hạn chốt", points: 12 },
    overdue: { label: "Đã quá hạn", points: 45 },
    ladder: [
      { days: 3,  label: "Còn ≤ 3 ngày",   points: 38 },
      { days: 7,  label: "Còn ≤ 7 ngày",   points: 30 },
      { days: 14, label: "Còn ≤ 14 ngày",  points: 20 },
      { days: 30, label: "Còn ≤ 30 ngày",  points: 10 }
    ],
    beyond: { label: "Còn hơn 30 ngày", points: 4 }
  },
  // Thành phần 2 — trọng số ưu tiên.
  priority: {
    label: "Trọng số ưu tiên", max: 25,
    points: { "High": 25, "Medium": 14, "Low": 6 }
  },
  // Thành phần 3 — độ ì trạng thái. Việc mở mãi không nhúc nhích thì rủi ro hơn.
  status: {
    label: "Độ ì trạng thái", max: 15,
    points: { "Open": 15, "In Progress": 8, "Done": 0 }
  },
  // Thành phần 4 — phạt thiếu dữ liệu. Không biết gì về một đầu mục cũng là rủi ro.
  data: {
    label: "Thiếu dữ liệu", max: 15,
    fields: [
      { key: "next_steps",     label: "Thiếu bước tiếp theo", points: 8 },
      { key: "timeline_start", label: "Thiếu ngày bắt đầu",   points: 4 },
      { key: "description",    label: "Thiếu mô tả",          points: 3 }
    ]
  },
  cap: 100
};

/* --- 2.2. Ngưỡng cảnh báo ----------------------------------------------- */
const BANDS = [
  { key: "critical", label: "Nguy cấp", min: 70, color: "#E11D48", soft: "#FDE7EC" },
  { key: "high",     label: "Cao",      min: 50, color: "#EA8C0B", soft: "#FDF0DC" },
  { key: "watch",    label: "Theo dõi", min: 30, color: "#A855F7", soft: "#F3E8FF" },
  { key: "stable",   label: "Ổn định",  min: 0,  color: "#0D9488", soft: "#D6F1EC" }
];

const THRESHOLDS = {
  dueSoonDays: 7,        // "đến hạn sắp tới" tính trong bao nhiêu ngày
  // Tập trung sở hữu đo bằng HHI so với đường cơ sở chia đều (1/số người).
  // Tỷ lệ 1.0 = đều nhất có thể; càng cao càng dồn vào ít người.
  hhiConcentrated: 1.35,
  hhiTight: 1.80,
  dataThin: 0.50         // dưới mức này coi là dữ liệu mỏng
};

/* --- 2.3. Suy luận luồng chiến lược từ tiêu đề -------------------------- */
const STREAM_RULES = [
  { name: "Sản phẩm & Nền tảng",  keys: ["product","platform","ai","merge","spendos","system","data","intelligence","app","api","nền tảng","sản phẩm","hệ thống"] },
  { name: "Đối tác & Phân phối",  keys: ["partner","partnership","survey","msb","bank","distribution","channel","đối tác","phân phối","khách hàng","hợp tác"] },
  { name: "Vốn & Nhà đầu tư",     keys: ["fund","raising","investor","capital","vifc","insignia","pilot","vốn","đầu tư","gọi vốn","cổ đông"] },
  { name: "Hiện diện & Vận hành", keys: ["office","event","market","sep","marina","operation","hiring","hiện diện","vận hành","văn phòng","sự kiện","tuyển"] }
];
const STREAM_FALLBACK = "Chưa phân luồng";

const STATUSES = ["Open", "In Progress", "Done"];
const STATUS_COLOR = { "Open": "#8A968F", "In Progress": "#A855F7", "Done": "#0D9488" };
const PRIORITIES = ["High", "Medium", "Low"];
const PRIORITY_COLOR = { "High": "#E11D48", "Medium": "#EA8C0B", "Low": "#8A968F" };
const AVATAR_COLORS = ["#7E22CE","#0D9488","#E11D48","#EA8C0B","#2563EB","#A855F7","#0F766E","#BE185D"];

const SQL_CONNECTED = `-- Xperise Workstream Intelligence v3 — connected layer
alter table public.projects
  add column if not exists stream     text,
  add column if not exists blocked_by uuid[] default '{}',
  add column if not exists progress   smallint;

-- live updates for every viewer
alter publication supabase_realtime add table public.projects;`;

/* ==========================================================================
   3. TRẠNG THÁI
   ========================================================================== */
const S = {
  sb: null,
  demo: false,          // true = đang chạy dữ liệu mẫu
  hasStream: false,     // cột stream đã tồn tại trên Supabase chưa
  hasBlockedBy: false,
  hasProgress: false,
  realtime: false,
  all: [],              // toàn bộ đầu mục (đã gắn _wri)
  view: [],             // sau khi lọc — nguồn duy nhất cho mọi tab
  links: [],            // liên kết phụ thuộc đã xác nhận trong phiên
  tab: "overview",
  modalId: null,
  filters: { q: "", pic: "ALL", status: "ALL", priority: "ALL", band: "ALL", from: "", to: "", flags: [] }
};

/* Bộ lọc nhanh — mỗi cái là một vị từ, dùng chung cho chip ở tóm tắt điều hành,
   chip trong thanh lọc và các thẻ KPI. Thêm một dòng ở đây là có thêm bộ lọc. */
const FLAGS = {
  overdue:   { label: "Trễ hạn",            test: p => p._wri.daysLeft !== null && p._wri.daysLeft < 0 && p.status !== "Done" },
  dueSoon:   { label: "Đến hạn ≤ 7 ngày",   test: p => p._wri.daysLeft !== null && p._wri.daysLeft >= 0 && p._wri.daysLeft <= THRESHOLDS.dueSoonDays && p.status !== "Done" },
  critical:  { label: "Nguy cấp",           test: p => p._wri.band.key === "critical" },
  highPrio:  { label: "Ưu tiên cao",        test: p => p.priority === "High" },
  noStart:   { label: "Chưa có ngày bắt đầu", test: p => !p.timeline_start },
  noNext:    { label: "Thiếu bước tiếp theo", test: p => !p.next_steps }
};

/* ==========================================================================
   4. TIỆN ÍCH
   ========================================================================== */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function toDate(d) {
  if (!d) return null;
  const p = String(d).slice(0,10).split("-");
  if (p.length !== 3) return null;
  const dt = new Date(+p[0], +p[1]-1, +p[2]);
  return isNaN(dt) ? null : dt;
}
function today0() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function fmtDate(d) { const x = toDate(d); return x ? String(x.getDate()).padStart(2,"0")+"/"+String(x.getMonth()+1).padStart(2,"0")+"/"+x.getFullYear() : ""; }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }
function initials(n) {
  const w = String(n||"?").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  return w.length === 1 ? w[0].slice(0,2).toUpperCase() : (w[0][0]+w[w.length-1][0]).toUpperCase();
}
function colorFor(name) {
  let h = 0; for (const c of String(name||"")) h = (h*31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
/** Một đầu mục có thể có nhiều người phụ trách, ngăn bằng dấu phẩy. */
function picsOf(p) { return String(p.pic||"").split(",").map(s => s.trim()).filter(Boolean); }
function avatar(name, cls) {
  return `<span class="avatar ${cls||""}" style="background:${colorFor(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;
}
function bandOf(score) { return BANDS.find(b => score >= b.min) || BANDS[BANDS.length-1]; }
function el(id) { return document.getElementById(id); }

function toast(msg, kind) {
  const t = document.createElement("div");
  t.className = "toast-note " + (kind||"");
  const ic = kind === "err" ? "bi-exclamation-circle" : kind === "ok" ? "bi-check-circle" : "bi-info-circle";
  t.innerHTML = `<i class="bi ${ic}"></i><span>${esc(msg)}</span>`;
  el("toastTray").appendChild(t);
  setTimeout(() => t.remove(), 3600);
}

/* ==========================================================================
   5. BỘ MÁY TÍNH WRI
   Trả về đủ cả điểm thành phần và LÝ DO — để giao diện giải thích được vì sao
   một đầu mục bị chấm cao, thay vì bắt người dùng tin một con số.
   ========================================================================== */
function computeWRI(p) {
  const end = toDate(p.timeline_end);
  const daysLeft = end ? daysBetween(today0(), end) : null;
  const done = p.status === "Done";

  // Đầu mục đã xong thì rủi ro bằng 0, bất kể các thành phần khác.
  if (done) {
    return { score: 0, daysLeft, band: bandOf(0), reason: "Đã hoàn thành",
             parts: { schedule: 0, priority: 0, status: 0, data: 0 }, missing: missingFields(p) };
  }

  /* Thành phần 1 — áp lực lịch */
  let schedule, why;
  if (daysLeft === null) {
    schedule = WRI.schedule.noDue.points; why = "chưa có hạn chốt";
  } else if (daysLeft < 0) {
    schedule = WRI.schedule.overdue.points; why = `trễ ${Math.abs(daysLeft)} ngày`;
  } else {
    const step = WRI.schedule.ladder.find(s => daysLeft <= s.days);
    schedule = step ? step.points : WRI.schedule.beyond.points;
    why = daysLeft === 0 ? "đến hạn hôm nay" : `còn ${daysLeft} ngày`;
  }

  /* Thành phần 2 & 3 */
  const priority = WRI.priority.points[p.priority] || 0;
  const status   = WRI.status.points[p.status] || 0;

  /* Thành phần 4 — phạt thiếu dữ liệu */
  const missing = missingFields(p);
  let data = 0;
  WRI.data.fields.forEach(f => { if (missing.includes(f.key)) data += f.points; });
  data = Math.min(data, WRI.data.max);

  const score = Math.min(WRI.cap, schedule + priority + status + data);

  return {
    score, daysLeft, band: bandOf(score), reason: why,
    parts: { schedule, priority, status, data },
    missing
  };
}

function missingFields(p) {
  return WRI.data.fields.filter(f => !p[f.key] || !String(p[f.key]).trim()).map(f => f.key);
}

/** Tách chuỗi thành các từ nguyên vẹn, có xử lý dấu tiếng Việt. */
function wordBag(s) {
  return " " + String(s||"").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(" ") + " ";
}

/** Suy ra luồng chiến lược: ưu tiên giá trị đã lưu, nếu không thì đoán từ tiêu đề.
    So khớp theo TỪ NGUYÊN VẸN — nếu không, "app" sẽ khớp nhầm vào "Apply". */
function streamOf(p) {
  if (p.stream && String(p.stream).trim()) return { name: p.stream, inferred: false };
  const bag = wordBag(String(p.title||"") + " " + String(p.description||""));
  let best = null, bestScore = 0;
  STREAM_RULES.forEach(rule => {
    const hits = rule.keys.filter(k => bag.includes(" " + k + " ")).length;
    if (hits > bestScore) { bestScore = hits; best = rule.name; }
  });
  return { name: best || STREAM_FALLBACK, inferred: !!best };
}

/** Gắn kết quả tính toán vào từng bản ghi — làm một lần sau mỗi lần tải dữ liệu. */
function enrich(rows) {
  return rows.map(p => {
    const c = Object.assign({}, p);
    c._wri = computeWRI(c);
    c._stream = streamOf(c);
    return c;
  });
}

/* ==========================================================================
   6. TỔNG HỢP TOÀN DANH MỤC
   Mọi con số trong tóm tắt điều hành đều lấy từ hàm này.
   ========================================================================== */
function digest(items) {
  const active = items.filter(p => p.status !== "Done");
  const d = {
    total: items.length,
    active: active.length,
    done: items.filter(p => p.status === "Done").length,
    counts: {}
  };

  Object.keys(FLAGS).forEach(k => { d.counts[k] = items.filter(FLAGS[k].test).length; });

  // Chỉ số rủi ro danh mục = trung bình WRI của các đầu mục đang chạy.
  d.portfolioWRI = active.length
    ? Math.round(active.reduce((s,p) => s + p._wri.score, 0) / active.length) : 0;
  d.portfolioBand = bandOf(d.portfolioWRI);

  // Tải theo người phụ trách: một đầu mục có 2 PIC thì mỗi người gánh 0.5.
  const load = {};
  active.forEach(p => {
    const list = picsOf(p);
    if (!list.length) { load["Chưa gán"] = (load["Chưa gán"]||0) + 1; return; }
    list.forEach(n => { load[n] = (load[n]||0) + 1/list.length; });
  });
  d.load = Object.entries(load).map(([name, w]) => ({ name, weight: w })).sort((a,b) => b.weight - a.weight);
  const totalW = d.load.reduce((s,x) => s + x.weight, 0) || 1;
  d.load.forEach(x => { x.share = x.weight / totalW; });

  // HHI — tổng bình phương thị phần. So với đường cơ sở chia đều (1/N) mới có
  // nghĩa: hai người chia đôi luôn cho HHI 0.50, đó là đều nhất chứ không phải
  // tập trung. Vì vậy mọi kết luận đọc từ tỷ lệ hhiRatio, không từ HHI thô.
  d.hhi = d.load.reduce((s,x) => s + x.share*x.share, 0);
  d.owners = d.load.length;
  d.hhiBase = d.owners ? 1 / d.owners : 1;
  d.hhiRatio = d.owners ? d.hhi / d.hhiBase : 1;
  d.topOwner = d.load[0] || null;
  d.concentration = d.owners <= 1 ? "dồn hết vào một người"
                  : d.hhiRatio >= THRESHOLDS.hhiTight ? "rất tập trung"
                  : d.hhiRatio >= THRESHOLDS.hhiConcentrated ? "khá tập trung" : "phân bổ đều";
  d.tooConcentrated = d.owners <= 1 || d.hhiRatio >= THRESHOLDS.hhiConcentrated;

  // Độ đầy đủ dữ liệu: đếm trên các trường tùy chọn.
  const fields = [
    { key: "timeline_end",   label: "Hạn chốt" },
    { key: "timeline_start", label: "Ngày bắt đầu" },
    { key: "next_steps",     label: "Bước tiếp theo" },
    { key: "description",    label: "Mô tả" }
  ];
  d.quality = fields.map(f => {
    const filled = items.filter(p => p[f.key] && String(p[f.key]).trim());
    return { key: f.key, label: f.label, filled: filled.length, total: items.length,
             pct: pct(filled.length, items.length),
             missingItems: items.filter(p => !p[f.key] || !String(p[f.key]).trim()) };
  });
  const cellsFilled = d.quality.reduce((s,q) => s + q.filled, 0);
  const cellsTotal  = fields.length * items.length;
  d.completeness = pct(cellsFilled, cellsTotal);
  d.cellsFilled = cellsFilled; d.cellsTotal = cellsTotal;

  return d;
}

/* ==========================================================================
   7. TÓM TẮT ĐIỀU HÀNH — sinh câu theo dữ liệu, không có câu chữ cố định
   Mỗi mệnh đề chỉ xuất hiện khi có gì đáng nói. Danh mục sạch sẽ đọc ra một
   câu hoàn toàn khác với danh mục đang cháy.
   ========================================================================== */
function execSentence(d) {
  if (!d.total) {
    return "Chưa có đầu mục nào trong danh mục. Thêm việc đầu tiên để hệ thống bắt đầu chấm rủi ro và dựng liên kết.";
  }
  if (!d.active) {
    return `Toàn bộ <b>${d.total}</b> đầu mục đã ở trạng thái Done. Không còn rủi ro tiến độ nào đang mở.`;
  }

  const parts = [];

  // Mệnh đề 1 — mức rủi ro tổng.
  parts.push(`Danh mục đang ở mức <em>${d.portfolioBand.label.toLowerCase()}</em> — chỉ số rủi ro <b>${d.portfolioWRI}/100</b> trên ${d.active} đầu mục đang chạy.`);

  // Mệnh đề 2 — các con số báo động, chỉ nêu cái nào khác 0.
  const alarms = [];
  if (d.counts.overdue)  alarms.push(`${d.counts.overdue} đã trễ hạn`);
  if (d.counts.dueSoon)  alarms.push(`${d.counts.dueSoon} đến hạn trong ${THRESHOLDS.dueSoonDays} ngày tới`);
  if (d.counts.critical) alarms.push(`${d.counts.critical} ở ngưỡng nguy cấp`);
  if (alarms.length) parts.push(capFirst(alarms.join(", ")) + ".");
  else parts.push("Không có đầu mục nào trễ hạn hay ở ngưỡng nguy cấp.");

  // Mệnh đề 3 — tập trung sở hữu, chỉ nêu khi đáng lo.
  if (d.topOwner && d.tooConcentrated) {
    parts.push(`Khối lượng <em>${d.concentration}</em>: ${esc(d.topOwner.name)} giữ <b>${Math.round(d.topOwner.share*100)}%</b> (HHI ${d.hhi.toFixed(2)}).`);
  } else if (d.owners > 1) {
    parts.push(`Khối lượng phân bổ tương đối đều giữa ${d.owners} người (HHI ${d.hhi.toFixed(2)}, mức chia đều là ${d.hhiBase.toFixed(2)}).`);
  }

  // Mệnh đề 4 — chất lượng dữ liệu và hệ quả của nó lên độ tin cậy của chỉ số.
  if (d.completeness < THRESHOLDS.dataThin * 100) {
    const noNext = d.counts.noNext;
    parts.push(`Chỉ <b>${d.completeness}%</b> trường dữ liệu tùy chọn được điền${noNext ? ` — ${noNext} đầu mục chưa ghi bước tiếp theo` : ""}, nên rủi ro thật có thể cao hơn con số hiển thị.`);
  } else {
    parts.push(`Dữ liệu đã điền <b>${d.completeness}%</b>, đủ để chỉ số phản ánh sát tình hình.`);
  }

  return parts.join(" ");
}
function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ==========================================================================
   8. LỌC
   ========================================================================== */
function applyFilters() {
  const f = S.filters;
  const from = toDate(f.from), to = toDate(f.to);
  const q = f.q.trim().toLowerCase();

  S.view = S.all.filter(p => {
    if (q) {
      const hay = [p.title, p.pic, p.next_steps, p.description, p._stream.name].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.pic !== "ALL" && !picsOf(p).includes(f.pic)) return false;
    if (f.status !== "ALL" && p.status !== f.status) return false;
    if (f.priority !== "ALL" && p.priority !== f.priority) return false;
    if (f.band !== "ALL" && p._wri.band.key !== f.band) return false;

    // Khoảng ngày: giữ đầu mục có thời gian GIAO NHAU với khoảng đã chọn.
    if (from || to) {
      const s = toDate(p.timeline_start), e = toDate(p.timeline_end);
      const start = s || e, end = e || s;
      if (!start) return false;
      if (from && end < from) return false;
      if (to && start > to) return false;
    }

    // Các cờ nhanh cộng dồn theo kiểu VÀ.
    for (const k of f.flags) { if (!FLAGS[k].test(p)) return false; }
    return true;
  });

  renderAll();
}

function setFilter(key, value) { S.filters[key] = value; syncFilterInputs(); applyFilters(); }

function toggleFlag(key) {
  const i = S.filters.flags.indexOf(key);
  if (i >= 0) S.filters.flags.splice(i, 1); else S.filters.flags.push(key);
  applyFilters();
}

function clearFilters() {
  S.filters = { q: "", pic: "ALL", status: "ALL", priority: "ALL", band: "ALL", from: "", to: "", flags: [] };
  syncFilterInputs();
  applyFilters();
  toast("Đã xóa bộ lọc", "ok");
}

function syncFilterInputs() {
  el("globalSearch").value = S.filters.q;
  el("fPic").value = S.filters.pic;
  el("fStatus").value = S.filters.status;
  el("fPriority").value = S.filters.priority;
  el("fBand").value = S.filters.band;
  el("fFrom").value = S.filters.from;
  el("fTo").value = S.filters.to;
}

function isFiltering() {
  const f = S.filters;
  return !!(f.q || f.flags.length || f.from || f.to ||
            f.pic !== "ALL" || f.status !== "ALL" || f.priority !== "ALL" || f.band !== "ALL");
}

/** Mở một đầu mục từ bất kỳ view nào — đây là sợi dây nối mọi màn hình. */
function focusItem(id) { openModal(id); }

/* ==========================================================================
   9. TẢI DỮ LIỆU
   ========================================================================== */
async function loadData() {
  if (S.demo) { S.all = enrich(DEMO_ROWS); afterLoad(); return; }

  const { data, error } = await S.sb.from("projects").select("*");
  if (error) { toast("Không đọc được dữ liệu: " + error.message, "err"); return; }

  const rows = data || [];
  // Phát hiện các cột mở rộng có sẵn hay chưa, để bật/tắt tính năng tương ứng.
  if (rows.length) {
    S.hasStream    = Object.prototype.hasOwnProperty.call(rows[0], "stream");
    S.hasBlockedBy = Object.prototype.hasOwnProperty.call(rows[0], "blocked_by");
    S.hasProgress  = Object.prototype.hasOwnProperty.call(rows[0], "progress");
  }
  S.all = enrich(rows);

  // Nạp các liên kết phụ thuộc đã lưu (nếu cột blocked_by tồn tại).
  if (S.hasBlockedBy) {
    S.links = [];
    S.all.forEach(p => (p.blocked_by || []).forEach(src => S.links.push({ from: src, to: p.id, saved: true })));
  }
  afterLoad();
}

function afterLoad() {
  S.all.sort((a,b) => b._wri.score - a._wri.score);
  fillPicSelect();
  applyFilters();
}

function fillPicSelect() {
  const names = [...new Set(S.all.flatMap(picsOf))].sort((a,b) => a.localeCompare(b, "vi"));
  const sel = el("fPic"), cur = S.filters.pic;
  sel.innerHTML = '<option value="ALL">Tất cả</option>' + names.map(n => `<option>${esc(n)}</option>`).join("");
  sel.value = names.includes(cur) ? cur : "ALL";
  if (!names.includes(cur)) S.filters.pic = "ALL";
  el("picList").innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join("");
}

/* ==========================================================================
   10. GHI DỮ LIỆU
   ========================================================================== */
function openModal(id) {
  S.modalId = id || null;
  const p = id ? S.all.find(x => String(x.id) === String(id)) : null;

  el("modalTitle").textContent = p ? "Sửa đầu mục" : "Đầu mục mới";
  el("modalSub").textContent = p ? `Chỉ số rủi ro hiện tại ${p._wri.score}/100 · ${p._wri.band.label}` : "Trạng thái mặc định là Open";
  el("modalError").classList.add("d-none");
  el("btnDelete").style.display = p ? "" : "none";

  el("mTitle").value    = p ? (p.title || "") : "";
  el("mDesc").value     = p ? (p.description || "") : "";
  el("mStart").value    = p && p.timeline_start ? String(p.timeline_start).slice(0,10) : "";
  el("mEnd").value      = p && p.timeline_end ? String(p.timeline_end).slice(0,10) : "";
  el("mPic").value      = p ? (p.pic || "") : "";
  el("mPriority").value = p ? (p.priority || "Medium") : "Medium";
  el("mStatus").value   = p ? (p.status || "Open") : "Open";
  el("mNext").value     = p ? (p.next_steps || "") : "";

  // Ô luồng chiến lược chỉ ghi được khi cột `stream` đã tồn tại.
  const names = [...new Set(S.all.map(x => x._stream.name).concat(STREAM_RULES.map(r => r.name)))];
  el("mStream").innerHTML = '<option value="">— để hệ thống tự suy ra —</option>' +
    names.map(n => `<option>${esc(n)}</option>`).join("");
  el("mStream").value = p && p.stream ? p.stream : "";
  el("mStream").disabled = !S.hasStream;
  el("streamHint").textContent = S.hasStream
    ? "Để trống thì luồng được suy ra từ khoá trong tiêu đề."
    : "Chưa có cột `stream` trên Supabase — luồng đang được suy ra tạm từ tiêu đề. Chạy SQL ở tab Dữ liệu & hệ thống để bật.";

  renderWriPreview();
  new bootstrap.Modal(el("itemModal")).show();
}

/** Xem trước điểm rủi ro ngay khi đang gõ — người nhập thấy hệ quả của mình. */
function renderWriPreview() {
  const draft = readForm();
  const w = computeWRI(draft);
  const parts = [
    { k: "schedule", c: "#E11D48" }, { k: "priority", c: "#EA8C0B" },
    { k: "status",   c: "#A855F7" }, { k: "data",     c: "#8A968F" }
  ];
  const total = Math.max(w.score, 1);

  el("wriPreview").innerHTML = `
    <div class="wp-head">
      <span class="lbl" style="margin:0">Chỉ số rủi ro dự kiến</span>
      <span class="wp-score" style="color:${w.band.color}">${w.score}<small style="font-size:12px;color:var(--ink-3)">/100 · ${w.band.label}</small></span>
    </div>
    <div class="wp-parts">
      ${parts.map(x => `<i style="width:${w.parts[x.k]/total*100}%;background:${x.c}"></i>`).join("")}
    </div>
    <div class="wp-legend">
      ${parts.map(x => `<span><i style="background:${x.c}"></i>${WRI[x.k].label} ${w.parts[x.k]}</span>`).join("")}
    </div>`;
}

function readForm() {
  return {
    title: el("mTitle").value.trim(),
    description: el("mDesc").value.trim() || null,
    timeline_start: el("mStart").value || null,
    timeline_end: el("mEnd").value || null,
    pic: el("mPic").value.trim(),
    priority: el("mPriority").value,
    status: el("mStatus").value,
    next_steps: el("mNext").value.trim() || null
  };
}

async function saveItem(e) {
  e.preventDefault();
  const err = el("modalError");
  err.classList.add("d-none");

  const payload = readForm();
  if (payload.timeline_start && payload.timeline_end && payload.timeline_end < payload.timeline_start) {
    err.textContent = "Hạn chốt đang sớm hơn ngày bắt đầu. Chỉnh lại giúp mình nhé.";
    err.classList.remove("d-none");
    return;
  }
  if (S.hasStream) payload.stream = el("mStream").value || null;

  if (S.demo) {
    if (S.modalId) Object.assign(S.all.find(x => String(x.id) === String(S.modalId)), payload);
    else S.all.push(Object.assign({ id: "demo-" + Date.now() }, payload));
    S.all = enrich(S.all);
    bootstrap.Modal.getInstance(el("itemModal")).hide();
    toast("Đã lưu (dữ liệu mẫu, không ghi lên Supabase)", "ok");
    afterLoad();
    return;
  }

  const q = S.modalId
    ? S.sb.from("projects").update(payload).eq("id", S.modalId)
    : S.sb.from("projects").insert([payload]);
  const { error } = await q;

  if (error) { err.textContent = "Lưu không thành công: " + error.message; err.classList.remove("d-none"); return; }
  bootstrap.Modal.getInstance(el("itemModal")).hide();
  toast(S.modalId ? "Đã cập nhật đầu mục" : "Đã thêm đầu mục", "ok");
  await loadData();
}

async function deleteItem() {
  const p = S.all.find(x => String(x.id) === String(S.modalId));
  if (!p || !confirm(`Xóa "${p.title}"? Thao tác này không hoàn tác được.`)) return;

  if (S.demo) {
    S.all = S.all.filter(x => String(x.id) !== String(S.modalId));
  } else {
    const { error } = await S.sb.from("projects").delete().eq("id", S.modalId);
    if (error) { toast("Xóa không thành công: " + error.message, "err"); return; }
  }
  bootstrap.Modal.getInstance(el("itemModal")).hide();
  toast("Đã xóa đầu mục", "ok");
  S.demo ? afterLoad() : await loadData();
}

/** Kéo thả trên bảng điều hành gọi thẳng vào đây. */
async function updateStatus(id, status) {
  const p = S.all.find(x => String(x.id) === String(id));
  if (!p || p.status === status) return;

  p.status = status;
  p._wri = computeWRI(p);                 // chấm lại rủi ro ngay, không đợi tải lại

  if (!S.demo) {
    const { error } = await S.sb.from("projects").update({ status }).eq("id", id);
    if (error) { toast("Không lưu được trạng thái: " + error.message, "err"); await loadData(); return; }
  }
  toast(`"${p.title.slice(0,32)}…" → ${status}`, "ok");
  applyFilters();
}

/* ==========================================================================
   11. XUẤT CSV
   ========================================================================== */
function exportCsv() {
  const cols = ["title","pic","stream","timeline_start","timeline_end","priority","status","next_steps","description","wri","band"];
  const head = ["Đầu mục","Phụ trách","Luồng","Ngày bắt đầu","Hạn chốt","Ưu tiên","Trạng thái","Bước tiếp theo","Mô tả","WRI","Mức rủi ro"];
  const cell = v => `"${String(v === null || v === undefined ? "" : v).replace(/"/g,'""')}"`;

  const lines = [head.map(cell).join(",")];
  S.view.forEach(p => {
    lines.push(cols.map(c => cell(
      c === "wri" ? p._wri.score : c === "band" ? p._wri.band.label :
      c === "stream" ? p._stream.name : p[c]
    )).join(","));
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `xperise-workstream-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Đã xuất ${S.view.length} đầu mục`, "ok");
}

/* ==========================================================================
   12. KHỞI ĐỘNG
   ========================================================================== */
async function boot() {
  bindEvents();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    S.demo = true;
    el("modeNotice").classList.remove("d-none");
    el("modeNotice").innerHTML =
      'Đang chạy <strong>dữ liệu mẫu</strong> để anh xem trước. Điền <code>SUPABASE_URL</code> và <code>SUPABASE_ANON_KEY</code> ở đầu file <code>app.js</code> để nối vào dữ liệu thật — mọi thao tác thêm/sửa/kéo thả sẽ ghi thẳng lên Supabase.';
  } else {
    S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  await loadData();
  subscribeRealtime();
}

/** Cập nhật tức thời khi người khác sửa dữ liệu — chỉ chạy nếu đã bật realtime. */
function subscribeRealtime() {
  if (S.demo || !S.sb) return;
  try {
    S.sb.channel("projects-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => loadData())
      .subscribe(status => { if (status === "SUBSCRIBED") { S.realtime = true; renderSystem(); } });
  } catch (e) { /* chưa bật realtime thì bỏ qua, app vẫn chạy bình thường */ }
}

function bindEvents() {
  el("btnNew").addEventListener("click", () => openModal(null));
  el("btnRefresh").addEventListener("click", async () => { await loadData(); toast("Đã tải lại", "ok"); });
  el("btnClear").addEventListener("click", clearFilters);
  el("btnCsv").addEventListener("click", exportCsv);
  el("btnPrint").addEventListener("click", () => window.print());
  el("itemForm").addEventListener("submit", saveItem);
  el("btnDelete").addEventListener("click", deleteItem);
  el("btnCopySql").addEventListener("click", () => {
    navigator.clipboard.writeText(SQL_CONNECTED).then(
      () => toast("Đã sao chép SQL", "ok"),
      () => toast("Trình duyệt chặn clipboard — bôi đen rồi copy tay nhé", "err"));
  });

  // Xem trước WRI cập nhật theo từng thao tác trong form.
  ["mEnd","mStart","mPriority","mStatus","mNext","mDesc"].forEach(id =>
    el(id).addEventListener("input", renderWriPreview));

  // Bộ lọc
  el("fPic").addEventListener("change", e => setFilter("pic", e.target.value));
  el("fStatus").addEventListener("change", e => setFilter("status", e.target.value));
  el("fPriority").addEventListener("change", e => setFilter("priority", e.target.value));
  el("fBand").addEventListener("change", e => setFilter("band", e.target.value));
  el("fFrom").addEventListener("change", e => setFilter("from", e.target.value));
  el("fTo").addEventListener("change", e => setFilter("to", e.target.value));

  let t;
  el("globalSearch").addEventListener("input", e => {
    clearTimeout(t);
    t = setTimeout(() => { S.filters.q = e.target.value; applyFilters(); }, 180);
  });

  // Tab
  el("tabs").addEventListener("click", e => {
    const b = e.target.closest(".tab[data-view]");
    if (b) switchTab(b.dataset.view);
  });

  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); el("globalSearch").focus(); }
  });

  // Mức rủi ro trong bộ lọc dựng từ BANDS, không gõ tay trong HTML.
  el("fBand").innerHTML = '<option value="ALL">Tất cả</option>' +
    BANDS.map(b => `<option value="${b.key}">${b.label} · ${b.min}+</option>`).join("");
}

function switchTab(view) {
  S.tab = view;
  document.querySelectorAll(".tab[data-view]").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + view));
  renderAll();   // vẽ lại tab vừa mở với đúng bộ lọc đang áp
}

/* ==========================================================================
   13. DỮ LIỆU MẪU — chỉ dùng khi chưa điền khóa Supabase
   ========================================================================== */
const DEMO_ROWS = [
  { id:"d1", title:"Merge xperise AI to xperise.com", description:null, timeline_start:null, timeline_end:"2026-08-09", pic:"Tai Vo", priority:"High", status:"In Progress", next_steps:null },
  { id:"d2", title:"MSB SpendOS Survey", description:"Handover online link to MSB", timeline_start:null, timeline_end:"2026-08-07", pic:"Khai Vo", priority:"High", status:"In Progress", next_steps:"Done survey for 300-500 companies - 1 week" },
  { id:"d3", title:"SpendOS + Bank product final version", description:"Finalize after analyzing survey data", timeline_start:null, timeline_end:"2026-08-20", pic:"Heilyn Nguyen", priority:"High", status:"In Progress", next_steps:null },
  { id:"d4", title:"Partnership Agreement: Xperise + MSB", description:null, timeline_start:null, timeline_end:"2026-08-25", pic:"Duong Ho, Khai Vo", priority:"High", status:"In Progress", next_steps:null },
  { id:"d5", title:"Pilot model US market - Enterprise Spend Intelligence Brain - CC capital: Insignia", description:null, timeline_start:"2026-08-20", timeline_end:"2026-08-20", pic:"Duong Ho", priority:"Medium", status:"In Progress", next_steps:null },
  { id:"d6", title:"Sep US Event", description:null, timeline_start:null, timeline_end:"2026-09-01", pic:"Duong Ho, Hung Vo", priority:"Medium", status:"In Progress", next_steps:null },
  { id:"d7", title:"Marina IFC Office", description:null, timeline_start:null, timeline_end:"2026-08-24", pic:"Duong Ho", priority:"Medium", status:"In Progress", next_steps:null },
  { id:"d8", title:"Fund Small Additional Raising", description:null, timeline_start:"2026-08-01", timeline_end:"2026-08-30", pic:"Duong Ho", priority:"Medium", status:"In Progress", next_steps:null },
  { id:"d9", title:"Apply VIFC Member", description:null, timeline_start:null, timeline_end:null, pic:"Duong Ho", priority:"Medium", status:"In Progress", next_steps:null },
  { id:"d10", title:"Assess initial xperise intelligence on current data system", description:null, timeline_start:null, timeline_end:null, pic:"Duong Ho, Hung Vo", priority:"Medium", status:"In Progress", next_steps:null }
];