export const STAGES = [
  {
    id: 'plan', num: '00', label: 'PLAN',
    eyebrow: 'LUXURY CUSTOM HOMES — THE PLAN',
    title: null, caption: '',
    start: 0.0, end: 0.075,
  },
  {
    id: 'fnd', num: '01', label: 'FOUNDATION',
    eyebrow: 'STAGE 01',
    title: 'Foundation',
    caption: 'Poured, cured and squared before a single stud goes up.',
    start: 0.075, end: 0.21,
  },
  {
    id: 'frm', num: '02', label: 'FRAMING',
    eyebrow: 'STAGE 02',
    title: 'Framing',
    caption: 'Every wall, post and truss exactly where the plan says it goes.',
    start: 0.21, end: 0.405,
  },
  {
    id: 'dry', num: '03', label: 'DRIED IN',
    eyebrow: 'STAGE 03',
    title: 'Dried in',
    caption: 'Sheathed, fully house-wrapped and sealed before the weather gets a vote.',
    start: 0.405, end: 0.56,
  },
  {
    id: 'ext', num: '04', label: 'EXTERIOR',
    eyebrow: 'STAGE 04',
    title: 'Exterior',
    caption: 'Architectural shingles, board-and-batten and hand-laid stonework.',
    start: 0.56, end: 0.72,
  },
  {
    id: 'home', num: '05', label: 'HOME',
    eyebrow: 'STAGE 05',
    title: 'Home',
    caption: '4,200 sq ft. Five bedrooms. Exactly how you pictured it.',
    start: 0.72, end: 0.885,
  },
  {
    id: 'wel', num: '06', label: 'WELCOME',
    eyebrow: 'STAGE 06',
    title: 'Welcome home.',
    caption: '',
    start: 0.885, end: 1.0,
  },
]

export function stageAt(p) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (p >= STAGES[i].start) return i
  }
  return 0
}

export function stageLocal(p, s) {
  return Math.min(1, Math.max(0, (p - s.start) / (s.end - s.start)))
}
