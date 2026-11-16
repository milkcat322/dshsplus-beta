"use strict";
// dshs43.app — js/start.js: 시작(init) · 다른 기수 계정 · 지난 화면 먼저 · 로그인 유지 · 로그인 이탈 기록
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 시작 ----------
// 새 버전으로 다시 열기(index.html 의 서비스 워커 부분)는 로그인 확인이 끝난 뒤에 합니다.
// 로그인 토큰을 받거나(dshs.app 로그인에서 돌아온 직후) 새로 받는 중에 다시 열면, 받은 토큰을 저장하지 못해 로그아웃됩니다.
let authSettled;
window.dshsSettled = new Promise((r) => { authSettled = r; });
async function init() {
  try { await startApp(); } finally { authSettled(); }
}
async function startApp() {
  if (!ENABLED) { $("studyNav").style.display = "none"; return; }
  if (dshsPopupLanding()) closeDshsPopup();   // 앱이 연 로그인 창이면 화면을 그리기 전에 바로 닫습니다
  silentReturned();   // 조용한 로그인에서 돌아왔으면 원래 주소로 (토큰은 # 뒤에 남겨 아래 dshsSession 이 씀)
  // 로그인 기록이 없으면 처음부터 시작하기 화면을 띄웁니다
  let saved = false;
  try { saved = !!localStorage.getItem("dshs-study-auth"); } catch {}
  applyAccess(!saved);
  // 지난번 화면을 서버 응답 없이 바로 그립니다. 아래에서 서버에 확인되면 새 내용으로 바꿉니다.
  const fromSnap = saved && loadSnap();
  if (fromSnap) { renderNav(); openStart(); }
  window.addEventListener("offline", () => applyAccess());
  window.addEventListener("online", backOnline);
  // 오프라인 화면인 채로 앱으로 돌아오면 기다리지 않고 바로 다시 확인합니다 (로그인 기능을 못 불러온 경우 포함)
  document.addEventListener("visibilitychange", () => { if (!document.hidden && netDown) watchNet(300); });
  // ?bundle: 여러 파일을 차례로 받지 않고 한 파일로 받습니다 (index.html 의 modulepreload 와 같은 주소)
  // esm.sh 가 잠깐 안 되면 같은 버전을 jsdelivr 에서 받습니다 (한 번 실패한 주소는 브라우저가 다시 받지 않으므로 다른 주소로)
  let createClient;
  for (const url of ["https://esm.sh/@supabase/supabase-js@2.45.4?bundle", "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"]) {
    try { ({ createClient } = await import(url)); break; } catch {}
  }
  if (!createClient) {
    netDown = true;   // 인터넷 없이 처음 열어 로그인 기능을 못 불러왔으면 오프라인 안내만 보여 줍니다
    applyAccess();
    return watchNet();   // 와이파이가 붙어 있어 'online' 이벤트가 오지 않아도 다시 확인해 돌아옵니다
  }
  $("gateLogin").onclick = gateLogin;
  $("gateAdmin").onclick = openAdminLogin;
  sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "dshs-study-auth" },
    global: { fetch: authFetch },
  });

  sbReady();

  await dshsSession();   // dshs.app 으로 로그인하고 돌아온 경우
  const { data: { session }, error: sessErr } = await sb.auth.getSession();   // ← 자동 로그인
  const shownId = me?.id, shownSid = me?.student_id;
  if (session) await loadProfile();
  else if (me && !(sessErr && isNetErr(sessErr))) { me = null; myClasses = []; clearSnap(); }   // 로그인이 끝남
  else if (me) netTrouble();   // 서버에 닿지 못함 → 지난 화면 유지 (정말 끊겼을 때만 오프라인 화면)
  if (!session && !sessErr && await silentLogin()) return;   // dshs.app 에 로그인돼 있는지 보러 갑니다 (페이지를 떠남)
  // 로그인 기록은 남아 있는데 서버가 잠깐 답하지 못했으면 조금 뒤 다시 확인합니다
  if ((session ? loadProfile.failed : sessErr && isNetErr(sessErr)) && authUserId()) retryAuth();
  renderNav();
  if (me) loadAssignments();
  if (me) setTimeout(maybeInstallAsk, 4000);   // 브라우저로 열었으면 하루 한 번 앱 설치 안내
  checkFbReplies();

  logVisit();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    logVisit();
    checkFbReplies();
    if (retryAuth.t) retryAuth(300);   // 앱으로 돌아오면 기다리지 않고 바로 다시 확인
  });
  sb.auth.onAuthStateChange(async (evt) => {
    if (evt === "SIGNED_OUT") { me = null; myClasses = []; dshs = dshsEmpty(); seatShares = new Map(); seatAt = 0; seatNeed = null; clearSnap(); closeStudy(); renderNav(); }
    if (evt === "SIGNED_IN") setTimeout(logVisit, 1000);   // 프로필을 읽은 뒤 (관리자면 세지 않도록)
  });

  // 지난 화면을 이미 띄웠으면 다른 계정으로 바뀐 경우에만 다시 엽니다
  if (!fromSnap || (me && (me.id !== shownId || me.student_id !== shownSid))) openStart();
  dshsReturned();
  watchDshs();
  watchStatus();
}

