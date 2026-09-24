import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  success(title: string, message?: string) { this.push('success', title, message); }
  error(title: string, message?: string) { this.push('error', title, message); }
  info(title: string, message?: string) { this.push('info', title, message); }
  warning(title: string, message?: string) { this.push('warning', title, message); }

  dismiss(id: number) {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, title: string, message?: string) {
    const toast: Toast = { id: ++this.seq, kind, title, message };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), kind === 'error' ? 7000 : 4000);
  }
}
