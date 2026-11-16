"use strict";
// dshs43.app — js/seat.js: 내 위치 · 자습실 자리 · 자습실 배치도
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 내 위치 ----------
// 수업에 빠진 학생을 세기 쉽도록 각자 지금 있는 곳을 남깁니다 (status.sql). 로그인한 학생 모두가 봐요.
// index.html 은 학생 이름 옆에 <span class="st-loc" data-st="학번"></span> 자리만 두고, 여기서 채웁니다.
const PLACES = ["자습실 자리", "빈백", "하늘마루", "기숙사"];
const STATUS_OLD = 6 * 3600000;   // 이보다 오래된 위치는 흐리게
let statusMap = new Map();
let statusAt = 0;

async function loadStatus(force = false) {
  if (!me || (!force && Date.now() - statusAt < 55000)) return;
  statusAt = Date.now();
  const [st, sh] = await Promise.all([
    sb.from("student_status").select("student_id, location, updated_at"),
    sb.from("seat_shares").select("student_id, public, asked, seat, seat_day"),
  ]);
  if (st.error) return;   // status.sql 을 아직 실행하지 않았으면 위치 없이 보여 줍니다
  statusMap = new Map(st.data.map((r) => [r.student_id, r]));
  seatShares = sh.error ? null : new Map(sh.data.map((r) => [r.student_id, r]));   // null = seats.sql 전
  paintStatus();
  saveSnap();
  loadMySeat();
  if (!askSeatConsent.t) askSeatConsent.t = setTimeout(askSeatConsent, 2500);   // 자리 공개가 꺼져 있으면 켜 달라고 묻기
}

