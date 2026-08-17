import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="rb-footer">
      <div class="footer-main">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-col brand-col">
              <div class="logo-footer"><span style="color:var(--red)">red</span>Bus</div>
              <p class="footer-desc">{{i18n.t('footer.desc')}}</p>
              <div class="social-links">
                <a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                <a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                <a href="#" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
                <a href="#" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
              </div>
              <div class="app-badges">
                <div class="app-badge-btn"><i class="fab fa-google-play"></i><div><div style="font-size:9px;opacity:0.7;">{{i18n.t('footer.getItOn')}}</div><div style="font-size:13px;font-weight:700;">Google Play</div></div></div>
                <div class="app-badge-btn"><i class="fab fa-apple"></i><div><div style="font-size:9px;opacity:0.7;">{{i18n.t('footer.downloadOn')}}</div><div style="font-size:13px;font-weight:700;">App Store</div></div></div>
              </div>
            </div>
            <div class="footer-col">
              <h4>{{i18n.t('footer.company')}}</h4>
              <ul>
                <li><a href="#">{{i18n.t('footer.aboutUs')}}</a></li>
                <li><a href="#">{{i18n.t('footer.careers')}}</a></li>
                <li><a href="#">{{i18n.t('footer.press')}}</a></li>
                <li><a href="#">{{i18n.t('footer.blog')}}</a></li>
                <li><a href="#">{{i18n.t('footer.investors')}}</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>{{i18n.t('footer.support')}}</h4>
              <ul>
                <li><a href="#">{{i18n.t('footer.helpCentre')}}</a></li>
                <li><a routerLink="/my-bookings">{{i18n.t('nav.bookings')}}</a></li>
                <li><a routerLink="/track">{{i18n.t('footer.trackMyBus')}}</a></li>
                <li><a href="#">{{i18n.t('footer.cancellationPolicy')}}</a></li>
                <li><a href="#">{{i18n.t('footer.faqs')}}</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>{{i18n.t('footer.services')}}</h4>
              <ul>
                <li><a href="#">{{i18n.t('footer.busHire')}}</a></li>
                <li><a href="#">{{i18n.t('footer.hotels')}}</a></li>
                <li><a routerLink="/route-planner">{{i18n.t('planner.title')}}</a></li>
                <li><a routerLink="/community">{{i18n.t('community.title')}}</a></li>
                <li><a href="#">{{i18n.t('footer.corporateTravel')}}</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>{{i18n.t('footer.popularRoutes')}}</h4>
              <ul>
                <li><a href="#">Bangalore → Chennai</a></li>
                <li><a href="#">Mumbai → Pune</a></li>
                <li><a href="#">Delhi → Agra</a></li>
                <li><a href="#">Hyderabad → Bangalore</a></li>
                <li><a href="#">Chennai → Coimbatore</a></li>
                <li><a href="#">Kolkata → Bhubaneswar</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="container flex-between">
          <p>{{i18n.t('footer.copyright', {year})}}</p>
          <div class="flex gap-16">
            <a href="#">{{i18n.t('footer.privacyPolicy')}}</a>
            <a href="#">{{i18n.t('footer.terms')}}</a>
            <a href="#">{{i18n.t('footer.cookiePolicy')}}</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .rb-footer { background:var(--footer-bg); color:#888; }
    .footer-main { padding:48px 0 32px; }
    .footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr; gap:32px; }
    .logo-footer { font-size:26px; font-weight:900; letter-spacing:-1px; color:#fff; margin-bottom:12px; }
    .footer-desc { font-size:13px; line-height:1.7; color:#777; margin-bottom:18px; }
    .social-links { display:flex; gap:8px; margin-bottom:18px;
      a { width:34px; height:34px; background:rgba(255,255,255,0.08); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#aaa; font-size:13px; transition:all 0.2s;
        &:hover { background:var(--red); color:#fff; transform:translateY(-2px); }
      }
    }
    .app-badges { display:flex; flex-direction:column; gap:8px; }
    .app-badge-btn { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 14px; cursor:pointer; color:#ddd; transition:all 0.2s;
      &:hover { background:rgba(255,255,255,0.14); }
      i { font-size:22px; }
    }
    .footer-col h4 { color:#e0e0e0; font-size:13px; font-weight:700; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px; }
    .footer-col ul { list-style:none;
      li { margin-bottom:10px; }
      a { color:#777; font-size:13px; transition:color 0.2s; &:hover { color:var(--red); } }
    }
    .footer-bottom { border-top:1px solid rgba(255,255,255,0.06); padding:16px 0; font-size:12px; color:#555;
      a { color:#555; &:hover { color:var(--red); } }
    }

    @media (max-width: 992px) {
      .footer-grid { grid-template-columns:2fr 1fr 1fr; }
      .footer-col.brand-col { grid-column:1 / -1; margin-bottom:8px; }
    }

    @media (max-width: 768px) {
      .footer-main { padding:36px 0 24px; }
      .footer-grid { grid-template-columns:1fr 1fr; gap:28px 20px; }
      .footer-col.brand-col { grid-column:1 / -1; }
      .footer-desc { max-width:420px; }
      .app-badges { flex-direction:row; flex-wrap:wrap; }
    }

    @media (max-width: 480px) {
      .footer-grid { grid-template-columns:1fr; gap:24px; }
      .app-badges { flex-direction:column; }
      .footer-bottom .flex-between { flex-direction:column; gap:12px; align-items:flex-start; }
    }
  `]
})
export class FooterComponent {
  i18n = inject(I18nService);
  year = new Date().getFullYear();
}
