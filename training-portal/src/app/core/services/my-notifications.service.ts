import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { ApiService } from './api.service';

/** One notice as the bell shows it. */
export interface MyNotification {
  id: number;
  title: string;
  body: string;
  linkPath?: string | null;
  kind?: string | null;
  sentOn: string;
  read: boolean;
}

interface MyNotifications {
  items: MyNotification[];
  unread: number;
}

/**
 * What the scheme has said to the signed-in account.
 *
 * The same feed the two apps read, which is why it is worth having here:
 * a programme raised for permission, a report sent back, anything
 * addressed to one person rather than broadcast. The bell was a button
 * with nothing behind it, so a manager waiting on a programme had only
 * the e-mail - and an e-mail is read wherever mail is read, which is not
 * the screen where the permission is given.
 *
 * Held as a signal rather than fetched per render: the bell is on every
 * screen and the count has to survive navigation.
 */
@Injectable({ providedIn: 'root' })
export class MyNotificationsService {
  private readonly api = inject(ApiService);

  private readonly state = signal<MyNotifications>({ items: [], unread: 0 });

  readonly items = computed(() => this.state().items);
  readonly unread = computed(() => this.state().unread);

  /**
   * Reads the list again.
   *
   * A failure leaves whatever is already held and says nothing: the bell
   * is not the screen anybody came for, and an error toast over it would
   * interrupt the work it sits beside.
   */
  refresh(): void {
    this.api
      .get<MyNotifications>('my-notifications', { take: 25 })
      .pipe(catchError(() => of(null)))
      .subscribe((next) => {
        if (next) this.state.set(next);
      });
  }

  /** Marks one read, and takes it off the count without waiting. */
  markRead(id: number): void {
    const current = this.state();
    if (current.items.find((one) => one.id === id)?.read !== false) return;

    this.state.set({
      items: current.items.map((one) => (one.id === id ? { ...one, read: true } : one)),
      unread: Math.max(0, current.unread - 1),
    });

    this.api
      .post<boolean>(`my-notifications/${id}/read`, {})
      .pipe(
        tap({
          error: () => this.refresh(),
        }),
        catchError(() => of(null)),
      )
      .subscribe();
  }
}
