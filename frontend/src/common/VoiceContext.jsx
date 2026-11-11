/* ─────────────────────────────────────────────
   음성 읽기 + 자막 (A 담당)

   - 브라우저 내장 TTS(speechSynthesis), 한국어 목소리
   - 문장 단위로 끊어 읽고, 지금 읽는 문장을 자막 바에 보여줍니다
     (긴 글을 한 번에 넘기면 크롬이 15초쯤에서 끊기는 문제도 피함)
   - 브라우저는 첫 터치 전에는 소리를 막습니다. 터치 전에 들어온 문장은
     기다렸다가 첫 터치 때 읽습니다. 그동안 자막은 바로 보입니다.
   - 한국어 목소리가 없는 기기면 자막만 보여줍니다 (플랜 B)

   화면에서는 보통 hooks/useVoice 를 씁니다.
───────────────────────────────────────────── */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './SettingsContext';

const VoiceContext = createContext(null);

const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;

export const cleanText = (t) => String(t ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** "안녕하세요. 또박입니다." → ["안녕하세요.", "또박입니다."] */
export function splitSentences(text) {
  const t = cleanText(text);
  if (!t) return [];
  return t.split(/(?<=[.!?。？！])\s+/).map(s => s.trim()).filter(Boolean);
}

function findKoreanVoice() {
  if (!hasTTS) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'ko-KR' && v.localService) ||
    voices.find(v => v.lang?.toLowerCase().replace('_', '-').startsWith('ko')) ||
    null
  );
}

export function VoiceProvider({ children }) {
  const { rate } = useSettings();
  const [caption, setCaption] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [voiceReady, setVoiceReady] = useState(() => Boolean(findKoreanVoice()));

  const genRef = useRef(0);          // stop/새 speak 때마다 증가 → 이전 문장의 콜백 무시
  const lastTextRef = useRef('');
  const pendingRef = useRef('');
  const unlockedRef = useRef(false);
  const voiceRef = useRef(findKoreanVoice());
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // 목소리 목록은 늦게 도착하는 브라우저가 많음
  useEffect(() => {
    if (!hasTTS) return;
    const load = () => {
      voiceRef.current = findKoreanVoice();
      setVoiceReady(Boolean(voiceRef.current));
    };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    pendingRef.current = '';
    if (hasTTS) { try { window.speechSynthesis.cancel(); } catch { /* 무시 */ } }
    setSpeaking(false);
    setCaption(lastTextRef.current);
  }, []);

  const play = useCallback((text) => {
    const gen = ++genRef.current;
    const sentences = splitSentences(text);
    if (!hasTTS || sentences.length === 0) { setSpeaking(false); return; }
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* 무시 */ }

    // cancel 직후 바로 speak하면 크롬이 가끔 삼켜서 아주 잠깐 기다림
    setTimeout(() => {
      if (gen !== genRef.current) return;
      sentences.forEach((s, i) => {
        const u = new SpeechSynthesisUtterance(s);
        u.lang = 'ko-KR';
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = rateRef.current;
        u.onstart = () => {
          if (gen !== genRef.current) return;
          setSpeaking(true);
          setCaption(s);
        };
        const done = () => {
          if (gen !== genRef.current) return;
          if (i === sentences.length - 1) {
            setSpeaking(false);
            setCaption(lastTextRef.current);
          }
        };
        u.onend = done;
        u.onerror = done;
        try { synth.speak(u); } catch { done(); }
      });
    }, 60);
  }, []);

  /** 문장을 읽습니다. 터치 전이면 자막만 띄우고 첫 터치 때 읽습니다. */
  const speak = useCallback((text) => {
    const t = cleanText(text);
    if (!t) return;
    lastTextRef.current = t;
    setCaption(t);
    if (!unlockedRef.current) { pendingRef.current = t; return; }
    play(t);
  }, [play]);

  /** 소리 버튼: 읽는 중이면 멈추고, 아니면 (text 또는 마지막 문장을) 다시 읽기 */
  const toggle = useCallback((text) => {
    if (speaking) { stop(); return; }
    speak(text || lastTextRef.current);
  }, [speaking, speak, stop]);

  /** 사용자 터치 순간에 호출하면 소리가 풀립니다. (첫 터치에서 자동으로도 호출됨) */
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    setUnlocked(true);
    if (hasTTS) {
      // iOS 사파리: 터치 이벤트 안에서 한 번 speak 해야 이후 소리가 남
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch { /* 무시 */ }
    }
    if (pendingRef.current) {
      const t = pendingRef.current;
      pendingRef.current = '';
      play(t);
    }
  }, [play]);

  useEffect(() => {
    const onFirst = () => unlock();
    window.addEventListener('pointerdown', onFirst, { once: true, capture: true });
    window.addEventListener('keydown', onFirst, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', onFirst, { capture: true });
      window.removeEventListener('keydown', onFirst, { capture: true });
    };
  }, [unlock]);

  // 탭을 떠나면 멈춤
  useEffect(() => {
    const onHide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  const value = useMemo(() => ({
    speak, stop, toggle, unlock,
    replay: () => speak(lastTextRef.current),
    speaking, caption, unlocked,
    supported: hasTTS,
    hasKoreanVoice: voiceReady,
  }), [speak, stop, toggle, unlock, speaking, caption, unlocked, voiceReady]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice는 VoiceProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
