/* ==========================================================================
   BẢNG ĐIỀU KHIỂN DỰ ÁN — app.js
   Kiến trúc: 100% client-side, script cổ điển (không dùng ES module import)
   nên mở thẳng index.html bằng trình duyệt là chạy được, không lỗi CORS.
   ========================================================================== */

/* ==========================================================================
   1. CẤU HÌNH — ĐIỀN 2 GIÁ TRỊ NÀY TRƯỚC KHI CHẠY
   Lấy tại: Supabase Dashboard → Project Settings → API
   ========================================================================== */
const SUPABASE_URL = "https://eovueumhcjxfptezqado.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdnVldW1oY2p4ZnB0ZXpxYWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwNjI3MjEsImV4cCI6MjEwMTYzODcyMX0.KZ1ARr-sz-BkPaoiF_iDduvaNa_appDZUTSkKgLmB6w";
/* ==========================================================================
   2. HẰNG SỐ & TRẠNG THÁI TOÀN CỤC
   ========================================================================== */
const STATUS_LIST = ["Open", "In Progress", "Done"];

// Màu dùng chung cho biểu đồ (khớp với chip trong bảng)
const STATUS_COLOR = {
  "Open":        "#64748B",
  "In Progress": "#C98416",
  "Done":        "#17876B"
};
const BRAND = "#0E6F6C";

// Thứ hạng dùng để sắp xếp cột (DataTables sort theo số, không theo chữ cái)
const PRIORITY_RANK = { "High": 1, "Medium": 2, "Low": 3 };
const STATUS_RANK   = { "Open": 1, "In Progress": 2, "Done": 3 };

let sb = null;              // Supabase client
let allProjects = [];       // toàn bộ dữ liệu tải từ Supabase
let filteredProjects = [];  // dữ liệu sau khi qua bộ lọc — nguồn duy nhất cho Chart + Table
let statusChart = null;     // instance Chart.js (doughnut)
let picChart = null;        // instance Chart.js (bar)
let dataTable = null;       // instance DataTables
let projectModal = null;    // instance Bootstrap Modal
let editingId = null;       // null = đang thêm mới, có giá trị = đang sửa
let dashboardLoaded = false;

/* ==========================================================================
   3. TIỆN ÍCH DÙNG CHUNG
   ========================================================================== */

/** Chống XSS: mọi dữ liệu người dùng nhập đều đi qua hàm này trước khi render HTML. */
function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** "2026-03-14" -> "14/03/2026" */
function fmtDate(d) {
  if (!d) return "";
  const parts = String(d).slice(0, 10).split("-");
  if (parts.length !== 3) return String(d);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Chuỗi ngày -> Date lúc 00:00 giờ địa phương (tránh lệch múi giờ khi so sánh). */
function toDate(d) {
  if (!d) return null;
  const p = String(d).slice(0, 10).split("-");
  if (p.length !== 3) return null;
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function today0() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** "Phuong Van" -> "PV" */
function initials(name) {
  const w = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}

/** Dự án quá hạn = có ngày kết thúc đã trôi qua nhưng chưa Done. */
function isLate(p) {
  const end = toDate(p.timeline_end);
  return !!end && p.status !== "Done" && end < today0();
}

function toast(message, type) {
  const tray = document.getElementById("toastTray");
  const el = document.createElement("div");
  el.className = "toast-note " + (type || "");
  const icon = type === "err" ? "bi-exclamation-circle" : type === "ok" ? "bi-check-circle" : "bi-info-circle";
  el.innerHTML = `<i class="bi ${icon}"></i><span>${esc(message)}</span>`;
  tray.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function setLoading(btnId, spinnerId, loading) {
  const btn = document.getElementById(btnId);
  const sp = document.getElementById(spinnerId);
  const label = btn.querySelector(".btn-label");
  btn.disabled = loading;
  sp.classList.toggle("d-none", !loading);
  if (label) label.classList.toggle("d-none", loading);
}

/* ==========================================================================
   4. KHỞI ĐỘNG
   ========================================================================== */
document.addEventListener("DOMContentLoaded", function () {
  projectModal = new bootstrap.Modal(document.getElementById("projectModal"));
  bindEvents();

  // Chưa điền khóa → dừng lại và báo ngay trên màn hình đăng nhập.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    document.getElementById("configWarning").classList.remove("d-none");
    document.getElementById("loginBtn").disabled = true;
    return;
  }

  // `window.supabase` là namespace của bản UMD; createClient trả về client thật.
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  initAuth();
});

/* ==========================================================================
   5. PHẦN A — XÁC THỰC (Supabase Auth)
   ========================================================================== */
async function initAuth() {
  // Khôi phục phiên đã lưu trong localStorage (nếu có) để không phải đăng nhập lại.
  const { data } = await sb.auth.getSession();
  if (data && data.session) {
    enterDashboard(data.session.user);
  } else {
    showAuthScreen();
  }

  // Theo dõi thay đổi phiên (đăng nhập / đăng xuất / token hết hạn).
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "SIGNED_IN" && session) enterDashboard(session.user);
    if (event === "SIGNED_OUT") showAuthScreen();
  });
}

