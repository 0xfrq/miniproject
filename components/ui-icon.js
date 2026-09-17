export function Icon({ name, size = 18, strokeWidth = 1.8, className = '' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path {...common} d="M3.5 10.5 12 3l8.5 7.5" /><path {...common} d="M5.5 9.5V21h13V9.5M9 21v-6h6v6" /></>,
    book: <><path {...common} d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" /><path {...common} d="M5 17a2.5 2.5 0 0 1 2.5-2.5H19M8.5 8h6M8.5 11h4" /></>,
    clipboard: <><rect {...common} x="5" y="4.5" width="14" height="16" rx="1.5" /><path {...common} d="M9 4.5V3h6v1.5M8.5 9h7M8.5 12h7M8.5 15h4" /></>,
    chart: <><path {...common} d="M4 20.5V4M4 20.5h17" /><path {...common} d="m7 16 3-4 3 2 5-7" /><circle {...common} cx="18" cy="7" r="1" /></>,
    clock: <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M12 7v5l3.5 2" /></>,
    edit: <><path {...common} d="m4 16.5-.7 3.7 3.7-.7L18.5 8a2.1 2.1 0 0 0-3-3L4 16.5Z" /><path {...common} d="m13.5 6.5 4 4" /></>,
    activity: <><path {...common} d="m12 3 2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z" /></>,
    posts: <><path {...common} d="M5 5h14M5 10h14M5 15h9M5 20h6" /></>,
    calendar: <><rect {...common} x="4" y="5" width="16" height="15" rx="1.5" /><path {...common} d="M8 3v4M16 3v4M4 9h16" /><path {...common} d="M8 13h.01M12 13h.01M16 13h.01M8 16h.01M12 16h.01" /></>,
    arrow: <><path {...common} d="M5 19 19 5M9 5h10v10" /></>,
    menu: <><path {...common} d="M4 7h16M4 12h16M4 17h16" /></>,
    chevronLeft: <path {...common} d="m14.5 5-7 7 7 7" />,
    chevronRight: <path {...common} d="m9.5 5 7 7-7 7" />,
    plus: <><path {...common} d="M12 5v14M5 12h14" /></>,
    spark: <><path {...common} d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" /><path {...common} d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" /></>,
    scan: <><path {...common} d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3" /><path {...common} d="M8 12h8M12 8v8" /></>,
    upload: <><path {...common} d="M12 16V4M8 8l4-4 4 4M5 15v4h14v-4" /></>,
    camera: <><path {...common} d="M4 8.5h3l1.4-2h7.2l1.4 2h3v10H4v-10Z" /><circle {...common} cx="12" cy="13.5" r="3" /></>,
    close: <><path {...common} d="m6 6 12 12M18 6 6 18" /></>,
    check: <path {...common} d="m5 12.5 4.2 4.2L19 7" />,
    warning: <><path {...common} d="m12 3 9 17H3L12 3Z" /><path {...common} d="M12 9v4M12 16h.01" /></>,
    help: <><circle {...common} cx="12" cy="12" r="8.5" /><path {...common} d="M9.7 9a2.4 2.4 0 1 1 3.7 2c-.9.6-1.4 1-1.4 2M12 16h.01" /></>,
    grip: <><circle cx="8" cy="7" r="1" fill="currentColor" /><circle cx="16" cy="7" r="1" fill="currentColor" /><circle cx="8" cy="12" r="1" fill="currentColor" /><circle cx="16" cy="12" r="1" fill="currentColor" /><circle cx="8" cy="17" r="1" fill="currentColor" /><circle cx="16" cy="17" r="1" fill="currentColor" /></>,
    search: <><circle {...common} cx="10.5" cy="10.5" r="6.5" /><path {...common} d="m16 16 4.5 4.5" /></>,
  };

  return <svg className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[name] || paths.activity}</svg>;
}
