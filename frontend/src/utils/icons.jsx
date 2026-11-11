/* SVG 아이콘 — 프로토타입과 동일한 경로 */
const paths = {
  back:    <path d="M15 5l-7 7 7 7"/>,
  speaker: <><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/></>,
  search:  <><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></>,
  mic:     <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>,
  user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></>,
  cal:     <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  pin:     <><path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></>,
  bag:     <><path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 016 0v2"/></>,
  alert:   <><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></>,
  phone:   <path d="M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A18 18 0 013 5a2 2 0 012-2z"/>,
  tag:     <><path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></>,
  doc:     <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></>,
  check:   <path d="M5 12l5 5 9-10"/>,
  chev:    <path d="M9 5l7 7-7 7"/>,
  heart:   <path d="M12 20s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 9c0 6-8 11-8 11z"/>,
  work:    <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/></>,
  won:     <><path d="M4 7l3 10 3-8 2 0 3 8 3-10M3 11h18"/></>,
  school:  <><path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/></>,
  gov:     <><path d="M3 10h18L12 4zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></>,
  globe:   <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></>,
  box:     <><path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"/></>,
  x:       <path d="M6 6l12 12M18 6L6 18"/>,
  camera:  <><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>,
};

export default function Icon({ name, size = 24, ...props }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width={size} height={size} {...props}>
      {paths[name]}
    </svg>
  );
}
