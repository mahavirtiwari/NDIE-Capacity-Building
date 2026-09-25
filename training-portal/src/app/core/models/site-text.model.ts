/**
 * One editable string on a screen that is not driven by data.
 *
 * The shipped wording lives on the server, so `default` is what the product
 * says out of the box and `value` is what it says now.
 */
export interface SiteText {
  key: string;
  /** The screen it appears on, used to group the editor. */
  group: string;
  label: string;
  hint?: string | null;
  multiline: boolean;
  default: string;
  value: string;
  isOverridden: boolean;
}
