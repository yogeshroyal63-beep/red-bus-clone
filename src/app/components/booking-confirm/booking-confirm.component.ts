import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-booking-confirm',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="confirm-page" *ngIf="!confirmed">
      <div class="container" style="padding-top:32px; padding-bottom:48px;">
        <div class="page-steps flex-center gap-0">
          <div class="step done"><span class="step-num"><i class="fa fa-check"></i></span><span class="step-label">{{i18n.t('confirm.stepSearch')}}</span></div>
          <div class="step-line done"></div>
          <div class="step done"><span class="step-num"><i class="fa fa-check"></i></span><span class="step-label">{{i18n.t('confirm.stepSelectSeat')}}</span></div>
          <div class="step-line active"></div>
          <div class="step active"><span class="step-num">3</span><span class="step-label">{{i18n.t('confirm.stepPassengerInfo')}}</span></div>
          <div class="step-line"></div>
          <div class="step"><span class="step-num">4</span><span class="step-label">{{i18n.t('confirm.stepPayment')}}</span></div>
        </div>

        <div class="confirm-layout">
          <!-- Passenger details form -->
          <div class="passenger-section">
            <div class="rb-card" style="margin-bottom:16px;">
              <div class="card-title-bar"><i class="fa fa-user"></i> {{i18n.t('confirm.passengerDetails')}}</div>
              <div class="pass-form-body">
                <div class="passenger-form" *ngFor="let p of passengers; let i=index">
                  <div class="pass-header">
                    <div class="seat-badge">{{i18n.t('confirm.seat')}} {{booking?.seats?.[i] || i+1}}</div>
                    <span class="fs-13 fw-600">{{i18n.t('confirm.passenger')}} {{i+1}}</span>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>{{i18n.t('confirm.fullName')}} *</label>
                      <input type="text" [(ngModel)]="p.name" [placeholder]="i18n.t('confirm.fullNamePlaceholder')" class="rb-input" [class.invalid]="submitted&&!p.name">
                    </div>
                    <div class="form-group">
                      <label>{{i18n.t('confirm.age')}} *</label>
                      <input type="number" [(ngModel)]="p.age" [placeholder]="i18n.t('confirm.age')" class="rb-input sm" min="1" max="120">
                    </div>
                    <div class="form-group">
                      <label>{{i18n.t('confirm.gender')}} *</label>
                      <select [(ngModel)]="p.gender" class="rb-input sm">
                        <option value="">{{i18n.t('confirm.select')}}</option>
                        <option value="M">{{i18n.t('confirm.male')}}</option>
                        <option value="F">{{i18n.t('confirm.female')}}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="contact-section">
                  <div class="fs-14 fw-600" style="margin-bottom:16px; color:var(--text-primary);">{{i18n.t('confirm.contactDetails')}}</div>
                  <div class="form-row">
                    <div class="form-group">
                      <label>{{i18n.t('confirm.mobileNumber')}} *</label>
                      <div class="phone-input-wrap">
                        <span class="phone-cc">+91</span>
                        <input type="tel" [(ngModel)]="mobile" [placeholder]="i18n.t('confirm.mobilePlaceholder')" class="rb-input" style="border-radius:0 6px 6px 0; border-left:none;" maxlength="10">
                      </div>
                    </div>
                    <div class="form-group">
                      <label>{{i18n.t('confirm.emailAddress')}} *</label>
                      <input type="email" [(ngModel)]="email" placeholder="your@email.com" class="rb-input">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Offers -->
            <div class="rb-card" style="margin-bottom:16px;">
              <div class="card-title-bar"><i class="fa fa-tag" style="color:#f47c20;"></i> {{i18n.t('confirm.applyCoupon')}}</div>
              <div class="coupon-section">
                <div class="coupon-input-row">
                  <input type="text" [(ngModel)]="couponCode" [placeholder]="i18n.t('confirm.couponPlaceholder')" class="rb-input" style="flex:1;">
                  <button class="rb-btn-outline" style="padding:10px 20px;" (click)="applyCoupon()">{{i18n.t('offers.apply')}}</button>
                </div>
                <div class="offer-chips">
                  <div class="rb-chip" *ngFor="let c of availableCoupons" (click)="couponCode=c.code">{{c.code}}</div>
                </div>
                <div class="coupon-success" *ngIf="couponApplied">
                  <i class="fa fa-check-circle text-green"></i> {{i18n.t('confirm.couponApplied', {amount: discount})}}
                </div>
              </div>
            </div>
          </div>

          <!-- Order Summary -->
          <div class="order-summary">
            <div class="rb-card" style="position:sticky; top:80px;">
              <div class="card-title-bar"><i class="fa fa-receipt"></i> {{i18n.t('confirm.orderSummary')}}</div>
              <div class="summary-content">
                <div class="sum-bus-info">
                  <div class="fw-600 fs-14">{{booking?.busName}}</div>
                  <div class="fs-12 text-grey">{{booking?.from}} → {{booking?.to}}</div>
                  <div class="fs-12 text-grey">{{booking?.date | date:'EEE, dd MMM yyyy'}} · {{booking?.departureTime}}</div>
                </div>
                <div class="sum-seats">
                  <span class="fs-13 text-grey">{{i18n.t('mybookings.seats')}}:</span>
                  <span class="seat-tag" *ngFor="let s of booking?.seats">{{s}}</span>
                </div>
                <div class="price-rows">
                  <div class="pr-row flex-between"><span class="fs-13 text-grey">{{i18n.t('confirm.baseFare')}}</span><span class="fs-13">₹{{booking?.totalAmount}}</span></div>
                  <div class="pr-row flex-between" *ngIf="discount>0"><span class="fs-13 text-green">{{i18n.t('confirm.couponDiscount')}}</span><span class="fs-13 text-green">-₹{{discount}}</span></div>
                  <div class="pr-row flex-between"><span class="fs-13 text-grey">{{i18n.t('confirm.convenienceFee')}}</span><span class="fs-13 text-green">{{i18n.t('confirm.free')}}</span></div>
                  <div class="pr-total flex-between">
                    <span class="fw-700 fs-15">{{i18n.t('confirm.totalPayable')}}</span>
                    <span class="fw-700 fs-18 text-red">₹{{finalAmount}}</span>
                  </div>
                </div>
              </div>

              <!-- Payment Methods -->
              <div class="payment-section">
                <div class="fs-13 fw-700" style="margin-bottom:12px; color:var(--text-primary);">{{i18n.t('confirm.selectPaymentMethod')}}</div>
                <div class="payment-option" *ngFor="let pm of paymentMethods" [class.active]="selectedPayment===pm.id" (click)="selectedPayment=pm.id">
                  <i [class]="pm.icon" [style.color]="pm.color"></i>
                  <span class="fs-13">{{i18n.t('confirm.pm.'+pm.id)}}</span>
                  <span class="pm-offer fs-11 text-green" *ngIf="pm.offer">{{i18n.t('confirm.cashbackOffer', {amount: pm.offer})}}</span>
                </div>
              </div>

              <div class="summary-action">
                <div class="terms-check">
                  <input type="checkbox" [(ngModel)]="termsAccepted" id="terms">
                  <label for="terms" class="fs-12 text-grey">{{i18n.t('confirm.agreeTo')}} <a href="#" class="text-red">{{i18n.t('footer.terms')}}</a> {{i18n.t('confirm.and')}} <a href="#" class="text-red">{{i18n.t('footer.privacyPolicy')}}</a></label>
                </div>
                <button class="rb-btn-primary" style="width:100%; padding:14px; font-size:15px; font-weight:700; margin-top:12px;" (click)="makePayment()" [disabled]="!termsAccepted || !selectedPayment">
                  <i class="fa fa-lock"></i> {{i18n.t('booking.pay')}} ₹{{finalAmount}}
                </button>
                <div class="secure-note fs-11 text-grey">
                  <i class="fa fa-shield-alt"></i> {{i18n.t('confirm.secureNote')}}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Success -->
    <div class="success-page" *ngIf="confirmed">
      <div class="container" style="padding-top:48px; padding-bottom:48px;">
        <div class="success-card rb-card">
          <div class="success-animation">
            <div class="success-circle"><i class="fa fa-check fa-3x"></i></div>
            <div class="success-confetti"></div>
          </div>
          <h2 class="success-title">{{i18n.t('booking.confirm')}} 🎉</h2>
          <p class="success-sub">{{i18n.t('confirm.successSub', {email})}}</p>
          <div class="pnr-box">
            <div class="pnr-label">{{i18n.t('confirm.pnrNumber')}}</div>
            <div class="pnr-num">{{pnr}}</div>
            <button class="copy-pnr" (click)="copyPnr()"><i class="fa fa-copy"></i></button>
          </div>
          <div class="ticket-preview">
            <div class="ticket-header-line">
              <div class="tl-city">{{booking?.from}}</div>
              <div class="tl-arrow">
                <div class="tl-line"></div>
                <i class="fa fa-bus" style="color:#d84e55;"></i>
                <div class="tl-line"></div>
              </div>
              <div class="tl-city">{{booking?.to}}</div>
            </div>
            <div class="ticket-details-grid">
              <div class="td-item"><div class="td-label">{{i18n.t('mybookings.journeyDate')}}</div><div class="td-val">{{booking?.date | date:'EEE, dd MMM yyyy'}}</div></div>
              <div class="td-item"><div class="td-label">{{i18n.t('confirm.departure')}}</div><div class="td-val">{{booking?.departureTime}}</div></div>
              <div class="td-item"><div class="td-label">{{i18n.t('mybookings.seats')}}</div><div class="td-val">{{booking?.seats?.join(', ')}}</div></div>
              <div class="td-item"><div class="td-label">{{i18n.t('mybookings.amountPaid')}}</div><div class="td-val text-red fw-700">₹{{finalAmount}}</div></div>
            </div>
          </div>
          <div class="success-actions flex-center gap-12">
            <button class="rb-btn-outline" (click)="downloadTicket()"><i class="fa fa-download"></i> {{i18n.t('mybookings.downloadTicket')}}</button>
            <button class="rb-btn-primary" (click)="goHome()"><i class="fa fa-home"></i> {{i18n.t('confirm.backToHome')}}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-page { min-height:100vh; background:var(--bg-secondary); }
    .page-steps { justify-content:center; margin-bottom:32px; }
    .step { display:flex; flex-direction:column; align-items:center; gap:6px; }
    .step-num { width:32px; height:32px; border-radius:50%; background:#e0e0e0; color:#999; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; }
    .step-label { font-size:12px; color:#999; white-space:nowrap; }
    .step.active .step-num { background:#d84e55; color:white; }
    .step.active .step-label { color:#d84e55; font-weight:600; }
    .step.done .step-num { background:#4caf50; color:white; }
    .step.done .step-label { color:#4caf50; }
    .step-line { width:60px; height:2px; background:#e0e0e0; margin-top:-24px;
      &.active, &.done { background:#d84e55; }
    }
    .confirm-layout { display:grid; grid-template-columns:1fr 340px; gap:20px; }
    .card-title-bar { padding:14px 20px; font-size:14px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .pass-form-body { padding:20px; }
    .passenger-form { margin-bottom:20px; padding-bottom:20px; border-bottom:1px dashed #eee;
      &:last-of-type { border-bottom:none; }
    }
    .pass-header { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .seat-badge { background:#d84e55; color:white; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
    .form-row { display:grid; grid-template-columns:2fr 1fr 1fr; gap:12px; }
    .form-group { display:flex; flex-direction:column; gap:5px;
      label { font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; }
    }
    .rb-input { width:100%; padding:10px 12px; border:1.5px solid #e0e0e0; border-radius:6px; font-size:13px; outline:none; font-family:inherit; transition:border 0.2s;
      &:focus { border-color:#d84e55; }
      &.invalid { border-color:#f44336; }
      &.sm { max-width:100%; }
    }
    .contact-section { margin-top:20px; padding-top:20px; border-top:1px solid var(--border); }
    .phone-input-wrap { display:flex; }
    .phone-cc { padding:10px 12px; background:var(--bg-secondary); border:1.5px solid #e0e0e0; border-right:none; border-radius:6px 0 0 6px; font-size:13px; color:var(--text-secondary); font-weight:500; white-space:nowrap; }
    .coupon-section { padding:16px 20px; }
    .coupon-input-row { display:flex; gap:10px; margin-bottom:12px; }
    .offer-chips { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
    .coupon-success { color:#4caf50; font-size:13px; display:flex; align-items:center; gap:6px; }
    .sum-bus-info { padding:16px 16px 12px; border-bottom:1px solid var(--border); }
    .sum-seats { padding:12px 16px; display:flex; align-items:center; gap:6px; flex-wrap:wrap; border-bottom:1px solid var(--border); }
    .seat-tag { background:#e8f5e9; color:#2e7d32; border-radius:4px; padding:2px 8px; font-size:12px; font-weight:600; }
    .price-rows { padding:12px 16px; }
    .pr-row { padding:5px 0; }
    .pr-total { padding:12px 0 0; border-top:2px solid var(--border); margin-top:8px; }
    .payment-section { padding:16px; border-top:1px solid var(--border); }
    .payment-option { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1.5px solid #e0e0e0; border-radius:6px; margin-bottom:8px; cursor:pointer; transition:all 0.2s;
      &.active, &:hover { border-color:#d84e55; background:var(--bg-card)0f1; }
      i { font-size:18px; width:24px; }
    }
    .pm-offer { margin-left:auto; }
    .summary-action { padding:16px; border-top:1px solid var(--border);
      button:disabled { background:#ccc; cursor:not-allowed; }
    }
    .terms-check { display:flex; align-items:flex-start; gap:8px; a { text-decoration:underline; } }
    .secure-note { text-align:center; margin-top:10px; display:flex; align-items:center; justify-content:center; gap:4px; }
    .success-page { min-height:80vh; background:var(--bg-secondary); }
    .success-card { max-width:680px; margin:0 auto; padding:48px; text-align:center; }
    .success-animation { margin-bottom:24px; }
    .success-circle { width:80px; height:80px; background:#4caf50; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; margin:0 auto; animation:pop 0.5s ease; }
    @keyframes pop { 0%{transform:scale(0)}60%{transform:scale(1.1)}100%{transform:scale(1)} }
    .success-title { font-size:26px; font-weight:800; color:var(--text-primary); margin-bottom:8px; }
    .success-sub { color:var(--text-muted); margin-bottom:24px; }
    .pnr-box { display:flex; align-items:center; justify-content:center; gap:12px; background:var(--bg-secondary); border:2px dashed #d84e55; border-radius:8px; padding:16px 24px; margin-bottom:24px; }
    .pnr-label { font-size:12px; font-weight:700; color:var(--text-muted); letter-spacing:1px; }
    .pnr-num { font-size:24px; font-weight:900; color:#d84e55; letter-spacing:3px; }
    .copy-pnr { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:16px; &:hover { color:#d84e55; } }
    .ticket-preview { background:#fafafa; border-radius:8px; padding:20px; margin-bottom:28px; border:1px solid var(--border); }
    .ticket-header-line { display:flex; align-items:center; gap:16px; justify-content:center; margin-bottom:20px; }
    .tl-city { font-size:20px; font-weight:800; }
    .tl-arrow { display:flex; align-items:center; gap:8px; }
    .tl-line { width:40px; height:2px; background:#e0e0e0; }
    .ticket-details-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .td-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .td-val { font-size:13px; font-weight:600; color:var(--text-primary); }
    .success-actions { justify-content:center; }
  
    @media (max-width: 900px) {
      .confirm-layout { grid-template-columns: 1fr !important; }
      .order-summary .rb-card { position: static !important; }
    }
    @media (max-width: 768px) {
      .confirm-layout { grid-template-columns: 1fr !important; }
      .form-row { grid-template-columns: 1fr !important; }
      .page-steps { overflow-x: auto; gap: 0; padding-bottom: 8px; }
      .step-line { width: 24px !important; }
      .step-label { font-size: 10px; }
      .ticket-details-grid { grid-template-columns: 1fr 1fr !important; }
      .success-card { padding: 24px !important; }
      .success-actions { flex-direction: column !important; }
      .success-actions button { width: 100%; justify-content: center; }
    }
    @media (max-width: 480px) {
      .ticket-details-grid { grid-template-columns: 1fr !important; }
      .pnr-num { font-size: 18px !important; letter-spacing: 1px; }
    }
  `]
})
export class BookingConfirmComponent implements OnInit {
  booking: any = null;
  passengers: any[] = [];
  mobile = ''; email = '';
  couponCode = ''; couponApplied = false; discount = 0;
  selectedPayment = 'upi';
  termsAccepted = false;
  confirmed = false; pnr = '';
  submitted = false;

  availableCoupons = [{ code: 'FIRST10' }, { code: 'HDFC15' }, { code: 'PAYTM20' }];
  paymentMethods = [
    { id: 'upi', icon: 'fa fa-mobile-alt', color: '#4caf50', offer: '50' },
    { id: 'card', icon: 'fa fa-credit-card', color: '#1976d2', offer: '' },
    { id: 'netbanking', icon: 'fa fa-university', color: '#ff9800', offer: '' },
    { id: 'wallet', icon: 'fa fa-wallet', color: '#9c27b0', offer: '' },
  ];

  get finalAmount() { return (this.booking?.totalAmount || 0) - this.discount; }

  constructor(private router: Router, private toast: ToastService, public i18n: I18nService) {}

  ngOnInit() {
    const data = localStorage.getItem('rb_pending_booking');
    if (data) {
      this.booking = JSON.parse(data);
      this.passengers = (this.booking.seats || ['1']).map((s: string) => ({ name: '', age: '', gender: '', seat: s }));
    }
  }

  applyCoupon() {
    const map: any = { FIRST10: 50, HDFC15: 80, PAYTM20: 100 };
    if (map[this.couponCode.toUpperCase()]) {
      this.discount = map[this.couponCode.toUpperCase()];
      this.couponApplied = true;
    } else { this.toast.error(this.i18n.t('confirm.invalidCoupon')); }
  }

  makePayment() {
    this.submitted = true;
    const allFilled = this.passengers.every(p => p.name && p.age && p.gender);
    if (!allFilled || !this.mobile || !this.email) { this.toast.error(this.i18n.t('confirm.fillAllDetails')); return; }
    this.pnr = 'RB' + Math.random().toString(36).substr(2,8).toUpperCase();
    // Persist the confirmed booking so reviews/community can verify it
    const confirmedBooking = {
      ...this.booking, pnr: this.pnr, status: 'confirmed',
      bookingDate: new Date().toISOString()
    };
    try {
      const existing: any[] = JSON.parse(localStorage.getItem('rb_bookings') || '[]');
      existing.unshift(confirmedBooking);
      localStorage.setItem('rb_bookings', JSON.stringify(existing.slice(0, 20)));
      localStorage.setItem('rb_last_booking', JSON.stringify(confirmedBooking));
    } catch {}
    localStorage.removeItem('rb_pending_booking');
    this.confirmed = true;
  }

  copyPnr() { navigator.clipboard.writeText(this.pnr).catch(()=>{}); this.toast.success(this.i18n.t('confirm.pnrCopied')); }
  downloadTicket() { this.toast.info(this.i18n.t('confirm.ticketDownloaded')); }
  goHome() { this.router.navigate(['/']); }
}
