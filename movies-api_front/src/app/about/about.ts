import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteFooter, SiteNav } from '../layout/site-nav';
import { ApiService, Overview } from '../api.service';
import { compact } from '../format';

interface Member {
  name: string;
  github: string;
}

const TEAM: Member[] = [
  { name: 'Juan David Martínez', github: 'Yenterick' },
  { name: 'Faider Asprilla Torres', github: 'Faiderasp' },
  { name: 'Tomás Salazar Vélez', github: 'TomasSalav' },
];

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, SiteNav, SiteFooter],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements OnInit {
  private api = inject(ApiService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly team = TEAM;
  readonly compact = compact;
  overview = signal<Overview | null>(null);

  ngOnInit(): void {
    if (this.isBrowser) window.scrollTo({ top: 0 });
    this.api.overview().subscribe({ next: (o) => this.overview.set(o), error: () => {} });
  }
}
