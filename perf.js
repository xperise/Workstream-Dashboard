/* ==========================================================================
   XPERISE — PERFORMANCE DASHBOARD  ·  perf.js
   Chế độ thứ hai của Workstream Intelligence: theo dõi doanh thu, khách hàng
   và người dùng theo tháng, đối chiếu thực tế với kế hoạch.

   Dùng chung thanh trên cùng, ngôn ngữ, Supabase client và hàm toast của app
   hiện có. Mọi thứ khác nằm gọn trong đối tượng Perf, không đụng biến toàn cục
   của phần Workstream.

   Bảng cần có trên Supabase: monthly_actual, monthly_target, uploads
   và view v_monthly. Xem schema.sql.
   ========================================================================== */

/* ==========================================================================
   1. CHỮ HIỂN THỊ — gắn thêm vào bảng ngôn ngữ có sẵn
   ========================================================================== */
Object.assign(I18N.vi, {
  modeWork: "Công việc", modePerf: "Số liệu",
  modeWorkBrand: "Workstream Intelligence", modePerfBrand: "Performance Intelligence",

  pTabPulse: "Nhịp kinh doanh", pTabRevenue: "Doanh thu",
  pTabCustomer: "Khách hàng", pTabData: "Nhập số liệu",

  pExecEyebrow: "Tóm tắt điều hành · tính từ số liệu đã nhập",
  pPeriod: "Kỳ báo cáo",
  pUnitBn: "tỷ VND", pUnitMn: "triệu VND", pUnitPct: "%", pUnitVnd: "VND",

  pRevVsPlanTitle: "Doanh thu · thực tế và kế hoạch",
  pArpcEyebrow: "Chất lượng khách hàng", pArpcTitle: "Doanh thu trên mỗi khách hàng",
  pMonthlyTable: "Số liệu theo tháng",
  pByStream: "Cơ cấu theo dòng doanh thu", pShareTitle: "Tỷ trọng dòng B",
  pStreamDetail: "Chi tiết theo dòng",
  pTotalVsActive: "Tổng và đang hoạt động", pActiveRate: "Tỷ lệ hoạt động",
  pCustomerDetail: "Chi tiết theo tháng",

  pUploadEyebrow: "Kế toán", pUploadTitle: "Tải file số liệu",
  pDropMain: "Kéo file vào đây, hoặc <button class='linkbtn' id='perfPick'>chọn từ máy</button>",
  pDropSub: "Nhận .xlsx, .xls, .csv — một tháng hoặc cả năm đều được",
  pTemplate: "Tải file mẫu",
  pTemplateHint: "Tên cột phải khớp file mẫu. Doanh thu ghi bằng VND nguyên, không ghi tỷ.",
  pCheckTitle: "Kiểm tra trước khi ghi", pCommit: "Ghi vào hệ thống",
  pTargetTitle: "Kế hoạch", pSaveTargets: "Lưu kế hoạch",
  pTargetHint: "Nhập số kế hoạch cho từng tháng. Bỏ trống nếu chưa có.",
  pUploadLog: "Lịch sử tải lên",

  pRevenue: "Doanh thu", pCustomers: "Khách hàng", pUsers: "Người dùng",
  pArpcShort: "Doanh thu / khách",
  pPlan: "kế hoạch", pNoPlan: "chưa đặt kế hoạch", pActual: "Thực tế",
  pForecast: "dự phóng", pActualLabel: "thực tế",
  pVsPrev: "so tháng trước", pAchieved: "% đạt",
  pTotal: "Tổng", pActive: "Hoạt động", pActiveShort: "% hoạt động",
  pStreamA: "Dòng A", pStreamB: "Dòng B", pShare: "Tỷ trọng",
  pWithLicence: "Có phí licence", pExLicence: "Loại phí licence",
  pPeriodCol: "Kỳ", pType: "Loại",
  pNoData: "Chưa có số liệu. Vào tab Nhập số liệu để tải lên.",
  pNoDataShort: "Chưa có số liệu",
  pConnecting: "Đang kết nối…", pConnOk: n => `${n} kỳ dữ liệu`,
  pConnNone: "Chưa có dữ liệu", pConnBad: "Không kết nối được",
  pNeedSupabase: "Chưa nối Supabase — phần số liệu cần kết nối để hoạt động.",
  pSchemaMissing: "Chưa tìm thấy bảng số liệu trên Supabase. Chạy schema.sql rồi tải lại trang.",

  pExecEmpty: "Chưa có kỳ nào được nhập. Tải file số liệu để hệ thống bắt đầu theo dõi.",
  pExecLine: (m, r, p) => `Kỳ <em>${m}</em> đạt <b>${r}</b> tỷ doanh thu, tương đương <b>${p}</b> kế hoạch.`,
  pExecLineNoPlan: (m, r) => `Kỳ <em>${m}</em> đạt <b>${r}</b> tỷ doanh thu. Chưa đặt kế hoạch cho kỳ này.`,
  pChipGrowth: v => `Doanh thu ${v >= 0 ? "tăng" : "giảm"} ${Math.abs(v).toFixed(1)}% so tháng trước`,
  pChipArpc: v => `Doanh thu mỗi khách ${v >= 0 ? "tăng" : "giảm"} ${Math.abs(v).toFixed(1)}%`,
  pChipActive: v => `${v.toFixed(1)}% khách hàng có phát sinh giao dịch`,
  pChipBelow: v => `Còn thiếu ${v.toFixed(1)}% so với kế hoạch`,

  pRowsValid: (n, a, o) => `${n} kỳ hợp lệ · ${a} thêm mới · ${o} ghi đè`,
  pRowsOverwrite: list => `Sẽ ghi đè: ${list}`,
  pTargetsFound: n => `Đọc được số kế hoạch cho ${n} kỳ từ sheet Target.`,
  pTargetsOnly: n => `Chỉ có số kế hoạch: ${n} kỳ. Bấm ghi để lưu.`,
  pColsIgnored: (n, list) => `Bỏ qua ${n} cột không nhận diện được: ${list}`,
  pBadRows: list => `Không đọc được kỳ báo cáo ở dòng: ${list}`,
  pNoHeader: 'Không tìm thấy dòng tiêu đề có cột "period". Tải file mẫu để xem đúng định dạng.',
  pNoValidRows: "Không có dòng hợp lệ nào.",
  pDupPeriods: list => `Kỳ bị lặp trong file: ${list}`,
  pDropWarn: m => `${m}: số khách hàng giảm hơn 20% so với kỳ trước — kiểm tra lại.`,
  pZeroRev: m => `${m}: tổng doanh thu bằng 0.`,
  pFileEmpty: "File rỗng hoặc không có sheet nào.",
  pReadFail: e => `Không đọc được file: ${e}`,
  pFileUnreadable: "trình duyệt không mở được tệp",
  pNoXlsxLib: "Thiếu thư viện đọc Excel (SheetJS). Kiểm tra thẻ script xlsx trong index.html và kết nối mạng, rồi tải lại trang.",
  pSheetsSeen: names => `Các sheet tìm thấy trong file: ${names}`,
  pSkippedBlank: list => `Bỏ qua các tháng chưa có số liệu: ${list}`,
  pGap: "Còn lại theo kế hoạch",
  pYtd: "Lũy kế đến nay", pFy: "Cả năm 2026", pRemaining: "Còn phải đạt",
  pProgress: "Tiến độ năm",
  pProgressLine: (a, b, p) => `Đã đạt <b>${a}</b> trong tổng kế hoạch <b>${b}</b> tỷ cho năm 2026, tương đương <b>${p}</b>.`,
  pCommitted: (a, t) => t ? `Đã ghi ${a} kỳ thực tế và ${t} kỳ kế hoạch` : `Đã ghi ${a} kỳ dữ liệu`,
  pCommitFail: e => `Ghi không thành công: ${e}`,
  pSavedTargets: n => `Đã lưu kế hoạch cho ${n} kỳ`,
  pNoTargets: "Chưa có số kế hoạch nào để lưu.",
  pTargetsFirst: "Tải số liệu thực tế trước, rồi nhập kế hoạch cho từng kỳ.",
  pUpTime: "Thời điểm", pUpFile: "Tên file", pUpRows: "Số dòng", pUpNote: "Ghi chú"
});

