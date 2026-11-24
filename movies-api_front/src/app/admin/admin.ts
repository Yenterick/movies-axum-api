import { Component, HostListener, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ApiService, CountryStats, GENRES, GenreStats, Movie, Overview, genreLabel } from '../api.service';
import { MovieEditor } from '../editor/movie-editor';
import { SiteFooter, SiteNav } from '../layout/site-nav';
import { PosterService } from '../poster.service';
import { money, posterGradient, rating, year } from '../format';

const PAGE_SIZE = 15;

/**
 * Admin console: the whole CRUD over /movies in one table. Listing and search use the public
 * endpoints; create, edit and delete go through the JWT-protected ones.
 */
@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterLink, MovieEditor, SiteNav, SiteFooter],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin implements OnInit, OnDestroy {
  readonly api = inject(ApiService);
  readonly posters = inject(PosterService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly genres = GENRES;
  readonly genreLabel = genreLabel;
  readonly money = money;
  readonly rating = rating;
  readonly year = year;
  readonly posterGradient = posterGradient;
  readonly pageSize = PAGE_SIZE;

  search = signal('');
  genre = signal('');
  page = signal(1);
  rows = signal<Movie[]>([]);
  hasNext = signal(false);
  loading = signal(true);
  error = signal('');

  overview = signal<Overview | null>(null);
  genreStats = signal<GenreStats[]>([]);
  countries = signal<CountryStats[]>([]);

  editorOpen = signal(false);
  editorMovie = signal<Movie | null>(null);
  pendingDelete = signal<Movie | null>(null);
  deleting = signal(false);
  deleteError = signal('');
  toast = signal<{ text: string; kind: 'ok' | 'bad' } | null>(null);
  /** Rows just written, briefly highlighted so the change is easy to spot. */
  flashId = signal<number | null>(null);

  /** Exact totals exist for the whole catalogue or a single genre; a search falls back to next/prev. */
  total = computed<number | null>(() => {
    if (this.search().trim()) return null;
    if (this.genre()) return this.genreStats().find((g) => g.genre === this.genre())?.movie_count ?? null;
    return this.overview()?.total_movies ?? null;
  });
  totalPages = computed(() => {
    const t = this.total();
    return t === null ? null : Math.max(1, Math.ceil(t / PAGE_SIZE));
  });
  rangeLabel = computed(() => {
    if (!this.rows().length) return '0 resultados';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end = start + this.rows().length - 1;
    const t = this.total();
    return t === null ? `${start}–${end}` : `${start}–${end} de ${t.toLocaleString('es')}`;
  });

  private search$ = new Subject<string>();
  private subs = new Subscription();
  private seq = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.isBrowser) window.scrollTo({ top: 0 });
    this.subs.add(this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe((q) => {
      this.search.set(q);
      this.page.set(1);
      this.load();
    }));
    this.refreshTotals();
    this.api.countries(100, 'movie_count', 1).subscribe({ next: (c) => this.countries.set(c), error: () => {} });
    this.load();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // ---------- Read ----------

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const seq = ++this.seq;
    const filters = { search: this.search().trim() || undefined, genre: this.genre() || undefined };
    this.api.getMovies(PAGE_SIZE + 1, (this.page() - 1) * PAGE_SIZE, filters).subscribe({
      next: (rows) => {
        if (seq !== this.seq) return;
        const page = rows.slice(0, PAGE_SIZE);
        this.rows.set(page);
        this.hasNext.set(rows.length > PAGE_SIZE);
        this.loading.set(false);
        this.posters.load(page);
      },
      error: (err: HttpErrorResponse) => {
        if (seq !== this.seq) return;
        this.rows.set([]);
        this.loading.set(false);
        this.error.set(err.status === 0 ? 'No hay conexión con la API en localhost:3000.' : `La API respondió con un error (${err.status}).`);
      },
    });
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  setGenre(genre: string): void {
    this.genre.set(genre);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    const max = this.totalPages();
    if (page < 1 || (max !== null && page > max) || (max === null && page > this.page() && !this.hasNext())) return;
    this.page.set(page);
    this.load();
  }

  // ---------- Create / Update ----------

  openEditor(movie: Movie | null): void {
    this.editorMovie.set(movie);
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
  }

  onSaved(movie: Movie): void {
    const wasEdit = !!this.editorMovie();
    this.closeEditor();
    this.notify(wasEdit ? `“${movie.title}” actualizada` : `“${movie.title}” creada con el id #${movie.id}`, 'ok');
    if (wasEdit) {
      this.rows.update((rows) => rows.map((r) => (r.id === movie.id ? movie : r)));
    } else {
      // New movies get the highest id, so they land on the last page; show it on top instead.
      this.rows.update((rows) => [movie, ...rows.filter((r) => r.id !== movie.id)].slice(0, PAGE_SIZE));
      this.refreshTotals();
    }
    this.flash(movie.id);
  }

  /** The editor drawer also offers delete. */
  onEditorDeleted(id: number): void {
    const title = this.editorMovie()?.title ?? `#${id}`;
    this.closeEditor();
    this.afterDelete(id, title);
  }

  // ---------- Delete ----------

  askDelete(movie: Movie): void {
    this.deleteError.set('');
    this.pendingDelete.set(movie);
  }

  cancelDelete(): void {
    if (!this.deleting()) this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const movie = this.pendingDelete();
    if (!movie || this.deleting()) return;
    this.deleting.set(true);
    this.api.deleteMovie(movie.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.afterDelete(movie.id, movie.title);
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(
          err.status === 401 ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
            : err.status === 404 ? 'La película ya no existe.'
              : err.status === 0 ? 'No hay conexión con la API.'
                : `Error inesperado (${err.status}).`);
      },
    });
  }

  private afterDelete(id: number, title: string): void {
    this.notify(`“${title}” eliminada`, 'bad');
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
    this.refreshTotals();
    // Refill the page (or step back if it was the last row on it).
    if (!this.rows().length && this.page() > 1) this.page.update((p) => p - 1);
    this.load();
  }

  // ---------- Helpers ----------

  private refreshTotals(): void {
    this.api.overview().subscribe({ next: (o) => this.overview.set(o), error: () => {} });
    this.api.genres().subscribe({ next: (g) => this.genreStats.set(g), error: () => {} });
  }

  private flash(id: number): void {
    this.flashId.set(id);
    setTimeout(() => { if (this.flashId() === id) this.flashId.set(null); }, 2200);
  }

  private notify(text: string, kind: 'ok' | 'bad'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ text, kind });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3800);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingDelete()) this.cancelDelete();
  }
}
