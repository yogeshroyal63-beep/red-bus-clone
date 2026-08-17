import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info', duration = 3500) {
    const id = `t_${Date.now()}`;
    this._toasts.update(ts => [...ts, { id, message, type, duration }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(msg: string) { this.show(msg, 'success'); }
  error(msg: string, duration = 5000) { this.show(msg, 'error', duration); }
  info(msg: string) { this.show(msg, 'info'); }
  warning(msg: string) { this.show(msg, 'warning'); }

  dismiss(id: string) {
    this._toasts.update(ts => ts.filter(t => t.id !== id));
  }
}