Object.assign(I18N.en, {
  modeWork: "Workstream", modePerf: "Performance",
  modeWorkBrand: "Workstream Intelligence", modePerfBrand: "Performance Intelligence",

  pTabPulse: "Business pulse", pTabRevenue: "Revenue",
  pTabCustomer: "Customers", pTabData: "Data entry",

  pExecEyebrow: "Executive summary · derived from loaded data",
  pPeriod: "Period",
  pUnitBn: "VND bn", pUnitMn: "VND m", pUnitPct: "%", pUnitVnd: "VND",

  pRevVsPlanTitle: "Revenue · actual against plan",
  pArpcEyebrow: "Customer quality", pArpcTitle: "Revenue per customer",
  pMonthlyTable: "Monthly figures",
  pByStream: "Revenue by stream", pShareTitle: "Stream B share",
  pStreamDetail: "Detail by stream",
  pTotalVsActive: "Total and active", pActiveRate: "Active rate",
  pCustomerDetail: "Monthly detail",

  pUploadEyebrow: "Finance", pUploadTitle: "Upload figures",
  pDropMain: "Drop a file here, or <button class='linkbtn' id='perfPick'>choose from your computer</button>",
  pDropSub: "Accepts .xlsx, .xls, .csv — a single month or a full year",
  pTemplate: "Download template",
  pTemplateHint: "Column names must match the template. Revenue in whole dong, not billions.",
  pCheckTitle: "Review before saving", pCommit: "Save to system",
  pTargetTitle: "Plan", pSaveTargets: "Save plan",
  pTargetHint: "Enter the plan for each month. Leave blank where there is none.",
  pUploadLog: "Upload history",

  pRevenue: "Revenue", pCustomers: "Customers", pUsers: "Users",
  pArpcShort: "Revenue / customer",
  pPlan: "plan", pNoPlan: "no plan set", pActual: "Actual",
  pForecast: "forecast", pActualLabel: "actual",
  pVsPrev: "vs prior month", pAchieved: "% of plan",
  pTotal: "Total", pActive: "Active", pActiveShort: "% active",
  pStreamA: "Stream A", pStreamB: "Stream B", pShare: "Share",
  pWithLicence: "Including licence", pExLicence: "Excluding licence",
  pPeriodCol: "Period", pType: "Type",
  pNoData: "No figures yet. Use the Data entry tab to upload.",
  pNoDataShort: "No data",
  pConnecting: "Connecting…", pConnOk: n => `${n} periods loaded`,
  pConnNone: "No data yet", pConnBad: "Cannot connect",
  pNeedSupabase: "Supabase is not connected — the performance side needs it to work.",
  pSchemaMissing: "Performance tables not found on Supabase. Run schema.sql and reload.",

  pExecEmpty: "No periods loaded yet. Upload a data file to start tracking.",
  pExecLine: (m, r, p) => `<em>${m}</em> delivered <b>${r}</b>bn of revenue, <b>${p}</b> of plan.`,
  pExecLineNoPlan: (m, r) => `<em>${m}</em> delivered <b>${r}</b>bn of revenue. No plan set for this period.`,
  pChipGrowth: v => `Revenue ${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(1)}% on the prior month`,
  pChipArpc: v => `Revenue per customer ${v >= 0 ? "up" : "down"} ${Math.abs(v).toFixed(1)}%`,
  pChipActive: v => `${v.toFixed(1)}% of customers transacted`,
  pChipBelow: v => `${v.toFixed(1)}% short of plan`,

  pRowsValid: (n, a, o) => `${n} valid periods · ${a} new · ${o} overwritten`,
  pRowsOverwrite: list => `Will overwrite: ${list}`,
  pTargetsFound: n => `Plan figures read for ${n} periods from the Target sheet.`,
  pTargetsOnly: n => `Plan figures only: ${n} periods. Press save to store them.`,
  pColsIgnored: (n, list) => `Ignored ${n} unrecognised columns: ${list}`,
  pBadRows: list => `Could not read the period on rows: ${list}`,
  pNoHeader: 'No header row with a "period" column. Download the template for the expected format.',
  pNoValidRows: "No valid rows found.",
  pDupPeriods: list => `Duplicate periods in the file: ${list}`,
  pDropWarn: m => `${m}: customer count fell by more than 20% — please check.`,
  pZeroRev: m => `${m}: total revenue is zero.`,
  pFileEmpty: "The file is empty or has no sheets.",
  pReadFail: e => `Could not read the file: ${e}`,
  pFileUnreadable: "the browser could not open the file",
  pNoXlsxLib: "The Excel reader (SheetJS) is missing. Check the xlsx script tag in index.html and your connection, then reload.",
  pSheetsSeen: names => `Sheets found in the file: ${names}`,
  pSkippedBlank: list => `Skipped months with no figures yet: ${list}`,
  pGap: "Remaining to plan",
  pYtd: "Year to date", pFy: "Full year 2026", pRemaining: "Still to deliver",
  pProgress: "Year progress",
  pProgressLine: (a, b, p) => `<b>${a}</b> delivered of the <b>${b}</b>bn full-year plan, or <b>${p}</b>.`,
  pCommitted: (a, t) => t ? `Saved ${a} actual periods and ${t} plan periods` : `Saved ${a} periods`,
  pCommitFail: e => `Save failed: ${e}`,
  pSavedTargets: n => `Plan saved for ${n} periods`,
  pNoTargets: "No plan figures to save.",
  pTargetsFirst: "Upload actuals first, then enter the plan for each period.",
  pUpTime: "When", pUpFile: "File", pUpRows: "Rows", pUpNote: "Note"
});

