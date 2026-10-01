const paths = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21v-8h6v8" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  students: <><path d="m2 10 10-5 10 5-10 5z" /><path d="M6 12v5c4 3 8 3 12 0v-5M22 10v6" /></>,
  teachers: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M7 21h10M12 17v4M7 8h7M7 11h5" /></>,
  levels: <><path d="M4 20V9l8-5 8 5v11zM9 20v-6h6v6M8 10h.01M16 10h.01" /></>,
  grades: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  periods: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2" /></>,
  sections: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  enrollments: <><path d="M4 4h13l3 3v13H4zM8 11h8M8 15h6M17 4v4h3" /></>,
  courses: <><path d="M4 4h7v16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM13 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7zM11 5v15M13 5v15" /></>,
  assignments: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M8 14l2 2 5-5" /></>,
  'grade-records': <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h4M8 16l2 2 5-5" /></>,
  'attendance-records': <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 15l2 2 5-5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 6.1A12 12 0 0 1 12 6c6.4 0 10 6 10 6a13 13 0 0 1-3.2 3.6M6.3 6.3C3.5 8.2 2 12 2 12s3.6 6 10 6c1.5 0 2.8-.3 4-.8" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
};

const aliases = { 'education-levels': 'levels', 'academic-periods': 'periods', 'teaching-assignments': 'assignments' };

export default function Icon({ name, size = 18, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[aliases[name] || name] || paths.info}</svg>;
}
