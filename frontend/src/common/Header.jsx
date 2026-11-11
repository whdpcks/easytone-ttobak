/* ─────────────────────────────────────────────
   공통 헤더 (A 담당) — 모든 화면 맨 위
   왼쪽: 뒤로 / 닫기 / 홈 / 없음,  가운데: 제목,  오른쪽: 글씨 · 소리 (+ 원하면 버튼 하나 더)

   <Header left="back" title="보관함" voiceText={읽을 문장}
           right={<HeaderButton icon="user" label="내정보" onClick={...} />} />

   - left="back"  → 기본 동작은 이전 화면 (onLeft로 바꿀 수 있음)
   - left="close" → onLeft 필수 (예: B 카메라에서 "버릴까요?" 확인)
   - voiceText 를 안 주면 소리 버튼은 마지막으로 읽은 문장을 다시 읽습니다
   - dark: 카메라처럼 어두운 화면이면 <div className="app dark"> 안에 두면 됩니다
───────────────────────────────────────────── */
import { useNavigate } from 'react-router-dom';
import Icon from '../utils/icons';
import { useUI } from './UIContext';
import { useVoiceContext } from './VoiceContext';

export function HeaderButton({ icon, label, onClick, className = '', children, ...rest }) {
  return (
    <button type="button" className={`ib ${className}`} onClick={onClick} aria-label={label} {...rest}>
      {children ?? <Icon name={icon} />}
      <span>{label}</span>
    </button>
  );
}

const LEFT = {
  back: { icon: 'back', label: '뒤로' },
  close: { icon: 'x', label: '닫기' },
  home: { icon: 'back', label: '홈' },
};

export default function Header({ left = 'back', onLeft, title = '', voiceText, right = null }) {
  const navigate = useNavigate();
  const { openFontSheet } = useUI();
  const { toggle, speaking } = useVoiceContext();

  const handleLeft = onLeft || (() => {
    if (left === 'home') navigate('/home');
    else if (window.history.length > 1) navigate(-1);
    else navigate('/home', { replace: true });
  });

  return (
    <header className="hdr">
      {LEFT[left]
        ? <HeaderButton icon={LEFT[left].icon} label={LEFT[left].label} onClick={handleLeft} />
        : <span className="spacer" />}

      <div className="ttl">{title}</div>

      <HeaderButton label="글씨" onClick={openFontSheet} aria-label="글씨 크기">
        <span className="gg" aria-hidden="true">가<small>가</small></span>
      </HeaderButton>
      <HeaderButton
        icon="speaker"
        label={speaking ? '멈춤' : '소리'}
        className={speaking ? 'speaking' : ''}
        onClick={() => toggle(voiceText)}
        aria-label={speaking ? '읽기 멈추기' : '다시 듣기'}
        aria-pressed={speaking}
      />
      {right}
    </header>
  );
}
