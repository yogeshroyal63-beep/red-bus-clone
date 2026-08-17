import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <!-- aria-live region: screen readers announce these automatically -->
    <div class="toast-container"
         aria-live="polite"
         aria-atomic="false"
         role="status"
         [attr.aria-label]="i18n.t('toast.regionLabel')">
      <div class="toast {{t.type}}"
           *ngFor="let t of ts.toasts(); trackBy: trackToastId"
           role="alert"
           [attr.aria-label]="t.message">
        <i class="fa" [class]="getIcon(t.type)" aria-hidden="true"></i>
        <span>{{t.message}}</span>
        <button class="toast-close" (click)="ts.dismiss(t.id)"
                [attr.aria-label]="i18n.t('toast.dismiss')">
          <i class="fa fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .toast-close {
      background: none; border: none; color: white; cursor: pointer;
      padding: 0 0 0 8px; font-size: 12px; opacity: 0.8;
      margin-left: auto; flex-shrink: 0;
      &:hover { opacity: 1; }
    }
  `]
})
export class ToastComponent {
  i18n = inject(I18nService);
  constructor(public ts: ToastService) {}
  trackToastId(_: number, t: any) { return t.id; }
  getIcon(type: string) {
    return { success: 'fa-check-circle', error: 'fa-times-circle',
      info: 'fa-info-circle', warning: 'fa-exclamation-triangle' }[type] || 'fa-info-circle';
  }
}