/* ==========================================================================
   2. MÔ-ĐUN
   ========================================================================== */
const Perf = (function () {

  /* --- 2.1. Dòng doanh thu — sửa ở đây là mọi nơi đổi theo -------------- */
  const STREAMS = [
    { key: "rev_travel",       vi: "Travel & lưu trú",      en: "Travel & accommodation", group: "A", color: "#0D9488" },
    { key: "rev_mobility",     vi: "Mobility",              en: "Mobility",               group: "A", color: "#14B8A6" },
    { key: "rev_other",        vi: "Nhóm chi tiêu khác",    en: "Other spend categories", group: "A", color: "#5EEAD4" },
    { key: "rev_subscription", vi: "Thuê bao nền tảng",     en: "Platform subscription",  group: "B", color: "#A855F7" },
    { key: "rev_licence",      vi: "Phí licence năm",       en: "Annual licence",         group: "B", color: "#C084FC" },
    { key: "rev_oneoff",       vi: "Triển khai một lần",    en: "One-off implementation", group: "B", color: "#EA8C0B" }
  ];
  const sName = s => (typeof LANG !== "undefined" && LANG === "en") ? s.en : s.vi;

  const BN = 1e9, MN = 1e6;
  const P = {
    sb: null, ready: false, rows: [], targets: [],
    ptab: "pulse", staged: null, stagedTargets: null, charts: {}
  };

  /* --- 2.2. Tiện ích ----------------------------------------------------- */
  const q  = id => document.getElementById(id);
  const vnd = n => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const bn  = (n, d = 3) => (n == null ? "—" : (n / BN).toFixed(d));
  const mn  = (n, d = 2) => (n == null ? "—" : (n / MN).toFixed(d));
  const int = n => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));
  const pc  = n => (n == null ? "—" : Number(n).toFixed(1) + "%");
  const esc = str => String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function mlabel(p) {
    const d = new Date(p + "T00:00:00");
    if (isNaN(d)) return String(p);
    return d.toLocaleString("en-GB", { month: "short" }) + "-" + String(d.getFullYear()).slice(2);
  }
  const grpTotal = (r, g) => STREAMS.filter(s => s.group === g)
    .reduce((a, s) => a + (Number(r[s.key]) || 0), 0);
  /* Tháng chưa có số thực tế trả về null, KHÔNG phải 0.
     0 nghĩa là doanh thu bằng không; null nghĩa là chưa có số. */
  const hasAct  = r => r.has_actual !== false && r.total_revenue !== null;
  const revTotal = r => hasAct(r) ? grpTotal(r, "A") + grpTotal(r, "B") : null;

  /* toast của app chính; nếu chưa có thì im lặng */
  function say(msg, kind) {
    if (typeof toast === "function") toast(msg, kind || "ok");
    else console.log(msg);
  }

  /* ==========================================================================
     3. NẠP DỮ LIỆU
     ========================================================================== */
  function init(sbClient) { P.sb = sbClient || null; }

  function conn(state, text) {
    const c = q("perfConn");
    if (!c) return;
    c.className = "perf-conn " + (state || "");
    c.textContent = text;
  }

  async function load() {
    if (!P.sb) {
      conn("bad", t("pConnBad"));
      notice(t("pNeedSupabase"));
      P.rows = []; P.targets = [];
      renderAll();
      return;
    }
    conn("", t("pConnecting"));
    try {
      const [a, tg] = await Promise.all([
        P.sb.from("v_monthly").select("*").order("period"),
        P.sb.from("monthly_target").select("*").order("period")
      ]);
      if (a.error) throw a.error;
      if (tg.error) throw tg.error;

      P.rows = a.data || [];
      P.targets = tg.data || [];
      P.ready = true;
      notice(null);
      conn(P.rows.length ? "ok" : "", P.rows.length ? t("pConnOk")(P.rows.length) : t("pConnNone"));
      renderAll();
      loadUploads();
    } catch (e) {
      console.error(e);
      P.rows = []; P.targets = [];
      conn("bad", t("pConnBad"));
      // bảng chưa tồn tại là lỗi hay gặp nhất, nói rõ cách xử lý
      const missing = /relation|does not exist|schema cache|not find/i.test(e.message || "");
      notice(missing ? t("pSchemaMissing") : (e.message || String(e)));
      renderAll();
    }
  }

  function notice(msg) {
    const n = q("perfNotice");
    if (!n) return;
    n.classList.toggle("d-none", !msg);
    if (msg) n.textContent = msg;
  }

  async function loadUploads() {
    if (!P.sb) return;
    const { data, error } = await P.sb.from("uploads")
      .select("*").order("uploaded_at", { ascending: false }).limit(25);
    if (error) return;
    table(q("ptblUploads"),
      [t("pUpTime"), t("pUpFile"), t("pUpRows"), t("pUpNote")],
      (data || []).map(u => [
        new Date(u.uploaded_at).toLocaleString("en-GB"),
        esc(u.filename || "—"), int(u.row_count), esc(u.note || "—")
      ]), [2]);
  }

  /* ==========================================================================
     4. HIỂN THỊ
     ========================================================================== */
  function enter() {
    bindOnce();
    switchPtab(P.ptab);
    if (!P.ready) load(); else { renderAll(); loadUploads(); }
  }

  function relabel() {
    applyStaticText();
    q("dropMain").innerHTML = t("pDropMain");
    bindPick();
    renderAll();
    loadUploads();
  }

  function renderAll() {
    fillPeriods();
    renderExec();
    renderYearProgress();
    renderRails();
    renderPulseTable();
    renderRevenue();
    renderCustomer();
    renderTargets();
  }

  function fillPeriods() {
    const sel = q("perfPeriod");
    if (!sel) return;
    const cur = sel.value;
    const withData = P.rows.filter(hasAct);
    if (!withData.length) { sel.innerHTML = `<option>${t("pNoDataShort")}</option>`; return; }
    sel.innerHTML = withData.map(r =>
      `<option value="${r.period}">${mlabel(r.period)}</option>`).join("");
    const actuals = withData.filter(r => !r.is_forecast);
    const fallback = (actuals.length ? actuals : withData).slice(-1)[0].period;
    sel.value = withData.some(r => r.period === cur) ? cur : fallback;
  }

  const current = () => {
    const v = (q("perfPeriod") || {}).value;
    return P.rows.find(r => r.period === v && hasAct(r)) || null;
  };

  function renderExec() {
    const r = current();
    const txt = q("perfExecText"), chips = q("perfExecChips");
    if (!txt) return;
    if (!r) { txt.innerHTML = t("pExecEmpty"); chips.innerHTML = ""; return; }

    const withData = P.rows.filter(hasAct);
    const i = withData.findIndex(x => x.period === r.period);
    const prev = i > 0 ? withData[i - 1] : null;
    const tot = revTotal(r);
    const hasPlan = r.target_revenue > 0;

    txt.innerHTML = hasPlan
      ? t("pExecLine")(mlabel(r.period), bn(tot, 2), pc(100 * tot / r.target_revenue))
      : t("pExecLineNoPlan")(mlabel(r.period), bn(tot, 2));

    const out = [];
    if (prev && revTotal(prev)) out.push(chip(t("pChipGrowth")((tot / revTotal(prev) - 1) * 100),
      tot >= revTotal(prev) ? "stable" : "high"));
    if (prev && prev.arpc) out.push(chip(t("pChipArpc")((r.arpc / prev.arpc - 1) * 100),
      r.arpc >= prev.arpc ? "stable" : "watch"));
    if (r.customer_active_rate != null) out.push(chip(t("pChipActive")(r.customer_active_rate), "watch"));
    if (hasPlan && tot < r.target_revenue)
      out.push(chip(t("pChipBelow")(100 - 100 * tot / r.target_revenue), "critical"));
    chips.innerHTML = out.join("");
  }
  const chip = (label, band) => `<span class="exec-chip band-${band}">${label}</span>`;

  /* --- 4.1. Thanh đối chiếu — phần đặc trưng của chế độ này -------------
     Thực tế đổ đầy từ trái, kế hoạch là một vạch trên cùng trục. Đọc được
     "đã tới đích chưa" bằng vị trí chứ không phải bằng cách nhẩm số.        */
  function renderRails() {
    const host = q("perfRails");
    if (!host) return;
    const r = current();
    if (!r) {
      host.innerHTML = `<div class="rail rail-empty">${t("pNoData")}</div>`;
      return;
    }
    const withData = P.rows.filter(hasAct);
    const i = withData.findIndex(x => x.period === r.period);
    const prev = i > 0 ? withData[i - 1] : null;
    const tot = revTotal(r);

    const cards = [
      { label: t("pRevenue"),   val: tot,               tgt: r.target_revenue,
        fmt: v => bn(v, 2), unit: t("pUnitBn"), prev: prev ? revTotal(prev) : null },
      { label: t("pCustomers"), val: r.total_customers, tgt: r.target_customers,
        fmt: int, unit: "", prev: prev ? prev.total_customers : null },
      { label: t("pUsers"),     val: r.total_users,     tgt: r.target_users,
        fmt: int, unit: "", prev: prev ? prev.total_users : null },
      { label: t("pArpcShort"), val: r.arpc,            tgt: null,
        fmt: v => mn(v, 2), unit: t("pUnitMn"), prev: prev ? prev.arpc : null }
    ];

    host.innerHTML = cards.map(c => {
      const has = c.tgt != null && c.tgt > 0;
      const p100 = has ? (c.val / c.tgt) * 100 : null;
      const span = has ? Math.max(c.val, c.tgt) * 1.08 : (c.val || 1);
      const fill = Math.max(0, Math.min(100, (c.val / span) * 100));
      const notch = has ? Math.min(100, (c.tgt / span) * 100) : null;
      const band = !has ? "" : p100 >= 100 ? "stable" : p100 >= 85 ? "high" : "critical";
      const d = c.prev ? (c.val / c.prev - 1) * 100 : null;

      return `<div class="rail">
        <div class="rail-label">${c.label}</div>
        <div class="rail-value mono">${c.fmt(c.val)}${c.unit ? `<span class="rail-unit">${c.unit}</span>` : ""}</div>
        <div class="rail-plan">${has ? t("pPlan") + " " + c.fmt(c.tgt) + (c.unit ? " " + c.unit : "") : t("pNoPlan")}</div>
        <div class="rail-track">
          <div class="rail-fill band-${band || "stable"}" style="width:${fill}%"></div>
          ${notch != null ? `<div class="rail-notch" style="left:${notch}%"><span>${t("pPlan")}</span></div>` : ""}
        </div>
        <div class="rail-foot">
          <b class="mono band-text-${band || "none"}">${has ? pc(p100) : "—"}</b>
          <span class="rail-delta mono">${d == null ? "" :
            (d >= 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1) + "% " + t("pVsPrev")}</span>
        </div>
      </div>`;
    }).join("");
  }

  /* Tiến độ cả năm: lũy kế thực tế so với tổng kế hoạch 12 tháng.
     Đây là câu trả lời trực tiếp cho "đang ở đâu so với mục tiêu tháng 12". */
  function renderYearProgress() {
    const host = q("perfYear");
    if (!host) return;
    const ytd = P.rows.filter(hasAct).reduce((a, r) => a + revTotal(r), 0);
    const fy  = P.rows.reduce((a, r) => a + (Number(r.target_revenue) || 0), 0);
    if (!fy) { host.innerHTML = ""; return; }

    const pctv = 100 * ytd / fy;
    const done = P.rows.filter(hasAct).length;
    const planned = P.rows.filter(r => r.target_revenue > 0).length;
    // tiến độ thời gian: đã đi bao nhiêu phần của năm
    const timePct = planned ? 100 * done / planned : 0;

    host.innerHTML = `
      <div class="yearbar">
        <div class="yearbar-head">
          <div>
            <span class="eyebrow">${t("pProgress")}</span>
            <p class="yearbar-line">${t("pProgressLine")(
              bn(ytd, 1) + " " + t("pUnitBn"), bn(fy, 1), pc(pctv))}</p>
          </div>
          <div class="yearbar-nums">
            <div><span>${t("pYtd")}</span><b class="mono">${bn(ytd, 1)}</b></div>
            <div><span>${t("pRemaining")}</span><b class="mono">${bn(fy - ytd, 1)}</b></div>
            <div><span>${t("pFy")}</span><b class="mono">${bn(fy, 1)}</b></div>
          </div>
        </div>
        <div class="yearbar-track">
          <div class="yearbar-fill" style="width:${Math.min(100, pctv)}%"></div>
          <div class="yearbar-time" style="left:${Math.min(100, timePct)}%"></div>
        </div>
        <div class="yearbar-scale">
          ${P.rows.map(r => `<span class="${hasAct(r) ? "on" : ""}">${mlabel(r.period).slice(0,3)}</span>`).join("")}
        </div>
      </div>`;
  }

  function renderPulseTable() {
    const dash = "—";
    table(q("ptblPulse"),
      [t("pPeriodCol"), `${t("pRevenue")} (${t("pUnitBn")})`, `${t("pPlan")} (${t("pUnitBn")})`,
       t("pAchieved"), t("pCustomers"), `${t("pCustomers")} ${t("pPlan")}`,
       t("pUsers"), `${t("pUsers")} ${t("pPlan")}`, `${t("pArpcShort")} (${t("pUnitMn")})`],
      P.rows.map(r => {
        const A = hasAct(r);
        return [
          mlabel(r.period),
          A ? bn(revTotal(r), 3) : dash,
          bn(r.target_revenue, 3),
          A ? pc(r.revenue_pct) : dash,
          A ? int(r.total_customers) : dash,
          int(r.target_customers),
          A ? int(r.total_users) : dash,
          int(r.target_users),
          A ? mn(r.arpc, 2) : dash
        ];
      }),
      [1, 2, 3, 4, 5, 6, 7, 8],
      P.rows.map(r => r.is_forecast || !hasAct(r)));
    chartRevenue(); chartArpc();
  }

  function renderRevenue() {
    const head = [t("pPeriodCol"), ...STREAMS.map(sName),
                  t("pStreamA"), t("pStreamB"), t("pTotal"), t("pStreamB") + " %"];
    table(q("ptblRevenue"), head,
      P.rows.filter(hasAct).map(r => [
        mlabel(r.period), ...STREAMS.map(s => vnd(r[s.key])),
        vnd(grpTotal(r, "A")), vnd(grpTotal(r, "B")), vnd(revTotal(r)), pc(r.stream_b_share)
      ]),
      head.map((_, i) => i).slice(1), P.rows.filter(hasAct).map(r => r.is_forecast));
    chartStack(); chartShare();
  }

  function renderCustomer() {
    table(q("ptblCustomer"),
      [t("pPeriodCol"), t("pCustomers"), t("pActive"), t("pActiveShort"),
       t("pUsers"), t("pActive"), t("pActiveShort")],
      P.rows.filter(hasAct).map(r => [
        mlabel(r.period), int(r.total_customers), int(r.active_customers), pc(r.customer_active_rate),
        int(r.total_users), int(r.active_users), pc(r.user_active_rate)
      ]), [1, 2, 3, 4, 5, 6], P.rows.filter(hasAct).map(r => r.is_forecast));
    chartUsers(); chartActive();
  }

  /* bảng dùng chung; cột trong numCols dùng phông số */
  function table(tbl, head, body, numCols, forecastFlags) {
    if (!tbl) return;
    numCols = numCols || []; forecastFlags = forecastFlags || [];
    if (!body.length) {
      tbl.innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody><tr><td class="ptable-empty" colspan="${head.length}">${t("pNoDataShort")}</td></tr></tbody>`;
      return;
    }
    tbl.innerHTML =
      `<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
      body.map((row, ri) =>
        `<tr class="${forecastFlags[ri] ? "is-forecast" : ""}">` +
        row.map((c, ci) => `<td class="${numCols.indexOf(ci) >= 0 ? "mono" : ""}">${c}</td>`).join("") +
        `</tr>`).join("") + `</tbody>`;
  }

  /* ==========================================================================
     5. BIỂU ĐỒ
     ========================================================================== */
  const AXIS = "#8A968F";
  const BASE = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded",
        font: { family: "'Be Vietnam Pro'", size: 11 }, color: "#46564C" } },
      tooltip: { backgroundColor: "#12281A", padding: 10, cornerRadius: 8, displayColors: true,
        titleFont: { family: "'Be Vietnam Pro'", size: 12, weight: "600" },
        bodyFont: { family: "'JetBrains Mono'", size: 11 } }
    },
    scales: {
      x: { grid: { display: false }, border: { color: "#E3E8EC" },
           ticks: { font: { family: "'JetBrains Mono'", size: 10 }, color: AXIS } },
      y: { grid: { color: "#EDF1F4" }, border: { display: false },
           ticks: { font: { family: "'JetBrains Mono'", size: 10 }, color: AXIS } }
    }
  };
  function mk(id, cfg) {
    const c = q(id); if (!c) return;
    if (P.charts[id]) { P.charts[id].destroy(); delete P.charts[id]; }
    if (!P.rows.length) return;
    P.charts[id] = new Chart(c, cfg);
  }
  const labels = () => P.rows.map(r => mlabel(r.period));

  /* Đường kế hoạch chạy đủ 12 tháng; cột thực tế dừng ở tháng cuối
     có số. Khoảng trống phía sau là chủ ý — cho thấy phần còn phải đi. */
  function chartRevenue() {
    mk("pcRevenue", { type: "bar", data: { labels: labels(), datasets: [
      { label: t("pActual"),
        data: P.rows.map(r => hasAct(r) ? +bn(revTotal(r), 3) : null),
        backgroundColor: "#0D9488", borderRadius: 5, order: 3 },
      { label: t("pPlan"), type: "line",
        data: P.rows.map(r => r.target_revenue ? +bn(r.target_revenue, 3) : null),
        borderColor: "#7E22CE", borderDash: [5, 4], borderWidth: 2, pointRadius: 2,
        tension: .25, spanGaps: true, order: 1 },
      { label: t("pGap"), type: "bar",
        data: P.rows.map(r => hasAct(r) ? null :
          (r.target_revenue ? +bn(r.target_revenue, 3) : null)),
        backgroundColor: "rgba(126,34,206,.13)", borderColor: "rgba(126,34,206,.45)",
        borderWidth: 1, borderRadius: 5, order: 2 }
    ] }, options: BASE });
  }
  function chartArpc() {
    mk("pcArpc", { type: "line", data: { labels: labels(), datasets: [
      { label: t("pPlan"), data: P.rows.map(r => r.target_arpc ? +mn(r.target_arpc, 3) : null),
        borderColor: "#7E22CE", borderDash: [5, 4], borderWidth: 2, pointRadius: 2,
        tension: .25, spanGaps: true },
      { label: t("pWithLicence"), data: P.rows.map(r => r.arpc ? +mn(r.arpc, 3) : null),
        borderColor: "#A855F7", backgroundColor: "rgba(168,85,247,.10)", fill: true,
        tension: .3, pointRadius: 2, borderWidth: 2 },
      { label: t("pExLicence"), data: P.rows.map(r => r.arpc_ex_licence ? +mn(r.arpc_ex_licence, 3) : null),
        borderColor: "#0D9488", borderDash: [5, 4], tension: .3, pointRadius: 2, borderWidth: 2 }
    ] }, options: BASE });
  }
  function chartStack() {
    mk("pcStack", { type: "bar", data: { labels: labels(),
      datasets: STREAMS.map(s => ({ label: sName(s), data: P.rows.map(r => +bn(r[s.key], 3)),
        backgroundColor: s.color, borderRadius: 2 })) },
      options: Object.assign({}, BASE, { scales: {
        x: Object.assign({}, BASE.scales.x, { stacked: true }),
        y: Object.assign({}, BASE.scales.y, { stacked: true }) } }) });
  }
  function chartShare() {
    mk("pcShare", { type: "line", data: { labels: labels(), datasets: [
      { label: t("pStreamB"), data: P.rows.map(r => r.stream_b_share),
        borderColor: "#A855F7", backgroundColor: "rgba(168,85,247,.12)", fill: true,
        tension: .3, pointRadius: 2, borderWidth: 2 }
    ] }, options: BASE });
  }
  function chartUsers() {
    mk("pcUsers", { type: "bar", data: { labels: labels(), datasets: [
      { label: t("pTotal"),  data: P.rows.map(r => r.total_users),  backgroundColor: "#E3E8EC", borderRadius: 5 },
      { label: t("pActive"), data: P.rows.map(r => r.active_users), backgroundColor: "#0D9488", borderRadius: 5 },
      { label: t("pPlan"), type: "line", data: P.rows.map(r => r.target_users || null),
        borderColor: "#7E22CE", borderDash: [5, 4], borderWidth: 2, pointRadius: 2,
        tension: .25, spanGaps: true }
    ] }, options: BASE });
  }
  function chartActive() {
    mk("pcActive", { type: "line", data: { labels: labels(), datasets: [
      { label: t("pCustomers"), data: P.rows.map(r => r.customer_active_rate),
        borderColor: "#0D9488", tension: .3, pointRadius: 2, borderWidth: 2 },
      { label: t("pUsers"), data: P.rows.map(r => r.user_active_rate),
        borderColor: "#A855F7", borderDash: [5, 4], tension: .3, pointRadius: 2, borderWidth: 2 }
    ] }, options: BASE });
  }

  /* ==========================================================================
     6. KẾ HOẠCH — nhập tay
     ========================================================================== */
  function renderTargets() {
    const tbl = q("ptblTargets"); if (!tbl) return;
    const all = Array.from(new Set(
      P.rows.map(r => r.period).concat(P.targets.map(x => x.period)))).sort();
    if (!all.length) {
      tbl.innerHTML = `<tbody><tr><td class="ptable-empty">${t("pTargetsFirst")}</td></tr></tbody>`;
      return;
    }
    const find = p => P.targets.find(x => x.period === p) || {};
    tbl.innerHTML =
      `<thead><tr><th>${t("pPeriodCol")}</th><th>${t("pRevenue")} (${t("pUnitVnd")})</th>
        <th>${t("pCustomers")}</th><th>${t("pUsers")}</th></tr></thead><tbody>` +
      all.map(p => {
        const x = find(p);
        return `<tr data-period="${p}">
          <td>${mlabel(p)}</td>
          <td><input type="number" step="1" class="form-control" data-f="target_revenue"   value="${x.target_revenue   != null ? x.target_revenue   : ""}" /></td>
          <td><input type="number" step="1" class="form-control" data-f="target_customers" value="${x.target_customers != null ? x.target_customers : ""}" /></td>
          <td><input type="number" step="1" class="form-control" data-f="target_users"     value="${x.target_users     != null ? x.target_users     : ""}" /></td>
        </tr>`;
      }).join("") + `</tbody>`;
  }

  async function saveTargets() {
    if (!P.sb) return say(t("pNeedSupabase"), "warn");
    const payload = Array.from(document.querySelectorAll("#ptblTargets tbody tr")).map(tr => {
      const o = { period: tr.dataset.period };
      tr.querySelectorAll("input").forEach(i => { o[i.dataset.f] = i.value === "" ? 0 : Number(i.value); });
      return o;
    }).filter(o => o.target_revenue || o.target_customers || o.target_users);

    if (!payload.length) return say(t("pNoTargets"), "warn");
    const { error } = await P.sb.from("monthly_target").upsert(payload, { onConflict: "period" });
    if (error) return say(t("pCommitFail")(error.message), "err");
    say(t("pSavedTargets")(payload.length), "ok");
    load();
  }

  /* ==========================================================================
     7. TẢI FILE — đọc, kiểm tra, rồi mới ghi
     ========================================================================== */
  const HEADERS = {
    period: ["period", "ky", "kỳ", "thang", "tháng", "month"],
    rev_travel: ["rev_travel", "travel"],
    rev_mobility: ["rev_mobility", "mobility"],
    rev_other: ["rev_other", "other"],
    rev_subscription: ["rev_subscription", "subscription"],
    rev_licence: ["rev_licence", "licence", "license"],
    rev_oneoff: ["rev_oneoff", "oneoff", "one_off"],
    total_customers: ["total_customers"], active_customers: ["active_customers"],
    total_users: ["total_users"], active_users: ["active_users"],
    is_forecast: ["is_forecast", "forecast"],
    target_revenue: ["target_revenue"], target_customers: ["target_customers"],
    target_users: ["target_users"], target_active_users: ["target_active_users"]
  };
  const norm = s => String(s == null ? "" : s).trim().toLowerCase()
    .replace(/[\s\-().]/g, "_").replace(/_+/g, "_");
  function mapHead(h) {
    const n = norm(h);
    for (const f in HEADERS) if (HEADERS[f].some(a => norm(a) === n)) return f;
    return null;
  }
  /* file mẫu có một dòng nhãn tiếng Việt phía trên dòng tên cột máy đọc,
     nên phải dò tìm chứ không mặc định dòng đầu tiên */
  function headerRow(raw) {
    for (let i = 0; i < Math.min(raw.length, 12); i++) {
      const hits = (raw[i] || []).map(mapHead).filter(Boolean);
      if (hits.indexOf("period") >= 0 && hits.length >= 2) return i;
    }
    return -1;
  }
  function parsePeriod(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date) return iso(v);
    if (typeof v === "number") {
      const d = XLSX.SSF.parse_date_code(v);
      return d ? `${d.y}-${String(d.m).padStart(2, "0")}-01` : null;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-01`;
    m = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[2]}-${String(+m[1]).padStart(2, "0")}-01`;
    const MO = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
    m = s.match(/^([a-z]{3})[a-z]*[\-\s](\d{2,4})$/i);
    if (m && MO[m[1].toLowerCase()]) {
      let y = +m[2]; if (y < 100) y += 2000;
      return `${y}-${String(MO[m[1].toLowerCase()]).padStart(2, "0")}-01`;
    }
    const d = new Date(s);
    return isNaN(d) ? null : iso(d);
  }
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  function num(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return Math.round(v);
    const n = Number(String(v).replace(/[,\s]/g, ""));
    return isNaN(n) ? 0 : Math.round(n);
  }

  function readFile(f) {
    // Thiếu thư viện đọc Excel là lỗi cấu hình, không phải lỗi file người dùng.
    if (typeof XLSX === "undefined") {
      checks([{ t: "err", m: t("pNoXlsxLib") }]);
      q("btnPerfCommit").disabled = true;
      return;
    }
    const fr = new FileReader();
    fr.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: true });
        if (!wb || !wb.SheetNames || !wb.SheetNames.length)
          return checks([{ t: "err", m: t("pFileEmpty") }]);
        let actualRaw = null, targetRaw = null;
        wb.SheetNames.forEach(name => {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false });
          const h = headerRow(raw);
          if (h < 0) return;
          const fields = raw[h].map(mapHead).filter(Boolean);
          const isTgt = fields.some(x => x.indexOf("target_") === 0);
          if (isTgt && !targetRaw) targetRaw = raw;
          else if (!isTgt && !actualRaw) actualRaw = raw;
        });
        if (!actualRaw && !targetRaw)
          return checks([
            { t: "err",  m: t("pNoHeader") },
            { t: "warn", m: t("pSheetsSeen")(wb.SheetNames.join(", ") || "—") }
          ]);

        P.stagedTargets = targetRaw ? parseTargets(targetRaw) : null;
        if (actualRaw) stage(actualRaw, f.name);
        else { P.staged = { recs: [], filename: f.name }; targetOnly(); }
      } catch (err) {
        console.error("perf upload:", err);
        checks([{ t: "err", m: t("pReadFail")(err && err.message ? err.message : String(err)) }]);
        q("btnPerfCommit").disabled = true;
      }
    };
    fr.onerror = () => {
      checks([{ t: "err", m: t("pReadFail")(t("pFileUnreadable")) }]);
      q("btnPerfCommit").disabled = true;
    };
    fr.readAsArrayBuffer(f);
  }

  function parseTargets(raw) {
    const h = headerRow(raw); if (h < 0) return null;
    raw = raw.slice(h);
    const map = raw[0].map(mapHead);
    const out = [];
    for (let i = 1; i < raw.length; i++) {
      const line = raw[i]; if (!line || !line.length) continue;
      const rec = {};
      map.forEach((f, ci) => {
        if (!f) return;
        if (f === "period") rec.period = parsePeriod(line[ci]);
        else if (f.indexOf("target_") === 0) rec[f] = num(line[ci]);
      });
      if (!rec.period) continue;
      if (!(rec.target_revenue || rec.target_customers || rec.target_users)) continue;
      out.push({ period: rec.period,
        target_revenue: rec.target_revenue || 0,
        target_customers: rec.target_customers || 0,
        target_users: rec.target_users || 0 });
    }
    return out.length ? out : null;
  }

  function stage(raw, filename) {
    const list = [];
    if (!raw.length) return say(t("pFileEmpty"), "err");
    const h = headerRow(raw);
    if (h < 0) return checks([{ t: "err", m: t("pNoHeader") }]);
    raw = raw.slice(h);
    const map = raw[0].map(mapHead);

    const unknown = raw[0].filter((c, i) => c && !map[i]);
    if (unknown.length) list.push({ t: "warn", m: t("pColsIgnored")(unknown.length, unknown.join(", ")) });

    const pcol = map.indexOf("period");
    const FOOTER = /^(t\u1ed5ng|t\u1ed5ng c\u1ed9ng|total|sum|grand total)$/i;
    const blank = v => v == null || String(v).trim() === "";

    const out = [], bad = [], skipped = [];
    for (let i = 1; i < raw.length; i++) {
      const line = raw[i]; if (!line || !line.length) continue;

      // Dòng tổng cuối bảng: bỏ qua, không tính là lỗi.
      if (pcol >= 0 && FOOTER.test(String(line[pcol] == null ? "" : line[pcol]).trim())) continue;

      // Tháng có ghi kỳ nhưng mọi ô số đều để trống = chưa có số liệu.
      // Bỏ qua hẳn, KHÔNG ghi thành 0 — số 0 nghĩa là doanh thu bằng không.
      const allBlank = map.every((f, ci) =>
        !f || f === "period" || f === "is_forecast" || blank(line[ci]));
      if (allBlank) {
        const p = pcol >= 0 ? parsePeriod(line[pcol]) : null;
        if (p) skipped.push(mlabel(p));
        continue;
      }

      const rec = {};
      map.forEach((f, ci) => {
        if (!f) return;
        if (f === "period") rec.period = parsePeriod(line[ci]);
        else if (f === "is_forecast") rec.is_forecast = /^(1|true|x|yes|c\u00f3)$/i.test(String(line[ci] == null ? "" : line[ci]).trim());
        else if (f.indexOf("target_") !== 0) rec[f] = num(line[ci]);
      });
      if (!rec.period) { bad.push(h + i + 1); continue; }
      STREAMS.forEach(s => rec[s.key] = rec[s.key] || 0);
      ["total_customers", "active_customers", "total_users", "active_users"]
        .forEach(k => rec[k] = rec[k] || 0);
      rec.is_forecast = !!rec.is_forecast;
      out.push(rec);
    }

    if (bad.length) list.push({ t: "err", m: t("pBadRows")(bad.join(", ")) });
    if (!out.length) {
      if (P.stagedTargets) { P.staged = { recs: [], filename: filename }; return targetOnly(list); }
      return checks(list.concat([{ t: "err", m: t("pNoValidRows") }]));
    }

    const seen = {}, dup = [];
    out.forEach(r => { if (seen[r.period]) dup.push(mlabel(r.period)); seen[r.period] = 1; });
    if (dup.length) list.push({ t: "err", m: t("pDupPeriods")(Array.from(new Set(dup)).join(", ")) });

    const over = out.filter(r => P.rows.some(x => x.period === r.period)).map(r => mlabel(r.period));
    list.push({ t: "ok", m: t("pRowsValid")(out.length, out.length - over.length, over.length) });
    if (over.length) list.push({ t: "warn", m: t("pRowsOverwrite")(over.join(", ")) });
    if (P.stagedTargets) list.push({ t: "ok", m: t("pTargetsFound")(P.stagedTargets.length) });
    if (skipped.length) list.push({ t: "warn", m: t("pSkippedBlank")(skipped.join(", ")) });

    out.sort((a, b) => a.period < b.period ? -1 : 1);
    out.forEach(r => {
      const prev = P.rows.filter(x => x.period < r.period && x.total_customers > 0).slice(-1)[0];
      if (prev && r.total_customers && r.total_customers < prev.total_customers * 0.8)
        list.push({ t: "warn", m: t("pDropWarn")(mlabel(r.period)) });
      if (revTotal(r) === 0) list.push({ t: "warn", m: t("pZeroRev")(mlabel(r.period)) });
    });

    const blocking = list.some(c => c.t === "err");
    P.staged = blocking ? null : { recs: out, filename: filename };
    checks(list);
    q("btnPerfCommit").disabled = blocking;

    table(q("ptblPreview"),
      [t("pPeriodCol"), ...STREAMS.map(sName), t("pTotal"), t("pCustomers"), t("pUsers"), t("pType")],
      out.map(r => [
        mlabel(r.period), ...STREAMS.map(s => vnd(r[s.key])), vnd(revTotal(r)),
        int(r.total_customers), int(r.total_users),
        r.is_forecast ? t("pForecast") : t("pActualLabel")
      ]),
      STREAMS.map((s, i) => i + 1).concat([STREAMS.length + 1, STREAMS.length + 2, STREAMS.length + 3]));
  }

  function targetOnly(prior) {
    checks((prior || []).concat([{ t: "ok", m: t("pTargetsOnly")(P.stagedTargets.length) }]));
    q("btnPerfCommit").disabled = false;
    table(q("ptblPreview"),
      [t("pPeriodCol"), t("pRevenue"), t("pCustomers"), t("pUsers")],
      P.stagedTargets.map(x => [mlabel(x.period), vnd(x.target_revenue),
        int(x.target_customers), int(x.target_users)]), [1, 2, 3]);
  }

  function checks(listItems) {
    q("perfPreview").classList.remove("d-none");
    q("perfChecks").innerHTML = listItems.map(c => `<li class="chk-${c.t}">${c.m}</li>`).join("");
  }

  function cancel() {
    P.staged = null; P.stagedTargets = null;
    q("perfPreview").classList.add("d-none");
    q("perfFile").value = "";
  }

  async function commit() {
    if (!P.sb) return say(t("pNeedSupabase"), "warn");
    if (!P.staged && !P.stagedTargets) return say(t("pNoValidRows"), "err");
    const btn = q("btnPerfCommit"); btn.disabled = true;
    try {
      const recs = (P.staged && P.staged.recs) || [];
      let uploadId = null;
      if (recs.length) {
        const { data: up, error: e1 } = await P.sb.from("uploads")
          .insert({ filename: P.staged.filename, row_count: recs.length,
                    uploaded_by: "dashboard", note: "Tải lên từ giao diện" })
          .select().single();
        if (e1) throw e1;
        uploadId = up.id;
        const { error: e2 } = await P.sb.from("monthly_actual")
          .upsert(recs.map(r => Object.assign({}, r, { upload_id: uploadId })), { onConflict: "period" });
        if (e2) throw e2;
      }
      if (P.stagedTargets && P.stagedTargets.length) {
        const { error: e3 } = await P.sb.from("monthly_target")
          .upsert(P.stagedTargets, { onConflict: "period" });
        if (e3) throw e3;
      }
      say(t("pCommitted")(recs.length, P.stagedTargets ? P.stagedTargets.length : 0), "ok");
      cancel();
      load();
    } catch (err) {
      say(t("pCommitFail")(err.message || err), "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* ==========================================================================
     8. SỰ KIỆN
     ========================================================================== */
  let bound = false;
  function bindPick() {
    const p = q("perfPick");
    if (p) p.addEventListener("click", () => q("perfFile").click());
  }

  function bindOnce() {
    if (bound) return; bound = true;

    q("dropMain").innerHTML = t("pDropMain");
    bindPick();

    q("perfTabs").addEventListener("click", e => {
      const b = e.target.closest(".tab[data-ptab]");
      if (b) switchPtab(b.dataset.ptab);
    });

    q("perfPeriod").addEventListener("change", () => { renderExec(); renderRails(); });

    const drop = q("perfDrop");
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.remove("is-over");
    }));
    drop.addEventListener("drop", e => {
      const f = e.dataTransfer.files[0]; if (f) readFile(f);
    });
    q("perfFile").addEventListener("change", e => {
      if (e.target.files[0]) readFile(e.target.files[0]);
    });

    q("btnPerfCancel").addEventListener("click", cancel);
    q("btnPerfCommit").addEventListener("click", commit);
    q("btnSaveTargets").addEventListener("click", saveTargets);
    q("btnTemplate").addEventListener("click", () =>
      window.open("Xperise_Metrics_Template.xlsx", "_blank"));
  }

  function switchPtab(tab) {
    P.ptab = tab;
    document.querySelectorAll("#perfTabs .tab[data-ptab]").forEach(b =>
      b.classList.toggle("is-active", b.dataset.ptab === tab));
    document.querySelectorAll(".pview").forEach(v =>
      v.classList.toggle("is-active", v.id === "pview-" + tab));
    // Chart.js cần đo lại khung sau khi khung được hiện ra
    Object.keys(P.charts).forEach(k => { try { P.charts[k].resize(); } catch (e) {} });
  }

  return { init, load, enter, relabel, STREAMS };
})();
