import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Inline stroke-icon set (Lucide style geometry) so the portal ships with no
 * icon-font dependency and icons inherit `currentColor`.
 */
export type IconName =
  | 'dashboard' | 'layers' | 'folder' | 'tag' | 'list' | 'shield' | 'book' | 'form'
  | 'rupee' | 'clipboard' | 'video' | 'file' | 'building' | 'users' | 'user-check'
  | 'calendar' | 'map-pin' | 'monitor' | 'search' | 'plus' | 'edit' | 'trash' | 'eye'
  | 'check' | 'x' | 'chevron-left' | 'chevron-right' | 'chevron-down' | 'chevron-up'
  | 'menu' | 'bell' | 'logout' | 'settings' | 'download' | 'upload' | 'filter'
  | 'refresh' | 'clock' | 'inbox' | 'award' | 'alert' | 'info' | 'lock' | 'mail'
  | 'phone' | 'save' | 'copy' | 'grip' | 'external' | 'arrow-up' | 'arrow-down'
  | 'more' | 'play' | 'link' | 'help' | 'sliders' | 'graduation' | 'flag' | 'send'
  | 'printer';

const PATHS: Record<IconName, string> = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  folder: '<path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.5L10 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z"/><path d="m9.5 12 1.8 1.8 3.4-3.6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5V4.5Z"/><path d="M20 18v4H6.5A2.5 2.5 0 0 1 4 19.5"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  rupee: '<path d="M7 4h10M7 9h10M15.5 4c0 3.3-2.5 5-5.5 5h-3l7 10"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3"/><path d="M9 12h6M9 16h4"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 11 6-3.5v9L16 13"/>',
  file: '<path d="M14 3v5h5"/><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.1M18 14.8c2 .7 3 2.6 3 5.2"/>',
  'user-check': '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5 1 0 2 .2 2.8.6"/><path d="m15 16 2 2 4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  'map-pin': '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.8"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevron-left': '<path d="m15 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  'chevron-up': '<path d="m5 15 7-7 7 7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6Z"/><path d="M10.5 20a2 2 0 0 0 3 0"/>',
  logout: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4"/><path d="m16 16 4-4-4-4M20 12H9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1.1Z"/>',
  download: '<path d="M12 3v12M7.5 11 12 15.5 16.5 11M4 20h16"/>',
  printer: '<path d="M7 9V3.5h10V9M7 18H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><rect x="7" y="14.5" width="10" height="6" rx="1"/>',
  upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 20h16"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-1.3 5.4"/><path d="M20 5v6h-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13l2.5 8v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5l2.5-8Z"/>',
  award: '<circle cx="12" cy="9" r="5.5"/><path d="m8.5 13.5-1 7.5 4.5-2.5 4.5 2.5-1-7.5"/>',
  alert: '<path d="M12 3.5 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3.5Z"/><path d="M12 9.5v4.2M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  lock: '<rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  phone: '<path d="M6.5 3h3l1.5 5-2.2 1.4a13 13 0 0 0 5.8 5.8L16 13l5 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3h1Z"/>',
  save: '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h7V3M8 21v-6h8v6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  'arrow-up': '<path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/>',
  'arrow-down': '<path d="M12 4v15M6.5 13.5 12 19l5.5-5.5"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
  link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3M12 17h.01"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  graduation: '<path d="m12 4 10 5-10 5-10-5 10-5Z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5"/>',
  flag: '<path d="M5 21V4M5 5h12l-2 3.5L17 12H5"/>',
  send: '<path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10.1 21 3Z"/>',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [innerHTML]="markup()"
    ></svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(1.7);

  /** The markup is a fixed, app-owned constant, never user input. */
  protected readonly markup = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()] ?? ''),
  );
}
