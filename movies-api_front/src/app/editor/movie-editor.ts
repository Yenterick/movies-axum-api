import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ApiService, CountryStats, GENRES, Movie, MovieCreate, MoviePatch, MovieStatus, genreLabel,
} from '../api.service';
import { LANGUAGES, countryName } from '../format';

interface Draft {
  title: string;
  original_title: string;
  tagline: string;
  overview: string;
  director: string;
  release_date: string;
  runtime: number | null;
  budget: number | null;
  revenue: number | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity: number | null;
  original_language: string;
  homepage: string;
  status: MovieStatus;
  genres: string[];
  keywords: string;
  cast: string;
  countries: string[];
  companies: string;
}

const SCALARS = [
  'title', 'original_title', 'tagline', 'overview', 'director', 'release_date', 'runtime', 'budget',
  'revenue', 'vote_average', 'vote_count', 'popularity', 'original_language', 'homepage', 'status',
] as const;

const list = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Admin drawer for POST /movies and PATCH /movies/{id}. Every field is editable in both modes;
 * on edit only what changed is sent, and a changed list replaces the stored one.
 */
@Component({
  selector: 'app-movie-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './movie-editor.html',
  styleUrl: './movie-editor.css',
})
export class MovieEditor implements OnInit {
  /** Movie to edit; null creates a new one. */
  @Input() movie: Movie | null = null;
  @Input() countries: CountryStats[] = [];
  @Output() saved = new EventEmitter<Movie>();
  @Output() deleted = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  private api = inject(ApiService);

  readonly genres = GENRES;
  readonly languages = LANGUAGES;
  readonly genreLabel = genreLabel;
  readonly countryName = countryName;
  readonly statuses: { value: MovieStatus; label: string }[] = [
    { value: 'Released', label: 'Estrenada' },
    { value: 'PostProduction', label: 'Postproducción' },
    { value: 'Rumored', label: 'Rumoreada' },
  ];

  draft!: Draft;
  private original!: Draft;
  saving = signal(false);
  confirmDelete = signal(false);
  error = signal('');

  get isEdit(): boolean {
    return !!this.movie;
  }

  ngOnInit(): void {
    const m = this.movie;
    this.draft = {
      title: m?.title ?? '',
      original_title: m?.original_title ?? '',
      tagline: m?.tagline ?? '',
      overview: m?.overview ?? '',
      director: m?.director ?? '',
      release_date: m?.release_date ?? '',
      runtime: m?.runtime ?? null,
      budget: m?.budget ?? null,
      revenue: m?.revenue ?? null,
      vote_average: m?.vote_average ?? null,
      vote_count: m?.vote_count ?? null,
      popularity: m?.popularity ?? null,
      original_language: m?.original_language ?? 'en',
      homepage: m?.homepage ?? '',
      status: (m?.status as MovieStatus) ?? 'Released',
      genres: [...(m?.genres ?? [])],
      keywords: m?.keywords.join(', ') ?? '',
      cast: m?.cast.join(', ') ?? '',
      countries: m?.production_countries.map((c) => c.iso_3166_1) ?? [],
      companies: m?.production_companies.map((c) => c.name).join(', ') ?? '',
    };
    this.original = structuredClone(this.draft);
  }

  /** Known countries plus any the movie already has, so editing never hides a selected one. */
  get countryOptions(): { iso_3166_1: string; name: string }[] {
    const own = this.movie?.production_countries ?? [];
    return [...this.countries, ...own.filter((c) => !this.countries.some((k) => k.iso_3166_1 === c.iso_3166_1))];
  }

  knownLanguage(): boolean {
    return this.languages.some((l) => l.code === this.draft.original_language);
  }

  toggleGenre(genre: string): void {
    const set = new Set(this.draft.genres);
    if (set.has(genre)) set.delete(genre); else set.add(genre);
    this.draft.genres = [...set];
  }

  toggleCountry(iso: string): void {
    const set = new Set(this.draft.countries);
    if (set.has(iso)) set.delete(iso); else set.add(iso);
    this.draft.countries = [...set];
  }

  save(): void {
    if (this.saving()) return;
    const problem = this.validate();
    if (problem) { this.error.set(problem); return; }
    this.error.set('');
    this.saving.set(true);

    const request = this.movie
      ? this.api.updateMovie(this.movie.id, this.patch())
      : this.api.createMovie(this.createBody());
    request.subscribe({
      next: (movie) => { this.saving.set(false); this.saved.emit(movie); },
      error: (err: HttpErrorResponse) => { this.saving.set(false); this.error.set(this.describe(err)); },
    });
  }

