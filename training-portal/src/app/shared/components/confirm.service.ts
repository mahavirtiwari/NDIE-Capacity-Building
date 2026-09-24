import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/** Promise based confirmation, rendered by `ConfirmHostComponent` in the shell. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pending.set({ tone: 'primary', confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...options, resolve });
    });
  }

  askDelete(entity: string): Promise<boolean> {
    return this.ask({
      title: `Delete ${entity}?`,
      message: `This will permanently remove the ${entity.toLowerCase()}. This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
  }

  settle(value: boolean): void {
    const current = this.pending();
    this.pending.set(null);
    current?.resolve(value);
  }
}
