/* ══════════════════════════════════════
   tts.js - Web Speech API (TTS) 래퍼
   iOS Safari: 사용자 제스처 후 unlock 필수
══════════════════════════════════════ */

class TTS {
  constructor() {
    this._voice    = null;
    this._unlocked = false;
  }

  /** 게임 시작 버튼 클릭 등 사용자 제스처 시 호출 */
  unlock() {
    if (this._unlocked || !window.speechSynthesis) return;
    const utt  = new SpeechSynthesisUtterance('');
    utt.volume = 0;
    utt.lang   = 'en-US';
    try {
      speechSynthesis.speak(utt);
      this._unlocked = true;
    } catch {}
  }

  /** voiceURI로 음성 설정 */
  setVoiceByURI(voiceURI) {
    if (!voiceURI) { this._voice = null; return; }
    const voices = speechSynthesis.getVoices();
    this._voice  = voices.find(v => v.voiceURI === voiceURI) ?? null;
  }

  /**
   * 텍스트 발화
   * @returns {SpeechSynthesisUtterance} - onend 등 이벤트 리스너 등록 가능
   */
  speak(text, rate = 0.88) {
    if (!window.speechSynthesis) return _nullUtt();
    speechSynthesis.cancel(); // 이전 발화 중단
    const utt  = new SpeechSynthesisUtterance(text);
    utt.lang   = 'en-US';
    utt.rate   = rate;
    utt.pitch  = 1.0;
    if (this._voice) utt.voice = this._voice;
    try {
      speechSynthesis.speak(utt);
    } catch (e) {
      console.warn('[TTS] speak 실패:', e);
    }
    return utt;
  }

  stop() {
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /**
   * 고품질 영어 음성 3개 반환
   *
   * 반환 구성:
   *  [0] Voice 1 - 최고 품질 (기존에 좋았던 음성)
   *  [1] Voice 2 - 고품질 여성 (en-US 우선)
   *  [2] Voice 3 - 고품질 영국 남성 (en-GB 우선)
   */
  static async getEnglishVoices() {
    return new Promise(resolve => {
      function _pick() {
        const all = speechSynthesis.getVoices();
        const en  = all.filter(v => v.lang.startsWith('en'));
        if (!en.length) return [];

        // 이름 중복 제거
        const seen   = new Set();
        const unique = en.filter(v => {
          if (seen.has(v.name)) return false;
          seen.add(v.name);
          return true;
        });

        // ── 성별 목록 ───────────────────────────────
        const FEMALE_NAMES = [
          'Samantha','Ava','Serena','Karen','Moira',
          'Tessa','Veena','Allison','Susan','Zoe',
          'Alice','Fiona','Victoria','Stephanie',
        ];
        // 영국 남성 우선 목록 (en-GB 고품질)
        const GB_MALE_NAMES = [
          'Daniel','Arthur','Oliver','Gordon','Malcolm',
          'James','Harry','George',
        ];
        // 기타 남성
        const MALE_NAMES = [
          ...GB_MALE_NAMES,
          'Alex','Tom','Lee','Rishi','Nathan','Aaron','Fred',
        ];

        function _gender(v) {
          const base = v.name.split(' ')[0];
          if (FEMALE_NAMES.includes(base)) return 'female';
          if (MALE_NAMES.includes(base))   return 'male';
          return 'unknown';
        }

        // ── 일반 품질 점수 (Voice 1·2용) ────────────
        function _score(v) {
          let s = 0;
          if (v.name.includes('Enhanced')) s += 100;
          if (v.name.includes('Premium'))  s += 90;
          if (v.lang === 'en-US')          s += 30;
          else if (v.lang === 'en-GB')     s += 20;
          else if (v.lang === 'en-AU')     s += 10;
          const base = v.name.split(' ')[0];
          if (FEMALE_NAMES.includes(base) || MALE_NAMES.includes(base)) s += 15;
          return s;
        }

        // ── 영국 남성 품질 점수 (Voice 3 전용) ────────
        function _gbMaleScore(v) {
          let s = 0;
          if (v.name.includes('Enhanced')) s += 100;
          if (v.name.includes('Premium'))  s += 90;
          // 영국(en-GB) 최우선
          if (v.lang === 'en-GB')          s += 60;
          else if (v.lang === 'en-AU')     s += 10;
          // else (en-US 등)               s += 0  ← 영국 아니면 감점 없음, 단 후순위
          const base = v.name.split(' ')[0];
          if (GB_MALE_NAMES.includes(base))s += 30; // 알려진 영국 남성 이름
          else if (MALE_NAMES.includes(base)) s += 10;
          return s;
        }

        // 전체 정렬 (일반 품질)
        unique.sort((a, b) => _score(b) - _score(a));

        // Voice 1: 전체 최고 품질
        const best = unique[0];
        const rest = unique.slice(1);

        // Voice 2: 최고 품질 여성
        const female = rest.find(v => _gender(v) === 'female')
                    ?? rest.find(v => _gender(v) === 'unknown')
                    ?? rest[0];

        // Voice 3: 영국 남성 최우선 선택
        const gbMaleCandidates = rest
          .filter(v => v !== female)
          .sort((a, b) => _gbMaleScore(b) - _gbMaleScore(a));

        const male = gbMaleCandidates[0]
                  ?? rest.find(v => v !== female)
                  ?? best;

        // 유효한 것만 반환 (중복 제거)
        const result = [best, female, male].filter(Boolean);
        const out    = [];
        const outURI = new Set();
        for (const v of result) {
          if (!outURI.has(v.voiceURI)) { out.push(v); outURI.add(v.voiceURI); }
          if (out.length === 3) break;
        }
        // 3개 미만이면 나머지 채움
        for (const v of unique) {
          if (out.length >= 3) break;
          if (!outURI.has(v.voiceURI)) { out.push(v); outURI.add(v.voiceURI); }
        }
        return out;
      }

      if (!window.speechSynthesis) { resolve([]); return; }

      const voices = _pick();
      if (voices.length > 0) { resolve(voices); return; }

      // Chrome/Firefox: voiceschanged 이벤트 대기
      const handler = () => resolve(_pick());
      speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
      setTimeout(() => {
        speechSynthesis.removeEventListener('voiceschanged', handler);
        resolve(_pick());
      }, 2000);
    });
  }
}

function _nullUtt() {
  return { onend: null };
}

export const tts = new TTS();
export { TTS };
