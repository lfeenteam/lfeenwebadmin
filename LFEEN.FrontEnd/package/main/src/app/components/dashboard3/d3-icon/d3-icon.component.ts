import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type D3IconName =
  | 'revenue' | 'bookings' | 'avg-value' | 'cancel'
  | 'hosts' | 'units' | 'occupancy' | 'retention'
  | 'guests' | 'returning' | 'downloads' | 'star'
  | 'bell' | 'calendar' | 'chevron-down' | 'logout' | 'user'
  | 'wifi' | 'wifi-off' | 'menu' | 'sparkles' | 'chart' | 'pie'
  | 'map-pin' | 'compare' | 'arrow-up' | 'arrow-down' | 'check-all' | 'external'
  | 'alert-octagon' | 'alert-triangle' | 'opportunity' | 'info'
  | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'x';

/**
 * LFEEN duotone icon set for the shell and executive dashboard.
 * One grid for every glyph: 24×24 viewBox, 1.75 stroke, round caps/joins, currentColor,
 * plus a soft fill of the same colour inside the main shape (`.f`, or a separate area
 * path for open line glyphs) — depth without a second colour; tune with --d3-icon-fill.
 * so icons inherit the text color and stay visually consistent next to Tabler icons
 * (same stroke style). Each icon names its moving part (`.m-*`); the part only moves
 * while an ancestor marked `.d3-mh` (motion host) is hovered or keyboard-focused,
 * never continuously. Decorative by default (aria-hidden); pass `label` to expose it.
 */
