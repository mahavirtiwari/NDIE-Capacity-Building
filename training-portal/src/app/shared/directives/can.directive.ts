import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { Permission } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';

/**
 * Shows an element only when the account holds the permission.
 *
 *   <button *appCan="'materials.manage'">Publish material</button>
 *
 * The server is the authority and refuses the call either way; this is so the
 * refusal never has to happen. Offering somebody a button, letting them fill
 * in a form and then rejecting it reads as a broken system rather than as a
 * permission they were never given.
 *
 * Several permissions mean any of them, matching AuthService.hasPermission and
 * the route guard beside it.
 */
@Directive({ selector: '[appCan]' })
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  readonly appCan = input.required<Permission | Permission[]>();

  private shown = false;

  constructor() {
    /* An effect rather than a one-off check: the signed-in account is a
       signal, so a session that changes underneath the page takes the
       buttons with it. */
    effect(() => {
      const allowed = this.auth.hasPermission(this.appCan());
      if (allowed === this.shown) return;

      this.container.clear();
      if (allowed) this.container.createEmbeddedView(this.template);
      this.shown = allowed;
    });
  }
}
