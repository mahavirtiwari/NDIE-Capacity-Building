import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Id, UserNode } from '../../core/models';
import { UserService } from '../../core/services/people.service';
import { IconComponent } from '../../shared/components/icon.component';

/** A node with its children hung off it, which is what the template walks. */
interface Branch {
  node: UserNode;
  children: Branch[];
  /** Everybody below, at every depth. Shown on a branch that is folded up. */
  below: number;
}

/**
 * One account's place in the chain of command.
 *
 * Who answers to whom is recorded on every account — it is set when the
 * account is created, it decides who can see it and who can act on it, and
 * it was readable from no screen. A manager looking for the coordinator
 * behind a batch, or an Admin checking that an agency sits under the manager
 * who empanelled it, had the answer in front of them with no way to see it.
 *
 * About the account that was asked for, not about everybody: the line above
 * them from the top down, then them, then everybody beneath. A chart of the
 * whole estate answers a question nobody asked and buries the one they did.
 *
 * The chain comes from the server scoped as the register is, so nothing can
 * appear here that the reader could not already list.
 */
@Component({
  selector: 'app-user-organogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet],
  template: `
    @if (loading()) {
      <div class="org__state">Loading the chain of command…</div>
    } @else if (focus(); as here) {
      <!-- The line above, from the top down. Flat rather than indented: it
           is one line of descent with no branches in it, and stepping it
           across the page spends width on a shape that has none. -->
      <div class="org__above">
        @if (spine().length > 0) {
          <span class="org__aboveHead">Reports up through</span>
          @for (up of spine(); track up.id) {
            <span class="org__up">
              <span class="org__upName">{{ up.fullName }}</span>
              <span class="org__code tabular">{{ up.userCode }}</span>
            </span>
          }
        } @else {
          <span class="org__aboveHead">Answers to nobody above</span>
        }
      </div>

      <div class="org__bar">
        <span class="org__count">
          @if (here.below === 0) {
            Nobody reports to this account
          } @else {
            {{ here.below }} {{ here.below === 1 ? 'account' : 'accounts' }} below
          }
        </span>
        @if (here.below > 0) {
          <div class="btn-row">
            <button type="button" class="btn btn--sm btn--secondary" (click)="expandAll()">
              Expand all
            </button>
            <button type="button" class="btn btn--sm btn--secondary" (click)="collapseAll()">
              Collapse all
            </button>
          </div>
        }
      </div>

      <div class="org">
        <ng-container
          [ngTemplateOutlet]="branch"
          [ngTemplateOutletContext]="{ $implicit: here, depth: 0 }"
        />
      </div>
    } @else {
      <div class="org__state">
        This account is not on the chain of command you can see.
      </div>
    }

    <!-- One template, called on itself: the chain is four deep today and the
         chart should not have to be rewritten when a tier is added. -->
    <ng-template #branch let-item let-depth="depth">
      <div class="org__branch" [style.--depth]="depth">
        <div class="org__row">
          @if (item.children.length > 0) {
            <button
              type="button"
              class="org__toggle"
              [attr.aria-expanded]="!folded().has(item.node.id)"
              [title]="folded().has(item.node.id) ? 'Show who reports to them' : 'Hide'"
              (click)="toggle(item.node.id)"
            >
              <app-icon
                [name]="folded().has(item.node.id) ? 'chevron-right' : 'chevron-down'"
                [size]="14"
              />
            </button>
          } @else {
            <span class="org__leaf"></span>
          }

          <div
            class="org__card"
            [class.org__card--here]="depth === 0"
            [class.org__card--off]="item.node.status !== 'Active'"
          >
            <div class="org__who">
              <span class="org__name">{{ item.node.fullName }}</span>
              <span class="org__code tabular">{{ item.node.userCode }}</span>
            </div>
            <div class="org__meta">
              <span class="org__tier">{{ tier(item.node.baseRole) }}</span>
              @if (item.node.roleName && item.node.roleName !== tier(item.node.baseRole)) {
                <span>{{ item.node.roleName }}</span>
              }
              @if (item.node.agencyName) {
                <span>
                  {{ item.node.agencyName }}
                  @if (item.node.agencyCode) {
                    <span class="tabular">({{ item.node.agencyCode }})</span>
                  }
                </span>
              }
              @if (item.node.status !== 'Active') {
                <span class="org__off">Disabled</span>
              }
            </div>
          </div>

          @if (item.children.length > 0 && folded().has(item.node.id)) {
            <button type="button" class="org__folded" (click)="toggle(item.node.id)">
              +{{ item.below }}
            </button>
          }
        </div>

        @if (!folded().has(item.node.id)) {
          @for (child of item.children; track child.node.id) {
            <ng-container
              [ngTemplateOutlet]="branch"
              [ngTemplateOutletContext]="{ $implicit: child, depth: depth + 1 }"
            />
          }
        }
      </div>
    </ng-template>
  `,
  styles: `
    .org__state {
      padding: 1.5rem 0;
      color: var(--ink-500);
      text-align: center;
    }

    /* The line above: muted, and chevroned so it reads downwards. */
    .org__above {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.35rem 0.5rem;
      font-size: var(--fs-xs);
      color: var(--ink-500);
      padding-bottom: 0.75rem;
    }

    .org__aboveHead {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .org__up {
      display: inline-flex;
      align-items: baseline;
      gap: 0.35rem;
    }

    .org__up::before {
      content: '›';
      margin-right: 0.15rem;
      color: var(--ink-400, var(--ink-500));
    }

    .org__upName { color: var(--ink-700); }

    .org__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--border);
    }

    .org__count {
      font-size: var(--fs-sm);
      color: var(--ink-500);
    }

    .org__branch {
      padding-left: calc(var(--depth) * 1.5rem);
    }

    .org__row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.2rem 0;
    }

    .org__toggle,
    .org__leaf {
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .org__toggle {
      border: 0;
      background: transparent;
      color: var(--ink-500);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .org__toggle:hover {
      background: var(--ink-100);
      color: var(--brand-700);
    }

    .org__card {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.35rem 0.75rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      min-width: 0;
    }

    /* The account the chart was opened for. Marked, because where they sit
       in it is the whole point. */
    .org__card--here {
      border-color: var(--brand-600);
      background: var(--brand-50);
    }

    .org__card--off {
      background: var(--surface-muted);
      border-style: dashed;
    }

    .org__who {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      min-width: 0;
    }

    .org__name {
      font-weight: 600;
      color: var(--ink-800);
    }

    /* The ID beside the name, not under it: a column of cards stays
       scannable when every card is one line tall. */
    .org__code {
      font-size: var(--fs-xs);
      color: var(--brand-700);
    }

    .org__meta {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: var(--fs-xs);
      color: var(--ink-500);
    }

    .org__tier {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .org__off {
      color: var(--danger-700);
      font-weight: 600;
    }

    /* How many are hidden under a folded branch, as a button that opens it. */
    .org__folded {
      border: 1px solid var(--border);
      background: var(--surface-muted);
      color: var(--ink-500);
      border-radius: 999px;
      padding: 0.05rem 0.5rem;
      font-size: var(--fs-xs);
      cursor: pointer;
    }

    .org__folded:hover {
      color: var(--brand-700);
      border-color: var(--brand-200);
    }
  `,
})
export class UserOrganogramComponent {
  private readonly users = inject(UserService);

