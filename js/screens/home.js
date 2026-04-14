/* ══════════════════════════════════════
   home.js - 시작화면
══════════════════════════════════════ */
import { router }     from '../router.js';
import { tts }        from '../components/tts.js';
import { ticker }     from '../components/ticker.js';
import { getSentences } from '../store.js';
import { showToast }  from '../utils/helpers.js';

export function initHome() {
  const btnStart = document.getElementById('btn-start');
  const btnAdmin = document.getElementById('btn-admin');

  btnStart.addEventListener('click', () => {
    const sentences = getSentences();
    if (sentences.length === 0) {
      showToast('📝 먼저 관리자에서 문제를 추가해주세요!');
      return;
    }

    // iOS 오디오/TTS 잠금 해제 (사용자 제스처 컨텍스트)
    tts.unlock();
    ticker.init();

    router.navigate('game', { sentences, isWrongOnly: false });
  });

  btnAdmin.addEventListener('click', () => {
    router.navigate('admin');
  });

  router.register('home', {
    onEnter() {
      // 결과 화면에서 돌아올 때 TTS 정지
      tts.stop();
    },
    onLeave() {},
  });
}
