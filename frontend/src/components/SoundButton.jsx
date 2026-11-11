import Icon from '../utils/icons';
import useVoice from '../hooks/useVoice';

/* 상단 오른쪽 소리 버튼 — 누를 때마다 켜짐/꺼짐. 켜면 지금 화면 안내(guide)를 바로 읽어줍니다. */
export default function SoundButton({ guide }) {
  const { soundOn, setSoundOn, speak } = useVoice();

  function toggle() {
    setSoundOn(!soundOn);
    if (!soundOn) speak(guide);
  }

  return (
    <button
      className="ib sound"
      onClick={toggle}
      aria-pressed={soundOn}
      aria-label={soundOn ? '소리 켜짐. 누르면 꺼져요' : '소리 꺼짐. 누르면 켜져요'}
    >
      <Icon name={soundOn ? 'speaker' : 'mute'} />
      <span>{soundOn ? '소리 켜짐' : '소리 꺼짐'}</span>
    </button>
  );
}