  /** The account the chart is about. */
  readonly userId = input.required<Id>();

  private readonly loaded = toSignal(this.users.organogram(), { initialValue: null });

  protected readonly loading = computed(() => this.loaded() === null);

  /** Folded branches, by the id of the account at the top of each. */
  protected readonly folded = signal<ReadonlySet<Id>>(new Set<Id>());

  /**
   * The whole chain, assembled from the flat list.
   *
   * A node whose parent is not in the list is a root. That is not an error
   * and must not drop it: scope is a subtree, so the account at the top of
   * one always reports to somebody the reader cannot see — and an account
   * created before the chain was recorded reports to nobody at all.
   */
  private readonly byId = computed<Map<Id, Branch>>(() => {
    const all = this.loaded() ?? [];
    const byId = new Map<Id, Branch>(
      all.map((node) => [node.id, { node, children: [], below: 0 }]),
    );

    const roots: Branch[] = [];
    for (const branch of byId.values()) {
      const parent =
        branch.node.reportsToUserId == null
          ? undefined
          : byId.get(branch.node.reportsToUserId);

      /* Itself as its own parent, or a cycle through two accounts, would
         hang the walk below. Treated as a root, which is the reading that
         still shows the account. */
      if (parent && parent !== branch) parent.children.push(branch);
      else roots.push(branch);
    }

    for (const root of roots) count(root, new Set<Id>());
    return byId;
  });

  /** The account asked about, with everybody beneath it. */
  protected readonly focus = computed(() => this.byId().get(this.userId()) ?? null);

  /**
   * The line above them, from the top down.
   *
   * Walked with a guard: a reporting line that loops would otherwise walk
   * for ever, and the chart of an account whose record is wrong should
   * still open.
   */
  protected readonly spine = computed<UserNode[]>(() => {
    const byId = this.byId();
    const up: UserNode[] = [];
    const seen = new Set<Id>();

    let at = this.focus();
    while (at && !seen.has(at.node.id)) {
      seen.add(at.node.id);

      const parentId = at.node.reportsToUserId;
      if (parentId == null) break;

      const parent = byId.get(parentId);
      if (!parent) break;

      up.unshift(parent.node);
      at = parent;
    }

    return up;
  });

  protected toggle(id: Id): void {
    const next = new Set(this.folded());
    if (!next.delete(id)) next.add(id);
    this.folded.set(next);
  }

  protected expandAll(): void {
    this.folded.set(new Set<Id>());
  }

  protected collapseAll(): void {
    /* Everything with anybody under it, except the account the chart is
       about: folding that away would leave the reader looking at nothing. */
    const shut = new Set<Id>();
    const walk = (branch: Branch, top: boolean): void => {
      if (!top && branch.children.length > 0) shut.add(branch.node.id);
      branch.children.forEach((child) => walk(child, false));
    };

    const here = this.focus();
    if (here) walk(here, true);
    this.folded.set(shut);
  }

  /** The tier, spelled the way the rest of the portal spells it. */
  protected tier(role: string): string {
    return TIERS[role] ?? role;
  }
}

const TIERS: Record<string, string> = {
  SuperAdmin: 'Super Admin',
  Ministry: 'Ministry',
  Admin: 'Admin',
  OperationManager: 'Operation Manager',
  AgencyAdmin: 'Implementing Agency',
  Coordinator: 'Coordinator',
};

/** Fills in how many sit below each branch, guarding against a cycle. */
function count(branch: Branch, seen: Set<Id>): number {
  if (seen.has(branch.node.id)) return 0;
  seen.add(branch.node.id);

  branch.below = branch.children.reduce((total, child) => total + 1 + count(child, seen), 0);
  return branch.below;
}
