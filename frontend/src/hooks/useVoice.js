/* useVoice — A 담당이 만들면 교체. 그 전까지 이 파일로 동작 */
import { useCallback, useSyncExternalStore } from 'react';

/* 소리 켜짐/꺼짐은 앱 전체가 같은 값을 쓰고, 다시 열어도 유지합니다. */
const STORAGE_KEY = 'ttobak-sound';
const listeners = new Set();
let soundOn = readSaved();

function readSaved() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function cancelSpeech() {
  try { speechSynthesis.cancel(); } catch { /* 브라우저 미지원 */ }
}

function setSoundOn(on) {
  soundOn = on;
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* 저장 불가 환경 */ }
  if (!on) cancelSpeech();
  listeners.forEach(l => l());
}

export default function useVoice() {
  const on = useSyncExternalStore(subscribe, () => soundOn);

  const speak = useCallback((text) => {
    if (!text || !soundOn) return;
    try {
      speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ''));
      ut.lang = 'ko-KR';
      ut.rate = 0.92;
      speechSynthesis.speak(ut);
    } catch { /* 브라우저 미지원 */ }
  }, []);

  return { speak, stop: cancelSpeech, soundOn: on, setSoundOn };
}
