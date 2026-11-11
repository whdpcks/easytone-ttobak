/* ─────────────────────────────────────────────
   useVoice — 화면 음성 (A 담당, 팀 공용)

   1) 화면 들어올 때 자동으로 읽기 + 나갈 때 멈춤
        const voice = useVoice('보관함이에요. 찾고 싶은 종이를 말해 주세요.');

   2) 원할 때 읽기 (D의 기존 사용법 그대로 동작)
        const { speak, stop } = useVoice();
        speak('준비물은 신분증이에요.');

   3) 소리 버튼은 공통 Header가 처리합니다. 직접 만들 때만:
        <button onClick={voice.toggle}>소리</button>   // 읽는 중이면 멈춤, 아니면 다시 듣기

   C의 결과 화면에는 announce={speak} 로 넘기면 됩니다.
───────────────────────────────────────────── */
import { useCallback, useEffect } from 'react';
import { useVoiceContext } from '../common/VoiceContext';

export default function useVoice(text, { auto = true } = {}) {
  const v = useVoiceContext();
  const { speak, stop } = v;

  useEffect(() => {
    if (!auto || !text) return undefined;
    speak(text);
    return () => stop();
  }, [auto, text, speak, stop]);

  const toggle = useCallback(() => v.toggle(text), [v, text]);

  return {
    speak,
    stop,
    toggle,
    replay: text ? () => speak(text) : v.replay,
    speaking: v.speaking,
    caption: v.caption,
  };
}
