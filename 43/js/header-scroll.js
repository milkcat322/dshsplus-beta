// 폰: 내리는 만큼(hp 0 → 1) 로고가 가운데(크게)에서 왼쪽 위(작게)로 이어서 옮겨 갑니다. 안 보이는 순간 없이 한 로고가 움직여요.
(() => {
  const head = document.querySelector('.header'), logo = document.querySelector('.nav-logo'), row = document.querySelector('.nav-icons');
  const phone = matchMedia('(max-width: 640px)');
  const BIG = 22 / 16;   // 맨 위 로고 글자 크기 / 위에 붙은 로고 글자 크기
  const RANGE = 40;      // 이만큼(px) 내리면 다 옮겨집니다
  let ticking = false;
  const check = () => {
    ticking = false;
    const top = -head.getBoundingClientRect().top;
    const hp = Math.min(1, Math.max(0, top / RANGE));
    document.body.style.setProperty('--hp', hp.toFixed(3));
    document.body.classList.toggle('scrolled', hp >= 1);
    if (!phone.matches) { logo.style.transform = ''; return; }
    const ease = hp * hp * (3 - 2 * hp);   // 처음과 끝을 부드럽게
    const s = BIG + (1 - BIG) * ease;
    const x0 = (row.clientWidth - logo.offsetWidth * BIG) / 2;   // 가운데에 있을 때 왼쪽 끝 위치
    logo.style.transform = `translateX(${(x0 * (1 - ease)).toFixed(1)}px) scale(${s.toFixed(3)})`;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  addEventListener('resize', check);
  addEventListener('load', check);   // 글꼴이 바뀌면 로고 너비가 달라집니다
  phone.addEventListener('change', check);
  check();
})();