@Component({
  selector: 'app-d3-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
         stroke-linecap="round" stroke-linejoin="round" focusable="false"
         [attr.aria-hidden]="label ? null : 'true'" [attr.role]="label ? 'img' : null"
         [attr.aria-label]="label || null">
      @switch (name) {
        @case ('revenue') {
          <path class="f a" d="M4 11l5-5 4 3 7-6V20H4z" />
          <path d="M3 20h18" />
          <path d="M5 16v-3M10 16V9M15 16v-5" opacity=".45" />
          <g class="m-arrow"><path d="M4 11l5-5 4 3 7-6" /><path d="M15 3h5v5" /></g>
        }
        @case ('bookings') {
          <rect class="f" x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path class="m-check" pathLength="1" d="M9 15.2l2.1 2.1 4-4.1" />
        }
        @case ('avg-value') {
          <g class="m-tag">
            <path class="f" d="M3.5 12.4V5.5a2 2 0 0 1 2-2h6.9l8.1 8.1a2 2 0 0 1 0 2.8l-6.1 6.1a2 2 0 0 1-2.8 0z" />
            <circle cx="8.2" cy="8.2" r="1.4" />
          </g>
        }
        @case ('cancel') {
          <circle class="f" cx="12" cy="12" r="8.75" />
          <g class="m-x"><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" /></g>
        }
        @case ('hosts') {
          <circle class="m-pop f" cx="12" cy="8" r="3.6" />
          <path class="f" d="M5 20.5v-1.2A4.8 4.8 0 0 1 9.8 14.5h4.4a4.8 4.8 0 0 1 4.8 4.8v1.2z" />
          <path class="m-key" d="M17.5 4.5l2 2" opacity=".5" />
        }
        @case ('units') {
          <path class="f" d="M4 10.8L12 4l8 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
          <path class="m-door" d="M10 20.5v-5h4v5" />
        }
        @case ('occupancy') {
          <path class="f a" d="M4.2 17.5a8.6 8.6 0 1 1 15.6 0z" />
          <path d="M4.2 17.5a8.6 8.6 0 1 1 15.6 0" />
          <path d="M12 6v1.2M6.8 8.2l.8.8M17.2 8.2l-.8.8" opacity=".5" />
          <g class="m-needle"><path d="M12 14.5l3.6-3.6" /><circle cx="12" cy="14.5" r="1.2" /></g>
        }
        @case ('retention') {
          <circle class="f a" cx="12" cy="12" r="5.5" />
          <g class="m-spin">
            <path d="M19.5 9A8 8 0 0 0 5.2 7.4L4 9" /><path d="M4 4.5V9h4.5" />
            <path d="M4.5 15a8 8 0 0 0 14.3 1.6L20 15" /><path d="M20 19.5V15h-4.5" />
          </g>
        }
        @case ('guests') {
          <circle class="m-pop f" cx="9" cy="8.5" r="3.3" />
          <path class="f" d="M3.5 19.5v-.8a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5v.8z" />
          <path d="M15.5 5.4a3.3 3.3 0 0 1 0 6.2M17.5 14.4a4.5 4.5 0 0 1 3 4.3v.8" opacity=".55" />
        }
        @case ('returning') {
          <circle class="f" cx="10" cy="8" r="3.4" />
          <path d="M4 20v-.8A4.6 4.6 0 0 1 8.6 14.6h2.2" />
          <g class="m-arrow"><path d="M20.5 15.5h-6" /><path d="M16.8 12.8l-2.7 2.7 2.7 2.7" /></g>
        }
        @case ('downloads') {
          <path class="f a" d="M4 15.5v2.5A2.5 2.5 0 0 0 6.5 20.5h11a2.5 2.5 0 0 0 2.5-2.5v-2.5z" />
          <path d="M4 15.5v2.5A2.5 2.5 0 0 0 6.5 20.5h11a2.5 2.5 0 0 0 2.5-2.5v-2.5" />
          <g class="m-drop"><path d="M12 3.5v11" /><path d="M7.5 10.5L12 15l4.5-4.5" /></g>
        }
        @case ('star') {
          <path class="m-pop f" d="M12 3.6l2.5 5.1 5.6.8-4 4 .9 5.6L12 16.4l-5 2.7.9-5.6-4-4 5.6-.8z" />
        }
        @case ('bell') {
          <g class="m-bell">
            <path class="f" d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5z" />
            <path class="m-clapper" d="M10 20.5a2.2 2.2 0 0 0 4 0" />
          </g>
        }
        @case ('calendar') {
          <rect class="f" x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
          <path class="m-pop" d="M8 14h2M14 14h2M8 17.2h2" />
        }
        @case ('chevron-down') { <path d="M6.5 9.5L12 15l5.5-5.5" /> }
        @case ('logout') {
          <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14" />
          <g class="m-arrow"><path d="M10 16.5L5.5 12 10 7.5" /><path d="M5.5 12H15" /></g>
        }
        @case ('user') {
          <circle class="m-pop f" cx="12" cy="8.2" r="3.7" />
          <path d="M5 20.5v-1A5 5 0 0 1 10 14.5h4a5 5 0 0 1 5 5v1" />
        }
        @case ('wifi') {
          <path d="M3 9.2a13.5 13.5 0 0 1 18 0" opacity=".45" />
          <path d="M6.2 12.6a9 9 0 0 1 11.6 0" opacity=".7" />
          <path d="M9.3 16a4.5 4.5 0 0 1 5.4 0" />
          <circle cx="12" cy="19" r=".9" fill="currentColor" />
        }
        @case ('wifi-off') {
          <path d="M9.3 16a4.5 4.5 0 0 1 5.4 0M6.2 12.6a9 9 0 0 1 4-1.9M3 9.2A13.5 13.5 0 0 1 7.4 6.6M15.6 11a9 9 0 0 1 2.2 1.6M13.2 6A13.5 13.5 0 0 1 21 9.2" />
          <circle cx="12" cy="19" r=".9" fill="currentColor" />
          <path d="M3.5 3.5l17 17" />
        }
        @case ('menu') { <path d="M4 7h16M4 12h16M4 17h10" /> }
        @case ('sparkles') {
          <path class="m-pop f" d="M12 3.5l1.7 4.6 4.6 1.7-4.6 1.7L12 16.1l-1.7-4.6-4.6-1.7 4.6-1.7z" />
          <path d="M18.5 15v4M16.5 17h4M5.5 16.5v3M4 18h3" opacity=".55" />
        }
        @case ('chart') {
          <path class="f a" d="M5 15.5l4.5-4.5 3.5 3 6-6.5v13H5z" />
          <path d="M3.5 20.5h17" />
          <path class="m-arrow" d="M5 15.5l4.5-4.5 3.5 3 6-6.5" />
          <circle cx="19" cy="7.5" r="1.4" />
        }
        @case ('pie') {
          <path d="M20.5 13A8.5 8.5 0 1 1 11 3.5" />
          <path class="m-pop f strong" d="M14.5 3.7A7 7 0 0 1 20.3 9.5h-5.8z" />
        }
        @case ('map-pin') {
          <path class="m-drop f" d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        }
        @case ('compare') {
          <path d="M8 4v16M16 4v16" opacity=".35" />
          <g class="m-arrow"><path d="M4 9h8M9 6l3 3-3 3" /><path d="M20 15h-8M15 12l-3 3 3 3" /></g>
        }
        @case ('arrow-up') { <path d="M7 17L17 7M9 7h8v8" /> }
        @case ('arrow-down') { <path d="M7 7l10 10M17 9v8H9" /> }
        @case ('check-all') { <path d="M3.5 12.5l4 4 8.5-9M12.5 15.5l1 1 8.5-9" /> }
        @case ('alert-octagon') {
          <path class="f" d="M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3z" />
          <path d="M12 8v4.6" /><circle cx="12" cy="16" r=".95" fill="currentColor" stroke="none" />
        }
        @case ('alert-triangle') {
          <path class="f" d="M10.3 4.4L2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z" />
          <path d="M12 9.5v4" /><circle cx="12" cy="16.9" r=".95" fill="currentColor" stroke="none" />
        }
        @case ('opportunity') {
          <circle class="f" cx="12" cy="12" r="8.75" />
          <g class="m-arrow"><path d="M8.5 15.5l7-7" /><path d="M10.2 8.5h5.3v5.3" /></g>
        }
        @case ('info') {
          <circle class="f" cx="12" cy="12" r="8.75" />
          <path d="M12 11v5" /><circle cx="12" cy="8" r=".95" fill="currentColor" stroke="none" />
        }
        @case ('chevron-left') { <path d="M14.5 6.5L9 12l5.5 5.5" /> }
        @case ('chevron-right') { <path d="M9.5 6.5L15 12l-5.5 5.5" /> }
        @case ('chevron-up') { <path d="M6.5 14.5L12 9l5.5 5.5" /> }
        @case ('x') { <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /> }
        @case ('external') { <path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" /> }
      }
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      width: var(--d3-icon-size, 20px);
      height: var(--d3-icon-size, 20px);
      flex-shrink: 0;
      line-height: 0;
    }
    svg { width: 100%; height: 100%; overflow: visible; }

    /* Duotone: a soft fill of the stroke colour inside the main shape. */
    .f { fill: currentColor; fill-opacity: var(--d3-icon-fill, .14); }
    .f.a { stroke: none; }            /* separate area under an open line glyph */
    .f.strong { fill-opacity: calc(var(--d3-icon-fill, .14) * 2.4); }
    :host-context(.d3-mh:hover) .f, :host-context(.d3-mh:focus-visible) .f {
      fill-opacity: calc(var(--d3-icon-fill, .14) * 1.6);
    }
    .f { transition: fill-opacity var(--d3-dur-base, 180ms) ease; }

    /* Moving parts: transform/opacity only, so nothing reflows. */
    .m-arrow, .m-tag, .m-x, .m-pop, .m-door, .m-needle, .m-spin, .m-drop, .m-bell, .m-clapper, .m-key {
      transform-box: fill-box;
      transition: transform var(--d3-dur-base, 180ms) var(--d3-ease, ease), opacity var(--d3-dur-base, 180ms) ease;
    }
    .m-tag, .m-x, .m-spin, .m-pop { transform-origin: center; }
    .m-needle { transform-origin: 0% 100%; }
    .m-bell { transform-origin: 50% 0%; }
    .m-door { transform-origin: 50% 100%; }
    .m-check { stroke-dasharray: 1; stroke-dashoffset: 0; }

    :host-context(.d3-mh:hover), :host-context(.d3-mh:focus-visible) {
      .m-arrow { transform: translate(1px, -1px); }
      .m-tag { transform: rotate(-10deg); }
      .m-x { transform: scale(0.85); }
      .m-pop { transform: scale(1.08); }
      .m-door { transform: scaleY(0.88); }
      .m-needle { transform: rotate(20deg); }
      .m-spin { transform: rotate(-35deg); }
      .m-drop { transform: translateY(1.5px); }
      .m-bell { animation: d3-bell-tilt var(--d3-dur-reveal, 600ms) var(--d3-ease, ease) 1; }
      .m-key { transform: translate(1px, -1px); opacity: 1; }
      .m-check { animation: d3-check-draw var(--d3-dur-panel, 220ms) var(--d3-ease, ease) 1; }
    }

    @keyframes d3-bell-tilt {
      0%, 100% { transform: rotate(0); }
      25% { transform: rotate(12deg); }
      55% { transform: rotate(-9deg); }
      80% { transform: rotate(4deg); }
    }
    @keyframes d3-check-draw {
      from { stroke-dashoffset: 1; }
      to { stroke-dashoffset: 0; }
    }
  `],
})
export class D3IconComponent {
  @Input({ required: true }) name!: D3IconName;
  /** Accessible name; leave empty for decorative icons next to visible text. */
  @Input() label = '';
}
