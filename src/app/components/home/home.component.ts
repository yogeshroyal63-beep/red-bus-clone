import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BusService } from '../../services/bus.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Hero Banner -->
    <section class="hero-section">
      <div class="hero-bg">
        <div class="container">
          <div class="hero-content">
            <h1 class="hero-title">{{i18n.t('home.title')}}</h1>
            <p class="hero-sub">{{i18n.t('home.sub')}}</p>

            <!-- Search Widget -->
            <div class="search-widget rb-card">
              <div class="search-tabs">
                <button class="tab active"><i class="fa fa-bus"></i> Bus Tickets</button>
                <button class="tab"><i class="fa fa-building"></i> Hotel</button>
                <button class="tab"><i class="fa fa-car"></i> Cabs</button>
              </div>
              <div class="search-form">
                <div class="search-row">
                  <div class="field-wrap">
                    <label>{{i18n.t('search.from')}}</label>
                    <div class="search-field">
                      <i class="fa fa-map-marker-alt field-icon"></i>
                      <input type="text" [(ngModel)]="from" placeholder="Enter origin city" class="city-input" aria-label="From city" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="showFromDD" (input)="filterFromCities($event)" (focus)="showFromDD=true" (blur)="hideDD('from')" (keydown)="onFromKey($event)" autocomplete="off">
                      <div class="city-dropdown" *ngIf="showFromDD && filteredFromCities.length" role="listbox" aria-label="City suggestions">
                        <div class="city-item" *ngFor="let city of filteredFromCities; let i=index; trackBy: trackByIndex" role="option" [class.highlighted]="i===fromHighlight" [attr.aria-selected]="i===fromHighlight" (mousedown)="selectFrom(city)">
                          <i class="fa fa-map-marker-alt"></i> {{city}}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button class="swap-btn" (click)="swapCities()" title="Swap cities" aria-label="Swap origin and destination">
                    <i class="fa fa-exchange-alt"></i>
                  </button>
                  <div class="field-wrap">
                    <label>{{i18n.t('search.to')}}</label>
                    <div class="search-field">
                      <i class="fa fa-map-marker-alt field-icon"></i>
                      <input type="text" [(ngModel)]="to" placeholder="Enter destination city" class="city-input" aria-label="To city" role="combobox" aria-autocomplete="list" [attr.aria-expanded]="showToDD" (input)="filterToCities($event)" (focus)="showToDD=true" (blur)="hideDD('to')" (keydown)="onToKey($event)" autocomplete="off">
                      <div class="city-dropdown" *ngIf="showToDD && filteredToCities.length" role="listbox" aria-label="City suggestions">
                        <div class="city-item" *ngFor="let city of filteredToCities; let i=index; trackBy: trackByIndex" role="option" [class.highlighted]="i===toHighlight" [attr.aria-selected]="i===toHighlight" (mousedown)="selectTo(city)">
                          <i class="fa fa-map-marker-alt"></i> {{city}}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="field-wrap">
                    <label>DATE OF JOURNEY</label>
                    <div class="search-field">
                      <i class="fa fa-calendar field-icon"></i>
                      <input type="date" [(ngModel)]="date" [min]="today" class="date-input" aria-label="Journey date">
                    </div>
                  </div>
                  <div class="field-wrap">
                    <label>PASSENGERS</label>
                    <div class="search-field">
                      <i class="fa fa-users field-icon"></i>
                      <select [(ngModel)]="passengers" class="pass-select">
                        <option value="1">1 Passenger</option>
                        <option value="2">2 Passengers</option>
                        <option value="3">3 Passengers</option>
                        <option value="4">4 Passengers</option>
                      </select>
                    </div>
                  </div>
                  <button class="search-btn rb-btn-primary" (click)="searchBuses()" aria-label="Search available buses">
                    <i class="fa fa-search"></i> SEARCH BUSES
                  </button>
                </div>
              </div>
              <!-- Recent searches -->
              <div class="recent-searches" *ngIf="recentSearches.length">
                <span class="rs-label">Recent:</span>
                <span class="rs-item" *ngFor="let s of recentSearches" (click)="applyRecent(s)">
                  {{s.from}} → {{s.to}}
                </span>
              </div>
            </div>

            <!-- Quick stats -->
            <div class="quick-stats">
              <div class="stat-item"><span class="stat-num">2000+</span><span class="stat-lbl">Routes</span></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><span class="stat-num">3500+</span><span class="stat-lbl">Bus Operators</span></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><span class="stat-num">25M+</span><span class="stat-lbl">Customers</span></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><span class="stat-num">60K+</span><span class="stat-lbl">Bus Routes Daily</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Offers Section -->
    <section class="section-pad">
      <div class="container">
        <div class="section-header flex-between">
          <h2 class="section-title">Exclusive Offers <span class="badge-orange" style="font-size:12px; vertical-align:middle; margin-left:8px;">LIMITED</span></h2>
          <a href="#" class="view-all-link">View All Offers <i class="fa fa-chevron-right"></i></a>
        </div>
        <div class="offers-grid">
          <div class="offer-card" *ngFor="let offer of offers; trackBy: trackByIndex">
            <div class="offer-left" [style.background]="offer.color">
              <div class="offer-code">{{offer.code}}</div>
              <div class="offer-disc">{{offer.discount}}</div>
            </div>
            <div class="offer-right">
              <div class="offer-title">{{offer.title}}</div>
              <div class="offer-desc">{{offer.desc}}</div>
              <button class="rb-btn-outline" style="padding:5px 14px; font-size:12px; margin-top:8px;" (click)="copyCode(offer.code)">
                <i class="fa fa-copy"></i> Copy Code
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Popular Routes -->
    <section class="section-pad" style="background:var(--bg-card); padding: 40px 0;">
      <div class="container">
        <h2 class="section-title" style="margin-bottom:24px;">{{i18n.t('home.popular')}}</h2>
        <div class="routes-grid">
          <div class="route-card" *ngFor="let route of popularRoutes; trackBy: trackByIndex" (click)="quickSearch(route.from, route.to)">
            <div class="route-icon"><i class="fa fa-bus"></i></div>
            <div class="route-info">
              <div class="route-path">{{route.from}} → {{route.to}}</div>
              <div class="route-meta">
                <span class="route-buses">{{route.buses}} buses</span>
                <span class="route-price">from ₹{{route.price}}</span>
              </div>
            </div>
            <i class="fa fa-chevron-right route-arrow"></i>
          </div>
        </div>
      </div>
    </section>

    <!-- Why redBus -->
    <section class="section-pad">
      <div class="container">
        <h2 class="section-title" style="margin-bottom:32px;">{{i18n.t('home.why')}}</h2>
        <div class="features-grid">
          <div class="feature-card" *ngFor="let feat of features; trackBy: trackByIndex">
            <div class="feat-icon" [style.color]="feat.color"><i [class]="feat.icon"></i></div>
            <h3 class="feat-title">{{feat.title}}</h3>
            <p class="feat-desc">{{feat.desc}}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Operators -->
    <section class="section-pad" style="background:var(--bg-card); padding: 40px 0;">
      <div class="container">
        <h2 class="section-title" style="margin-bottom:28px; text-align:center;">Top Bus Operators</h2>
        <div class="operators-grid">
          <div class="operator-item" *ngFor="let op of operators">{{op}}</div>
        </div>
      </div>
    </section>

    <!-- Testimonials -->
    <section class="section-pad">
      <div class="container">
        <h2 class="section-title" style="margin-bottom:28px;">What Our Customers Say</h2>
        <div class="testimonials-grid">
          <div class="testimonial-card rb-card" *ngFor="let t of testimonials; trackBy: trackByIndex">
            <div class="t-stars">
              <i class="fa fa-star" *ngFor="let s of getStars(t.rating)"></i>
            </div>
            <p class="t-text">"{{t.text}}"</p>
            <div class="t-author flex-center gap-8">
              <div class="t-avatar">{{t.name[0]}}</div>
              <div>
                <div class="t-name">{{t.name}}</div>
                <div class="t-route">{{t.route}}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- App Download -->
    <section class="app-section">
      <div class="container">
        <div class="app-inner flex-between">
          <div class="app-text">
            <h2>Download the redBus App</h2>
            <p>Book bus tickets on the go. Available on Android & iOS</p>
            <ul class="app-features">
              <li><i class="fa fa-check-circle"></i> Instant booking confirmation</li>
              <li><i class="fa fa-check-circle"></i> Real-time bus tracking</li>
              <li><i class="fa fa-check-circle"></i> Exclusive app-only deals</li>
              <li><i class="fa fa-check-circle"></i> Easy cancellation & refunds</li>
            </ul>
            <div class="flex gap-12 mt-16">
              <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Google Play" style="height:40px; cursor:pointer;">
              <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="App Store" style="height:40px; cursor:pointer;">
            </div>
          </div>
          <div class="app-phone">
            <div class="phone-mock">
              <div class="phone-screen">
                <div style="background:#d84e55; padding:12px; text-align:center; color:white; font-weight:700; font-size:16px;">redBus</div>
                <div style="padding:12px;">
                  <div style="background:var(--bg-secondary); border-radius:6px; padding:10px; margin-bottom:8px;">
                    <div style="font-size:11px; color:var(--text-muted);">{{i18n.t('search.from')}}</div>
                    <div style="font-weight:600;">Bangalore</div>
                  </div>
                  <div style="background:var(--bg-secondary); border-radius:6px; padding:10px; margin-bottom:8px;">
                    <div style="font-size:11px; color:var(--text-muted);">{{i18n.t('search.to')}}</div>
                    <div style="font-weight:600;">Chennai</div>
                  </div>
                  <div style="background:#d84e55; color:white; border-radius:6px; padding:10px; text-align:center; font-weight:600;">SEARCH BUSES</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero-section { background: linear-gradient(135deg, #d84e55 0%, #c0392b 50%, #922b21 100%); min-height: 480px; position: relative; overflow: hidden; }
    .hero-bg {
      background-image: url('https://www.redbus.in/staticpages/images/web/homepage/bus-hero.png');
      background-size: cover; background-position: center; min-height: 480px;
      display: flex; align-items: center;
      &::before { content:''; position:absolute; inset:0; background: linear-gradient(135deg, rgba(216,78,85,0.92) 0%, rgba(146,43,33,0.88) 100%); }
    }
    .hero-content { position:relative; z-index:1; padding: 48px 0 40px; }
    .hero-title { color:#ffffff; font-size:32px; font-weight:800; margin-bottom:8px; text-shadow:0 2px 4px rgba(0,0,0,0.2); }
    .hero-sub { color:rgba(255,255,255,0.85); font-size:15px; margin-bottom:28px; }
    .search-widget { border-radius:12px; overflow:visible; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    .search-tabs { display:flex; border-bottom: 1px solid var(--border); padding: 0 4px;
      .tab { background:none; border:none; padding:14px 20px; font-size:14px; font-weight:500; color:var(--text-secondary); cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; transition:all 0.2s; display:flex; align-items:center; gap:6px;
        &.active, &:hover { color:#d84e55; border-bottom-color:#d84e55; }
      }
    }
    .search-form { padding: 20px; }
    .search-row { display:grid; grid-template-columns: 1fr auto 1fr 180px auto; gap:12px; align-items:end; }
    .field-wrap { display:flex; flex-direction:column; gap:4px;
      label { font-size:10px; font-weight:700; color:var(--text-muted); letter-spacing:0.5px; }
    }
    .search-field { position:relative; }
    .field-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#d84e55; font-size:13px; }
    .city-input, .date-input, .pass-select {
      width:100%; padding:10px 12px 10px 32px; border:1.5px solid #e0e0e0; border-radius:6px; font-size:14px; background:var(--bg-card); outline:none; transition:border 0.2s;
      &:focus { border-color:#d84e55; }
    }
    .city-dropdown { position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,0.12); z-index:200; max-height:200px; overflow-y:auto; }
    .city-item { padding:10px 14px; &.highlighted { background:var(--red-light); color:var(--red); } font-size:13px; cursor:pointer; display:flex; align-items:center; gap:8px; color:var(--text-secondary);
      i { color:#d84e55; font-size:11px; }
      &:hover { background:var(--bg-card)0f1; color:#d84e55; }
    }
    .swap-btn { width:40px; height:40px; border-radius:50%; border:1.5px solid #d84e55; background:var(--bg-card); color:#d84e55; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; align-self:flex-end;
      &:hover { background:#d84e55; color:white; }
    }
    .search-btn { padding:10px 28px; font-size:15px; font-weight:700; border-radius:6px; white-space:nowrap; align-self:flex-end; height:42px; }
    .recent-searches { padding:0 20px 16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .rs-label { font-size:12px; color:var(--text-muted); }
    .rs-item { font-size:12px; background:var(--bg-card)0f1; color:#d84e55; padding:3px 10px; border-radius:20px; cursor:pointer; border:1px solid #f5c6c8;
      &:hover { background:#d84e55; color:white; }
    }
    .quick-stats { display:flex; align-items:center; gap:0; margin-top:24px; background:rgba(255,255,255,0.15); border-radius:10px; padding:16px 24px; backdrop-filter:blur(4px); width:fit-content; }
    .stat-item { text-align:center; padding: 0 24px; }
    .stat-num { display:block; font-size:22px; font-weight:800; color:white; }
    .stat-lbl { font-size:12px; color:rgba(255,255,255,0.8); }
    .stat-divider { width:1px; height:40px; background:rgba(255,255,255,0.3); }
    .section-pad { padding: 48px 0; }
    .section-header { margin-bottom:20px; }
    .section-title { font-size:22px; font-weight:700; color:var(--text-primary); }
    .view-all-link { color:#d84e55; font-size:13px; font-weight:600; display:flex; align-items:center; gap:4px; &:hover { text-decoration:underline; } }
    .offers-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; }
    .offer-card { display:flex; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid var(--border); }
    .offer-left { padding:20px 16px; min-width:100px; display:flex; flex-direction:column; justify-content:center; align-items:center; }
    .offer-code { color:white; font-size:14px; font-weight:700; letter-spacing:1px; text-align:center; }
    .offer-disc { color:white; font-size:22px; font-weight:900; }
    .offer-right { padding:16px; background:var(--bg-card); flex:1; }
    .offer-title { font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:4px; }
    .offer-desc { font-size:12px; color:var(--text-muted); }
    .routes-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; }
    .route-card { display:flex; align-items:center; gap:12px; padding:14px 16px; border:1px solid var(--border); border-radius:8px; cursor:pointer; transition:all 0.2s; background:var(--bg-card);
      &:hover { border-color:#d84e55; box-shadow:0 2px 8px rgba(216,78,85,0.15); transform:translateY(-2px); }
    }
    .route-icon { width:36px; height:36px; background:var(--bg-card)0f1; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#d84e55; font-size:14px; flex-shrink:0; }
    .route-info { flex:1; }
    .route-path { font-size:13px; font-weight:600; color:var(--text-primary); }
    .route-meta { display:flex; gap:8px; margin-top:3px; }
    .route-buses { font-size:11px; color:var(--text-muted); }
    .route-price { font-size:11px; color:#d84e55; font-weight:600; }
    .route-arrow { color:#ccc; font-size:11px; }
    .features-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:24px; }
    .feature-card { text-align:center; padding:28px 20px; background:var(--bg-card); border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); border:1px solid #f0f0f0; transition:transform 0.2s;
      &:hover { transform:translateY(-4px); box-shadow:0 6px 20px rgba(0,0,0,0.1); }
    }
    .feat-icon { font-size:36px; margin-bottom:14px; }
    .feat-title { font-size:15px; font-weight:700; color:var(--text-primary); margin-bottom:8px; }
    .feat-desc { font-size:13px; color:var(--text-muted); line-height:1.6; }
    .operators-grid { display:grid; grid-template-columns: repeat(5, 1fr); gap:12px; }
    .operator-item { padding:14px 16px; border:1.5px solid #eee; border-radius:8px; text-align:center; font-size:13px; font-weight:600; color:var(--text-secondary); cursor:pointer; transition:all 0.2s;
      &:hover { border-color:#d84e55; color:#d84e55; background:var(--bg-card)0f1; }
    }
    .testimonials-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; }
    .testimonial-card { padding:20px; }
    .t-stars { color:#f4c430; margin-bottom:10px; font-size:13px; display:flex; gap:2px; }
    .t-text { font-size:13px; color:var(--text-secondary); line-height:1.7; margin-bottom:16px; font-style:italic; }
    .t-avatar { width:36px; height:36px; background:#d84e55; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:14px; font-weight:700; flex-shrink:0; }
    .t-name { font-size:13px; font-weight:600; color:var(--text-primary); }
    .t-route { font-size:11px; color:var(--text-muted); }
    .app-section { background:linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 100%); padding:48px 0; }
    .app-inner { gap:40px; }
    .app-text { flex:1; color:white;
      h2 { font-size:28px; font-weight:800; margin-bottom:8px; }
      p { color:#aaa; font-size:15px; margin-bottom:20px; }
    }
    .app-features { list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:8px;
      li { font-size:13px; color:#ccc; display:flex; align-items:center; gap:8px;
        i { color:#4caf50; }
      }
    }
    .mt-16 { margin-top:16px; }
    .phone-mock { width:220px; background:#1a1a1a; border-radius:20px; padding:12px; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
    .phone-screen { background:var(--bg-card); border-radius:12px; overflow:hidden; }

    @media (max-width: 900px) {
      .search-row { grid-template-columns: 1fr auto 1fr !important; }
      .search-row .field-wrap:nth-child(4) { display: none; }
      .quick-stats { gap: 0; }
    }
    @media (max-width: 768px) {
      .search-row { grid-template-columns: 1fr !important; }
      .swap-btn { display: none !important; }
      .search-btn { width: 100%; justify-content: center; padding: 12px; }
      .hero-title { font-size: 20px !important; }
      .hero-sub { font-size: 13px !important; }
      .quick-stats { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
      .stat-divider { display: none; }
      .offers-grid { grid-template-columns: 1fr !important; }
      .routes-grid { grid-template-columns: 1fr 1fr !important; }
      .features-grid { grid-template-columns: 1fr 1fr !important; }
      .operators-grid { grid-template-columns: repeat(3,1fr) !important; }
      .testimonials-grid { grid-template-columns: 1fr !important; }
      .app-features { grid-template-columns: 1fr !important; }
      .app-inner { flex-direction: column !important; }
      .phone-mock { display: none !important; }
      .footer-grid { grid-template-columns: 1fr 1fr !important; }
      .section-title { font-size: 18px !important; }
      .search-widget { border-radius: 8px; }
    }
    @media (max-width: 480px) {
      .routes-grid { grid-template-columns: 1fr !important; }
      .features-grid { grid-template-columns: 1fr !important; }
      .operators-grid { grid-template-columns: 1fr 1fr !important; }
      .hero-title { font-size: 17px !important; }
    }
  `]
})
export class HomeComponent implements OnInit {
  from = '';
  to = '';
  date = '';
  passengers = '1';
  showFromDD = false;
  showToDD = false;
  filteredFromCities: string[] = [];
  filteredToCities: string[] = [];
  today = new Date().toISOString().split('T')[0];
  recentSearches: any[] = [];
  fromHighlight = -1;
  toHighlight = -1;

  cities = ['Bangalore', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Coimbatore', 'Kochi', 'Vizag', 'Vijayawada', 'Tirupati', 'Mysore', 'Mangalore', 'Madurai', 'Trichy', 'Salem', 'Erode'];

  popularRoutes: any[] = [];

  offers = [
    { code: 'FIRST10', discount: '10% OFF', title: 'First Booking Offer', desc: 'Get 10% off on your first bus booking with redBus. Max discount ₹100.', color: '#d84e55' },
    { code: 'HDFC15', discount: '15% OFF', title: 'HDFC Bank Offer', desc: 'Pay with HDFC Bank credit/debit card and get 15% off. Max discount ₹200.', color: '#1976d2' },
    { code: 'PAYTM20', discount: '20% OFF', title: 'Paytm Cashback', desc: 'Pay via Paytm and get 20% cashback. Min transaction ₹500.', color: '#00bcd4' },
    { code: 'ICICI12', discount: '12% OFF', title: 'ICICI Exclusive', desc: 'ICICI Bank credit card users get 12% off. Valid on all routes.', color: '#f47c20' },
    { code: 'GPAY200', discount: '₹200 OFF', title: 'Google Pay Offer', desc: 'Pay with Google Pay and get flat ₹200 off. Min booking ₹800.', color: '#4caf50' },
    { code: 'CORPO25', discount: '25% OFF', title: 'Corporate Special', desc: 'Corporate travel offer: 25% off for companies with 10+ employees.', color: '#9c27b0' }
  ];

  features = [
    { icon: 'fa fa-shield-alt', title: 'Safe & Secure', desc: 'Your personal data and payments are fully encrypted and secure.', color: '#4caf50' },
    { icon: 'fa fa-ticket-alt', title: 'Easy Booking', desc: 'Book your bus tickets in under 2 minutes. Simple, fast, hassle-free.', color: '#d84e55' },
    { icon: 'fa fa-undo', title: 'Easy Cancellation', desc: 'Cancel your ticket with one click. Quick refund to your account.', color: '#1976d2' },
    { icon: 'fa fa-headset', title: '24/7 Support', desc: 'Our customer support team is available round the clock to help you.', color: '#f47c20' }
  ];

  operators = ['VRL Travels', 'SRS Travels', 'Orange Travels', 'Kallada Travels', 'KSRTC', 'Parveen Travels', 'Raj National Express', 'Paulo Travels', 'Neeta Tours', 'National Travels'];

  testimonials = [
    { name: 'Arjun Sharma', rating: 5, text: 'Excellent service! The bus was on time, seats were clean and comfortable. Will definitely book again through redBus.', route: 'Bangalore → Chennai' },
    { name: 'Priya Nair', rating: 4, text: 'Great experience booking through redBus. The seat selection feature is very helpful and the confirmation was instant.', route: 'Mumbai → Pune' },
    { name: 'Rahul Verma', rating: 5, text: 'Best bus booking app in India. Easy to use, great offers, and excellent customer support. Highly recommended!', route: 'Delhi → Agra' }
  ];

  constructor(private busService: BusService, private router: Router, public i18n: I18nService) {}

  ngOnInit() {
    this.date = this.today;
    this.filteredFromCities = [...this.cities];
    this.filteredToCities = [...this.cities];
    this.popularRoutes = this.busService.getPopularRoutes();
    const saved = localStorage.getItem('rb_recent');
    if (saved) this.recentSearches = JSON.parse(saved).slice(0, 3);
  }

  filterFromCities(e: any) { const v = e.target.value.toLowerCase(); this.filteredFromCities = this.cities.filter(c => c.toLowerCase().includes(v)); this.showFromDD = true; }
  filterToCities(e: any) { const v = e.target.value.toLowerCase(); this.filteredToCities = this.cities.filter(c => c.toLowerCase().includes(v)); this.showToDD = true; }
  selectFrom(city: string) { this.from = city; this.showFromDD = false; }
  selectTo(city: string) { this.to = city; this.showToDD = false; }
  hideDD(type: string) { setTimeout(() => { if(type==='from') this.showFromDD=false; else this.showToDD=false; }, 200); }
  swapCities() { [this.from, this.to] = [this.to, this.from]; }

  searchBuses() {
    if (!this.from || !this.to || !this.date) { alert('Please fill in all fields'); return; }
    const rec = { from: this.from, to: this.to, date: this.date };
    const recents = JSON.parse(localStorage.getItem('rb_recent') || '[]');
    recents.unshift(rec);
    localStorage.setItem('rb_recent', JSON.stringify(recents.slice(0, 5)));
    this.router.navigate(['/search'], { queryParams: { from: this.from, to: this.to, date: this.date, passengers: this.passengers } });
  }

  quickSearch(from: string, to: string) {
    this.from = from; this.to = to;
    this.searchBuses();
  }

  applyRecent(s: any) { this.from = s.from; this.to = s.to; this.date = s.date; }
  copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
    alert(`Code ${code} copied!`);
  }
  getStars(n: number) { return Array(n).fill(0); }
  trackByIndex(index: number): number { return index; }
  onFromKey(e: KeyboardEvent) {
    if (!this.showFromDD) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.fromHighlight = Math.min(this.fromHighlight + 1, this.filteredFromCities.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.fromHighlight = Math.max(this.fromHighlight - 1, -1); }
    else if (e.key === 'Enter' && this.fromHighlight >= 0) { this.selectFrom(this.filteredFromCities[this.fromHighlight]); this.fromHighlight = -1; }
    else if (e.key === 'Escape') { this.showFromDD = false; this.fromHighlight = -1; }
  }
  onToKey(e: KeyboardEvent) {
    if (!this.showToDD) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.toHighlight = Math.min(this.toHighlight + 1, this.filteredToCities.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.toHighlight = Math.max(this.toHighlight - 1, -1); }
    else if (e.key === 'Enter' && this.toHighlight >= 0) { this.selectTo(this.filteredToCities[this.toHighlight]); this.toHighlight = -1; }
    else if (e.key === 'Escape') { this.showToDD = false; this.toHighlight = -1; }
  }
}
