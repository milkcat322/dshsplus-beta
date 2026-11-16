"use strict";
// dshs43.app — js/dshs-login.js: 조용한 로그인 · 앱에서 dshs.app 로그인 · 학생 명단
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 조용한 로그인 ----------
// 아이폰 · 아이패드는 홈 화면 앱과 Safari(또는 다른 브라우저)의 저장소가 따로라, 앱에서 로그인해 두어도 Safari 로 열면
// 로그아웃된 것처럼 보입니다. 로그인 기록이 없는 브라우저에서 열면 dshs.app 에 prompt=none 으로 한 번 다녀와서,
// 그 브라우저에 dshs.app 로그인이 살아 있으면 화면 없이 바로 로그인합니다 (이미 계정이 있는 학생만. dshs-oauth 의 silent).
// - 홈 화면 앱에서는 하지 않습니다 (다른 사이트로 가면 앱 안에 브라우저 창이 떠서 '조용히'가 안 됨)
// - 그 브라우저에서 하루 한 번만 (로그인 안 하는 방문자가 매번 다녀오지 않게 · dshs.app 요청 한도)
// - 이 브라우저에서 로그아웃했으면 다시 로그인할 때까지 하지 않습니다
const SILENT_KEY = "dshs-silent";       // localStorage { day, off }
const SILENT_BACK = "dshs-silent-back"; // sessionStorage: 다녀오기 전 주소의 ?… (알림 링크 등)
function silentState(patch) {
  try {
    const st = JSON.parse(localStorage.getItem(SILENT_KEY) || "{}");
    if (!patch) return st;
    localStorage.setItem(SILENT_KEY, JSON.stringify({ ...st, ...patch }));
    return JSON.parse(localStorage.getItem(SILENT_KEY));
  } catch { return null; }
}
async function silentLogin() {
  if (isInstalledApp() || inKakao() || !navigator.onLine || silentReturned.back) return false;
  if (new URLSearchParams(location.search).get("dshs") || /dshs_login=/.test(location.hash)) return false;
  const today = dayKey(new Date()), st = silentState();
  if (!st || st.off || st.day === today) return false;
  if (silentState({ day: today })?.day !== today) return false;   // 저장이 안 되는 브라우저(사생활 보호 등)는 열 때마다 다녀오게 되므로 하지 않음
  try {
    sessionStorage.setItem(SILENT_BACK, location.search);
    const { body } = await dshsCall("login", { return_to: location.origin + location.pathname, silent: true });
    if (body.silent === true && body.url) { location.replace(body.url); return true; }
  } catch { }
  return false;
}
// 돌아오면(?dshs=silent) 다녀오기 전 주소로 바꿉니다. 성공했으면 # 뒤의 일회용 토큰은 그대로 둡니다.
function silentReturned() {
  if (new URLSearchParams(location.search).get("dshs") !== "silent") return;
  silentReturned.back = true;
  let q = "";
  try { q = sessionStorage.getItem(SILENT_BACK) || ""; sessionStorage.removeItem(SILENT_BACK); } catch { }
  history.replaceState(null, "", location.pathname + q + location.hash);
}

