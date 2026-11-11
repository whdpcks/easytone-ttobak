/* 브라우저 저장 키 — 팀 전체가 같은 이름을 씁니다. */
export const STORAGE = {
  token: 'ttobak-token',            // 로그인 토큰 (D의 api/documents.js와 같은 키)
  scale: 'ttobak-scale',            // 글씨 크기 1 | 1.25 | 1.5
  rate: 'ttobak-rate',              // 목소리 빠르기
  lang: 'ttobak-lang',              // 사용할 말 ko | en | zh | vi
  cameraIntroSeen: 'ttobak-camera-intro-seen', // B: 촬영 안내 애니메이션을 봤는지 ('1')
};

export function readStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch { /* 사생활 보호 모드 등 저장 불가 */ }
}
