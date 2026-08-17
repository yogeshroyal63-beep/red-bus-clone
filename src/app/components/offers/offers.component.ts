import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-offers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="offers-page">
      <div class="offers-hero">
        <div class="container">
          <h1><i class="fa fa-tags"></i> {{i18n.t('offers.heroTitle')}}</h1>
          <p>{{i18n.t('offers.heroSub')}}</p>
        </div>
      </div>

      <div class="container" style="padding:32px 16px 64px;">
        <!-- Filter chips -->
        <div class="filter-chips" style="margin-bottom:28px;">
          <span class="rb-chip" [class.active]="activeFilter==='all'" (click)="activeFilter='all'">{{i18n.t('offers.filterAll')}}</span>
          <span class="rb-chip" [class.active]="activeFilter==='bank'" (click)="activeFilter='bank'">{{i18n.t('offers.filterBank')}}</span>
          <span class="rb-chip" [class.active]="activeFilter==='upi'" (click)="activeFilter='upi'">{{i18n.t('offers.filterUpi')}}</span>
          <span class="rb-chip" [class.active]="activeFilter==='wallet'" (click)="activeFilter='wallet'">{{i18n.t('offers.filterWallet')}}</span>
          <span class="rb-chip" [class.active]="activeFilter==='promo'" (click)="activeFilter='promo'">{{i18n.t('offers.filterPromo')}}</span>
        </div>

        <div class="offers-big-grid">
          <div class="offer-big-card" *ngFor="let offer of filteredOffers">
            <div class="obc-banner" [style.background]="offer.gradient">
              <div class="obc-discount">{{offer.discount}}</div>
              <div class="obc-title-banner">{{offer.title}}</div>
              <div class="obc-tag"><i class="fa fa-tag"></i></div>
            </div>
            <div class="obc-body">
              <div class="obc-desc">{{offer.desc}}</div>
              <div class="obc-terms fs-11 text-grey">{{offer.terms}}</div>
              <div class="obc-expiry fs-12" *ngIf="offer.expiry">
                <i class="fa fa-clock text-red"></i> {{i18n.t('offers.expires')}} {{offer.expiry}}
              </div>
              <div class="obc-footer flex-between">
                <div class="code-box">
                  <span class="code-text">{{offer.code}}</span>
                  <button class="copy-btn" (click)="copy(offer.code, $event)">
                    <i class="fa fa-copy"></i> {{copied === offer.code ? i18n.t('offers.copied') : i18n.t('offers.copy')}}
                  </button>
                </div>
                <button class="rb-btn-primary" style="padding:8px 18px; font-size:13px;" (click)="claim(offer)">{{i18n.t('offers.apply')}}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .offers-page { min-height:100vh; background:var(--bg-secondary); }
    .offers-hero { background:linear-gradient(135deg, #f47c20, #d84e55); padding:40px 0; color:white; text-align:center;
      h1 { font-size:28px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:12px; }
      p { color:rgba(255,255,255,0.85); margin-top:8px; font-size:15px; }
    }
    .filter-chips { display:flex; gap:8px; flex-wrap:wrap; }
    .offers-big-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
    .offer-big-card { border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.1); background:white; transition:transform 0.2s;
      &:hover { transform:translateY(-4px); box-shadow:0 8px 24px rgba(0,0,0,0.15); }
    }
    .obc-banner { padding:28px 24px; position:relative; overflow:hidden;
      &::after { content:''; position:absolute; right:-20px; top:-20px; width:100px; height:100px; border-radius:50%; background:rgba(255,255,255,0.1); }
    }
    .obc-discount { font-size:32px; font-weight:900; color:white; }
    .obc-title-banner { color:rgba(255,255,255,0.9); font-size:14px; font-weight:500; margin-top:4px; }
    .obc-tag { position:absolute; top:16px; right:20px; color:rgba(255,255,255,0.4); font-size:40px; }
    .obc-body { padding:20px; }
    .obc-desc { font-size:14px; color:#333; font-weight:500; margin-bottom:8px; }
    .obc-terms { margin-bottom:8px; line-height:1.5; }
    .obc-expiry { margin-bottom:16px; display:flex; align-items:center; gap:5px; }
    .obc-footer { gap:12px; }
    .code-box { display:flex; align-items:center; border:2px dashed #d84e55; border-radius:6px; overflow:hidden; }
    .code-text { padding:7px 12px; font-size:13px; font-weight:800; color:#d84e55; letter-spacing:1px; }
    .copy-btn { background:#d84e55; border:none; color:white; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px; transition:background 0.2s;
      &:hover { background:#b73a40; }
    }
  
    @media (max-width: 900px) {
      .offers-big-grid { grid-template-columns: 1fr 1fr !important; }
    }
    @media (max-width: 600px) {
      .offers-big-grid { grid-template-columns: 1fr !important; }
      .filter-chips { overflow-x: auto; flex-wrap: nowrap; }
      .rb-chip { white-space: nowrap; flex-shrink: 0; }
    }
  `]
})
export class OffersComponent {
  i18n = inject(I18nService);
  private notifService = inject(NotificationService);
  private toast = inject(ToastService);

  activeFilter = 'all';
  copied = '';

  allOffers = [
    { code:'FIRST10', discount:'10% OFF', title:'First Booking Offer', desc:'Get 10% off on your very first bus booking with redBus. Max discount ₹100.', terms:'Valid once per user. Min booking ₹300.', expiry:'31 Dec 2026', gradient:'linear-gradient(135deg,#d84e55,#922b21)', category:'promo' },
    { code:'HDFC15', discount:'15% OFF', title:'HDFC Bank Exclusive', desc:'Pay with any HDFC Bank credit or debit card and get 15% instant discount.', terms:'Max discount ₹200. Valid on all routes.', expiry:'30 Nov 2026', gradient:'linear-gradient(135deg,#1565c0,#0d47a1)', category:'bank' },
    { code:'PAYTM20', discount:'20% OFF', title:'Paytm Super Cash', desc:'Pay via Paytm and get 20% cashback credited to your Paytm wallet instantly.', terms:'Min transaction ₹500. Max cashback ₹150.', expiry:'15 Oct 2026', gradient:'linear-gradient(135deg,#00bcd4,#0097a7)', category:'wallet' },
    { code:'ICICI12', discount:'12% OFF', title:'ICICI Card Offer', desc:'ICICI Bank credit card holders get 12% off on bus bookings via redBus.', terms:'Valid on select routes. Max discount ₹180.', expiry:'', gradient:'linear-gradient(135deg,#f57c00,#e65100)', category:'bank' },
    { code:'GPAY200', discount:'₹200 OFF', title:'Google Pay Flat Off', desc:'Pay with Google Pay and get flat ₹200 discount on bus ticket booking.', terms:'Min booking ₹800. Limited period offer.', expiry:'20 Sep 2026', gradient:'linear-gradient(135deg,#4caf50,#2e7d32)', category:'upi' },
    { code:'PHONEPE50', discount:'₹50 CASH', title:'PhonePe Cashback', desc:'Pay via PhonePe and get ₹50 cashback in your PhonePe wallet.', terms:'Min booking ₹400. Valid 3x per user.', expiry:'', gradient:'linear-gradient(135deg,#7b1fa2,#4a148c)', category:'upi' },
    { code:'CORPO25', discount:'25% OFF', title:'Corporate Travel Deal', desc:'Exclusive 25% off for corporate bookings. Register your company to avail.', terms:'Min 10 seats per booking. T&C apply.', expiry:'31 Mar 2027', gradient:'linear-gradient(135deg,#37474f,#263238)', category:'promo' },
    { code:'STUDENT15', discount:'15% OFF', title:'Student Discount', desc:'Valid student ID required. 15% off for students on all bus routes.', terms:'Show valid ID at boarding. Once per week.', expiry:'', gradient:'linear-gradient(135deg,#e91e63,#880e4f)', category:'promo' },
    { code:'SBICARD10', discount:'10% OFF', title:'SBI Card Special', desc:'SBI credit card users get 10% off + 100 reward points on every booking.', terms:'Max discount ₹150. Valid on weekends too.', expiry:'', gradient:'linear-gradient(135deg,#1976d2,#0d47a1)', category:'bank' },
  ];

  get filteredOffers() {
    if (this.activeFilter === 'all') return this.allOffers;
    return this.allOffers.filter(o => o.category === this.activeFilter);
  }

  copy(code: string, e: Event) {
    navigator.clipboard.writeText(code).catch(() => {});
    this.copied = code;
    setTimeout(() => { if (this.copied === code) this.copied = ''; }, 1500);
  }

  /** Finding #13: "promotional/offer" notifications used to have no real trigger
   *  anywhere — the type only ever appeared in static seed data. Claiming an offer here
   *  is a genuine user action that now fires a real, current notification with this
   *  offer's actual code and discount, instead of a demo-only placeholder. */
  claim(offer: { code: string; title: string; discount: string }) {
    this.copy(offer.code, {} as Event);
    this.notifService.push({
      type: 'offer',
      title: `${offer.title}: ${offer.discount}. Use code ${offer.code} at checkout.`,
      message: `${offer.title}: ${offer.discount}. Use code ${offer.code} at checkout.`,
      titleKey: 'notif.offerClaimedTitle',
      messageKey: 'notif.offerClaimedMsg',
      params: { title: offer.title, discount: offer.discount, code: offer.code },
      channel: 'push',
      icon: 'fa-tags',
      color: '#4caf50',
      action: '/offers'
    });
    this.toast.success(this.i18n.t('offers.claimedToast', { code: offer.code }));
  }
}