function showAuthScreen() {
  document.getElementById("authScreen").classList.remove("d-none");
  document.getElementById("appScreen").classList.add("d-none");
  dashboardLoaded = false;
}

async function enterDashboard(user) {
  document.getElementById("authScreen").classList.add("d-none");
  document.getElementById("appScreen").classList.remove("d-none");
  document.getElementById("userEmail").textContent = user && user.email ? user.email : "Đã đăng nhập";

  if (dashboardLoaded) return;   // tránh khởi tạo lại khi onAuthStateChange bắn thêm lần nữa
  dashboardLoaded = true;

  initTable();     // dựng khung DataTables (rỗng)
  initCharts();    // dựng khung Chart.js (rỗng) + gắn sự kiện click
  await loadProjects();
}

async function handleLogin(e) {
  e.preventDefault();
  const errBox = document.getElementById("loginError");
  errBox.classList.add("d-none");
  setLoading("loginBtn", "loginSpinner", true);

  const { error } = await sb.auth.signInWithPassword({
    email: document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginPassword").value
  });

  setLoading("loginBtn", "loginSpinner", false);

  if (error) {
    errBox.textContent = error.message === "Invalid login credentials"
      ? "Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử lần nữa."
      : error.message;
    errBox.classList.remove("d-none");
    return;
  }
  document.getElementById("loginForm").reset();
}

async function handleLogout() {
  await sb.auth.signOut();
  allProjects = [];
  filteredProjects = [];
  showAuthScreen();
}

/* ==========================================================================
   6. ĐỌC DỮ LIỆU (READ)
   ========================================================================== */
async function loadProjects() {
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .order("timeline_start", { ascending: true, nullsFirst: false });

  if (error) {
    toast("Không tải được dữ liệu: " + error.message, "err");
    return;
  }

  allProjects = data || [];
  populatePicOptions();   // dropdown PIC luôn dựng từ TOÀN BỘ dữ liệu, không phải dữ liệu đã lọc
  applyFilters();         // -> tính KPI, vẽ chart, đổ bảng
}

/** Đổ danh sách PIC duy nhất vào dropdown lọc và datalist gợi ý trong form. */
function populatePicOptions() {
  const pics = [...new Set(allProjects.map(p => p.pic).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));

  const sel = document.getElementById("filterPic");
  const current = sel.value;
  sel.innerHTML = '<option value="ALL">Tất cả</option>' +
    pics.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  // Giữ nguyên lựa chọn cũ nếu vẫn còn tồn tại
  sel.value = pics.includes(current) ? current : "ALL";

  document.getElementById("picSuggestions").innerHTML =
    pics.map(p => `<option value="${esc(p)}"></option>`).join("");
}