// 알림을 누르고 들어오면 그 탭으로, 아니면 내 일정으로 시작합니다 (43기는 아직 시간표가 없음)
function openStart() {
  const q = new URLSearchParams(location.search);
  const opened = q.get("view");
  if (me?.is_admin) openAdminMoved();
  else if (otherCohort()) openOtherCohort();
  else if (me && opened === "assignments") openAsgLink(q.get("asg"));
  else if (me && opened === "feedback") openFeedbackLink();
  else if (me) openStudy("tt");   // 42기 사이트처럼 내 시간표(이름 · 위치 · 학점 계산 · 배경화면)로 시작
}

// ---------- 다른 기수 계정 ----------
// 이 사이트는 43기(학번 1000 ~ 1999)용입니다. 같은 DB 라 42기 계정으로도 로그인되므로, 그때는 42기 사이트로 안내합니다.
// (학번 없는 예전 계정 · 관리자 계정은 해당 없음. 관리자는 openAdminMoved)
const otherCohort = () => !!me && !me.is_admin && !!me.student_id && !inCohort(me.student_id);
function openOtherCohort() {
  if (sb) forgetPush();   // 이 기기로 다른 기수 학생의 알림이 오지 않게
  closeStudy();
  openSheet("43기 사이트예요", `
    <div class="asg-body">dshs43.app 은 대전과학고 <b>43기</b> 학생용 사이트예요. ${esc(me.name)}님(학번 ${esc(me.student_id)})은 42기 사이트를 써 주세요.</div>
    <a class="study-submit" href="${esc(COHORT_OTHER_URL)}" style="display:block;text-align:center;text-decoration:none">dshs42.app 열기</a>
    <button class="study-submit ghost" id="ocLogout">이 사이트에서 로그아웃</button>`);
  $("ocLogout").onclick = () => { closeModal(); logout(); };
}

// 답장 알림으로 들어오면 피드백 창을 엽니다 (주소의 view 는 지워 새로고침해도 다시 뜨지 않게)
function openFeedbackLink() {
  if (me?.student_id && $("studyView").style.display !== "block") openStudy("cal");
  try {
    const u = new URL(location.href);
    if (u.searchParams.get("view") === "feedback") {
      u.searchParams.delete("view");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    }
  } catch {}
  openFeedback();
}

// 수행평가 알림으로 들어오면 수행평가 탭을 열고, asg 가 있으면 그 수행평가 자세히 보기까지 엽니다
// (목록이 아직 안 왔으면 받아진 뒤 한 번만. 못 찾으면 탭만 보여 줍니다)
async function openAsgLink(id) {
  openStudy("notice");
  if (!id) return;
  const clean = () => {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("view"); u.searchParams.delete("asg");
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {}
  };
  try {
    let a = findAsg(id);
    if (!a) { await loadAssignments({ quiet: true }); a = findAsg(id); }
    if (a && me) openAsgDetail(a);
  } finally { clean(); }
}

// 이미 열려 있는 창에 서비스 워커가 알림 주소를 보내면 새로고침 없이 그 화면으로 갑니다
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type !== "open-url" || !me) return;
    try {
      const u = new URL(e.data.url, location.origin);
      if (u.origin !== location.origin) return;
      const v = u.searchParams.get("view");
      if (me.is_admin || otherCohort()) return;
      if (v === "assignments") openAsgLink(u.searchParams.get("asg"));
      else if (v === "cal") openStudy("cal");
      else if (v === "feedback") openFeedbackLink();
    } catch {}
  });
}

