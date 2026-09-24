import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Capacity-building artwork for the sign-in hero: a training session in
 * progress — a facilitator at a board showing capability rising across a
 * programme, a seated cohort, and the certificate the cohort leaves with.
 *
 * Inline SVG rather than a photograph: it inherits the palette, stays crisp at
 * any size, needs no licensing and adds nothing to the network payload. If real
 * photography is wanted later, this component is the slot to swap.
 *
 * Purely decorative, so it is hidden from assistive technology.
 */
@Component({
  selector: 'app-auth-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 460 296" fill="none" aria-hidden="true" focusable="false">
      <!-- ------------------------------------------------------- board -->
      <rect x="168" y="28" width="248" height="148" rx="10" class="art__board" />
      <path d="M168 38a10 10 0 0 1 10-10h228a10 10 0 0 1 10 10v18H168z" class="art__board-head" />
      <circle cx="184" cy="42" r="3.5" class="art__board-dot" />
      <circle cx="196" cy="42" r="3.5" class="art__board-dot" />
      <circle cx="208" cy="42" r="3.5" class="art__board-dot" />

      <!-- Capability rising across the programme -->
      <g class="art__bars">
        <rect x="196" y="140" width="26" height="20" rx="3" />
        <rect x="234" y="126" width="26" height="34" rx="3" />
        <rect x="272" y="108" width="26" height="52" rx="3" />
        <rect x="310" y="88" width="26" height="72" rx="3" />
      </g>
      <rect x="348" y="72" width="26" height="88" rx="3" class="art__bar-peak" />
      <path d="M196 132l38-14 38-18 38-20 38-12" class="art__trend" />
      <circle cx="348" cy="68" r="5" class="art__trend-dot" />

      <!-- ------------------------------------------------- facilitator -->
      <circle cx="96" cy="74" r="17" class="art__head" />
      <path d="M76 176v-54a20 20 0 0 1 40 0v54z" class="art__body" />
      <path d="M112 114l40-20" class="art__limb" />
      <circle cx="156" cy="92" r="5.5" class="art__head" />

      <!-- ------------------------------------------------------ cohort -->
      <circle cx="132" cy="210" r="16" class="art__head" />
      <path d="M108 258v-18a24 24 0 0 1 48 0v18z" class="art__body" />

      <circle cx="230" cy="202" r="17" class="art__head" />
      <path d="M204 258v-20a26 26 0 0 1 52 0v20z" class="art__body art__body--alt" />

      <circle cx="328" cy="210" r="16" class="art__head" />
      <path d="M304 258v-18a24 24 0 0 1 48 0v18z" class="art__body" />

      <!-- ------------------------------------------------- certificate -->
      <g transform="translate(404 194)">
        <path d="M-13 24l-6 26 19-12 19 12-6-26z" class="art__ribbon" />
        <circle r="28" class="art__seal" />
        <circle r="20" class="art__seal-inner" />
        <path d="M-8 0l6 7 11-13" class="art__seal-tick" />
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        display: block;
        pointer-events: none;
      }
      svg {
        width: 100%;
        height: auto;
        overflow: visible;
      }

      /* Drawn as a watermark: no card behind it, and the board is left open
         so the shapes read as a line drawing rather than as a panel. */
      .art__board { fill: none; stroke: var(--brand-600); stroke-width: 2.5; }
      .art__board-head { fill: var(--brand-600); }
      .art__board-dot { fill: #fff; opacity: 0.6; }

      .art__bars rect { fill: var(--brand-500); }
      .art__bar-peak { fill: var(--accent-300); }

      .art__trend {
        fill: none;
        stroke: var(--brand-600);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .art__trend-dot { fill: var(--brand-600); }

      .art__head { fill: var(--brand-700); }
      .art__body { fill: var(--brand-600); }
      .art__body--alt { fill: var(--accent-600); }
      .art__limb {
        stroke: var(--brand-600);
        stroke-width: 7;
        stroke-linecap: round;
      }

      .art__seal { fill: var(--accent-500); }
      .art__seal-inner { fill: none; stroke: var(--brand-50); stroke-width: 2; }
      .art__seal-tick {
        fill: none;
        stroke: var(--brand-50);
        stroke-width: 3.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .art__ribbon { fill: var(--brand-700); }
    `,
  ],
})
export class AuthArtComponent {}