/* ==========================================================================
   7. KHU VỰC 1 — BỘ LỌC TỔNG
   Mọi thay đổi bộ lọc đều chạy qua applyFilters(), và applyFilters() là nơi
   DUY NHẤT cập nhật KPI + Biểu đồ + Bảng. Nhờ vậy 3 khu vực luôn đồng bộ.
   ========================================================================== */
function applyFilters() {
  const pic    = document.getElementById("filterPic").value;
  const status = document.getElementById("filterStatus").value;
  const from   = toDate(document.getElementById("filterFrom").value);
  const to     = toDate(document.getElementById("filterTo").value);

  filteredProjects = allProjects.filter(function (p) {
    if (pic !== "ALL" && p.pic !== pic) return false;
    if (status !== "ALL" && p.status !== status) return false;

    // Lọc timeline theo nguyên tắc GIAO NHAU: giữ lại dự án có khoảng thời gian
    // chồng lấn với khoảng người dùng chọn (không đòi hỏi nằm trọn bên trong).
    if (from || to) {
      const s = toDate(p.timeline_start);
      const e = toDate(p.timeline_end);
      const start = s || e;
      const end   = e || s;
      if (!start) return false;              // dự án chưa có timeline thì loại khi đang lọc theo ngày
      if (from && end < from) return false;  // kết thúc trước mốc "Từ ngày"
      if (to && start > to) return false;    // bắt đầu sau mốc "Đến ngày"
    }
    return true;
  });

  renderKpis();
  updateCharts();
  renderTable();
  renderFilterSummary(pic, status, from, to);
}

function renderFilterSummary(pic, status, from, to) {
  const bits = [];
  if (pic !== "ALL") bits.push("PIC: " + pic);
  if (status !== "ALL") bits.push("Trạng thái: " + status);
  const f = document.getElementById("filterFrom").value;
  const t = document.getElementById("filterTo").value;
  if (f || t) bits.push("Timeline: " + (f ? fmtDate(f) : "…") + " → " + (t ? fmtDate(t) : "…"));

  document.getElementById("filterSummary").textContent =
    bits.length ? "Đang lọc — " + bits.join(" · ") : "Đang xem toàn bộ dự án";
}

/** Nút "Xóa bộ lọc": đưa mọi điều kiện về mặc định và vẽ lại toàn bộ dashboard. */
function clearFilters() {
  document.getElementById("filterPic").value = "ALL";
  document.getElementById("filterStatus").value = "ALL";
  document.getElementById("filterFrom").value = "";
  document.getElementById("filterTo").value = "";
  if (dataTable) dataTable.search("").draw();   // xóa luôn ô Search của DataTables
  applyFilters();
  toast("Đã xóa bộ lọc", "ok");
}

function renderKpis() {
  const count = s => filteredProjects.filter(p => p.status === s).length;
  document.getElementById("kpiTotal").textContent    = filteredProjects.length;
  document.getElementById("kpiOpen").textContent     = count("Open");
  document.getElementById("kpiProgress").textContent = count("In Progress");
  document.getElementById("kpiDone").textContent     = count("Done");
  document.getElementById("kpiLate").textContent     = filteredProjects.filter(isLate).length;
}

/* ==========================================================================
   8. KHU VỰC 2 — BIỂU ĐỒ CHART.JS + DRILL-DOWN
   ========================================================================== */

