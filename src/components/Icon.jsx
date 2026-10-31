import React from 'react';

// Small line icons (24px grid, stroke = currentColor).
const P = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  diary: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5" /><path d="M9 7h7M9 11h5" /></>,
  attendance: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></>,
  listening: <><path d="M3 14v-2a9 9 0 0 1 18 0v2" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></>,
  marks: <><path d="M3 21h18" /><rect x="5" y="11" width="3" height="7" rx="1" /><rect x="10.5" y="6" width="3" height="12" rx="1" /><rect x="16" y="13" width="3" height="5" rx="1" /></>,
  reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  writing: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  shop: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4.5-6.5" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="m5 12 5 5L20 7" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  school: <><path d="m2 9 10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /></>,
  whatsapp: <><path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.3 3.2z" /><path d="M9 8.8c0 3 2.4 6 5.6 6.4l1.2-1.3-1.8-.9-.8.7c-1-.4-2.5-1.9-2.9-2.9l.7-.8-.9-1.8L9 8.8z" /></>,
  globe: <><circle cx="12" cy="12" r="9.5" /><path d="M2.5 12h19M12 2.5c2.6 2.8 3.8 6 3.8 9.5s-1.2 6.7-3.8 9.5c-2.6-2.8-3.8-6-3.8-9.5s1.2-6.7 3.8-9.5z" /></>,
  admin: <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
};

export default function Icon({ name, size = 20, className = '', stroke = 1.8 }) {
  return (
    <svg className={'icon ' + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>
  );
}

// Kolam-style dot-and-loop motif used as a decorative pattern.
export function Kolam({ className = '' }) {
  const dots = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) dots.push(<circle key={`${x}${y}`} cx={20 + x * 40} cy={20 + y * 40} r="2.6" />);
  return (
    <svg className={'kolam ' + className} viewBox="0 0 200 200" aria-hidden="true">
      <g fill="currentColor">{dots}</g>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M100 20c22 0 40 18 40 40s18 40 40 40c-22 0-40 18-40 40s-18 40-40 40c0-22-18-40-40-40s-40-18-40-40c22 0 40-18 40-40s18-40 40-40z" />
        <path d="M100 60c11 0 20 9 20 20s9 20 20 20c-11 0-20 9-20 20s-9 20-20 20c0-11-9-20-20-20s-20-9-20-20c11 0 20-9 20-20s9-20 20-20z" />
        <circle cx="100" cy="100" r="8" />
        <path d="M20 20c10 10 10 30 0 40M180 20c-10 10-10 30 0 40M20 180c10-10 10-30 0-40M180 180c-10-10-10-30 0-40" />
      </g>
    </svg>
  );
}
