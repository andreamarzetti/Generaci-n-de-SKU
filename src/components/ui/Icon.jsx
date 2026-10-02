// Iconos de trazo (24×24), inline para no depender de una librería. Heredan el color del texto.
const ICONS = {
  plus: [
    ['path', 'M5 12h14'],
    ['path', 'M12 5v14'],
  ],
  edit: [
    ['path', 'M12 20h9'],
    ['path', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
  ],
  save: [
    ['path', 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'],
    ['path', 'M17 21v-8H7v8'],
    ['path', 'M7 3v5h8'],
  ],
  close: [
    ['path', 'M18 6 6 18'],
    ['path', 'm6 6 12 12'],
  ],
  trash: [
    ['path', 'M3 6h18'],
    ['path', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'],
    ['path', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
    ['path', 'M10 11v6'],
    ['path', 'M14 11v6'],
  ],
  eraser: [
    ['path', 'm7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21'],
    ['path', 'M22 21H7'],
    ['path', 'm5 11 9 9'],
  ],
  check: [['path', 'M20 6 9 17l-5-5']],
  checkCircle: [
    ['path', 'M22 11.08V12a10 10 0 1 1-5.93-9.14'],
    ['path', 'M22 4 12 14.01l-3-3'],
  ],
  download: [
    ['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'],
    ['path', 'M7 10l5 5 5-5'],
    ['path', 'M12 15V3'],
  ],
  sheet: [
    ['path', 'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'],
    ['path', 'M14 2v6h6'],
    ['path', 'M8 13h8'],
    ['path', 'M8 17h8'],
  ],
  copy: [
    ['rect', { x: 8, y: 8, width: 14, height: 14, rx: 2, ry: 2 }],
    ['path', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  ],
  arrowLeft: [
    ['path', 'M19 12H5'],
    ['path', 'm12 19-7-7 7-7'],
  ],
  arrowRight: [
    ['path', 'M5 12h14'],
    ['path', 'm12 5 7 7-7 7'],
  ],
  undo: [
    ['path', 'M3 7v6h6'],
    ['path', 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13'],
  ],
  refresh: [
    ['path', 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'],
    ['path', 'M21 3v5h-5'],
    ['path', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'],
    ['path', 'M8 16H3v5'],
  ],
  shield: [
    [
      'path',
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ],
    ['path', 'm9 12 2 2 4-4'],
  ],
  sparkles: [
    [
      'path',
      'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
    ],
  ],
  load: [
    ['path', 'm15 10 5 5-5 5'],
    ['path', 'M4 4v7a4 4 0 0 0 4 4h12'],
  ],
  alert: [['path', 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
  search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', 'm21 21-4.3-4.3']],
  chevronDown: [['path', 'm6 9 6 6 6-6']],
  chevronRight: [['path', 'm9 18 6-6-6-6']],
  chevronUp: [['path', 'm18 15-6-6-6 6']],
  list: [
    ['path', 'M8 6h13'],
    ['path', 'M8 12h13'],
    ['path', 'M8 18h13'],
    ['path', 'M3 6h.01'],
    ['path', 'M3 12h.01'],
    ['path', 'M3 18h.01'],
  ],
  image: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }],
    ['circle', { cx: 8.5, cy: 8.5, r: 1.5 }],
    ['path', 'm21 15-5-5L5 21'],
  ],
  database: [
    ['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }],
    ['path', 'M3 5v14a9 3 0 0 0 18 0V5'],
    ['path', 'M3 12a9 3 0 0 0 18 0'],
  ],
}

const SHAPES = {
  path: (value, key) => <path key={key} d={value} />,
  circle: (value, key) => <circle key={key} {...value} />,
  rect: (value, key) => <rect key={key} {...value} />,
  ellipse: (value, key) => <ellipse key={key} {...value} />,
}

export function Icon({ name, size = 16 }) {
  const shapes = ICONS[name]
  if (!shapes) return null
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes.map(([shape, value], index) => SHAPES[shape](value, index))}
    </svg>
  )
}
