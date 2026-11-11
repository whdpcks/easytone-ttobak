/* ─────────────────────────────────────────────
   음성 읽기 + 자막 (A 담당)

   - 서버 음성(GET /tts, 신경망 목소리 mp3)을 <audio>로 재생합니다.
     서버 음성이 안 되면 브라우저 내장 TTS(speechSynthesis)로 자동 전환합니다.
   - 문장 단위로 끊어 읽고, 지금 읽는 문장을 자막 바에 보여줍니다.
     다음 문장은 미리 받아 둬서 문장 사이가 끊기지 않게 합니다.
   - 브라우저는 첫 터치 전에는 소리를 막습니다. 터치 전에 들어온 문장은
     기다렸다가 첫 터치 때 읽습니다. 그동안 자막은 바로 보입니다.

   화면에서는 보통 hooks/useVoice 를 씁니다.
───────────────────────────────────────────── */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../api/client';
import { useSettings } from './SettingsContext';

const VoiceContext = createContext(null);

const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window;
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

export const cleanText = (t) => String(t ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** "안녕하세요. 또박입니다." → ["안녕하세요.", "또박입니다."] */
export function splitSentences(text) {
  const t = cleanText(text);
  if (!t) return [];
  return t.split(/(?<=[.!?。？！])\s+/).map(s => s.trim()).filter(Boolean);
}

export const ttsUrl = (text, { lang = 'ko', rate = 0.92 } = {}) =>
  `${API_BASE}/tts?${new URLSearchParams({ text, lang, rate: String(rate) })}`;

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

  const genRef = useRef(0);          // stop/새 speak 때마다 증가 → 이전 재생의 콜백 무시
  const lastTextRef = useRef('');
  const pendingRef = useRef('');
  const unlockedRef = useRef(false);
  const audioRef = useRef(null);
  const serverFailRef = useRef(0);   // 서버 음성이 연달아 실패하면 브라우저 음성으로
  const voiceRef = useRef(findKoreanVoice());
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }
    return audioRef.current;
  };

  useEffect(() => {
    if (!hasTTS) return undefined;
    const load = () => { voiceRef.current = findKoreanVoice(); };
    load();
    window.speechSynthesis.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load);
  }, []);

  const finish = useCallback((gen) => {
    if (gen !== genRef.current) return;
    setSpeaking(false);
    setCaption(lastTextRef.current);
  }, []);

  /* 브라우저 내장 음성 (예비) */
  const playBrowser = useCallback((gen, sentences) => {
    if (!hasTTS || sentences.length === 0) { finish(gen); return; }
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch { /* 무시 */ }
    setTimeout(() => {
      if (gen !== genRef.current) return;
      sentences.forEach((s, i) => {
        const u = new SpeechSynthesisUtterance(s);
        u.lang = 'ko-KR';
        if (voiceRef.current) u.voice = voiceRef.current;
        u.rate = rateRef.current;
        u.onstart = () => { if (gen === genRef.current) { setSpeaking(true); setCaption(s); } };
        const done = () => { if (i === sentences.length - 1) finish(gen); };
        u.onend = done;
        u.onerror = done;
        try { synth.speak(u); } catch { done(); }
      });
    }, 60);
  }, [finish]);

  /* 서버 음성: 한 문장씩 이어서 재생 */
  const playServer = useCallback((gen, sentences, i = 0) => {
    if (gen !== genRef.current) return;
    if (i >= sentences.length) { finish(gen); return; }

    const opts = { rate: rateRef.current };
    const s = sentences[i];
    if (i + 1 < sentences.length) {
      fetch(ttsUrl(sentences[i + 1], opts)).catch(() => {});  // 다음 문장 미리 받기
    }

    const a = getAudio();
    let failed = false;
    const fallback = () => {
      if (failed || gen !== genRef.current) return;
      failed = true;
      serverFailRef.current += 1;
      playBrowser(gen, sentences.slice(i));
    };
    a.onended = () => {
      if (gen !== genRef.current) return;
      serverFailRef.current = 0;
      playServer(gen, sentences, i + 1);
    };
    a.onerror = fallback;
    a.onplaying = () => { if (gen === genRef.current) { setSpeaking(true); setCaption(s); } };
    a.src = ttsUrl(s, opts);
    a.play().catch(fallback);
  }, [finish, playBrowser]);

  const play = useCallback((text) => {
    const gen = ++genRef.current;
    const sentences = splitSentences(text);
    if (sentences.length === 0) { setSpeaking(false); return; }
    if (hasTTS) { try { window.speechSynthesis.cancel(); } catch { /* 무시 */ } }
    if (serverFailRef.current >= 2) playBrowser(gen, sentences);
    else playServer(gen, sentences);
  }, [playBrowser, playServer]);

  const stop = useCallback(() => {
    genRef.current += 1;
    pendingRef.current = '';
    audioRef.current?.pause();
    if (hasTTS) { try { window.speechSynthesis.cancel(); } catch { /* 무시 */ } }
    setSpeaking(false);
    setCaption(lastTextRef.current);
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
    // iOS 사파리: 터치 이벤트 안에서 한 번 재생해 둬야 이후 자동 재생이 됨
    const a = getAudio();
    a.src = SILENT_WAV;
    a.play().catch(() => {});
    if (hasTTS) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch { /* 무시 */ }
    }
    if (pendingRef.current) {
      const t = pendingRef.current;
      pendingRef.current = '';
      setTimeout(() => play(t), 0);
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
    supported: true,
  }), [speak, stop, toggle, unlock, speaking, caption, unlocked]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice는 VoiceProvider 안에서만 쓸 수 있어요.');
  return ctx;
}