// 관리 기능(관리 탭 · 학교 일정 관리)은 관리자 사이트(admin/ · CFG.ADMIN_URL)로 옮겼습니다.
// 관리자 계정으로 학생 사이트에 들어오면 관리자 사이트로 안내하고, 이 기기로 관리자 알림이 오지 않게 등록을 지웁니다.
const ADMIN_URL = CFG.ADMIN_URL || "https://dshs42-admin.netlify.app";
function openAdminMoved() {
  if (sb) forgetPush();
  openSheet("관리자 계정", `
    <div class="asg-body">관리 기능(수행평가 승인 · 피드백 · 학생 현황 · 학교 일정 관리)은 관리자 사이트로 옮겼어요. 관리자 알림도 관리자 사이트에서 켜요.</div>
    <a class="study-submit" href="${esc(ADMIN_URL)}" style="display:block;text-align:center;text-decoration:none">관리자 사이트 열기</a>
    <button class="study-submit ghost" id="amLogout">이 사이트에서 로그아웃</button>`);
  $("amLogout").onclick = () => { closeModal(); logout(); };
}

// ---------- 지난 화면 먼저 ----------
// 로그인한 학생이 열 때 서버를 기다리지 않도록, 마지막으로 받은 내 정보 · 수행평가 · 일정 · 위치를
// 이 기기에 남겨 두고(SNAP_KEY) 다음에 열면 그것으로 먼저 그립니다. 서버 응답이 오면 새 내용으로 바꿉니다.
// 로그아웃하거나 다른 계정이면 쓰지 않고 지웁니다. 로그인 기록(dshs-study-auth)과 같은 기기에만 남습니다.
const SNAP_KEY = "dshs-snap";
let sbReady;
const sbWait = new Promise((r) => { sbReady = r; });   // 지난 화면을 띄운 뒤 서버 연결이 준비되기 전 눌러도 기다렸다 받습니다
const isNetErr = (e) => /fetch|network|load failed|timeout/i.test(e?.message || "") || e?.status === 0;
function authUserId() {
  try { return JSON.parse(localStorage.getItem("dshs-study-auth"))?.user?.id || null; } catch { return null; }
}

