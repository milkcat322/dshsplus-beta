"use strict";
// dshs43.app — js/login.js: 로그인 · 탭(시간표 · 내 일정 · 수행평가 · 할 일 · 급식)
// 모듈이 아니라 전역 스코프를 함께 쓰는 스크립트입니다 (index.html 에 적힌 순서대로 읽음. 설명은 js/core.js 맨 위).

// ---------- 로그인 ----------
// 회원가입은 없습니다. 새 학생은 dshs.app 으로 로그인하면 dshs-oauth 가 학번으로 계정을 만듭니다.
// 처음 오는 학생은 계정이 없으므로 '로그인' 대신 'dshs.app 계정으로 시작하기' 하나만 크게 보여 줍니다.
// 아이디 · 비밀번호 로그인(관리자 · 예전에 아이디로 가입한 학생)은 시작하기 창 아래 작은 '관리자 · 아이디로 로그인'
// 또는 설정 창 제목 "설정" 을 7번 누르면 열립니다.
function closeModal() { $("studyModal").className = "study-modal"; }

function openAuth() {
  openSheet("시작하기", `
    <div class="asg-body">따로 가입할 필요 없어요. dshs.app 계정으로 시작하면 바로 수행평가 · 내 일정 · 할 일을 쓸 수 있어요.</div>
    <button class="study-submit dshs-login" id="doDshsLogin">dshs.app 계정으로 시작하기</button>
    <div class="study-err" id="authErr"></div>
    <div class="study-foot">dshs.app 비밀번호는 이 사이트에 전달되지 않아요. 전에 아이디로 가입했어도 dshs.app으로 시작하면 같은 학번 계정으로 들어가요.<br>
      대전과학고등학교 및 dshs.app에서 공식적으로 제공하거나 운영하는 사이트가 아닌 학생 비공식 사이트예요.</div>
    ${adminLinkHtml()}`);
  $("doDshsLogin").onclick = loginWithDshs;
  bindAdminLink();
}
// 작게: 관리자 · 예전 아이디 계정용 아이디 · 비밀번호 로그인
const adminLinkHtml = () => '<button class="auth-admin" id="openIdLogin" type="button">관리자 · 아이디로 로그인</button>';
function bindAdminLink() { $("openIdLogin").onclick = openAdminLogin; }

// 아이디 · 비밀번호 로그인 (로그인 창과 관리자 로그인 창이 같이 씁니다)
function idLoginHtml(idHint = "", pwHint = "") {
  return `
    <label class="study-label">아이디</label>
    <input class="study-input" id="loginId" autocomplete="username" placeholder="${idHint}">
    <label class="study-label">비밀번호</label>
    <input class="study-input" id="loginPw" type="password" autocomplete="current-password" placeholder="${pwHint}">
    <div class="study-err" id="authErr"></div>
    <button class="study-submit" id="doLogin">로그인</button>`;
}
function bindIdLogin() {
  const go = async () => {
    const u = $("loginId").value.trim().toLowerCase();
    const p = $("loginPw").value;
    if (!u || !p) return showErr("아이디와 비밀번호를 입력해 주세요.");
    $("doLogin").disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: `${u}@${EMAIL_DOMAIN}`, password: p });
    $("doLogin").disabled = false;
    if (error) return showErr("아이디나 비밀번호가 맞지 않아요.");
    await loadProfile();
    if (!me) {
      await sb.auth.signOut({ scope: "local" });
      return showErr("계정 정보(프로필)를 찾지 못했어요. 관리자 계정이라면 admins.sql 을 실행했는지 확인해 주세요.");
    }
    closeModal(); renderNav(); openHome();
    toast(`${me.name}님, 반가워요`);
    setTimeout(maybeOnboard, 800);
  };
  $("doLogin").onclick = go;
  $("loginPw").onkeydown = (e) => { if (e.key === "Enter") go(); };
}

// 설정 창 제목을 빠르게 7번 누르면 관리자 로그인
const ADMIN_TAPS = 7;
function bindAdminTap() {
  const t = $("studyModal").querySelector(".sheet-title");
  let n = 0, last = 0;
  t.style.userSelect = "none";
  t.onclick = () => {
    const now = Date.now();
    n = now - last < 1500 ? n + 1 : 1;
    last = now;
    if (n >= ADMIN_TAPS) openAdminLogin();
  };
}

function openAdminLogin() {
  openSheet("관리자 · 아이디로 로그인", idLoginHtml("아이디", "비밀번호"));
  bindIdLogin();
  $("loginId").focus();
}

function showErr(msg) { const e = $("authErr"); e.textContent = msg; e.classList.add("show"); }

// ---------- 탭: 시간표 · 내 일정 · 수행평가 공지 · 할 일 · 급식 ----------
// (42기 사이트의 '공부' 탭은 43기에 없습니다)
const PAGES = [["tt", "시간표"], ["cal", "내 일정"], ["notice", "수행평가"], ["todo", "할 일"], ["meal", "급식"]];
const PAGE_VIEW = { tt: "tt", cal: "feed", notice: "notice", todo: "todo", meal: "meal" };