/* ------------------------------------------------------------------
   LOGIC "BẮT SỰ KIỆN CLICK BIỂU ĐỒ ĐỂ UPDATE FILTER" — phần quan trọng nhất
   ------------------------------------------------------------------
   Luồng xử lý gồm 4 bước:

   B1. Chart.js truyền vào callback `onClick(event, elements, chart)` một mảng
       `elements`. Mảng RỖNG nghĩa là người dùng bấm vào vùng trống của canvas
       → bỏ qua, không làm gì cả.

   B2. Nếu có phần tử, `elements[0].index` chính là vị trí của lát bánh /
       cột vừa bấm. Dùng index đó tra ngược vào `chart.data.labels[index]`
       để lấy NHÃN (ví dụ "In Progress" hoặc "Phuong Van").

   B3. Gán nhãn vừa lấy vào đúng ô <select> ở Khu vực 1, rồi gọi applyFilters().
       Vì applyFilters() là nguồn duy nhất cập nhật dashboard nên biểu đồ, KPI
       và DataTables ở Khu vực 3 sẽ tự làm mới theo — không cần gọi tay.

   B4. Cuộn mượt xuống Khu vực 3 để người dùng thấy ngay kết quả chi tiết.

   Ngoài ra `onHover` đổi con trỏ chuột thành hình bàn tay (pointer) khi rê
   vào phần tử bấm được, để người dùng biết chỗ đó click được.
   ------------------------------------------------------------------ */

