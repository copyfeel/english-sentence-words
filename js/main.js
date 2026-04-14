/* ══════════════════════════════════════
   main.js - 앱 진입점
══════════════════════════════════════ */
import { router }     from './router.js';
import { initHome }   from './screens/home.js';
import { initAdmin }  from './screens/admin.js';
import { initGame }   from './screens/game.js';
import { initResult } from './screens/result.js';

// 각 화면 초기화 (이벤트 리스너 등록)
initHome();
initAdmin();
initGame();
initResult();

// 앱 시작: 홈 화면으로
router.navigate('home');

// iOS BFCache 복원 대응 (뒤로가기로 캐시된 페이지 복원 시)
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    router.navigate('home');
  }
});
