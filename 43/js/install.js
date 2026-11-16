// ===== 앱 설치 (PWA) =====
(function () {
  const bar = document.getElementById('installBar');
  const btn = document.getElementById('installBtn');
  const sheet = document.getElementById('iosSheet');
  const steps = document.getElementById('iosSteps');
  let deferred = null;

  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const dismissed = (function () { try { return localStorage.getItem('installDismissed') === '1'; } catch (e) { return false; } })();
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const inApp = /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\//i.test(ua);

  // 설치 막대는 안드로이드에서만 띄웁니다. 아이폰 · 아이패드는 로그인 직후 안내와 설정 창의 그림 안내(js/ 의 iosGuideHtml)로 알려 줍니다.
  function show() { if (!standalone && !dismissed && isAndroid) bar.classList.add('show'); }

  // 안드로이드 크롬 등: 네이티브 설치 프롬프트
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    window.__deferredInstall = e;
    show();
  });

  // 프롬프트가 오지 않는 환경(iOS, 삼성 인터넷 일부, 인앱 브라우저)에도 수동 안내가 뜨도록
  setTimeout(show, 1400);

  btn.addEventListener('click', async () => {
    if (deferred) {
      try {
        deferred.prompt();
        const res = await deferred.userChoice;
        deferred = null;
        window.__deferredInstall = null;
        if (res && res.outcome === 'accepted') {
          bar.classList.remove('show');
          return;
        }
      } catch (err) { deferred = null; window.__deferredInstall = null; }
    }
    let list;
    if (inApp) {
      list = ['오른쪽 위 <b>⋮ / 공유</b> 버튼을 누르세요', '<b>다른 브라우저로 열기</b>(Chrome·Safari)를 선택하세요', '열린 브라우저에서 다시 <b>설치</b>를 눌러주세요'];
    } else if (isIOS) {
      list = ['사파리 아래쪽의 <b>공유 버튼</b>(↑)을 누르세요', '<b>홈 화면에 추가</b>를 선택하세요', '오른쪽 위 <b>추가</b>를 누르면 끝이에요'];
    } else if (/SamsungBrowser/i.test(ua)) {
      list = ['화면 아래 <b>≡ 메뉴</b>를 누르세요', '<b>현재 페이지 추가</b>를 선택하세요', '<b>홈 화면</b>을 고르고 <b>추가</b>를 누르면 끝이에요', '설치가 계속 실패하면 <b>크롬</b>으로 열어보세요'];
    } else {
      list = ['브라우저 오른쪽 위 <b>⋮ 메뉴</b>를 누르세요', '<b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택하세요', '<b>설치</b>를 누르면 끝이에요'];
    }
    steps.innerHTML = list.map((t, i) => `<div class="ios-step"><div class="ios-num">${i + 1}</div><div>${t}</div></div>`).join('');
    document.getElementById('installNotes').innerHTML = installNotesHTML();
    sheet.classList.add('show');
  });

  document.getElementById('installX').addEventListener('click', () => {
    bar.classList.remove('show');
    try { localStorage.setItem('installDismissed', '1'); } catch (e) {}
  });

  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('show'); });
  window.addEventListener('appinstalled', () => bar.classList.remove('show'));

  // 서비스 워커 등록 (오프라인 + 설치 조건)
  // 페이지·스크립트는 서비스 워커가 받아 둔 것으로 바로 열고(서버를 기다리지 않음), 새 버전은 뒤에서 받습니다.
  // 새 버전이 준비되면(controllerchange) 연 지 얼마 안 됐을 때는 바로, 쓰는 중이면 화면을 떠날 때 다시 엽니다.
  // 새로고침 안내는 띄우지 않고, 바뀐 내용은 아래 "업데이트 소식" 이 알려 줍니다.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const sw = navigator.serviceWorker;
    const hadCtrl = !!sw.controller, opened = Date.now();
    let reg = null, waiting = false, reloading = false;
    // 로그인 확인(js/ 의 dshsSettled)이 끝난 뒤에 다시 엽니다. 도중에 열면 로그인이 풀릴 수 있어요. 10초가 지나면 그냥 엽니다.
    const reload = () => {
      if (reloading) return;
      reloading = true;
      Promise.race([window.dshsSettled, new Promise(r => setTimeout(r, 10000))]).then(() => location.reload());
    };
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    sw.addEventListener('controllerchange', () => {
      if (!hadCtrl) return;   // 처음 설치된 경우는 이미 최신
      if (Date.now() - opened < 15000 && !typing()) reload();
      else waiting = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (waiting) reload(); }
      else reg?.update().catch(() => {});   // 앱으로 돌아오면 새 버전이 있는지 확인
    });
    window.addEventListener('load', () => {
      sw.register('sw.js').then(r => { reg = r; }).catch(() => {});
    });
  }
})();

