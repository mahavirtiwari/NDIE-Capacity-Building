import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type Mode = 'formatted' | 'html';

interface ToolbarButton {
  command: string;
  value?: string;
  /** Drawn as text: the icon set has no typographic glyphs, and B / I / ¶ are
      read faster than any picture of them would be. */
  label: string;
  title: string;
  /** Renders the label in the weight or style the button applies. */
  style?: 'bold' | 'italic' | 'underline';
}

/**
 * An HTML body that can be written either way: formatted, with a toolbar, or as
 * source.
 *
 * Both views edit the same value — the toggle only changes how it is shown, so
 * nothing is converted or lost in passing between them. Someone laying out a
 * notice picks Formatted; someone pasting a block of markup or checking exactly
 * what will be sent picks HTML.
 *
 * Placeholders such as <c>{{ '{{code}}' }}</c> are ordinary text in both views,
 * so they survive formatting and can be typed in either.
 */
@Component({
  selector: 'app-rich-text-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="rte" [class.is-disabled]="disabled()">
      <div class="rte__bar">
        <div class="rte__modes" role="tablist">
          <button
            type="button"
            role="tab"
            class="rte__mode"
            [class.is-on]="mode() === 'formatted'"
            [attr.aria-selected]="mode() === 'formatted'"
            (click)="setMode('formatted')"
          >
            Formatted
          </button>
          <button
            type="button"
            role="tab"
            class="rte__mode"
            [class.is-on]="mode() === 'html'"
            [attr.aria-selected]="mode() === 'html'"
            (click)="setMode('html')"
          >
            HTML
          </button>
        </div>

        @if (mode() === 'formatted') {
          <div class="rte__tools">
            @for (tool of tools; track tool.title) {
              <button
                type="button"
                class="rte__tool"
                [title]="tool.title"
                [attr.aria-label]="tool.title"
                [disabled]="disabled()"
                (mousedown)="$event.preventDefault()"
                (click)="run(tool)"
              >
                <span
                  [class.tool-bold]="tool.style === 'bold'"
                  [class.tool-italic]="tool.style === 'italic'"
                  [class.tool-underline]="tool.style === 'underline'"
                  >{{ tool.label }}</span
                >
              </button>
            }
            <button
              type="button"
              class="rte__tool"
              title="Add a link"
              aria-label="Add a link"
              [disabled]="disabled()"
              (mousedown)="$event.preventDefault()"
              (click)="addLink()"
            >
              <span class="tool-underline">link</span>
            </button>
          </div>
        }
      </div>

      @if (mode() === 'formatted') {
        <div
          #surface
          class="rte__surface"
          role="textbox"
          aria-multiline="true"
          [attr.contenteditable]="disabled() ? 'false' : 'true'"
          [style.min-height.px]="minHeight()"
          (input)="onSurfaceInput()"
          (blur)="onTouched()"
        ></div>
      } @else {
        <textarea
          #source
          class="rte__source"
          spellcheck="false"
          [style.min-height.px]="minHeight()"
          [disabled]="disabled()"
          [value]="value()"
          (input)="onSourceInput($event)"
          (blur)="onTouched()"
        ></textarea>
      }
    </div>
  `,
  styles: [
    `
      .rte {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: #fff;
        overflow: hidden;
      }
      .rte.is-disabled { background: var(--ink-50); opacity: 0.75; }
      .rte__bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding: 0.35rem 0.4rem;
        border-bottom: 1px solid var(--border);
        background: var(--ink-50);
      }
      .rte__modes { display: flex; gap: 0.15rem; }
      .rte__mode {
        border: 1px solid transparent;
        background: transparent;
        border-radius: var(--radius-sm);
        padding: 0.25rem 0.6rem;
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--ink-500);
        cursor: pointer;
      }
      .rte__mode.is-on {
        background: #fff;
        border-color: var(--border);
        color: var(--brand-700);
      }
      .rte__tools {
        display: flex;
        gap: 0.1rem;
        flex-wrap: wrap;
        padding-left: 0.6rem;
        border-left: 1px solid var(--border);
      }
      .rte__tool {
        min-width: 26px;
        height: 26px;
        padding: 0 0.35rem;
        font-size: var(--fs-xs);
        font-family: inherit;
        display: grid;
        place-items: center;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--ink-600);
        cursor: pointer;
      }
      .rte__tool:hover:not(:disabled) { background: #fff; border-color: var(--border); color: var(--brand-700); }
      .rte__tool:disabled { opacity: 0.4; cursor: default; }
      .tool-bold { font-weight: 800; }
      .tool-italic { font-style: italic; }
      .tool-underline { text-decoration: underline; }
      .rte__surface {
        padding: 0.7rem 0.8rem;
        font-size: var(--fs-sm);
        line-height: 1.55;
        color: var(--ink-800);
        outline: none;
        overflow-y: auto;
        max-height: 420px;
      }
      .rte__surface:focus { box-shadow: inset 0 0 0 2px var(--brand-100); }
      .rte__surface p { margin: 0 0 0.6rem; }
      .rte__surface ul, .rte__surface ol { margin: 0 0 0.6rem; padding-left: 1.4rem; }
      .rte__source {
        display: block;
        width: 100%;
        border: 0;
        outline: none;
        resize: vertical;
        padding: 0.7rem 0.8rem;
        font-family: var(--font-mono, ui-monospace, monospace);
        font-size: var(--fs-xs);
        line-height: 1.6;
        color: var(--ink-800);
        background: #fff;
        max-height: 420px;
      }
    `,
  ],
})
export class RichTextEditorComponent implements ControlValueAccessor {
  readonly minHeight = input(220);

  private readonly surface = viewChild<ElementRef<HTMLElement>>('surface');

  protected readonly mode = signal<Mode>('formatted');
  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  /* execCommand is deprecated but is still the only thing every browser
     implements for this, and the alternative — hand-rolling Range surgery for
     each button — is a great deal of code to maintain for a form field an
     administrator uses now and then. */
  protected readonly tools: ToolbarButton[] = [
    { command: 'bold', label: 'B', title: 'Bold', style: 'bold' },
    { command: 'italic', label: 'I', title: 'Italic', style: 'italic' },
    { command: 'underline', label: 'U', title: 'Underline', style: 'underline' },
    { command: 'formatBlock', value: 'h3', label: 'H', title: 'Heading' },
    { command: 'formatBlock', value: 'p', label: '¶', title: 'Paragraph' },
    { command: 'insertUnorderedList', label: '• —', title: 'Bulleted list' },
    { command: 'insertOrderedList', label: '1.', title: 'Numbered list' },
    { command: 'removeFormat', label: '✕', title: 'Clear formatting' },
  ];

  protected onChange: (value: string) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    /* The surface is a view child, so it does not exist when writeValue first
       runs — the form supplies the body before the template has rendered the
       element to put it in. Painting from an effect covers that, and the two
       later cases as well: switching back from HTML, and a value patched in
       from elsewhere on the form. */
    effect(() => {
      const element = this.surface()?.nativeElement;
      const html = this.value();
      if (element) this.paint(element, html);
    });
  }

  /* ------------------------------------------------ ControlValueAccessor */

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  /* --------------------------------------------------------------- edit */

  protected setMode(mode: Mode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    /* Nothing to do for the surface: the effect fills it as soon as the
       template has created it. */
  }

  protected onSurfaceInput(): void {
    const html = this.surface()?.nativeElement.innerHTML ?? '';
    /* Only the signal is updated, never the DOM: writing innerHTML back into
       the element the caret is sitting in would send it to the start on every
       keystroke. */
    this.value.set(html);
    this.onChange(html);
  }

  protected onSourceInput(event: Event): void {
    const html = (event.target as HTMLTextAreaElement).value;
    this.value.set(html);
    this.onChange(html);
  }

  protected run(tool: ToolbarButton): void {
    if (this.disabled()) return;
    this.surface()?.nativeElement.focus();
    document.execCommand(tool.command, false, tool.value);
    this.onSurfaceInput();
  }

  protected addLink(): void {
    if (this.disabled()) return;
    const href = window.prompt('Link address', 'https://');
    if (!href) return;
    this.surface()?.nativeElement.focus();
    document.execCommand('createLink', false, href);
    this.onSurfaceInput();
  }

  /** Pushes the value into the editable surface, leaving the caret alone. */
  private paint(element: HTMLElement, html: string): void {
    if (element.innerHTML === html) return;
    /* Never while the author is typing: rewriting the element the caret sits
       in would send it back to the start on every keystroke. */
    if (document.activeElement === element) return;
    element.innerHTML = html;
  }
}
