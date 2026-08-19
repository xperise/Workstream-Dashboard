/* ==========================================================================
   XPERISE — BIÊN BẢN HỌP  ·  minutes.js
   Tab trong chế độ Công việc. Tệp lưu trên Supabase Storage (bucket
   "minutes"), phần mô tả lưu ở bảng meeting_minutes.

   Dùng chung Supabase client, ngôn ngữ và toast của app hiện có.
   Bảng cần có: meeting_minutes. Bucket cần có: minutes. Xem migrate_v2.sql.
   ========================================================================== */

Object.assign(I18N.vi, {
  mTab: "Biên bản họp", mTabTip: "Lưu trữ biên bản các cuộc họp",
  mEyebrow: "Lưu trữ", mTitle: "Biên bản họp", mNew: "Thêm biên bản",
  mDate: "Ngày họp", mSubject: "Nội dung cuộc họp", mAttendees: "Thành phần tham dự",
  mSummary: "Tóm tắt và kết luận",
  mSubjectPh: "Ví dụ: Họp rà soát tiến độ tuần",
  mAttendeesPh: "Ngăn cách bằng dấu phẩy",
  mSummaryPh: "Những điểm chính, quyết định và việc cần làm",
  mDropMain: "Kéo tệp vào đây, hoặc <button class='linkbtn' id='minutePick'>chọn từ máy</button>",
  mDropSub: "Nhận mọi định dạng, tối đa 20 MB",
  mSave: "Lưu biên bản", mDownload: "Tải về", mDelete: "Xóa",
  mEmpty: "Chưa có biên bản nào. Bấm \u201cThêm biên bản\u201d để bắt đầu.",
  mNeedDate: "Cần chọn ngày họp.", mNeedSubject: "Cần nhập nội dung cuộc họp.",
  mTooBig: "Tệp vượt quá 20 MB.",
  mSaved: "Đã lưu biên bản", mDeleted: "Đã xóa biên bản",
  mSaveFail: e => `Lưu không thành công: ${e}`,
  mConfirmDelete: name => `Xóa biên bản "${name}"? Thao tác này không hoàn tác được.`,
  mNoFile: "Không đính kèm tệp", mSaving: "Đang lưu…",
  mAttendeesLabel: "Tham dự",
  mTableMissing: "Chưa có bảng biên bản họp. Chạy migrate_v2.sql rồi tải lại trang.",
  mNeedDb: "Chưa nối Supabase — phần biên bản họp cần kết nối để hoạt động."
});

Object.assign(I18N.en, {
  mTab: "Minutes", mTabTip: "Archive of meeting minutes",
  mEyebrow: "Archive", mTitle: "Meeting minutes", mNew: "Add minutes",
  mDate: "Meeting date", mSubject: "Subject", mAttendees: "Attendees",
  mSummary: "Summary and decisions",
  mSubjectPh: "e.g. Weekly progress review",
  mAttendeesPh: "Separate names with commas",
  mSummaryPh: "Key points, decisions and actions",
  mDropMain: "Drop a file here, or <button class='linkbtn' id='minutePick'>choose from your computer</button>",
  mDropSub: "Any format, up to 20 MB",
  mSave: "Save minutes", mDownload: "Download", mDelete: "Delete",
  mEmpty: "No minutes yet. Press \u201cAdd minutes\u201d to start.",
  mNeedDate: "Please choose the meeting date.", mNeedSubject: "Please enter the subject.",
  mTooBig: "The file is larger than 20 MB.",
  mSaved: "Minutes saved", mDeleted: "Minutes deleted",
  mSaveFail: e => `Save failed: ${e}`,
  mConfirmDelete: name => `Delete "${name}"? This cannot be undone.`,
  mNoFile: "No file attached", mSaving: "Saving…",
  mAttendeesLabel: "Attendees",
  mTableMissing: "The minutes table is missing. Run migrate_v2.sql and reload.",
  mNeedDb: "Supabase is not connected — meeting minutes need it to work."
});