async function dshsCall(action, extra) {
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(DSHS_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CFG.SUPABASE_ANON_KEY, Authorization: `Bearer ${session?.access_token || CFG.SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ action, ...extra }),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

// 내 일정이 화면에 보이는 동안 1분에 한 번 새로 받습니다.
// 요청 제한(60초 120회)이 사이트 전체 합산이라, 한도를 넘었다는 응답이 오면 5분 쉽니다.
const DSHS_GAP = 55000;   // 1분 타이머가 조금 일찍 울려도 건너뛰지 않도록 1분보다 살짝 짧게
const DSHS_REST = 5 * 60000;
const calOpen = () => $("studyView").style.display === "block" && view === "feed";

async function loadDshs({ force = false } = {}) {
  if (!force && Date.now() - dshs.at < DSHS_GAP) return;
  if (!sb) await sbWait;
  dshs.at = Date.now();
  const before = JSON.stringify([dshs.linked, dshs.items]);
  try {
    const { body } = await dshsCall("requests");
    if (typeof body.linked !== "boolean") throw new Error();
    if (body.expired && dshs.linked) toast("dshs.app 연결이 만료됐어요. 다시 연결해 주세요", true);
    dshs.linked = body.linked;
    dshs.name = body.name || null;
    if (!body.linked) dshs.items = [];
    else if (body.items) dshs.items = body.items;   // 잠깐 못 받으면 지난번 목록을 그대로 둡니다
    if (body.error === "busy") dshs.at = Date.now() + DSHS_REST - DSHS_GAP;
  } catch { dshs.at = 0; return; }   // 못 받으면 신청 내역 없이 달력만 보여 줍니다
  if (JSON.stringify([dshs.linked, dshs.items]) === before) return;   // 바뀐 게 없으면 보던 화면을 건드리지 않습니다
  paintDshs();
  if (calOpen()) rerender();
}

// 연결한 학생만 받습니다. 앱으로 돌아오면 바로, 켜 둔 동안에는 1분마다.
function watchDshs() {
  const tick = () => { if (me && dshs.linked && !document.hidden && calOpen()) loadDshs(); };
  setInterval(tick, 60000);
  document.addEventListener("visibilitychange", tick);
}

const dshsItems = () => (dshs.linked ? dshs.items.filter((r) => r.status !== "rejected") : []);

// 아직 연결하지 않은 학생에게만 내 일정 위에 안내를 띄웁니다. 닫으면 이 기기에서는 다시 뜨지 않고, 계정에서 연결할 수 있어요.
const DSHS_HINT_KEY = "dshs-link-hint-off";
function dshsHintOff() {
  try { return localStorage.getItem(DSHS_HINT_KEY) === "1"; } catch { return false; }
}
function paintDshs() {
  const box = $("dshsHint");
  if (!box) return;
  if (dshs.linked !== false || !me?.student_id || dshsHintOff()) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="dshs-hint">
    <span>dshs.app을 연결하면 내 신청이 달력에 자동으로 보여요</span>
    <button class="study-btn small ok" id="dshsHintGo">연결</button>
    <button class="study-x" id="dshsHintX" aria-label="닫기">✕</button>
  </div>`;
  $("dshsHintGo").onclick = openSettings;
  $("dshsHintX").onclick = () => {
    try { localStorage.setItem(DSHS_HINT_KEY, "1"); } catch { }
    box.innerHTML = "";
  };
}

// 날짜만 정한 신청은 시작 = 끝 → 그날 종일 일정
const dshsAllDay = (r) => r.from === r.to;
function dshsAgenda() {
  const now = new Date();
  return dshsItems().map((r) => {
    const at = new Date(r.from), allDay = dshsAllDay(r), end = allDay ? null : new Date(r.to);
    return {
      kind: "dshs", id: r.uid, title: r.title, at, end, allDay, color: "dshs", status: r.status,
      done: eventEnd({ starts_at: r.from, ends_at: end && r.to, all_day: allDay }) < now,
      tag: [DSHS_STATUS[r.status], r.room].filter(Boolean).join(" · "),
    };
  });
}

function openDshsDetail(r) {
  if (!r) return;
  const when = schoolWhen({ starts_at: r.from, ends_at: dshsAllDay(r) ? null : r.to, all_day: dshsAllDay(r) });
  const info = [r.form !== r.title && r.form, r.category, r.room, r.count > 1 && `${r.count}명 참여`].filter(Boolean);
  openSheet("dshs.app 신청", `
    <div class="shared-card c-dshs">
      <div class="ev-title">${esc(r.title)}</div>
      <div class="ev-meta">${esc(when)} · ${DSHS_STATUS[r.status] || ""}</div>
      ${info.length ? `<div class="asg-body">${info.map(esc).join("<br>")}</div>` : ""}
    </div>
    <div class="study-foot">dshs.app 에서 가져온 신청이에요. 바꾸거나 취소하려면 dshs.app 에서 해 주세요.</div>
    <a class="study-btn wide" href="https://dshs.app" target="_blank" rel="noopener">dshs.app 열기</a>`);
}

// 화면 테마 (index.html 의 applyTheme 이 실제로 바꿉니다)
// [이름, 표시 이름, 미리보기 배경, 미리보기 강조색]. 고른 적이 없으면 기기 설정(다크 · 라이트)을 따릅니다.
const THEMES = [
  ["dark", "다크", "#0a0a0f", "#7c6fe0"],
  ["light", "라이트", "#f5f5fa", "#6a5cd6"],
  ["simple", "심플", "#ffffff", "#0076c0"],
  ["ocean", "바다", "#07111b", "#3fa7e0"],
  ["forest", "숲", "#0a120d", "#5fbf7a"],
  ["coco", "코코", "#f2f7f3", "#2f9a52"],
  ["sakura", "벚꽃", "#fbf3f6", "#d0577f"],
];
const THEME_KEY = "dshs-theme";
const curTheme = () => document.documentElement.dataset.theme || "dark";   // applyTheme 이 정한 지금 테마
function themeHtml() {
  return `<div class="set-row" style="display:block"><b>화면 테마</b>
    <span class="ev-hint">고르지 않으면 기기 설정(다크 · 라이트)을 따라가요</span>
    <div class="theme-grid">${THEMES.map(([k, label, bg, ac]) =>
    `<button type="button" data-theme-pick="${k}"${curTheme() === k ? ' class="on"' : ""}><i style="background:linear-gradient(135deg, ${bg} 50%, ${ac} 50%)"></i>${label}</button>`).join("")}</div></div>`;
}
function bindTheme() {
  $("studyModal").querySelectorAll("[data-theme-pick]").forEach((b) => b.onclick = () => {
    try { localStorage.setItem(THEME_KEY, b.dataset.themePick); } catch { }
    window.applyTheme?.();
    $("studyModal").querySelectorAll("[data-theme-pick]").forEach((x) => x.classList.toggle("on", x === b));
  });
}

// 설정: 알림 · 학교 일정 보이기 · 화면 테마 · 계정(로그아웃과 dshs.app 연결 관리)
function openSettings() {
  if (!me) {   // 로그인 전: 화면 테마와 로그인 안내 (제목 7번 → 관리자 로그인)
    openSheet("설정", `
      ${themeHtml()}
      ${homeGuideHtml()}
      <div class="asg-body" style="margin-top:14px">dshs.app 계정으로 시작하면 알림 · 내 일정 달력 설정과 계정을 여기서 관리할 수 있어요. 따로 가입할 필요 없어요.</div>
      <button class="study-submit dshs-login" id="doDshsLogin">dshs.app 계정으로 시작하기</button>
      <div class="study-err" id="authErr"></div>
      ${adminLinkHtml()}`);
    $("doDshsLogin").onclick = loginWithDshs;
    bindAdminLink();
    bindTheme();
    bindHomeGuide();
    return bindAdminTap();
  }
  openSheet("설정", `
    <label class="set-row"><span><b>알림</b><span class="ev-hint" id="pushHint">${PUSH_HINT}</span></span>
      <input type="checkbox" id="setPush"></label>
    ${homeGuideHtml()}
    ${seatSettingHtml()}
    ${themeHtml()}
    <div class="set-sec">내 일정 달력</div>
    ${calSettingsHtml()}
    <div class="set-sec">계정</div>
    <div class="ev-title">${esc(me.name)}</div>
    <div class="ev-meta">${esc(me.username)}</div>
    <div id="dshsLinkBox">${dshsLinkHtml()}</div>
    <button class="study-btn wide" id="doLogout">로그아웃</button>`);
  $("setPush").onchange = togglePush;
  paintPush(); refreshPush();
  bindSeatSetting();
  bindCalSettings();
  bindDshsLink();
  // 연결 상태를 아직 모르면(일정 탭을 열기 전) 서버에 물어보고 그 칸만 다시 그립니다
  if (dshs.linked === null) loadDshs({ force: true }).then(() => {
    const box = $("dshsLinkBox");
    if (!box) return;
    box.innerHTML = dshs.linked === null ? `<div class="study-foot" style="text-align:left">지금은 dshs.app 연결을 확인하지 못했어요. 잠시 뒤 설정을 다시 열어 주세요.</div>` : dshsLinkHtml();
    bindDshsLink();
  });
  $("doLogout").onclick = () => { closeModal(); logout(); };
  bindTheme();
  bindHomeGuide();
  bindAdminTap();
}

// 설정 창의 연결 버튼, 또는 내 위치 줄의 '다시 연결' 버튼
async function startDshs(e) {
  const btn = e?.currentTarget || $("doDshs");
  btn.disabled = true;
  try {
    const handoff = newHandoff();
    const { body } = await dshsCall("start", { return_to: location.origin + location.pathname, handoff });
    if (body.url) { openDshsLogin(body.url, handoff); return; }
    toast(body.error || "dshs.app 연결을 시작하지 못했어요", true);
  } catch { toast("dshs.app 연결을 시작하지 못했어요", true); }
  btn.disabled = false;
}

// 설정의 dshs.app 연결 칸. 연결 상태를 아직 모르면(linked: null) '확인하는 중'으로 두고, 연결 버튼을 띄우지 않습니다
function dshsLinkHtml() {
  if (dshs.linked === null) return `<div class="study-foot" style="text-align:left">dshs.app 연결을 확인하는 중이에요…</div>`;
  return dshs.linked
    ? `<div class="asg-body">dshs.app ${dshs.name ? `${esc(dshs.name)} 계정과 ` : ""}연결돼 있어요. 진행 중인 내 신청 ${dshsItems().length}건이 달력에 보여요.</div>
       <div class="study-foot">내 일정을 보는 동안 1분마다 새로 받아 와요. 연결을 해제하면 이 사이트에 저장된 dshs.app 로그인 정보가 지워져요.</div>
       <button class="study-btn wide" id="dshsUnlink">dshs.app 연결 해제</button>`
    : `<div class="asg-body">dshs.app 계정을 연결하면 내가 낸 신청이 내 일정 달력에 자동으로 보여요.</div>
       <div class="study-foot">dshs.app 로그인 화면에서 로그인하고 동의하면 돼요. 비밀번호는 이 사이트에 전달되지 않아요.<br>
         신청 내역은 보기만 할 수 있고, 신청 · 변경은 dshs.app 에서 해요.</div>
       <button class="study-submit" id="doDshs">dshs.app으로 로그인해서 연결</button>`;
}
function bindDshsLink() {
  if ($("doDshs")) $("doDshs").onclick = startDshs;
  if ($("dshsUnlink")) $("dshsUnlink").onclick = unlinkDshs;
}

async function unlinkDshs() {
  if (!confirm("dshs.app 연결을 해제할까요? 달력에서 신청 내역이 사라져요.")) return;
  try {
    const { ok } = await dshsCall("unlink");
    if (!ok) throw new Error();
  } catch { return toast("연결을 해제하지 못했어요", true); }
  dshs = { ...dshsEmpty(), linked: false, at: Date.now() };
  seatNeed = null;
  closeModal(); paintDshs(); paintStatus();
  if (calOpen()) rerender();
  toast("dshs.app 연결을 해제했어요");
}

// 'dshs.app으로 로그인' (로그인 전 화면). 돌아오면 init 이 주소의 일회용 토큰으로 세션을 만듭니다.
async function loginWithDshs() {
  $("doDshsLogin").disabled = true;
  logLogin("click", "sheet");
  let why = "net";
  try {
    const handoff = newHandoff();
    const { ok, body } = await dshsCall("login", { return_to: location.origin + location.pathname, handoff });
    if (body.url) {
      await logLeave(leaveHow(handoff));
      openDshsLogin(body.url, handoff);
      if (handoff && $("doDshsLogin")) $("doDshsLogin").disabled = false;   // 로그인 창을 그냥 닫았으면 다시 누를 수 있게 둡니다
      return;
    }
    why = ok ? "nourl" : "server";
  } catch { }
  logLogin("start_fail", why);
  showErr("dshs.app 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  $("doDshsLogin").disabled = false;
}

// 시작하기 화면의 '로그인': 로그인 창을 거치지 않고 바로 dshs.app 로그인을 시작합니다 (화면 모양은 그대로).
// 시작하지 못하면 로그인 창을 열어 아이디 로그인 · 다시 시도를 할 수 있게 합니다.
async function gateLogin() {
  const b = $("gateLogin");
  b.disabled = true;
  const logged = logGate("click");
  logLogin("click", "gate");
  let why = "net";
  try {
    const handoff = newHandoff();
    const { ok, body } = await dshsCall("login", { return_to: location.origin + location.pathname, handoff });
    if (body.url) {
      await Promise.race([logged, new Promise((ok) => setTimeout(ok, 600))]);   // 이 창을 떠나기 전에 기록을 보냅니다
      await logLeave(leaveHow(handoff));
      openDshsLogin(body.url, handoff);
      b.disabled = false;
      return;
    }
    why = ok ? "nourl" : "server";
  } catch { }
  logLogin("start_fail", why);
  b.disabled = false;
  openAuth();
  showErr("dshs.app 로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

// ---------- 앱(홈 화면에 추가)에서 dshs.app 로그인 ----------
// 앱에서는 dshs.app 로그인 화면이 다른 브라우저 창(팝업)에서 열려, 그 창으로 돌아온 로그인은 앱에 남지 않습니다.
// 그래서 앱만 아는 임의 값(handoff)을 함께 보내고, 로그인 창에는 "앱으로 돌아가세요"만 띄운 뒤
// 앱이 Edge Function 에서 결과(일회용 로그인 토큰)를 받아 앱에서 로그인하고, 로그인 창은 닫습니다.
// 이 값은 앱 창의 메모리에만 두어 팝업은 모릅니다. 새 창을 못 열어 이 창에서 로그인 화면으로 갈 때만
// sessionStorage 에 남겨, 돌아온 뒤 이어서 받습니다 (새 창은 열 때 sessionStorage 를 복사해 가므로 그 전에는 쓰지 않음).
const DSHS_HAND_KEY = "dshs-handoff";
const DSHS_HAND_TTL = 10 * 60000;   // 서버의 로그인 요청 유효 시간과 같음
const isInstalledApp = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function newHandoff() {
  if (!isInstalledApp()) return undefined;
  const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/[+/=]/g, "");
  waitHandoff.h = { key, at: Date.now() };
  try { sessionStorage.removeItem(DSHS_HAND_KEY); } catch { }
  return key;
}

// 카카오톡 안 브라우저: dshs.app 로그인(Google 로그인)을 Google 이 앱 안 브라우저에서 막으므로 기본 브라우저로 엽니다.
// (index.html 이 열 때도 한 번 기본 브라우저로 보냄. 그게 안 됐을 때 로그인 버튼에서 다시)
const inKakao = () => /KAKAOTALK/i.test(navigator.userAgent);
const leaveHow = (handoff) => (inKakao() ? "kakao" : handoff ? "popup" : "page");   // 로그인 이탈 기록용
const kakaoOutside = (url) => `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;

// 앱: 로그인 화면을 새 창으로 열어 두었다가, 로그인이 끝나면 앱이 그 창을 닫습니다.
function openDshsLogin(url, handoff) {
  if (inKakao()) {   // 로그인 주소를 기본 브라우저에서 열면, 로그인한 뒤 그 브라우저에서 이 사이트로 돌아옵니다
    toast("카카오톡에서는 로그인이 안 돼서 기본 브라우저로 열어요");
    location.href = kakaoOutside(url);
    return;
  }
  if (!handoff) { location.href = url; return; }
  const w = window.open(url, "_blank");
  if (w) waitHandoff.win = w;
  else {
    try { sessionStorage.setItem(DSHS_HAND_KEY, JSON.stringify(waitHandoff.h)); } catch { }
    location.href = url;
  }
  waitHandoff();
}

// 앱이 연 로그인 창으로 돌아온 경우 (?dshs=app 이고 이 창은 handoff 를 모름) → 창을 닫습니다.
// 닫을 수 없는 브라우저면 "앱으로 돌아가세요" 안내가 남습니다.
const dshsPopupLanding = () => new URLSearchParams(location.search).get("dshs") === "app" && !pendingHandoff();
function closeDshsPopup() {
  try { window.opener?.postMessage("dshs-handoff", location.origin); } catch { }   // 앱이 기다리지 않고 바로 받아 가게
  try { window.close(); } catch { }
}
function pendingHandoff() {
  let h = waitHandoff.h;
  try { h = JSON.parse(sessionStorage.getItem(DSHS_HAND_KEY)) || h; } catch { }
  return h && Date.now() - h.at < DSHS_HAND_TTL ? h.key : null;
}
function clearHandoff() {
  try { sessionStorage.removeItem(DSHS_HAND_KEY); } catch { }
  waitHandoff.h = null;
}

// 로그인 창에서 돌아오면 바로, 앱이 보이는 동안에는 3초마다 결과를 확인합니다.
function waitHandoff() {
  if (waitHandoff.on) return;
  waitHandoff.on = true;
  // 로그인 창이 앞에 있어 앱이 가려져 있어도, 로그인 창이 끝났다고 알려 오면(now) 바로 받아 갑니다
  const tick = async (now) => {
    const key = pendingHandoff();
    if (!key) return stop();
    if ((document.hidden && now !== true) || tick.busy) return;
    tick.busy = true;
    try {
      const { ok, body } = await dshsCall("poll", { handoff: key });
      if (ok && !body.pending && key === pendingHandoff()) { stop(); await handoffArrived(body); }
    } catch { }
    tick.busy = false;
  };
  const t = setInterval(tick, 3000);
  const onMsg = (e) => { if (e.origin === location.origin && e.data === "dshs-handoff") tick(true); };
  function stop() {
    clearInterval(t);
    document.removeEventListener("visibilitychange", tick);
    window.removeEventListener("message", onMsg);
    waitHandoff.on = false;
  }
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("message", onMsg);
  tick();
}

async function handoffArrived(r) {
  clearHandoff();
  try { waitHandoff.win?.close(); } catch { }
  waitHandoff.win = null;
  let ok = ["linked", "login", "joined"].includes(r.result), why = r.reason || "failed";
  if (ok && r.token) {
    const { error } = await sb.auth.verifyOtp({ token_hash: r.token, type: "magiclink" });
    if (!error) await loadProfile();
    ok = !error && !!me;
    why = error ? "verify" : "profile";
  }
  if (r.result !== "linked" && (ok || loginTry())) logLogin(ok ? "done" : "fail", ok ? null : why);   // 연결(설정의 dshs.app 연결)은 세지 않음
  if (!ok) return toast(DSHS_RETURNED[r.reason] || "dshs.app 로그인에 실패했어요", true);
  closeModal();
  if (r.result === "linked") {
    dshs.at = 0;
    loadDshs();
  } else {
    renderNav(); openHome();
    setTimeout(maybeOnboard, 800);
  }
  toast(DSHS_RETURNED[r.result]);
}

// dshs.app 로그인에서 돌아오며 받은 일회용 토큰(#dshs_login=…) → 이 사이트 세션. 토큰은 주소에서 바로 지웁니다.
async function dshsSession() {
  const token = new URLSearchParams(location.hash.slice(1)).get("dshs_login");
  if (!token) return;
  history.replaceState(null, "", location.pathname + location.search);
  const { error } = await sb.auth.verifyOtp({ token_hash: token, type: "magiclink" });
  if (error) dshsSession.failed = true;
}

// dshs.app 로그인에서 돌아왔을 때 (?dshs=linked | login | joined | error&reason=…) 결과를 알리고 주소를 정리합니다
function dshsReturned() {
  const q = new URLSearchParams(location.search), r = q.get("dshs");
  if (pendingHandoff()) waitHandoff();   // 앱 창 안에서 로그인 화면으로 갔다 온 경우 (컴퓨터에 설치한 앱 등)
  if (!r) return;
  if (r === "app") {
    // 앱에서 연 로그인 창(팝업)으로 돌아온 경우. 로그인은 앱이 이어서 합니다.
    if (!pendingHandoff()) {   // init 에서 창을 닫지 못한 경우의 안내
      openSheet("dshs.app 로그인", `
        <div class="ev-title">dshs.app 로그인을 마쳤어요</div>
        <div class="asg-body">이 창을 닫고 앱으로 돌아가 주세요. 앱에서 자동으로 이어져요.</div>`);
    }
  } else {
    const ok = ["linked", "login", "joined"].includes(r) && !dshsSession.failed && !!me;
    toast(ok ? DSHS_RETURNED[r] : DSHS_RETURNED[q.get("reason")] || "dshs.app 로그인에 실패했어요", !ok);
    // 로그인 이탈 기록: 로그인 · 가입 결과만 (설정의 dshs.app 연결은 세지 않음). 실패는 로그인 시도 중일 때만
    if (r === "login" || r === "joined") logLogin(ok ? "done" : "fail", ok ? null : dshsSession.failed ? "verify" : "profile");
    else if (r === "error" && loginTry()) logLogin("fail", q.get("reason") || "failed");
    if (ok && r !== "linked") setTimeout(maybeOnboard, 800);
  }
  q.delete("dshs"); q.delete("reason");
  const rest = q.toString();
  history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
}

// 전체 학생 명단 (43기 · 1학년). DB 의 명단(roster.sql 은 42기, 43기는 roster43.sql)과 같게 둡니다.
// 가입 전 친구를 이름 · 학번으로 찾을 때 씁니다 (openEventForm 의 search). 분반이 없어 classes 는 비어 있습니다.
const ROSTER_43 = `1101 김묘경,1102 이온유,1103 임지수,1104 함시우,1105 구자현,1106 김인하,1107 김현빈,1108 박태준,1109 서지오,1110 손수민,
1111 신주환,1112 임유찬,1113 채명준,1114 최지원,1115 홍태성,1116 정지호,1201 김하연,1202 이담비,1203 최효윤,1204 강주찬,1205 권준현,1206 박민수,
1207 성지후,1208 여이환,1209 유재승,1210 윤주성,1211 윤지성,1212 이시우,1213 이정산,1214 주영준,1215 추호현,1216 홍승원,1301 고민혁,
1302 김건희,1303 김도윤,1304 김민서,1305 김민준,1306 김재겸,1307 박건우,1308 박주원,1309 서범기,1310 양민재,1311 여소율,1312 원강연,
1313 윤준범,1314 이건,1315 이상준,1316 전현우,1401 공도윤,1402 김규민,1403 김민준,1404 김범수,1405 김태균,1406 변승현,1407 심준용,
1408 옥재현,1409 유준우,1410 윤호연,1411 이두현,1412 이준서,1413 정유안,1414 조성율,1415 최윤준,1416 하승윤,1501 고동훈,1502 고은율,
1503 김승리,1504 나준수,1505 심준용,1506 양태혁,1507 임예준,1508 임유준,1509 장영민,1510 정정웅,1511 조현호,1512 주승민,1513 최민준,
1514 최훈,1515 한재민,1516 허륜,1601 김대윤,1602 김석준,1603 김승우,1604 김태윤,1605 배호람,1606 손승호,1607 신재원,1608 유태우,
1609 이시우,1610 이준원,1611 이지호,1612 정민규,1613 정재환,1614 조민성,1615 최영우,1616 한원희`
  .split(",").map((s) => s.trim().split(" ")).map(([sid, name]) => ({ sid: +sid, name, classes: {} }));
function roster() {
  return ROSTER_43;   // [{ sid, name, classes }]
}

function schoolWhen(e) {
  const s = new Date(e.starts_at), en = e.ends_at ? new Date(e.ends_at) : null;
  if (e.all_day) return en && dayKey(en) !== dayKey(s) ? `${dayTitle(dayKey(s))} – ${dayTitle(dayKey(en))}` : `${dayTitle(dayKey(s))} · 하루 종일`;
  return `${dayTitle(dayKey(s))} ${hm(s)}${en ? ` – ${dayKey(en) !== dayKey(s) ? md(en) + " " : ""}${hm(en)}` : ""}`;
}

function openSchoolDetail(e) {
  openSheet("학교 일정", `
    <div class="shared-card c-school">
      <div class="ev-title">${esc(e.title)}</div>
      <div class="ev-meta">${esc(schoolWhen(e))} · ${catLabel(e.category)}${e.no_class ? " · 수업 없음" : ""}</div>
      ${e.memo ? `<div class="asg-body">${esc(e.memo)}</div>` : ""}
    </div>
    <div class="study-foot">${e.neis_key ? "학교 홈페이지 학사일정을 관리자가 고친 일정이에요." : "관리자가 올린 일정이에요."}</div>`);
}