/** B4 — cuộn mượt xuống bảng dữ liệu. */
function scrollToTable() {
  document.getElementById("zoneTable").scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Dùng chung cho cả 2 biểu đồ: đổi con trỏ thành pointer khi rê vào phần tử. */
function chartHover(event, elements) {
  event.native.target.style.cursor = elements.length ? "pointer" : "default";
}

/**
 * Xử lý click chung.
 * @param {Array}  elements   mảng phần tử Chart.js trả về
 * @param {Object} chart      instance biểu đồ (để đọc labels)
 * @param {String} filterId   id của ô select cần điền ("filterStatus" | "filterPic")
 */
function handleChartClick(elements, chart, filterId) {
  if (!elements.length) return;                       // B1 — bấm vào chỗ trống

  const index = elements[0].index;                    // B2 — vị trí phần tử
  const label = chart.data.labels[index];             //      -> nhãn tương ứng
  if (!label) return;

  const select = document.getElementById(filterId);   // B3 — điền vào bộ lọc

  // Nhãn "Chưa gán" (dự án chưa có PIC) không có trong dropdown → không lọc được.
  const hasOption = Array.prototype.some.call(select.options, o => o.value === label);
  if (!hasOption) {
    toast("Không có tùy chọn lọc cho “" + label + "”", "err");
    return;
  }

  // Bấm lại đúng phần tử đang lọc = bỏ lọc (toggle), thao tác này rất tự nhiên khi dùng.
  select.value = (select.value === label) ? "ALL" : label;

  applyFilters();                                     //      -> làm mới KPI + Chart + DataTables

  if (select.value === "ALL") {
    toast("Đã bỏ lọc " + label, "ok");
  } else {
    toast("Đang lọc: " + label, "ok");
    scrollToTable();                                  // B4 — cuộn mượt xuống Khu vực 3
  }
}

function initCharts() {
  Chart.defaults.font.family = "'Be Vietnam Pro', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = "#40506B";

  /* ---------- Biểu đồ 1: Doughnut theo Status ---------- */
  statusChart = new Chart(document.getElementById("statusChart"), {
    type: "doughnut",
    data: {
      labels: STATUS_LIST.slice(),
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: STATUS_LIST.map(s => STATUS_COLOR[s]),
        borderColor: "#fff",
        borderWidth: 3,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      onHover: chartHover,
      // Click vào một lát bánh -> điền vào bộ lọc Trạng thái
      onClick: function (event, elements, chart) {
        handleChartClick(elements, chart, "filterStatus");
      },
      plugins: {
        legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", padding: 16, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
              const pct = Math.round(ctx.parsed / total * 100);
              return ` ${ctx.label}: ${ctx.parsed} đầu mục (${pct}%)`;
            },
            footer: () => "Bấm để lọc theo trạng thái này"
          }
        }
      }
    }
  });

  /* ---------- Biểu đồ 2: Bar theo PIC ---------- */
  picChart = new Chart(document.getElementById("picChart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Số đầu mục", data: [], backgroundColor: BRAND, borderRadius: 5, maxBarThickness: 42 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onHover: chartHover,
      // Click vào một cột -> điền vào bộ lọc PIC
      onClick: function (event, elements, chart) {
        handleChartClick(elements, chart, "filterPic");
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
        y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 }, grid: { color: "#EAEEF4" }, border: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} đầu mục`,
            footer: () => "Bấm để lọc theo người này"
          }
        }
      }
    }
  });
}

/** Vẽ lại số liệu 2 biểu đồ từ filteredProjects (bộ lọc áp cho toàn dashboard). */
function updateCharts() {
  // Doughnut: đếm theo trạng thái
  statusChart.data.datasets[0].data = STATUS_LIST.map(
    s => filteredProjects.filter(p => p.status === s).length
  );
  statusChart.update();

  // Bar: đếm theo PIC, sắp xếp giảm dần cho dễ đọc
  const tally = {};
  filteredProjects.forEach(p => {
    const key = p.pic || "Chưa gán";
    tally[key] = (tally[key] || 0) + 1;
  });
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  picChart.data.labels = sorted.map(x => x[0]);
  picChart.data.datasets[0].data = sorted.map(x => x[1]);
  picChart.update();
}

/* ==========================================================================
   9. KHU VỰC 3 — DATATABLES
   ========================================================================== */
function initTable() {
  dataTable = new DataTable("#projectsTable", {
    data: [],
    pageLength: 10,
    lengthMenu: [10, 25, 50, 100],
    order: [[2, "asc"]],        // mặc định sắp theo ngày bắt đầu
    columns: [
      /* 0 — Đầu mục: hiển thị tên + mô tả rút gọn.
            `orderData`/`render` trả chuỗi thường để Search và Sort chạy trên tên. */
      {
        data: "title",
        render: function (data, type, row) {
          if (type !== "display") return data || "";
          const desc = row.description
            ? `<div class="cell-desc">${esc(String(row.description).slice(0, 120))}${String(row.description).length > 120 ? "…" : ""}</div>`
            : "";
          return `<div class="cell-title">${esc(data)}</div>${desc}`;
        }
      },

      /* 1 — PIC */
      {
        data: "pic",
        render: function (data, type) {
          if (type !== "display") return data || "";
          if (!data) return '<span class="cell-muted">Chưa gán</span>';
          return `<span class="pic-cell"><span class="avatar">${esc(initials(data))}</span>${esc(data)}</span>`;
        }
      },

      /* 2 — Timeline: sort theo ngày bắt đầu dạng ISO (so sánh chuỗi là đúng thứ tự),
            display là thanh tiến độ mini + cảnh báo trễ hạn. */
      {
        data: "timeline_start",
        render: function (data, type, row) {
          if (type !== "display") return data || "9999-12-31";
          return renderTimelineCell(row);
        }
      },

      /* 3 — Ưu tiên: sort theo thứ hạng số (High < Medium < Low) chứ không theo alphabet. */
      {
        data: "priority",
        render: function (data, type) {
          if (type === "sort" || type === "type") return PRIORITY_RANK[data] || 99;
          if (type !== "display") return data || "";
          const cls = data === "High" ? "chip-hi" : data === "Low" ? "chip-lo" : "chip-mid";
          return `<span class="chip ${cls}">${esc(data || "—")}</span>`;
        }
      },

      /* 4 — Trạng thái: sort theo vòng đời Open → In Progress → Done. */
      {
        data: "status",
        render: function (data, type) {
          if (type === "sort" || type === "type") return STATUS_RANK[data] || 99;
          if (type !== "display") return data || "";
          const cls = data === "Done" ? "chip-done" : data === "In Progress" ? "chip-progress" : "chip-open";
          return `<span class="chip ${cls}">${esc(data || "—")}</span>`;
        }
      },

      /* 5 — Bước tiếp theo */
      {
        data: "next_steps",
        render: function (data, type) {
          if (type !== "display") return data || "";
          if (!data) return '<span class="cell-muted">—</span>';
          return `<div class="cell-next">${esc(data)}</div>`;
        }
      },

      /* 6 — Thao tác (Sửa / Xóa) */
      {
        data: "id",
        orderable: false,
        searchable: false,
        render: function (data) {
          return `<div class="row-actions">
            <button class="btn-icon js-edit"   data-id="${esc(data)}" title="Sửa"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon danger js-delete" data-id="${esc(data)}" title="Xóa"><i class="bi bi-trash3"></i></button>
          </div>`;
        }
      }
    ],
    language: {
      search: "",
      searchPlaceholder: "Tìm theo tên đầu mục…",
      lengthMenu: "Hiện _MENU_ dòng",
      info: "Đang xem _START_–_END_ trên tổng _TOTAL_ đầu mục",
      infoEmpty: "Không có đầu mục nào",
      infoFiltered: "(lọc từ _MAX_ đầu mục)",
      zeroRecords: "Không tìm thấy đầu mục nào khớp điều kiện.",
      emptyTable: "Chưa có dự án nào. Bấm “Thêm dự án mới” để bắt đầu.",
      paginate: { first: "Đầu", last: "Cuối", next: "Sau", previous: "Trước" }
    }
  });

  // Uỷ quyền sự kiện cho tbody: nút Sửa/Xóa được render động theo từng trang.
  $("#projectsTable tbody").on("click", ".js-edit", function () {
    openProjectModal(this.getAttribute("data-id"));
  });
  $("#projectsTable tbody").on("click", ".js-delete", function () {
    deleteProject(this.getAttribute("data-id"));
  });
}

/** ĐIỂM NHẤN: ô Timeline vẽ thanh tiến độ theo thời gian thực + cảnh báo trễ. */
function renderTimelineCell(row) {
  const s = toDate(row.timeline_start);
  const e = toDate(row.timeline_end);
  if (!s && !e) return '<span class="cell-muted">Chưa đặt timeline</span>';

  const dates = `<div class="tl-dates">${fmtDate(row.timeline_start) || "—"} → ${fmtDate(row.timeline_end) || "—"}</div>`;
  if (!s || !e || e < s) return `<div class="tl">${dates}</div>`;

  const now = today0();
  const span = Math.max(1, e - s);
  const pct = Math.min(100, Math.max(0, Math.round((now - s) / span * 100)));

  const late = isLate(row);
  const fillCls = row.status === "Done" ? "is-done" : late ? "is-late" : "";
  const width = row.status === "Done" ? 100 : pct;

  const days = Math.ceil((e - now) / 86400000);
  let meta = "";
  if (row.status === "Done")      meta = '<div class="tl-meta">Đã hoàn thành</div>';
  else if (late)                  meta = `<div class="tl-meta is-late">Trễ ${Math.abs(days)} ngày</div>`;
  else if (days === 0)            meta = '<div class="tl-meta">Đến hạn hôm nay</div>';
  else if (now < s)               meta = `<div class="tl-meta">Còn ${Math.ceil((s - now) / 86400000)} ngày nữa bắt đầu</div>`;
  else                            meta = `<div class="tl-meta">Còn ${days} ngày</div>`;

  return `<div class="tl">
      ${dates}
      <div class="tl-track"><div class="tl-fill ${fillCls}" style="width:${width}%"></div></div>
      ${meta}
    </div>`;
}

/** Nạp lại dữ liệu vào DataTables, giữ nguyên ô Search và cột đang sort. */
function renderTable() {
  if (!dataTable) return;
  dataTable.clear();
  dataTable.rows.add(filteredProjects);
  dataTable.draw(false);
  document.getElementById("tableCount").textContent = filteredProjects.length + " đầu mục";
}

/* ==========================================================================
   10. GHI DỮ LIỆU (CREATE / UPDATE / DELETE)
   ========================================================================== */

/** Mở modal. Không truyền id = thêm mới; truyền id = sửa (form được điền sẵn). */
function openProjectModal(id) {
  const form = document.getElementById("projectForm");
  form.reset();
  document.getElementById("formError").classList.add("d-none");
  editingId = id || null;

  if (id) {
    const p = allProjects.find(x => String(x.id) === String(id));
    if (!p) return;
    document.getElementById("projectModalTitle").textContent = "Sửa dự án";
    document.getElementById("fTitle").value       = p.title || "";
    document.getElementById("fDescription").value = p.description || "";
    document.getElementById("fStart").value       = p.timeline_start ? String(p.timeline_start).slice(0, 10) : "";
    document.getElementById("fEnd").value         = p.timeline_end ? String(p.timeline_end).slice(0, 10) : "";
    document.getElementById("fPic").value         = p.pic || "";
    document.getElementById("fPriority").value    = p.priority || "Medium";
    document.getElementById("fStatus").value      = p.status || "Open";
    document.getElementById("fNextSteps").value   = p.next_steps || "";
  } else {
    document.getElementById("projectModalTitle").textContent = "Thêm dự án mới";
    document.getElementById("fPriority").value = "Medium";
    document.getElementById("fStatus").value   = "Open";   // mặc định Open theo yêu cầu
  }

  projectModal.show();
}

async function handleSaveProject(e) {
  e.preventDefault();
  const errBox = document.getElementById("formError");
  errBox.classList.add("d-none");

  const start = document.getElementById("fStart").value;
  const end   = document.getElementById("fEnd").value;

  if (start && end && end < start) {
    errBox.textContent = "Ngày kết thúc đang sớm hơn ngày bắt đầu. Chỉnh lại giúp mình nhé.";
    errBox.classList.remove("d-none");
    return;
  }

  // Cột date của Postgres không nhận chuỗi rỗng → gửi null.
  const payload = {
    title:          document.getElementById("fTitle").value.trim(),
    description:    document.getElementById("fDescription").value.trim() || null,
    timeline_start: start || null,
    timeline_end:   end || null,
    pic:            document.getElementById("fPic").value.trim(),
    priority:       document.getElementById("fPriority").value,
    status:         document.getElementById("fStatus").value,
    next_steps:     document.getElementById("fNextSteps").value.trim() || null
  };

  setLoading("btnSaveProject", "saveSpinner", true);

  let error;
  if (editingId) {
    ({ error } = await sb.from("projects").update(payload).eq("id", editingId));
  } else {
    ({ error } = await sb.from("projects").insert([payload]));
  }

  setLoading("btnSaveProject", "saveSpinner", false);

  if (error) {
    errBox.textContent = "Lưu không thành công: " + error.message;
    errBox.classList.remove("d-none");
    return;
  }

  projectModal.hide();
  toast(editingId ? "Đã cập nhật dự án" : "Đã thêm dự án mới", "ok");
  editingId = null;
  await loadProjects();
}

async function deleteProject(id) {
  const p = allProjects.find(x => String(x.id) === String(id));
  if (!confirm(`Xóa "${p ? p.title : "đầu mục này"}"? Thao tác này không hoàn tác được.`)) return;

  const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) {
    toast("Xóa không thành công: " + error.message, "err");
    return;
  }
  toast("Đã xóa đầu mục", "ok");
  await loadProjects();
}

/* ==========================================================================
   11. GẮN SỰ KIỆN
   ========================================================================== */
function bindEvents() {
  // Auth
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  document.getElementById("btnLogout").addEventListener("click", handleLogout);
  document.getElementById("togglePw").addEventListener("click", function () {
    const input = document.getElementById("loginPassword");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    this.innerHTML = `<i class="bi bi-eye${show ? "-slash" : ""}"></i>`;
  });

  // Khu vực 1 — bộ lọc
  ["filterPic", "filterStatus", "filterFrom", "filterTo"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", applyFilters);
  });
  document.getElementById("btnClearFilters").addEventListener("click", clearFilters);

  // Modal thêm / sửa
  document.getElementById("btnAddProject").addEventListener("click", function () { openProjectModal(null); });
  document.getElementById("projectForm").addEventListener("submit", handleSaveProject);
}