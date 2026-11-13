/* ─────────────────────────────────────────────
   공통 헤더 (A 담당) — 모든 화면 맨 위
   왼쪽: 뒤로 / 닫기 / 홈 / 없음,  가운데: 제목,  오른쪽: 글씨 · 소리 (+ 원하면 버튼 하나 더)

   <Header left="back" title="보관함" voiceText={읽을 문장}
           right={<HeaderButton icon="user" label="내정보" onClick={...} />} />

   - left="back"  → 기본 동작은 이전 화면 (onLeft로 바꿀 수 있음)
   - left="close" → onLeft 필수 (예: B 카메라에서 "버릴까요?" 확인)
   - voiceText 를 안 주면 소리 버튼은 마지막으로 읽은 문장을 다시 읽습니다
   - 제목은 화면 정가운데에 놓입니다. (오른쪽에 버튼을 더 넣으면 남은 자리 가운데)
   - 어두운 화면(카메라)은 <div className="app dark"> 안에 두면 됩니다
───────────────────────────────────────────── */
import { useNavigate } from 'react-router-dom';
import Icon from '../utils/icons';
import { useUI } from './UIContext';
import { useVoiceContext } from './VoiceContext';
import { useT } from './i18n';

export function HeaderButton({ icon, label, onClick, className = '', children, ...rest }) {
  return (
    <button type="button" className={`ib ${className}`} onClick={onClick} aria-label={label} {...rest}>
      {children ?? <Icon name={icon} />}
      <span>{label}</span>
    </button>
  );
}

const LEFT = {
  back: { icon: 'back', key: 'hdr.back' },
  close: { icon: 'x', key: 'hdr.close' },
  home: { icon: 'back', key: 'hdr.home' },
};

export default function Header({ left = 'back', onLeft, title = '', voiceText, right = null }) {
  const navigate = useNavigate();
  const { openFontSheet } = useUI();
  const { toggle, speaking, muted } = useVoiceContext();
  const t = useT();
  // 소리 버튼 3가지: 읽는 중 → [멈춤], 꺼져 있음 → [꺼짐], 그 외 → [소리]
  const sound = speaking
    ? { icon: 'speaker', label: t('hdr.stop'), aria: t('hdr.stopAria'), cls: 'speaking' }
    : muted
      ? { icon: 'speakerOff', label: t('hdr.off'), aria: t('hdr.unmuteAria'), cls: 'muted' }
      : { icon: 'speaker', label: t('hdr.sound'), aria: t('hdr.replayAria'), cls: '' };

  const handleLeft = onLeft || (() => {
    if (left === 'home') navigate('/home');
    else if (window.history.length > 1) navigate(-1);
    else navigate('/home', { replace: true });
  });

  return (
    <header className={`hdr${right ? '' : ' centered'}`}>
      <div className="hdr-l">
        {LEFT[left] && <HeaderButton icon={LEFT[left].icon} label={t(LEFT[left].key)} onClick={handleLeft} />}
      </div>

      <div className="ttl">{title}</div>

      <div className="hdr-r">
        <HeaderButton label={t('hdr.font')} onClick={openFontSheet} aria-label={t('hdr.fontAria')}>
          <span className="gg" aria-hidden="true">가<small>가</small></span>
        </HeaderButton>
        <HeaderButton
          icon={sound.icon}
          label={sound.label}
          className={sound.cls}
          onClick={() => toggle(voiceText)}
          aria-label={sound.aria}
          aria-pressed={speaking}
        />
        {right}
      </div>
    </header>
  );
}