  remove(): void {
    if (!this.movie || this.saving()) return;
    if (!this.confirmDelete()) { this.confirmDelete.set(true); return; }
    this.saving.set(true);
    const id = this.movie.id;
    this.api.deleteMovie(id).subscribe({
      next: () => { this.saving.set(false); this.deleted.emit(id); },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.confirmDelete.set(false);
        this.error.set(this.describe(err));
      },
    });
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (!this.saving()) this.closed.emit();
  }

  private validate(): string {
    const d = this.draft;
    if (!d.title.trim()) return 'El título es obligatorio.';
    if (!d.genres.length) return 'Elige al menos un género.';
    if (d.vote_average !== null && (d.vote_average < 0 || d.vote_average > 10)) return 'El rating va de 0 a 10.';
    for (const key of ['runtime', 'budget', 'revenue', 'vote_count', 'popularity'] as const) {
      const v = d[key];
      if (v !== null && (v < 0 || !Number.isFinite(v))) return 'Los valores numéricos no pueden ser negativos.';
    }
    if (d.homepage && !/^https?:\/\//.test(d.homepage)) return 'El sitio oficial debe empezar por http:// o https://';
    return '';
  }

  /** Only fields that actually changed, so an edit never clobbers data the form doesn't show. */
  private patch(): MoviePatch {
    const patch: Record<string, unknown> = {};
    for (const key of SCALARS) {
      const now = this.draft[key];
      if (now !== this.original[key]) patch[key] = this.normalize(key, now);
    }
    const d = this.draft;
    const o = this.original;
    if (!sameSet(d.genres, o.genres)) patch['genres'] = d.genres;
    if (!sameSet(list(d.keywords), list(o.keywords))) patch['keywords'] = list(d.keywords);
    if (!sameSet(list(d.cast), list(o.cast))) patch['cast'] = list(d.cast);
    if (!sameSet(list(d.companies), list(o.companies))) patch['production_companies'] = this.companies();
    if (!sameSet(d.countries, o.countries)) patch['production_countries'] = this.selectedCountries();
    return patch as MoviePatch;
  }

  private selectedCountries(): { iso_3166_1: string; name: string }[] {
    return this.draft.countries.map((iso) => ({
      iso_3166_1: iso,
      name: this.countryOptions.find((c) => c.iso_3166_1 === iso)?.name ?? iso,
    }));
  }

  /** Studios need an id: reuse the stored one for studios the movie already had, derive the rest from the name. */
  private companies(): { id: number; name: string }[] {
    const own = this.movie?.production_companies ?? [];
    return list(this.draft.companies).map((name) => ({
      id: own.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? this.stableId(name),
      name,
    }));
  }

  private createBody(): MovieCreate {
    const d = this.draft;
    const languageName = this.languages.find((l) => l.code === d.original_language)?.english ?? d.original_language;
    return {
      title: d.title.trim(),
      original_title: d.original_title.trim() || d.title.trim(),
      tagline: d.tagline.trim() || null,
      overview: d.overview.trim() || null,
      director: d.director.trim() || null,
      release_date: d.release_date || null,
      runtime: d.runtime ?? null,
      budget: Math.round(d.budget ?? 0),
      revenue: Math.round(d.revenue ?? 0),
      vote_average: d.vote_average ?? 0,
      vote_count: Math.round(d.vote_count ?? 0),
      popularity: d.popularity ?? 0,
      original_language: d.original_language,
      homepage: d.homepage.trim() || null,
      status: d.status,
      genres: d.genres,
      keywords: list(d.keywords),
      cast: list(d.cast),
      production_countries: this.selectedCountries(),
      production_companies: this.companies(),
      spoken_languages: [{ iso_639_1: d.original_language, name: languageName }],
      crew: [],
    };
  }

  private normalize(key: (typeof SCALARS)[number], value: unknown): unknown {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // The API keeps a field when it receives null, so an emptied text field is sent as "".
      return key === 'release_date' && !trimmed ? undefined : trimmed;
    }
    if (typeof value === 'number' && ['budget', 'revenue', 'vote_count', 'runtime'].includes(key)) return Math.round(value);
    return value ?? undefined;
  }

  private stableId(name: string): number {
    let h = 2166136261;
    for (const ch of name.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    // Keep clear of the dataset's small ids.
    return 1_000_000 + ((h >>> 0) % 900_000_000);
  }

  private describe(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No hay conexión con la API.';
    if (err.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (err.status === 404) return 'La película ya no existe.';
    if (err.status === 409) return 'Ya existe una película con ese id.';
    if (err.status === 422 || err.status === 400) {
      const detail = typeof err.error === 'string' ? err.error : err.error?.message;
      return `La API rechazó los datos${detail ? `: ${detail}` : '.'}`;
    }
    return `Error inesperado (${err.status}).`;
  }
}
