import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AppNotification, Id, NotificationUpsert } from '../models';
import { CrudService } from './crud.service';

/**
 * What the scheme says to the handsets.
 *
 * Writing one and sending it are the same act from the screen — the
 * button says Send — so `create` carries `sendNow` and the server does
 * both. `send` is for a draft that was saved without going out.
 */
@Injectable({ providedIn: 'root' })
export class AppNotificationService extends CrudService<AppNotification, NotificationUpsert> {
  protected readonly resource = 'notifications';

  send(id: Id): Observable<AppNotification> {
    return this.api.post<AppNotification>(`${this.resource}/${id}/send`, {});
  }
}
