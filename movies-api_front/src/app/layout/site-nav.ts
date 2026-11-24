import { Component, EventEmitter, HostListener, Input, Output, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ApiService } from '../api.service';

/** Sections of the home page the nav can jump to. */
type Section = 'analytics' | 'catalog';

/**
 * Top bar shared by every page. On the home page the section links scroll in place; anywhere
 * else they navigate home with a fragment that the home page scrolls to once it has rendered.
 */
@Component({
  selector: 'app-site-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-nav.html',
  styleUrl: './site-nav.css',
})
export class SiteNav {
  /** Show the "Nueva película" action; the host page decides what it opens. */
  @Input() canCreate = false;
  @Output() create = new EventEmitter<void>();

  readonly api = inject(ApiService);
  private router = inject(Router);

  scrolled = signal(false);
  menuOpen = signal(false);

  go(section: Section): void {
    this.menuOpen.set(false);
    const onHome = this.router.url.split(/[?#]/)[0] === '/';
    if (onHome) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' });
    else this.router.navigate(['/'], { fragment: section });
  }

  top(): void {
    this.menuOpen.set(false);
    if (this.router.url.split(/[?#]/)[0] === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  logout(): void {
    this.menuOpen.set(false);
    this.api.logout();
    if (this.router.url.startsWith('/gestion')) this.router.navigate(['/']);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer shell">
      <span class="brand">Cine<span class="gradient-text">Data</span></span>
      <nav class="footer-links">
        <a routerLink="/sobre-nosotros">Sobre nosotros</a>
        <a href="https://github.com/Yenterick/movies-axum-api" target="_blank" rel="noopener">GitHub ↗</a>
        <a href="http://localhost:3000/api/v1/docs" target="_blank" rel="noopener">API docs ↗</a>
      </nav>
      <span class="mono">Axum · PostgreSQL · Angular · three.js</span>
    </footer>
  `,
  styles: `
    :host { display: block; }
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding: 34px 0 44px; border-top: 1px solid var(--line); color: var(--ink-3); font-size: 12px; }
    .brand { font-family: var(--display); font-size: 18px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
    .footer-links { display: flex; flex-wrap: wrap; gap: 20px; font-family: var(--mono); }
    a:hover { color: var(--amber); }
  `,
})
export class SiteFooter {}