// ---------- 로그인 유지 ----------
// supabase-js 는 로그인 토큰 새로 받기(refresh)가 502 · 503 · 504 말고 다른 서버 오류(요청 한도 429, 500 등)로
// 실패해도 토큰이 무효라고 보고 이 기기의 로그인 기록을 지웁니다. 학교 와이파이처럼 여러 학생이 같은 IP 로
// 한꺼번에 열면 요청 한도에 걸리기 쉬워 "자동 로그인이 풀렸다"가 됩니다.
// 그래서 이런 실패는 '서버에 닿지 못함'으로 바꿔 로그인 기록을 남기고 나중에 다시 받습니다.
// 토큰이 정말 무효일 때(400 등)만 로그아웃됩니다. 한도에 걸리면 잠시 요청을 보내지 않아 한도를 더 쓰지 않습니다.
let refreshPauseUntil = 0;
async function authFetch(input, init) {
  const url = typeof input === "string" ? input : input?.url || String(input);
  if (!/\/auth\/v1\/token\?grant_type=refresh_token/.test(url)) return fetch(input, init);
  if (Date.now() < refreshPauseUntil) throw new TypeError("Failed to fetch (auth busy)");
  const res = await fetch(input, init);
  if (res.status === 429 || res.status >= 500) {
    refreshPauseUntil = Date.now() + (res.status === 429 ? 60000 : 10000);
    throw new TypeError(`Failed to fetch (auth ${res.status})`);
  }
  return res;
}
// 로그인 기록은 있는데 서버가 잠깐 답하지 못한 경우: 점점 간격을 늘려(최대 2분) 다시 확인하고, 되면 내 화면으로 돌아갑니다
function retryAuth(delay = 15000) {
  clearTimeout(retryAuth.t);
  retryAuth.t = setTimeout(async () => {
    retryAuth.t = null;
    if (!authUserId()) return;   // 그사이 로그아웃했거나 토큰이 정말 무효였음
    const { data: { session }, error } = await sb.auth.getSession();
    if (session) {
      await backOnline();
      if (loadProfile.failed) retryAuth(Math.min(delay * 2, 120000));
    } else if (error && isNetErr(error)) retryAuth(Math.min(delay * 2, 120000));
  }, delay);
}
// 브라우저가 저장 공간이 모자랄 때 로그인 기록을 지우지 않도록 요청합니다 (Firefox 는 허락 창이 떠서 빼고, 거절돼도 그대로 씀)
function keepStorage() {
  if (keepStorage.done || /Firefox/.test(navigator.userAgent)) return;
  keepStorage.done = true;
  try { navigator.storage?.persist?.().catch(() => {}); } catch {}
}
function saveSnap() {
  clearTimeout(saveSnap.t);
  saveSnap.t = setTimeout(() => {
    if (!me) return;
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify({
        v: 1, at: Date.now(), me,
        cache: { ...cache, done: [...cache.done], people: [...cache.people], invites: [...(cache.invites || new Map())] },
        status: [...statusMap],
        seats: seatShares ? [...seatShares] : null,
      }));
    } catch {}   // 저장 공간이 모자라면 다음에도 서버를 기다립니다
  }, 400);
}
function loadSnap() {
  try {
    const s = JSON.parse(localStorage.getItem(SNAP_KEY) || "null");
    if (s?.v !== 1 || !s.me?.id || s.me.id !== authUserId()) { clearSnap(); return false; }
    setMe(s.me);
    const c = s.cache || {};
    cache = { ...cache, ...c, done: new Set(c.done || []), people: new Map(c.people || []), invites: new Map(c.invites || []) };
    statusMap = new Map(s.status || []);
    if (s.seats) seatShares = new Map(s.seats);
    haveData = !!s.cache;
    return true;
  } catch { return false; }
}
function clearSnap() { try { localStorage.removeItem(SNAP_KEY); } catch {} }

// 방문 기기 수 (visits.sql). 화면에는 아무것도 보이지 않고, 관리자만 관리 탭에서 수를 봅니다.
// 이 기기에 만든 무작위 ID 로 하루 한 번(로그인하면 한 번 더)만 보냅니다. 이름 · 학번은 보내지 않습니다.
// 관리자로 로그인한 적 있는 기기는 로그아웃 상태에서도 세지 않습니다.
const VISIT_KEY = "dshs-visit";
function visitKind() {
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/.test(ua) && touch)) return "tablet";
  if (navigator.userAgentData?.mobile || /Mobi|iPhone|iPod|Android/i.test(ua)) return "phone";
  return "pc";
}
async function logVisit() {
  try {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (session && !me) return;   // 프로필을 아직 못 읽었으면 다음 기회에
    const st = JSON.parse(localStorage.getItem(VISIT_KEY) || "{}");
    if (me?.is_admin) st.skip = true;
    if (st.skip) return localStorage.setItem(VISIT_KEY, JSON.stringify(st));
    const today = dayKey(new Date());
    const login = !!session;
    if (st.day === today && (st.login || !login)) return;
    st.id = visitId();
    const { error } = await logRpc("log_visit", { p_device: st.id, p_kind: visitKind(), p_standalone: isStandalone() });
    if (error) return;
    const now = JSON.parse(localStorage.getItem(VISIT_KEY) || "{}");   // 그사이 logGate 가 남긴 값을 지우지 않게 다시 읽습니다
    now.login = (now.day === today && now.login) || login;
    now.day = today;
    localStorage.setItem(VISIT_KEY, JSON.stringify(now));
  } catch {}
}
// 방문 · 로그인 기록에 이 사이트의 기수(43기)를 함께 남깁니다 (visits.sql · loginsteps.sql 의 p_cohort, 관리자 사이트가 기수별로 봄).
// DB 에 아직 기수 칸이 없으면(함수 없음) 예전처럼 기수 없이 남깁니다.
const SITE_COHORT = 43;
function logRpc(fn, args) {
  return sb.rpc(fn, { ...args, p_cohort: SITE_COHORT }).then((r) => (r.error?.code === "PGRST202" ? sb.rpc(fn, args) : r));
}
// 기기 ID 는 바로 저장해 logVisit · logGate 가 동시에 불려도 같은 값을 씁니다
function visitId() {
  const st = JSON.parse(localStorage.getItem(VISIT_KEY) || "{}");
  if (!st.id) {
    st.id = crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISIT_KEY, JSON.stringify(st));
  }
  return st.id;
}

