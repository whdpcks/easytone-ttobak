/* useVoice — A 담당이 만들면 교체. 그 전까지 이 파일로 동작 */
import { useCallback, useRef } from 'react';

export default function useVoice() {
  const utRef = useRef(null);

  const speak = useCallback((text) => {
    if (!text) return;
    const clean = text.replace(/<[^>]+>/g, '');
    try {
      speechSynthesis.cancel();
      const ut = new SpeechSynthesisUtterance(clean);
      ut.lang = 'ko-KR';
      ut.rate = 0.92;
      utRef.current = ut;
      speechSynthesis.speak(ut);
    } catch (e) {
      /* 브라우저 미지원 시 무시 */
    }
  }, []);

  const stop = useCallback(() => {
    try { speechSynthesis.cancel(); } catch (e) {}
  }, []);

  return { speak, stop };
}
