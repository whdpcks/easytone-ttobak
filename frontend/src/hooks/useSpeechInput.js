/* ─────────────────────────────────────────────
   D 담당 — 말로 입력하기 (보관함 '말로 찾기')

   const mic = useSpeechInput({ onText, onDone, onError });
     mic.supported  이 브라우저가 음성 인식을 하는지
     mic.listening  지금 듣는 중인지
     mic.toggle()   듣기 시작 / 멈추기
   - onText(글자): 말하는 동안 계속 (검색창에 실시간으로 채움)
   - onDone(글자): 말이 끝나면 한 번 (그 말로 검색)
   - onError(종류): 'none'(못 알아들음) | 'denied'(마이크 거절) | 'network' | 'unsupported'

   브라우저에 들어 있는 음성 인식(Web Speech API)을 씀 → 서버·키 없음.
   크롬·안드로이드·아이폰 사파리·삼성 인터넷에서 됨. https(또는 localhost)에서만 마이크가 켜짐.
───────────────────────────────────────────── */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '../common/SettingsContext';
import { useVoiceContext } from '../common/VoiceContext';

const getRecognition = () => (typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition || null
  : null);

/* 앱에서 고른 말 → 음성 인식 언어 */
const SPEECH_LANG = {
  ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', vi: 'vi-VN', th: 'th-TH',
  id: 'id-ID', fil: 'fil-PH', km: 'km-KH', my: 'my-MM', hi: 'hi-IN', ne: 'ne-NP',
};

export default function useSpeechInput({ onText, onDone, onError }) {
  const { lang } = useSettings();
  const { stop: stopVoice } = useVoiceContext();
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const handlers = useRef({ onText, onDone, onError });
  handlers.current = { onText, onDone, onError };

  // 화면을 떠나면 듣기도 멈춤
  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Recognition = getRecognition();
    if (!Recognition) { handlers.current.onError?.('unsupported'); return; }
    stopVoice();  // 앱이 읽어 주는 소리를 마이크가 받아 적지 않게 먼저 멈춤

    const r = new Recognition();
    r.lang = SPEECH_LANG[lang] || 'ko-KR';
    r.interimResults = true;   // 말하는 중에도 글자를 받음
    r.continuous = false;      // 말을 멈추면 끝
    r.maxAlternatives = 1;

    let finalText = '';
    let failed = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i += 1) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = text;
      }
      handlers.current.onText?.(text.trim());
    };
    r.onerror = (e) => {
      if (e.error === 'aborted') return;  // 직접 멈춘 것
      failed = true;
      const kind = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied'
        : e.error === 'network' ? 'network' : 'none';
      handlers.current.onError?.(kind);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      const text = finalText.trim();
      if (text) handlers.current.onDone?.(text);
      else if (!failed) handlers.current.onError?.('none');
    };

    rec.current = r;
    setListening(true);
    try { r.start(); } catch { rec.current = null; setListening(false); }
  }, [lang, stopVoice]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);  // 멈춰도 그때까지 들은 말로 검색

  const toggle = useCallback(() => (rec.current ? stop() : start()), [start, stop]);

  return { supported: !!getRecognition(), listening, toggle, stop };
}