// 비로그인 시작하기 화면을 본 날('seen') · 그 화면의 로그인 버튼을 누른 날('click')을 하루 한 번씩 남깁니다 (visits.sql 의 log_gate).
// 사용 분석 에이전트가 "본 기기 → 누른 기기 → 로그인한 기기"로 로그인 유도 효과를 판단합니다. 화면에는 아무것도 보이지 않습니다.
async function logGate(ev) {
  try {
    if (!sb || me) return;
    const key = ev === "click" ? "gateClick" : "gateSeen", today = dayKey(new Date());
    const st = JSON.parse(localStorage.getItem(VISIT_KEY) || "{}");
    if (st.skip || st[key] === today) return;
    const { error } = await logRpc("log_gate", { p_device: visitId(), p_kind: visitKind(), p_standalone: isStandalone(), p_event: ev });
    if (error) return;
    const now = JSON.parse(localStorage.getItem(VISIT_KEY) || "{}");
    now[key] = today;
    localStorage.setItem(VISIT_KEY, JSON.stringify(now));
  } catch {}
}

// ---------- 로그인 이탈 기록 (loginsteps.sql) ----------
// 'dshs.app 계정으로 시작하기'를 누른 뒤 어디서 멈췄는지 단계별로 남겨, 관리자 사이트 '학생' 칸의 '로그인 이탈'에서 분석합니다.
// 누를 때 만든 시도 ID 를 이 기기(LOGIN_TRY)에 두고, dshs.app 에서 돌아오면 같은 ID 로 결과를 남깁니다.
// 화면에는 아무것도 보이지 않고, 이름 · 학번은 보내지 않습니다. 실패해도(표가 없는 DB 등) 조용히 넘어갑니다.
const LOGIN_TRY = "dshs-login-try";
function loginEnv() {
  const ua = navigator.userAgent, app = isStandalone();
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua)) return "inapp";
  if (isAppleMobile()) return app ? "ios-app" : /CriOS/.test(ua) ? "ios-chrome" : "ios-safari";
  if (/Android/i.test(ua)) return app ? "android-app" : /SamsungBrowser/i.test(ua) ? "android-samsung" : "android-chrome";
  return app ? "pc-app" : "pc";
}
function loginTry(start) {
  try {
    if (start) {
      const t = { id: crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`, at: Date.now() };
      localStorage.setItem(LOGIN_TRY, JSON.stringify(t));
      return t.id;
    }
    const t = JSON.parse(localStorage.getItem(LOGIN_TRY) || "null");
    return t && Date.now() - t.at < 30 * 60000 ? t.id : null;
  } catch { return null; }
}
// step: click · start_fail · leave · done · fail. 결과(done · fail)를 남기면 시도를 끝냅니다.
// 누른 기록 없이 돌아온 경우(카카오톡에서 눌러 다른 브라우저로 돌아옴 등)는 새 시도로 남깁니다.
function logLogin(step, reason) {
  try {
    if (!sb) return Promise.resolve();
    const attempt = step === "click" ? loginTry(true) : loginTry() || loginTry(true);
    if (step === "done" || step === "fail") localStorage.removeItem(LOGIN_TRY);
    return logRpc("log_login_step", { p_device: visitId(), p_attempt: attempt, p_step: step, p_reason: reason || null, p_env: loginEnv() })
      .then(() => {}, () => {});
  } catch { return Promise.resolve(); }
}
// 로그인 주소를 받아 떠나기 직전: 기록을 보낼 틈을 잠깐(최대 0.6초) 줍니다
const logLeave = (how) => Promise.race([logLogin("leave", how), new Promise((ok) => setTimeout(ok, 600))]);

async function loadProfile() {
  // 관리자는 RLS 상 모든 프로필을 볼 수 있으므로 반드시 내 id 로 좁힙니다.
  loadProfile.failed = false;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { me = null; return; }
  const read = () => sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  let { data, error } = await read();
  if (error && !isNetErr(error)) {   // 로그인 토큰이 막 만료된 경우 등: 토큰을 새로 받아 한 번 더 읽습니다
    await sb.auth.refreshSession().catch(() => {});
    ({ data, error } = await read());
  }
  if (error) {   // 서버에 닿지 못했거나 잠깐 실패 → 로그아웃으로 보지 않고, 지난 화면의 내 정보가 이 계정 것이면 그대로 씁니다
    loadProfile.failed = true;
    if (isNetErr(error)) netTrouble();
    if (me?.id !== session.user.id) me = null;
    return;
  }
  if (!data) { me = null; clearSnap(); return; }
  netDown = false;
  setMe(data);
  myMail = mailFull(mailMid(session.user.user_metadata?.gravatar_email));
  setAvatar(myMail);
  saveSnap();
  keepStorage();
  if (silentState()?.off) silentState({ off: false });   // 다시 로그인했으니 다음에 로그인 기록이 없어지면 조용한 로그인을 다시 씁니다
}
function setMe(data) {
  me = data;
  // 43기는 시간표(분반) 자료가 아직 없고 모두 같은 과목을 함께 들으므로, 누구나 43기 과목 전체 · 분반 없음(ban: null = 전체 분반)
  myClasses = allClassList();
}

// 프로필 사진용 메일: 학생이 등록한 학교 구글 메일. 꼭 43th○○@djshs.djsch.kr 모양이어야 합니다 (○○ 만 학생이 적음).
// 내 계정의 user_metadata.gravatar_email 에 저장합니다: 계정에 붙는 값이라 기기를 바꿔도 따라오고, DB 표 · 권한은 건드리지 않습니다.
// 등록하지 않았으면 Gravatar 를 쓰지 않고 이름 첫 글자만 보입니다.
const MAIL_HEAD = "43th", MAIL_TAIL = "@djshs.djsch.kr";
const MAIL_MID = /^[a-z0-9._-]{1,30}$/;   // 가운데 부분에 쓸 수 있는 글자
// 메일 주소 → 가운데 부분 (모양이 다르면 ""). 가운데만 적은 것도 받습니다
function mailMid(v) {
  let m = String(v || "").trim().toLowerCase();
  if (m.endsWith(MAIL_TAIL)) m = m.slice(0, -MAIL_TAIL.length);
  if (m.startsWith(MAIL_HEAD)) m = m.slice(MAIL_HEAD.length);
  return MAIL_MID.test(m) ? m : "";
}
const mailFull = (mid) => (mid ? MAIL_HEAD + mid + MAIL_TAIL : "");

// 이메일 등록 창 (내 위치 줄의 '이메일 등록' 버튼 — js/seat.js 의 paintMyStatus)
function openMailForm() {
  openSheet("프로필 사진 이메일", `
    <div class="asg-body">학교 구글 메일을 등록하면, 그 메일로 <a href="https://gravatar.com" target="_blank" rel="noopener">gravatar.com</a> 에 올려 둔 사진이 내 프로필에 보여요. 올려 둔 사진이 없으면 무늬 그림이 보여요.</div>
    <label class="study-label" for="mailMid">학교 메일</label>
    <div class="mail-field"><span>${MAIL_HEAD}</span>
      <input class="study-input" id="mailMid" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(mailMid(myMail))}">
      <span>${MAIL_TAIL}</span></div>
    <div class="study-err" id="mailErr"></div>
    <button class="study-submit" id="mailSave">${myMail ? "바꾸기" : "등록"}</button>
    ${myMail ? `<button class="study-btn wide" id="mailClear">등록한 이메일 지우기</button>` : ""}
    <div class="study-foot" style="text-align:left">메일 주소는 내 계정에만 저장돼요. 사진을 찾을 때는 주소를 알아볼 수 없게 바꾼 값만 gravatar.com 에 보내요.</div>`);
  const err = (msg) => { $("mailErr").textContent = msg; $("mailErr").classList.add("show"); };
  const save = async (mid) => {
    $("mailSave").disabled = true;
    const { error } = await sb.auth.updateUser({ data: { gravatar_email: mailFull(mid) || null } });
    if (error) { $("mailSave").disabled = false; return err("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요"); }
    myMail = mailFull(mid);
    setAvatar(myMail);
    closeModal();
    paintMyStatus();
    toast(mid ? "이메일을 등록했어요" : "등록한 이메일을 지웠어요");
  };
  $("mailSave").onclick = () => {
    const mid = mailMid($("mailMid").value);
    if (!mid) { err(`${MAIL_HEAD} 뒤에 올 부분을 영문 · 숫자로 적어 주세요`); return $("mailMid").focus(); }
    save(mid);
  };
  $("mailMid").onkeydown = (e) => { if (e.key === "Enter" && !e.isComposing) $("mailSave").click(); };
  if ($("mailClear")) $("mailClear").onclick = () => save("");
  $("mailMid").focus();
}

// 프로필 사진: 등록한 메일로 Gravatar(gravatar.com)에 올려 둔 사진을 씁니다. 등록한 메일이 없으면 Gravatar 에 아무것도 묻지 않습니다. 주소에는 이메일 대신 그 SHA-256 값만 들어갑니다.
// 올려 둔 사진이 없으면 Gravatar 가 이메일마다 다른 무늬(identicon)를 주고, 사진을 못 받으면(오프라인 등) 이름 첫 글자가 그대로 보입니다.
// 다른 학생은 이메일을 알 수 없어 이름 첫 글자만 보입니다.
async function setAvatar(email) {
  const mail = (email || "").trim().toLowerCase();
  if (setAvatar.mail === mail) return;
  setAvatar.mail = mail;
  myAvatar = "";
  if (!mail) return paintAvatar();   // 등록한 메일이 없음 → 사진을 떼고 이름 첫 글자만
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mail));
    if (setAvatar.mail !== mail) return;   // 그사이 다른 계정으로 바뀜
    const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    myAvatar = `https://gravatar.com/avatar/${hash}?s=160&d=identicon&r=g`;
    paintAvatar();
  } catch {}
}
// 내 프로필 칸(.student-avatar[data-me])에 사진을 얹습니다. 다 받은 뒤에 얹으므로 그 전에는 이름 첫 글자가 보입니다.
function paintAvatar() {
  const box = document.querySelector(".student-avatar[data-me]");
  if (!box) return;
  if (!myAvatar) { box.querySelector("img")?.remove(); return; }
  if (box.querySelector("img")?.src === myAvatar) return;
  const img = new Image();
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.onload = () => {   // 메일을 바꿔 사진 주소가 달라졌으면 전 사진을 새 사진으로 바꿉니다
    if (img.src !== myAvatar) return;
    box.querySelector("img")?.remove();
    box.append(img);
  };
  img.src = myAvatar;
}

// 수강 과목: { subject, ban }. 분반이 생기면 여기서 학생마다 ban 을 채웁니다.
function allClassList() {
  return sortClasses(SUBJECTS_43.map(([subject]) => ({ subject, ban: null })));
}
function sortClasses(list) {
  return list.sort((a, b) => a.subject.localeCompare(b.subject, "ko") || (a.ban || "").localeCompare(b.ban || "", "ko"));
}
const banLabel = (ban) => ban || "전체";   // 43기 수행평가: 전체 또는 'n반' (cohort43ban.sql)
const mySubjects = () => [...new Set(myClasses.map((c) => c.subject))];
// 수행평가를 보지 않는 과목은 수행평가 탭과 추가 화면에서 뺍니다.
const NO_ASG_SUBJECTS = new Set(["체육"]);
const asgClasses = () => myClasses.filter((c) => !NO_ASG_SUBJECTS.has(c.subject));
const asgSubjects = () => mySubjects().filter((s) => !NO_ASG_SUBJECTS.has(s));

// 수행평가 탭 옆 숫자: 완료 표시를 안 했고 마감이 지금부터 3일(72시간) 안인, 승인된 수행평가 수. 데이터가 없으면 0
function asgSoonCount() {
  if (!haveData || !cache.items) return 0;
  const now = Date.now();
  return noticeItems().filter((a) => a.status === "approved" && !cache.done.has(a.id)
    && dueMs(a) >= now && dueMs(a) <= now + 72 * 3600 * 1000).length;
}
