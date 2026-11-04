import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
 * The chain of command, drawn.
 *
 * Who answers to whom is recorded on every account — it is set when the
 * account is created, it decides who can see it and who can act on it, and
 * it was readable from no screen in the portal. A manager looking for the
 * coordinator behind a batch, or an Admin checking that an agency sits under
 * the manager who empanelled it, had the answer in front of them with no way
 * to see it.
 *
 * Scoped on the server like the register beside it: the Super Admin and the
 * Ministry see the whole chain, everybody else sees their own subtree with
 * themselves at the top of it.
 */
@Component({
  selector: 'app-user-organogram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, NgTemplateOutlet],
  template: `
    @if (loading()) {
      <div class="org__state">Loading the chain of command…</div>
    } @else if (roots().length === 0) {
      <div class="org__state">
        No accounts answer to you yet. Create one and it appears here.
      </div>
    } @else {
      <div class="org__bar">
        <span class="org__count">
          {{ nodes().length }} {{ nodes().length === 1 ? 'account' : 'accounts' }}
        </span>
        <div class="btn-row">
          <button type="button" class="btn btn--sm btn--secondary" (click)="expandAll()">
            Expand all
          </button>
          <button type="button" class="btn btn--sm btn--secondary" (click)="collapseAll()">
            Collapse all
          </button>
        </div>
      </div>

      <div class="org">
        @for (root of roots(); track root.node.id) {
          <ng-container
            [ngTemplateOutlet]="branch"
            [ngTemplateOutletContext]="{ $implicit: root, depth: 0 }"
          />
        }
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

          <div class="org__card" [class.org__card--off]="item.node.status !== 'Active'">
            <div class="org__who">
              <span class="org__name">{{ item.node.fullName }}</span>
              <span class="org__code tabular">{{ item.node.userCode }}</span>
            </div>
            <div class="org__meta">
              <span class="org__tier" [attr.data-tier]="item.node.baseRole">
                {{ tier(item.node.baseRole) }}
              </span>
              @if (item.node.roleName && item.node.roleName !== tier(item.node.baseRole)) {
                <span class="org__role">{{ item.node.roleName }}</span>
              }
              @if (item.node.agencyName) {
                <span class="org__agency">{{ item.node.agencyName }}</span>
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
      padding: 2rem 0;
      color: var(--ink-500);
      text-align: center;
    }

    .org__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 0.75rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid var(--border);
    }

    .org__count {
      font-size: var(--fs-sm);
      color: var(--ink-500);
    }

    /* Indented by depth, with a rule down the left of each level so a long
       list of coordinators under one agency still reads as belonging to it
       once the parent has scrolled off the top. */
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

    /* The ID beside the name, not under it: a row of cards down a chart
       stays scannable when every card is one line tall. */
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
      color: var(--ink-500);
    }

    .org__tier[data-tier='SuperAdmin'],
    .org__tier[data-tier='Ministry'] {
      color: var(--brand-700);
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

  private readonly loaded = toSignal(this.users.organogram(), { initialValue: null });

  protected readonly loading = computed(() => this.loaded() === null);
  protected readonly nodes = computed<UserNode[]>(() => this.loaded() ?? []);

  /** Folded branches, by the id of the account at the top of each. */
  protected readonly folded = signal<ReadonlySet<Id>>(new Set<Id>());

  /**
   * The chart, assembled from the flat list.
   *
   * A node whose parent is not in the list is a root. That is not an error
   * and must not drop it: scope is a subtree, so the account at the top of
   * one always reports to somebody the reader cannot see — and an account
   * created before the chain was recorded reports to nobody at all. Either
   * way it belongs on the chart.
   */
  protected readonly roots = computed<Branch[]>(() => {
    const all = this.nodes();
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
    return roots;
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
    /* Everything that has anybody under it, roots included: the chart folds
       to its top line, which is where somebody reading a large one starts. */
    const shut = new Set<Id>();
    const walk = (branch: Branch): void => {
      if (branch.children.length > 0) shut.add(branch.node.id);
      branch.children.forEach(walk);
    };
    this.roots().forEach(walk);
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
