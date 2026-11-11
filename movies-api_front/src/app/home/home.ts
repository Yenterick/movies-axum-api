import {
  Component, ElementRef, HostListener, OnDestroy, OnInit, PLATFORM_ID, ViewChild, computed, inject, signal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SkeletonComponent } from 'boneyard-js/angular';
import { Subject, Subscription, debounceTime, filter } from 'rxjs';
import {
  ApiService, CountryStats, GENRES, GenreStats, Movie, MovieFilters, Overview, genreLabel,
} from '../api.service';
import { Analytics } from '../analytics/analytics';
import { MovieEditor } from '../editor/movie-editor';
import { PosterService } from '../poster.service';
import { CinemaScene } from '../scene/cinema-scene';
import { LANGUAGES, compact, flag, money, multiple, posterGradient, rating, year } from '../format';

const PAGE_SIZES = [12, 24, 48];

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SkeletonComponent, Analytics, CinemaScene, MovieEditor, RouterLink, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('catalog') catalogRef?: ElementRef<HTMLElement>;
  @ViewChild('results') resultsRef?: ElementRef<HTMLElement>;

  readonly api = inject(ApiService);
  readonly posters = inject(PosterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly genres = GENRES;
  readonly languages = LANGUAGES;
  readonly pageSizes = PAGE_SIZES;
  readonly genreLabel = genreLabel;
  readonly money = money;
  readonly compact = compact;
  readonly rating = rating;
  readonly multiple = multiple;
  readonly year = year;
  readonly flag = flag;
  readonly posterGradient = posterGradient;
  readonly skeletonCards = Array.from({ length: 12 }, (_, i) => i);
  /** Capture each card as poster block + two text lines; the overlays inside the poster are noise. */
  readonly gridSnapshot = { excludeSelectors: ['.poster > *'] };

  // ---- Catalog state (mirrored into the URL) ----
  search = signal('');
  genre = signal('');
  language = signal('');
  country = signal('');
  keyword = signal('');
  page = signal(1);
  pageSize = signal(24);
  showFilters = signal(false);

  movies = signal<Movie[]>([]);
  hasNext = signal(false);
  loading = signal(true);
  error = signal('');

  // ---- Reference data used for filter options and page totals ----
  overview = signal<Overview | null>(null);
  genreStats = signal<GenreStats[]>([]);
  countryStats = signal<CountryStats[]>([]);

  // ---- Detail modal ----
  selected = signal<Movie | null>(null);
  modalOpen = signal(false);
  modalLoading = signal(false);

  // ---- Admin editor ----
  editorOpen = signal(false);
  editorMovie = signal<Movie | null>(null);
  toast = signal<{ text: string; kind: 'ok' | 'bad' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  scrolled = signal(false);
  /** Results height frozen while a page loads, so the document doesn't shrink and yank the scroll position. */
  resultsMinHeight = signal<number | null>(null);
  heroStats = signal({ movies: 0, revenue: 0, votes: 0 });

  activeFilterCount = computed(() =>
    [this.genre(), this.language(), this.country(), this.keyword()].filter(Boolean).length);

  /**
   * The list endpoint doesn't return a total, but analytics does for the common cases:
   * the whole catalogue, a single genre or a single country. Anything else falls back to
   * "is there a next page" pagination.
   */
  knownTotal = computed<number | null>(() => {
    const onlyGenre = this.genre() && !this.search() && !this.language() && !this.country() && !this.keyword();
    const onlyCountry = this.country() && !this.search() && !this.language() && !this.genre() && !this.keyword();
    const none = !this.search() && !this.genre() && !this.language() && !this.country() && !this.keyword();
    if (none) return this.overview()?.total_movies ?? null;
    if (onlyGenre) return this.genreStats().find((g) => g.genre === this.genre())?.movie_count ?? null;
    if (onlyCountry) return this.countryStats().find((c) => c.iso_3166_1 === this.country())?.movie_count ?? null;
    return null;
  });

  totalPages = computed(() => {
    const total = this.knownTotal();
    return total === null ? null : Math.max(1, Math.ceil(total / this.pageSize()));
  });

  pageItems = computed<(number | '…')[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total === null) return [];
    const pages = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const items: (number | '…')[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) items.push('…');
      items.push(p);
    });
    return items;
  });

  rangeLabel = computed(() => {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = start + this.movies().length - 1;
    const total = this.knownTotal();
    if (!this.movies().length) return '0 resultados';
    return total !== null ? `${start}–${end} de ${total.toLocaleString('es')}` : `${start}–${end}`;
  });

  countryName = computed(() => this.countryStats().find((c) => c.iso_3166_1 === this.country())?.name ?? this.country());
  languageName = computed(() => this.languages.find((l) => l.code === this.language())?.name ?? this.language());

  private search$ = new Subject<string>();
  private subs = new Subscription();
  private fetchSeq = 0;
  private detailSeq = 0;

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.search.set(q.get('q') ?? '');
    this.genre.set(q.get('genre') ?? '');
    this.language.set(q.get('lang') ?? '');
    this.country.set(q.get('country') ?? '');
    this.keyword.set(q.get('keyword') ?? '');
    this.page.set(Math.max(1, Number(q.get('page')) || 1));
    const size = Number(q.get('size'));
    if (PAGE_SIZES.includes(size)) this.pageSize.set(size);
    if (this.activeFilterCount()) this.showFilters.set(true);

    this.subs.add(
      this.search$.pipe(debounceTime(350), filter((value) => value !== this.search())).subscribe((value) => {
        this.search.set(value);
        this.page.set(1);
        this.fetch();
      }),
    );

    this.api.overview().subscribe({
      next: (o) => { this.overview.set(o); this.countUp(o); },
      error: () => {},
    });
    this.api.genres().subscribe({ next: (g) => this.genreStats.set(g), error: () => {} });
    this.api.countries(100, 'movie_count', 1).subscribe({ next: (c) => this.countryStats.set(c), error: () => {} });

    this.fetch(false);
    const movieId = Number(q.get('movie'));
    if (movieId) this.openMovie(movieId);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.isBrowser) document.body.style.overflow = '';
  }

  // ---------- Catalog ----------

  fetch(scroll = true): void {
    if (this.resultsRef) this.resultsMinHeight.set(this.resultsRef.nativeElement.offsetHeight || null);
    this.loading.set(true);
    this.error.set('');
    this.syncUrl();
    const filters: MovieFilters = {
      search: this.search().trim() || undefined,
      genre: this.genre() || undefined,
      language: this.language() || undefined,
      country: this.country() || undefined,
      keyword: this.keyword().trim() || undefined,
    };
    const size = this.pageSize();
    const seq = ++this.fetchSeq;
    // Ask for one extra row so we know whether a next page exists without a count endpoint.
    this.api.getMovies(size + 1, (this.page() - 1) * size, filters).subscribe({
      next: (rows) => {
        if (seq !== this.fetchSeq) return;
        const page = rows.slice(0, size);
        this.movies.set(page);
        this.hasNext.set(rows.length > size);
        this.loading.set(false);
        this.resultsMinHeight.set(null);
        this.posters.load(page);
      },
      error: (err) => {
        if (seq !== this.fetchSeq) return;
        this.movies.set([]);
        this.hasNext.set(false);
        this.error.set(err.status === 0
          ? 'No hay conexión con la API. Verifica que el backend esté corriendo en localhost:3000.'
          : `La API respondió con un error (${err.status}).`);
        this.loading.set(false);
        this.resultsMinHeight.set(null);
      },
    });
    if (scroll) this.scrollToResults();
  }

  onSearchInput(value: string): void {
    this.search$.next(value);
  }

  clearSearch(): void {
    this.search$.next('');
    if (this.searchInput) this.searchInput.nativeElement.value = '';
  }

  setGenre(genre: string): void {
    this.genre.set(this.genre() === genre ? '' : genre);
    this.page.set(1);
    this.fetch();
  }

  setFilter(kind: 'language' | 'country' | 'keyword', value: string): void {
    this[kind].set(value);
    this.page.set(1);
    this.fetch();
  }

  setPageSize(size: number): void {
    // Keep the first visible movie on screen when the page size changes.
    const firstIndex = (this.page() - 1) * this.pageSize();
    this.pageSize.set(size);
    this.page.set(Math.floor(firstIndex / size) + 1);
    this.fetch();
  }

  clearFilters(): void {
    this.genre.set('');
    this.language.set('');
    this.country.set('');
    this.keyword.set('');
    this.page.set(1);
    this.fetch();
  }

  goToPage(page: number): void {
    const total = this.totalPages();
    if (page < 1 || (total !== null && page > total) || page === this.page()) return;
    if (total === null && page > this.page() && !this.hasNext()) return;
    this.page.set(page);
    this.fetch();
  }

  /** Called from analytics: jump to the catalog with that genre / country applied. */
  filterFromAnalytics(kind: 'genre' | 'country', value: string): void {
    this.search.set('');
    if (this.searchInput) this.searchInput.nativeElement.value = '';
    this.genre.set(kind === 'genre' ? value : '');
    this.country.set(kind === 'country' ? value : '');
    this.language.set('');
    this.keyword.set('');
    this.showFilters.set(true);
    this.page.set(1);
    this.fetch();
  }

  private scrollToCatalog(): void {
    if (!this.isBrowser || !this.catalogRef) return;
    const top = this.catalogRef.nativeElement.getBoundingClientRect().top + window.scrollY - 80;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top, behavior: 'smooth' });
  }

  /**
   * Brings the first row of results just under the sticky nav + toolbar. Only scrolls when the
   * results start above or far below the viewport — e.g. after clicking a page at the bottom —
   * so changing a filter while looking at the grid doesn't move anything.
   */
  private scrollToResults(): void {
    if (!this.isBrowser) return;
    const el = this.resultsRef?.nativeElement;
    if (!el) { this.scrollToCatalog(); return; }
    const toolbar = document.querySelector('.toolbar') as HTMLElement | null;
    const offset = 82 + (toolbar?.offsetHeight ?? 60) + 16;
    const rectTop = el.getBoundingClientRect().top;
    if (rectTop >= offset - 4 && rectTop < window.innerHeight * 0.6) return;
    window.scrollTo({ top: rectTop + window.scrollY - offset, behavior: 'smooth' });
  }

  private syncUrl(): void {
    const queryParams: Record<string, string | number | null> = {
      q: this.search() || null,
      genre: this.genre() || null,
      lang: this.language() || null,
      country: this.country() || null,
      keyword: this.keyword() || null,
      page: this.page() > 1 ? this.page() : null,
      size: this.pageSize() !== 24 ? this.pageSize() : null,
      movie: this.modalOpen() && this.selected() ? this.selected()!.id : null,
    };
    this.router.navigate([], { queryParams, replaceUrl: true });
  }

  // ---------- Modal ----------

  openMovie(id: number, preview?: Movie): void {
    this.selected.set(preview ?? null);
    this.modalOpen.set(true);
    this.modalLoading.set(true);
    if (this.isBrowser) document.body.style.overflow = 'hidden';
    const seq = ++this.detailSeq;
    this.api.getMovie(id).subscribe({
      next: (m) => {
        if (seq !== this.detailSeq) return;
        this.posters.load([m]);
        this.selected.set(m);
        this.modalLoading.set(false);
        this.syncUrl();
      },
      error: () => {
        if (seq !== this.detailSeq) return;
        this.modalLoading.set(false);
        if (!this.selected()) this.closeModal();
      },
    });
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.detailSeq++;
    if (this.isBrowser) document.body.style.overflow = '';
    this.syncUrl();
  }

  filterFromModal(kind: 'genre' | 'keyword', value: string): void {
    this.closeModal();
    if (kind === 'genre') this.filterFromAnalytics('genre', value);
    else {
      this.showFilters.set(true);
      this.setFilter('keyword', value);
    }
  }

  ratingDash(value: number): string {
    const circumference = 2 * Math.PI * 26;
    return `${(value / 10) * circumference} ${circumference}`;
  }

  companyNames(m: Movie): string {
    return m.production_companies.slice(0, 4).map((c) => c.name).join(' · ');
  }

  profit(m: Movie): number {
    return m.revenue - m.budget;
  }

  budgetShare(m: Movie): number {
    const max = Math.max(m.budget, m.revenue, 1);
    return (m.budget / max) * 100;
  }

  revenueShare(m: Movie): number {
    const max = Math.max(m.budget, m.revenue, 1);
    return (m.revenue / max) * 100;
  }

  // ---------- Admin ----------

  openEditor(movie: Movie | null): void {
    this.editorMovie.set(movie);
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    // The detail modal underneath still wants the scroll lock.
    if (this.isBrowser && !this.modalOpen()) document.body.style.overflow = '';
  }

  onSaved(movie: Movie): void {
    const wasEdit = !!this.editorMovie();
    this.closeEditor();
    this.showToast(wasEdit ? `“${movie.title}” actualizada` : `“${movie.title}” creada con el id #${movie.id}`, 'ok');
    this.fetch(false);
    this.openMovie(movie.id, movie);
  }

  onDeleted(id: number): void {
    const title = this.editorMovie()?.title ?? `#${id}`;
    this.closeEditor();
    this.closeModal();
    this.showToast(`“${title}” eliminada`, 'bad');
    this.fetch(false);
  }

  private showToast(text: string, kind: 'ok' | 'bad'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ text, kind });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3800);
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- Session ----------

  logout(): void {
    this.api.logout();
  }

  // ---------- Global interactions ----------

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 24);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    if (this.editorOpen()) return; // the editor handles its own Escape
    if (e.key === 'Escape' && this.modalOpen()) { this.closeModal(); return; }
    if (typing || this.modalOpen()) return;
    if (e.key === '/') {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.scrollToCatalog();
    }
  }

  private countUp(o: Overview): void {
    if (!this.isBrowser) { this.heroStats.set({ movies: o.total_movies, revenue: o.total_revenue, votes: o.total_votes }); return; }
    const start = performance.now();
    const duration = 1600;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 4);
      this.heroStats.set({ movies: o.total_movies * e, revenue: o.total_revenue * e, votes: o.total_votes * e });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
