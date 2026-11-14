/* SVG 아이콘 — UNIICONS(무료 선 아이콘) 모양을 따라 다시 그림
   이름은 그대로 두고 모양만 바꿈 (보관함 = 폴더, 카테고리 = 겹친 종이, 준비물 = 가방 …)
   세트에 없는 모양(뒤로·닫기·하트)은 같은 선 굵기로 맞춤 */
const paths = {
  // 화살표·표시
  back:    <path d="M15 4.5L7.5 12l7.5 7.5"/>,
  chev:    <path d="M9 4.5l7.5 7.5L9 19.5"/>,
  check:   <path d="M4 12.5l5 5L20 6.5"/>,
  x:       <path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>,

  // 소리·검색·마이크·사람 (세트: 스피커, 돋보기, 마이크, 프로필)
  speaker:    <><path d="M3 9.5h4L12 5v14l-5-4.5H3z"/><path d="M15.5 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/></>,
  speakerOff: <><path d="M3 9.5h4L12 5v14l-5-4.5H3z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></>,
  search:  <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></>,
  mic:     <><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11.5a7 7 0 0014 0M12 18.5v3.5"/></>,
  user:    <><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.5"/><path d="M5.8 18.6c1.5-2.4 3.7-3.6 6.2-3.6s4.7 1.2 6.2 3.6"/></>,

  // 상세 타일 (세트: 달력, 위치, 가방, 경고 팔각형, 휴대폰, 겹친 종이, 문서, 줄)
  cal:     <><rect x="3.5" y="5.5" width="17" height="15" rx="1"/><path d="M3.5 10h17M7.5 3v4.5M10.5 3v4.5M13.5 3v4.5M16.5 3v4.5"/></>,
  pin:     <><path d="M12 21.5s-6.5-6.6-6.5-12a6.5 6.5 0 0113 0c0 5.4-6.5 12-6.5 12z"/><circle cx="12" cy="9.5" r="2.5"/></>,
  bag:     <><path d="M5 6h14v15H5z"/><path d="M9 6v1.5a3 3 0 006 0V6"/></>,
  alert:   <><path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="M12 7.5v6M12 16.5v.5"/></>,
  phone:   <><rect x="6.5" y="2.5" width="11" height="19" rx="2"/><path d="M10.5 5.5h3M12 18.5v.01"/></>,
  tag:     <><path d="M12 4l9 4.5-9 4.5-9-4.5z"/><path d="M3 13l9 4.5 9-4.5"/></>,
  doc:     <><path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14.5 3v4.5H19"/></>,
  lines:   <path d="M4 6.5h16M4 12h16M4 17.5h16"/>,

  // 카테고리 (세트: 노트북=일, 지갑=돈, 자=학교, 우산=복지, 지도=비자)
  heart:   <path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/>,
  work:    <><path d="M5 5h14v10H5z"/><path d="M3 15h18l-1.5 3.5h-15z"/></>,
  won:     <><path d="M4 7h16v13H4z"/><path d="M4 7l12-4v4"/><path d="M15 11.5h5v5h-5z"/><path d="M17.5 14h.01"/></>,
  school:  <><path d="M3 17L17 3l4 4L7 21z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/></>,
  gov:     <><path d="M3 12a9 9 0 0118 0z"/><path d="M12 12v6.5a2 2 0 01-4 0M12 3v.5"/></>,
  globe:   <><path d="M3 6l6-2.5L15 6l6-2.5V18L15 20.5 9 18l-6 2.5z"/><path d="M9 3.5V18M15 6v14.5"/></>,

  // 홈 (세트: 폴더=보관함, 카메라, 올리기=파일 업로드)
  box:     <path d="M3 5.5h6.5l2 2.5H21v11.5H3z"/>,
  camera:  <><path d="M3 7.5h4L8.5 5h7L17 7.5h4V19H3z"/><circle cx="12" cy="13" r="3.5"/><path d="M18 10.5h.01"/></>,
  upload:  <><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M8.5 10.5H5V21h14V10.5h-3.5"/></>,

  // 문서 삭제 (휴지통)
  trash:   <><path d="M4 6.5h16M9.5 6.5V4h5v2.5"/><path d="M6 6.5l1 14h10l1-14"/><path d="M10 10.5v6M14 10.5v6"/></>,
};

export default function Icon({ name, size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} {...props}>
      {paths[name]}
    </svg>
  );
}