// ===== 설치 중 경고 안내 =====
function installNotesHTML() {
  const ua = navigator.userAgent;
  if (!/Android/.test(ua)) return '';
  const samsung = /SamsungBrowser/i.test(ua);
  return `
    <div class="warn-note">
      <div class="hd">${icon('warning')} "안전하지 않은 앱" 경고가 떠도 괜찮아요</div>
      안드로이드는 <b>플레이스토어를 거치지 않은 설치</b>에 무조건 이 경고를 띄웁니다. 바이러스가 발견된 게 아니라, 출처를 확인할 수 없다는 뜻이에요.
      이 앱은 <b>웹페이지 하나</b>일 뿐이고, 연락처·사진 같은 권한은 아무것도 요구하지 않습니다.<br>
      경고가 뜨면 <b>자세히 / 더보기 → 무시하고 설치</b>를 누르면 됩니다.
    </div>
    ${samsung ? `<div class="alt-note">
      <b>경고 없이 설치하려면 크롬을 쓰세요.</b> 삼성 인터넷은 설치 파일을 직접 만들어서 경고가 뜨지만, 크롬은 구글이 서명한 방식이라 경고 없이 설치됩니다.<br>
      설치가 부담스러우면 <b>≡ 메뉴 → 현재 페이지 추가 → 홈 화면</b>으로 <b>바로가기만</b> 추가해도 됩니다. 경고가 전혀 없고 화면·기능은 똑같아요.
    </div>` : `<div class="alt-note">
      설치가 부담스러우면 메뉴에서 <b>홈 화면에 추가</b>로 <b>바로가기만</b> 만들어도 됩니다. 경고가 전혀 없고 화면·기능은 똑같아요.
    </div>`}`;
}

// ===== 설치 진단 =====
async function runInstallDiagnostics() {
  const box = document.getElementById('diagList');
  box.style.display = 'block';
  box.innerHTML = '<div class="diag-row"><span class="st">' + icon('hourglass_top') + '</span><span class="ms">확인 중…</span></div>';
  const rows = [];
  const add = (ok, label, detail) => rows.push({ok, label, detail});

  // 1. HTTPS
  const secure = location.protocol === 'https:' || location.hostname === 'localhost';
  add(secure, 'HTTPS 접속', secure ? location.origin : `${location.protocol} 은 설치 불가 — https 주소로 접속하세요`);

  // 2. manifest
  let manifest = null, mUrl = '';
  try {
    const link = document.querySelector('link[rel="manifest"]');
    mUrl = link ? link.href : '';
    const r = await fetch(mUrl, {cache: 'no-store'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    manifest = await r.json();
    add(true, 'manifest.webmanifest', `${manifest.name || '?'} · display: ${manifest.display}`);
  } catch (e) {
    add(false, 'manifest.webmanifest', '불러오기 실패 — 파일이 같은 폴더에 올라갔는지 확인 (' + e.message + ')');
  }

  // 3. 아이콘
  if (manifest && manifest.icons) {
    const results = await Promise.all(manifest.icons.map(async ic => {
      try {
        const u = new URL(ic.src, mUrl).href;
        const r = await fetch(u, {cache: 'no-store'});
        return {src: ic.src, ok: r.ok && (r.headers.get('content-type') || '').includes('image')};
      } catch (e) { return {src: ic.src, ok: false}; }
    }));
    const bad = results.filter(r => !r.ok);
    add(bad.length === 0, `아이콘 ${results.length}개`,
      bad.length === 0 ? '모두 정상' : '없음: ' + bad.map(b => b.src).join(', '));
  } else {
    add(false, '아이콘', 'manifest를 읽지 못해 확인 불가');
  }

  // 4. 서비스 워커
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const ctrl = !!navigator.serviceWorker.controller;
      add(regs.length > 0, '서비스 워커', regs.length === 0 ? 'sw.js 등록 실패 — 파일이 있는지 확인' : (ctrl ? '작동 중' : '등록됨 (새로고침하면 활성화)'));
    } catch (e) { add(false, '서비스 워커', e.message); }
  } else {
    add(false, '서비스 워커', '이 브라우저가 지원하지 않음');
  }

  // 5. 설치 프롬프트
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) add(true, '설치 상태', '이미 앱으로 실행 중이에요');
  else add(!!window.__deferredInstall, '설치 프롬프트', window.__deferredInstall ? '준비됨 — 설치 버튼을 누르세요' : '아직 안 뜸 — 브라우저 메뉴로 직접 추가하세요');

  const bad = rows.filter(r => !r.ok);
  box.innerHTML = rows.map(r =>
    `<div class="diag-row ${r.ok ? 'ok' : 'bad'}"><span class="st">${icon(r.ok ? 'check_circle' : 'cancel', r.ok ? 'ok' : 'bad')}</span><span class="ms"><b style="color:var(--text)">${r.label}</b> — ${r.detail}</span></div>`
  ).join('') + `<div class="diag-sum">${bad.length === 0
    ? '설치 조건은 모두 갖춰졌어요. 프롬프트가 안 뜨면 브라우저 <b>메뉴 → 현재 페이지 추가 / 홈 화면에 추가</b>로 넣어도 똑같이 동작합니다.'
    : `<b>${bad.length}개 항목</b>에 문제가 있어요. 위의 ${icon('cancel', 'bad')} 내용을 그대로 알려주면 고칠 수 있어요.`}</div>`;
}