// ---------- 자습실 자리 (seats.sql) ----------
// dshs.app 은 다른 학생의 자리를 주지 않으므로(개인정보처리방침), 각자 자기 기기에서 내 자리(reservation.read.me)를 받아
// seat_shares 에 남깁니다 (dshs-oauth 의 myseat. 학생은 public 만 바꾸고 자리는 서버만 씀).
// 자리는 본인이 보여 주기로 한 학생 것만 보입니다: 위치가 '자습실 자리'이거나 '내 자습실 자리 공개'를 켬 (DB 권한으로 막음).
// 자리는 목요일 밤에 신청해 금요일 15시(한국 시간)부터 한 주 동안 이어지므로, 주에 한 번만 받습니다
// (seat_day = 가장 최근 '금요일 15시'의 금요일 날짜. dshs-oauth 의 seatWeek 와 같은 계산).
let seatShares = new Map();       // 학번 → { public, seat, seat_day } (읽을 수 있는 것만)
let seatNeed = null;              // "relink" · "link" · "error" · "off": 내 자리를 못 받은 이유
let seatAt = 0;
const kstDay = (back = 0) => new Date(Date.now() + 9 * 3600000 - back * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
function seatWeek() {
  const k = new Date(Date.now() + 9 * 3600000);
  let back = (k.getUTCDay() - 5 + 7) % 7;          // 5 = 금요일
  if (back === 0 && k.getUTCHours() < 15) back = 7; // 금요일 15시 전이면 지난주 금요일
  return kstDay(back);
}
const SEAT_PLACE = PLACES[0];     // "자습실 자리"
// 내 자리를 받아야 하는지: 위치가 '자습실 자리'이거나 공개를 켰을 때
const seatWanted = (sid) => statusMap.get(sid)?.location === SEAT_PLACE || !!seatShares?.get(sid)?.public;

async function loadMySeat(force = false) {
  const sid = me?.student_id;
  if (!sid || !seatShares || !seatWanted(sid) || dshs.linked === false) return;
  const sh = seatShares.get(sid);
  // 이번 주 자리를 받았으면 다시 받지 않고, 못 찾았으면(신청 없음) 열 때 한 번 · 그 뒤 10분마다 다시 찾습니다
  if (!force && sh?.seat_day === seatWeek() && (sh.seat || Date.now() - seatAt < 600000)) return;
  if (!force && Date.now() - seatAt < DSHS_GAP) return;
  seatAt = Date.now();
  try {
    const { body } = await dshsCall("myseat");
    if (body.off) { seatAt = Date.now() + 3600000; seatNeed = "off"; }   // 서버가 아직 자리를 받지 않음
    else if (body.linked === false) { dshs.linked = false; seatNeed = "link"; }
    else {
      seatNeed = body.need || (body.error ? "error" : null);
      if (body.error === "busy") seatAt = Date.now() + DSHS_REST - DSHS_GAP;
      if (body.day) seatShares.set(sid, { public: false, ...seatShares.get(sid), student_id: sid, seat: body.seat || null, seat_day: body.day });
    }
  } catch { seatAt = 0; seatNeed = "error"; }
  paintStatus();
  saveSnap();
}

// 그 학생의 보이는 자리 (본인이 보여 주기로 했을 때만. 다른 학생 것은 DB 가 이미 걸러 줌)
const seatInfo = (sid) => {
  const sh = seatShares?.get(sid);
  return sh?.seat && seatWanted(sid) ? sh : null;
};
// 누르면 자습실 배치도에 그 자리를 표시한 창을 띄웁니다. 배치도에 없는 자리(세미나실 s… 등)는 창 없이 dshs.app 좌석 배치도로 갑니다.
const seatUrl = (seat, day) => `https://dshs.app/reserve/${encodeURIComponent(day)}?goto=${encodeURIComponent(seat)}`;
const seatLink = (sh) => `<a class="st-seat" href="${seatUrl(sh.seat, sh.seat_day)}" target="_blank" rel="noopener"
  data-seat="${esc(sh.seat)}" data-day="${esc(sh.seat_day)}" onclick="return seatClick(event, this)">${esc(sh.seat)}</a>`;
// 위치 글자: '자습실 자리'면 '자습실 a101', 아니면 위치 그대로
const locHtml = (r) => {
  const sh = seatInfo(r.student_id);
  return r.location === SEAT_PLACE && sh ? `자습실 ${seatLink(sh)}` : esc(r.location);
};
// 위치가 '자습실 자리'가 아닌데 자리를 공개한 학생: 위치 뒤(또는 위치 없이) 자리 아이콘 a101
const seatChip = (sid) => {
  const sh = seatInfo(sid);
  return sh && statusMap.get(sid)?.location !== SEAT_PLACE ? `<span class="st-chip">${icon("event_seat")} ${seatLink(sh)}</span>` : "";
};
// ---------- 자습실 배치도 ----------
// seat-a.jpg · seat-b.jpg 는 자습실 평면도(가운데 세미나실 · 계단을 빼고 A · B 두 곳으로 자름) 이고,
// 아래 좌표는 그 그림의 픽셀 위치입니다. 자리 이름 a412 = A 자습실 4구역 412번 (백의 자리가 구역).
const SEAT_HALLS = (() => {
  const halls = { a: { img: "seat-a.jpg", w: 1150, h: 736, name: "A", seats: {} }, b: { img: "seat-b.jpg", w: 1005, h: 736, name: "B", seats: {} } };
  const put = (hall, area, list, dx = 0) => list.forEach(([x, y], i) => { halls[hall].seats[area * 100 + i + 1] = [x - dx, y]; });
  const row = (n, x0, step, y) => Array.from({ length: n }, (_, i) => [x0 + step * i, y]);
  const grid = (xs, ys) => xs.flatMap((x) => ys.map((y) => [x, y]));   // 열마다 위에서 아래로
  // A 자습실
  put("a", 1, row(15, 96, 46.9, 38));
  put("a", 2, [[195, 185], [212, 207], [247, 150], [265, 172], [312, 117], [317, 142], [380, 97], [382, 122], [442, 97],
    [510, 97], [577, 95], [575, 120], [640, 117], [635, 142], [702, 147], [690, 170], [757, 187], [740, 210]]);
  put("a", 3, [[320, 287], [357, 265], [390, 252], [430, 242], [525, 242], [562, 252], [595, 265], [627, 285]]);
  put("a", 4, grid([317, 390, 440, 510, 562, 632], [380, 412, 445]));
  put("a", 5, [297, 327, 385, 415, 452, 485, 542, 572, 615, 645].map((x) => [x, 497]));
  put("a", 6, [[242, 572], [242, 607], [307, 572], [307, 607], [362, 572], [422, 572], [362, 607], [422, 607],
    [480, 572], [540, 572], [480, 607], [540, 607], [597, 572], [597, 607], [657, 590]]);
  put("a", 7, grid([807, 837, 865, 907, 937, 978, 1008, 1037], [560, 630]));
  put("a", 8, row(23, 71, 47.1, 693));
  // B 자습실 (원래 평면도에서 x 1400 부터 잘랐으므로 1400 을 뺍니다)
  const B = 1400;
  put("b", 1, row(14, 1550, 46.9, 38), B);
  put("b", 2, [[1651, 129], [1680, 140], [1627, 188], [1655, 201], [1605, 238], [1632, 248], [1582, 294], [1607, 307]], B);
  put("b", 3, [[1887, 118], [1887, 140], [1957, 134], [1941, 159], [1992, 159], [2060, 193], [1982, 183], [2044, 218],
    [2104, 221], [2088, 244], [2163, 259], [2147, 282]], B);
  put("b", 4, [[1807, 191], [1860, 226], [1910, 251], [1963, 288]], B);
  put("b", 5, [[1717, 326], [1792, 323], [1854, 326], ...[1704, 1736, 1767, 1801, 1832, 1870, 1901, 1932].map((x) => [x, 386])], B);
  put("b", 6, [1673, 1742, 1817, 1886, 1967, 2036].map((x) => [x, 463]), B);
  put("b", 7, [1501, 1532, 1570, 1604, 1686, 1754, 1807, 1876, 1926, 1995, 2045, 2117]
    .flatMap((x, i) => (i < 4 ? [[x, 564], [x, 632]] : [[x, 583], [x, 614]])), B);   // 홀수 위 · 짝수 아래
  put("b", 8, row(19, 1478, 46.8, 693), B);
  put("b", 9, [160, 213, 267, 320].map((y) => [1497, y]), B);
  return halls;
})();

function seatSpot(seat) {
  const m = /^([ab])(\d{3})$/i.exec(String(seat || "").trim());
  if (!m) return null;
  const hall = SEAT_HALLS[m[1].toLowerCase()], p = hall.seats[+m[2]];
  return p ? { hall, num: m[2], x: p[0], y: p[1] } : null;
}

window.seatClick = (e, a) => {
  e.stopPropagation();
  if (!openSeatMap(a.dataset.seat, a.dataset.day)) return true;   // 배치도에 없는 자리는 링크대로
  e.preventDefault();
  return false;
};

// 수업 팝업(z-index 1000) 위에서도 보이도록 따로 된 창을 씁니다
function openSeatMap(seat, day) {
  const s = seatSpot(seat);
  if (!s) return false;
  const { hall } = s;
  const scale = 0.62;   // 휴대폰에서도 자리 번호 줄이 보이게 줄이고, 옆으로 밀어 봅니다
  const box = document.createElement("div");
  box.className = "study-modal show seat-modal";
  box.innerHTML = `<div class="study-sheet seat-sheet">
    <div class="study-sheet-head"><div class="sheet-title">자습실 ${hall.name} · ${esc(s.num)}번 자리</div><button class="study-x">✕</button></div>
    <div class="seat-scroll"><div class="seat-stage" style="width:${Math.round(hall.w * scale)}px">
      <img src="${hall.img}" width="${hall.w}" height="${hall.h}" alt="자습실 ${hall.name} 배치도">
      <span class="seat-pin" style="left:${(s.x / hall.w) * 100}%;top:${(s.y / hall.h) * 100}%"></span>
    </div></div>
    <a class="study-submit ghost seat-out" href="${seatUrl(seat, day)}" target="_blank" rel="noopener">dshs.app 좌석 배치도에서 보기</a>
  </div>`;
  const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  box.querySelector(".study-x").onclick = close;
  box.onclick = (e) => { e.stopPropagation(); if (e.target === box) close(); };
  document.addEventListener("keydown", onKey);
  document.body.appendChild(box);
  // 표시한 자리가 가운데 오도록 밀어 둡니다
  const sc = box.querySelector(".seat-scroll");
  requestAnimationFrame(() => { sc.scrollLeft = s.x * scale - sc.clientWidth / 2; });
  return true;
}
// 화면을 보는 동안 1분마다 새로 받습니다
function watchStatus() {
  const tick = () => { if (me && !otherCohort() && !document.hidden) loadStatus(); };
  setInterval(tick, 60000);
  document.addEventListener("visibilitychange", tick);
}

function whenLabel(iso) {
  const d = new Date(iso), now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  return dayKey(d) === dayKey(now) ? hm(d) : `${md(d)} ${hm(d)}`;
}

function paintStatus(root = document) {
  root.querySelectorAll("[data-st]").forEach((el) => {
    const sid = +el.dataset.st;
    const mine = sid === me?.student_id && $("myStatus");   // 내 위치 · 자리는 위의 내 위치 줄에
    const r = me && !mine ? statusMap.get(sid) : null;
    const chip = me && !mine ? seatChip(sid) : "";
    el.innerHTML = (r ? `${icon("location_on")} ${locHtml(r)} <small>${whenLabel(r.updated_at)}</small>` : "") + (r && chip ? " " : "") + chip;
    el.classList.toggle("old", !!r && !chip && Date.now() - new Date(r.updated_at) > STATUS_OLD);
  });
  paintMyStatus();
}

function paintMyStatus() {
  const box = $("myStatus");
  if (!box) return;
  if (!me?.student_id) { box.remove(); return; }
  const sid = me.student_id, r = statusMap.get(sid);
  box.innerHTML = `<span class="ms-label">${icon("location_on")} 내 위치</span>
    <b>${r ? locHtml(r) : "아직 안 정했어요"}</b>${r ? `<small>${whenLabel(r.updated_at)} 수정</small>` : ""}${seatChip(sid)}
    <button class="ms-btn" id="msEdit" type="button" aria-label="내 위치 ${r ? "바꾸기" : "정하기"}" title="내 위치 ${r ? "바꾸기" : "정하기"}">${icon("location_on")}${icon("autorenew", "ms-turn")}</button>
    <span class="ms-bar" aria-hidden="true"></span>
    <button class="ms-btn" id="msMail" type="button" aria-label="프로필 사진 이메일 ${myMail ? "바꾸기" : "등록"}" title="프로필 사진 이메일 ${myMail ? "바꾸기" : "등록"}">${icon("mail")}${icon("autorenew", "ms-turn")}</button>
    ${seatWanted(sid) && !seatInfo(sid) ? seatNote() : ""}`;
  $("msEdit").onclick = openStatusPicker;
  $("msMail").onclick = openMailForm;
  if ($("msRelink")) $("msRelink").onclick = startDshs;
}

// 자리를 보여 주기로 했는데 자리 번호가 없을 때, 왜 없는지 내 위치 줄에 알려 줍니다
function seatNote() {
  if (!seatShares || seatNeed === "off") return "";   // seats.sql 전이거나 서버가 자리를 받지 않음
  if (seatNeed === "relink") return `<button class="ms-relink" id="msRelink">dshs.app 을 다시 연결하면 자습실 자리가 함께 보여요</button>`;
  if (seatNeed === "link" || dshs.linked === false) return `<button class="ms-relink" id="msRelink">dshs.app 을 연결하면 자습실 자리가 함께 보여요</button>`;
  if (seatNeed === "error") return `<span class="ms-note">자리를 아직 못 받았어요. 잠시 뒤 다시 받아요</span>`;
  if (seatShares.get(me.student_id)?.seat_day === seatWeek())
    return `<a class="ms-note" href="https://dshs.app/reserve/${seatWeek()}" target="_blank" rel="noopener">dshs.app 에 이번 주 신청한 자습실 자리를 찾지 못했어요</a>`;
  return `<span class="ms-note">자습실 자리를 받는 중이에요</span>`;
}

function openStatusPicker() {
  const cur = statusMap.get(me.student_id)?.location || "";
  const custom = cur && !PLACES.includes(cur) ? cur : "";
  openSheet("내 위치", `
    <div class="place-opts">${PLACES.map((p) =>
      `<button type="button" class="study-btn${p === cur ? " primary" : ""}" data-place="${esc(p)}">${p}</button>`).join("")}</div>
    <label class="study-label">직접 입력</label>
    <div class="place-custom">
      <input class="study-input" id="plIn" maxlength="30" placeholder="예: 도서관, 보건실, 물리실험실" value="${esc(custom)}">
      <button type="button" class="study-btn primary" id="plSave">저장</button>
    </div>
    <div class="study-err" id="authErr"></div>
    ${cur ? '<button class="study-submit ghost" id="plClear">위치 지우기</button>' : ""}
    <div class="study-foot">로그인한 친구들이 볼 수 있어요. 고친 시각도 함께 보여요.
      '자습실 자리'로 정하면 dshs.app 에서 신청한 이번 주 자리(예: a101)도 함께 보여요.
      위치와 상관없이 자리를 보여 주려면 설정에서 '자습실 자리 공개'를 켜세요.</div>`);
  $("studyModal").querySelectorAll("[data-place]").forEach((b) => b.onclick = () => saveStatus(b.dataset.place));
  $("plSave").onclick = () => {
    const v = $("plIn").value.trim();
    if (!v) return showErr("위치를 입력해 주세요.");
    saveStatus(v);
  };
  $("plIn").onkeydown = (e) => { if (e.key === "Enter") $("plSave").click(); };
  if ($("plClear")) $("plClear").onclick = () => saveStatus(null);
}

// '자습실 자리 공개' 켜고 끄기 (seat_shares.public. 자리 자체는 서버가 채움). 저장했으면 true.
// 동의 창에 답한 것도 함께 남깁니다(asked) → 계정마다 한 번만 묻습니다.
async function saveSeatPublic(on, quiet = false) {
  const sid = me.student_id;
  const { error } = await sb.from("seat_shares").upsert({ student_id: sid, public: on, asked: true });
  if (error) { toast("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요", true); return false; }
  seatShares.set(sid, { seat: null, seat_day: null, ...seatShares.get(sid), student_id: sid, public: on, asked: true });
  if (!quiet) toast(on ? "내 자습실 자리를 공개했어요" : "내 자습실 자리 공개를 껐어요");
  paintStatus();
  saveSnap();
  if (on) loadMySeat(true);
  return true;
}

// 자리 공개가 꺼져 있으면 동의 창으로 켜 달라고 묻습니다. '공개하지 않기'를 골라도 꺼져 있는 동안은
// 이 기기에서 하루 한 번 다시 묻습니다(SEAT_ASK_KEY). 설정의 '자습실 자리 공개'에서도 켜고 끕니다.
const SEAT_ASK_KEY = "dshs-seat-ask";
function askSeatConsent() {
  const sid = me?.student_id, sh = seatShares?.get(sid);
  if (!sid || me.is_admin || otherCohort() || !seatShares || sh?.public || askSeatConsent.shown) return;
  const today = dayKey(new Date());
  try { if (localStorage.getItem(SEAT_ASK_KEY) === today) return; } catch {}
  // 업데이트 소식 · 다른 창이 떠 있으면 닫힐 때까지 기다립니다
  const busy = () => ["studyModal", "updModal"].some((id) => $(id)?.classList.contains("show"));
  if (busy() || document.hidden) { clearTimeout(askSeatConsent.t); askSeatConsent.t = setTimeout(askSeatConsent, 3000); return; }
  askSeatConsent.shown = true;
  try { localStorage.setItem(SEAT_ASK_KEY, today); } catch {}
  openSheet("자습실 자리 공개", `<div class="seat-ask">
    <div class="asg-body">dshs.app 에서 신청한 내 자습실 자리(예: a101)를 친구들에게 보여 줄까요?</div>
    <ul>
      <li>로그인한 43기 학생이 내 이름 옆과 시간표 검색에서 내 자리를 볼 수 있어요</li>
      <li>자리는 매주 금요일 15시에 새로 신청한 자리로 바뀌어요</li>
      <li>dshs.app 계정이 연결돼 있어야 자리를 받아 올 수 있어요</li>
      <li>나중에 설정에서 언제든 끌 수 있어요</li>
    </ul>
    <button class="study-submit" id="saYes">동의하고 공개하기</button>
    <button class="study-submit ghost" id="saNo">공개하지 않기</button>
  </div>`);
  const answer = async (on, btn) => {
    btn.disabled = true;
    if (!(await saveSeatPublic(on, !on))) { btn.disabled = false; return; }
    closeModal();
    if (!on) toast("공개하지 않아요. 설정에서 언제든 켤 수 있어요");
  };
  $("saYes").onclick = (e) => answer(true, e.target);
  $("saNo").onclick = (e) => answer(false, e.target);
}

// 설정 창의 '자습실 자리 공개' 줄
function seatSettingHtml() {
  if (!seatShares || !me?.student_id) return "";
  return `<label class="set-row"><span><b>자습실 자리 공개</b><span class="ev-hint">켜면 로그인한 친구들이 dshs.app 에 신청한 내 자습실 자리를 볼 수 있어요</span></span>
    <input type="checkbox" id="setSeat"${seatShares.get(me.student_id)?.public ? " checked" : ""}></label>`;
}
function bindSeatSetting() {
  const box = $("setSeat");
  if (!box) return;
  box.onchange = async () => {
    box.disabled = true;
    if (!(await saveSeatPublic(box.checked))) box.checked = !box.checked;
    box.disabled = false;
  };
}

async function saveStatus(loc) {
  const { error } = loc
    ? await sb.from("student_status").upsert({ student_id: me.student_id, location: loc })
    : await sb.from("student_status").delete().eq("student_id", me.student_id);
  if (error) return showErr(/relation|does not exist|schema cache/i.test(error.message)
    ? "위치 기능은 아직 준비 중이에요." : "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (loc) statusMap.set(me.student_id, { student_id: me.student_id, location: loc, updated_at: new Date().toISOString() });
  else statusMap.delete(me.student_id);
  if (loc === SEAT_PLACE) loadMySeat(true);
  closeModal(); paintStatus();
  toast(loc ? `내 위치: ${loc}` : "위치를 지웠어요");
  loadStatus(true);
}
// 로그인 직후 첫 화면: 학생은 내 시간표, 관리자 계정은 관리자 사이트 안내, 다른 기수 학생은 그 기수 사이트 안내
const openHome = () => (me.is_admin ? openAdminMoved() : otherCohort() ? openOtherCohort() : openStudy("tt"));

async function logout() {
  await forgetPush();   // 이 기기로 다음 사람의 알림이 오지 않도록, 로그아웃하기 전에 서버 등록만 지웁니다
  await sb.auth.signOut({ scope: "local" });   // 이 기기만 (기본값 global 은 그 학생의 다른 기기 · 다른 기수 사이트 로그인까지 모두 끊음)
  silentState({ off: true });   // 직접 로그아웃했으면 조용한 로그인으로 다시 들어가지 않게
  autoPush.done = false;   // 다음에 로그인하는 사람의 알림을 다시 맞춥니다
  paintPush.known = false;
  statusMap = new Map(); statusAt = 0;
  seatShares = new Map(); seatAt = 0; seatNeed = null;
  me = null; myClasses = []; dshs = dshsEmpty(); closeStudy(); renderNav();
  toast("로그아웃했어요");
}