const Minutes = (function () {

  const M = { sb: null, items: [], bound: false, loaded: false };

  const q = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  function note(msg, kind) {
    if (typeof toast === "function") toast(msg, kind || "ok");
    else console.log(msg);
  }

  function init(sbClient) { M.sb = sbClient || null; }

  /* Gọi mỗi lần mở tab. Chỉ nạp lần đầu, sau đó dùng lại danh sách đã có. */
  function enter() {
    bindOnce();
    if (!M.loaded) load();
  }

  function load() {
    M.loaded = true;
    return loadMinutes();
  }

  function relabel() { resetMinuteForm(); renderList(); }

  const MAX_FILE = 20 * 1024 * 1024;
  let minuteFile = null;

  async function loadMinutes() {
    const host = q("minuteList");
    if (!host) return;
    if (!M.sb) { host.innerHTML = `<p class="minute-empty">${t("mNeedDb")}</p>`; return; }
    const { data, error } = await M.sb.from("meeting_minutes")
      .select("*").order("meeting_date", { ascending: false });
    if (error) {
      host.innerHTML = `<p class="minute-empty">${t("mTableMissing")}</p>`;
      return;
    }
    M.items = data || [];
    updateCount();
    if (!M.items.length) {
      host.innerHTML = `<p class="minute-empty">${t("mEmpty")}</p>`;
      return;
    }
    host.innerHTML = M.items.map(m => {
      const url = m.file_path
        ? M.sb.storage.from("minutes").getPublicUrl(m.file_path).data.publicUrl : null;
      return `<article class="minute">
        <div class="minute-date">
          <b>${new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-GB",
              { day: "2-digit", month: "short" })}</b>
          <span>${new Date(m.meeting_date + "T00:00:00").getFullYear()}</span>
        </div>
        <div class="minute-body">
          <h3 class="minute-title">${esc(m.title)}</h3>
          ${m.attendees ? `<p class="minute-att"><span>${t("mAttendeesLabel")}:</span> ${esc(m.attendees)}</p>` : ""}
          ${m.summary ? `<p class="minute-sum">${esc(m.summary)}</p>` : ""}
          <div class="minute-foot">
            ${url
              ? `<a class="btn btn-ghost btn-sm" href="${url}" download="${esc(m.file_name || "")}" target="_blank" rel="noopener">
                   <i class="bi bi-download"></i> ${t("mDownload")}
                   <span class="minute-fname">${esc(m.file_name || "")}${m.file_size ? " · " + kb(m.file_size) : ""}</span>
                 </a>`
              : `<span class="minute-nofile">${t("mNoFile")}</span>`}
            <button class="linkbtn minute-del" data-id="${m.id}"
              data-path="${esc(m.file_path || "")}" data-name="${esc(m.title)}">${t("mDelete")}</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

  function resetMinuteForm() {
    minuteFile = null;
    ["mDate", "mSubject", "mAttendees", "mSummary"].forEach(id => { if (q(id)) q(id).value = ""; });
    q("minuteDropMain").innerHTML = t("mDropMain");
    bindMinutePick();
    q("minuteFile").value = "";
  }

  async function saveMinute() {
    if (!M.sb) return note(t("mNeedDb"), "warn");
    const date = q("mDate").value, title = q("mSubject").value.trim();
    if (!date)  return note(t("mNeedDate"), "warn");
    if (!title) return note(t("mNeedSubject"), "warn");

    const btn = q("btnMinuteSave"); btn.disabled = true;
    const label = btn.textContent; btn.textContent = t("mSaving");
    try {
      let path = null, fname = null, fsize = null;
      if (minuteFile) {
        // tên tệp giữ nguyên phần mở rộng, thêm timestamp để không đè nhau
        const safe = minuteFile.name.replace(/[^\w.\-]+/g, "_");
        path = `${date}/${Date.now()}_${safe}`;
        const { error: eUp } = await M.sb.storage.from("minutes")
          .upload(path, minuteFile, { upsert: false });
        if (eUp) throw eUp;
        fname = minuteFile.name; fsize = minuteFile.size;
      }
      const { error } = await M.sb.from("meeting_minutes").insert({
        meeting_date: date, title: title,
        attendees: q("mAttendees").value.trim() || null,
        summary: q("mSummary").value.trim() || null,
        file_path: path, file_name: fname, file_size: fsize,
        uploaded_by: "dashboard"
      });
      if (error) throw error;
      note(t("mSaved"), "ok");
      q("minuteForm").classList.add("d-none");
      resetMinuteForm();
      loadMinutes();
    } catch (e) {
      note(t("mSaveFail")(e.message || e), "err");
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  async function deleteMinute(id, path, name) {
    if (!window.confirm(t("mConfirmDelete")(name))) return;
    try {
      if (path) await M.sb.storage.from("minutes").remove([path]);
      const { error } = await M.sb.from("meeting_minutes").delete().eq("id", id);
      if (error) throw error;
      note(t("mDeleted"), "ok");
      loadMinutes();
    } catch (e) {
      note(t("mSaveFail")(e.message || e), "err");
    }
  }

  function bindMinutePick() {
    const p = q("minutePick");
    if (p) p.addEventListener("click", () => q("minuteFile").click());
  }

  function pickedMinuteFile(f) {
    if (!f) return;
    if (f.size > MAX_FILE) return note(t("mTooBig"), "warn");
    minuteFile = f;
    q("minuteDropMain").innerHTML =
      `<i class="bi bi-file-earmark-check"></i> ${esc(f.name)} · ${kb(f.size)}`;
  }

  function updateCount() {
    const c = q("tabCountMinutes");
    if (c) c.textContent = M.items.length;
  }

  /* Vẽ lại danh sách từ dữ liệu đã có, không gọi lại mạng. Dùng khi đổi ngôn ngữ. */
  function renderList() {
    if (!M.loaded) return;
    loadMinutes();
  }

  function bindOnce() {
    if (M.bound) return; M.bound = true;
    resetMinuteForm();

    q("btnNewMinute").addEventListener("click", () => {
      const f = q("minuteForm");
      f.classList.toggle("d-none");
      if (!f.classList.contains("d-none")) {
        if (!q("mDate").value) q("mDate").value = new Date().toISOString().slice(0, 10);
        q("mSubject").focus();
      }
    });
    q("btnMinuteCancel").addEventListener("click", () => {
      q("minuteForm").classList.add("d-none"); resetMinuteForm();
    });
    q("btnMinuteSave").addEventListener("click", saveMinute);
    q("minuteFile").addEventListener("change", e => pickedMinuteFile(e.target.files[0]));

    const md = q("minuteDrop");
    ["dragenter", "dragover"].forEach(ev => md.addEventListener(ev, e => {
      e.preventDefault(); md.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach(ev => md.addEventListener(ev, e => {
      e.preventDefault(); md.classList.remove("is-over");
    }));
    md.addEventListener("drop", e => pickedMinuteFile(e.dataTransfer.files[0]));

    q("minuteList").addEventListener("click", e => {
      const b = e.target.closest(".minute-del");
      if (b) deleteMinute(b.dataset.id, b.dataset.path, b.dataset.name);
    });
  }

  return { init, load, enter, relabel, count: () => M.items.length };
})();
