/* ══════════════════════════════════════
   home.js - 시작화면
══════════════════════════════════════ */
import { router }                    from '../router.js';
import { tts }                       from '../components/tts.js';
import { ticker }                    from '../components/ticker.js';
import { getSentences, getSelectedIds, getFilterLevels } from '../store.js';
import { showToast }                 from '../utils/helpers.js';

export function initHome() {
  const btnStart   = document.getElementById('btn-start');
  const btnAdmin   = document.getElementById('btn-admin');
  const countBadge = document.getElementById('home-question-count');

  btnStart.addEventListener('click', () => {
    const { sentences, error } = _getGameSentences();
    if (error) { showToast(error); return; }

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
      tts.stop();
      _updateCountBadge(countBadge);
    },
    onLeave() {},
  });
}

/** 게임에 출제할 문제 목록 결정 */
function _getGameSentences() {
  const all          = getSentences();
  const filterLevels = getFilterLevels();
  const selectedIds  = getSelectedIds();

  if (all.length === 0) {
    return { error: '📝 먼저 관리자에서 문제를 추가해주세요!' };
  }

  // 레벨 필터가 설정된 경우
  if (filterLevels.length > 0) {
    const levelSet   = new Set(filterLevels);
    const filtered   = all.filter(s => levelSet.has(s.level));
    if (filtered.length === 0) {
      return { error: '⚠️ 선택된 레벨에 문제가 없습니다. 관리자에서 확인해주세요.' };
    }
    // 필터된 목록 중 체크된 항목이 있으면 그것만, 없으면 필터된 전체
    if (selectedIds.length > 0) {
      const idSet    = new Set(selectedIds);
      const checked  = filtered.filter(s => idSet.has(s.id));
      if (checked.length > 0) return { sentences: checked };
    }
    return { sentences: filtered };
  }

  // 레벨 필터 없음: 체크된 항목이 있으면 해당 문제만, 없으면 전체
  if (selectedIds.length > 0) {
    const idSet     = new Set(selectedIds);
    const sentences = all.filter(s => idSet.has(s.id));
    if (sentences.length === 0) {
      return { error: '⚠️ 선택된 문제가 없습니다. 관리자에서 체크해주세요.' };
    }
    return { sentences };
  }

  return { sentences: all };
}

/** 홈 화면 배지 업데이트 */
function _updateCountBadge(badge) {
  if (!badge) return;
  const all          = getSentences();
  const filterLevels = getFilterLevels();
  const selectedIds  = getSelectedIds();

  if (all.length === 0) {
    badge.textContent = '등록된 문제 없음';
    badge.className   = 'home-count-badge none';
    return;
  }

  if (filterLevels.length > 0) {
    const levelSet   = new Set(filterLevels);
    const filtered   = all.filter(s => levelSet.has(s.level));
    const levelNames = [...filterLevels].sort().map(l => `Lv.${l}`).join('+');
    // 필터된 목록 중 체크된 항목이 있으면 그 수를 표시
    const idSet      = new Set(selectedIds);
    const checked    = filtered.filter(s => idSet.has(s.id));
    const count      = checked.length > 0 ? checked.length : filtered.length;
    const prefix     = checked.length > 0 ? '✅' : '🎯';
    badge.textContent = `${prefix} ${levelNames} · ${count}문제`;
    badge.className   = 'home-count-badge selected';
    return;
  }

  if (selectedIds.length > 0) {
    const idSet = new Set(all.map(s => s.id));
    const valid = selectedIds.filter(id => idSet.has(id)).length;
    badge.textContent = `✅ ${valid}문제 선택됨`;
    badge.className   = 'home-count-badge selected';
  } else {
    badge.textContent = `📚 전체 ${all.length}문제`;
    badge.className   = 'home-count-badge all';
  }
}
