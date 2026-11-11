import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { SkeletonComponent } from 'boneyard-js/angular';
import { forkJoin } from 'rxjs';
import {
  ApiService, BucketStats, CountryStats, GENRES, GenreStats, MovieFinancials, Overview, RankedEntity,
  RankingKind, RankingSort, RatedMovie, YearStats, genreLabel,
} from '../api.service';
import { PosterService } from '../poster.service';
import { compact, flag, money, multiple, percent, rating, year } from '../format';

type YearMetric = 'movie_count' | 'total_revenue' | 'average_rating';
type GenreMetric = 'movie_count' | 'average_rating' | 'median_roi' | 'total_revenue';
type BucketSource = 'budget' | 'runtime';
type BucketMetric = 'median_roi' | 'average_rating' | 'profitable_share';
type Board = 'grossing' | 'profit' | 'roi' | 'rated';

interface Row { id: number; title: string; date: string | null; value: number; display: string; detail: string }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [SkeletonComponent, DecimalPipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics implements OnInit {
  @Output() genreSelected = new EventEmitter<string>();
  @Output() countrySelected = new EventEmitter<string>();
  @Output() movieSelected = new EventEmitter<number>();

  private api = inject(ApiService);
  readonly posters = inject(PosterService);

  readonly genres = GENRES;
  readonly genreLabel = genreLabel;
  readonly money = money;
  readonly compact = compact;
  readonly percent = percent;
  readonly rating = rating;
  readonly flag = flag;
  readonly multiple = multiple;

  // ---- Base data ----
  overview = signal<Overview | null>(null);
  genreStats = signal<GenreStats[]>([]);
  yearStats = signal<YearStats[]>([]);
  budgetTiers = signal<BucketStats[]>([]);
  runtimes = signal<BucketStats[]>([]);
  countries = signal<CountryStats[]>([]);
  baseLoading = signal(true);
  error = signal(false);

  // ---- Timeline ----
  yearMetric = signal<YearMetric>('movie_count');
  yearFrom = signal(1960);
  hoverYear = signal<YearStats | null>(null);
  visibleYears = computed(() => this.yearStats().filter((y) => y.year >= this.yearFrom()));
  yearMax = computed(() => Math.max(1, ...this.visibleYears().map((y) => this.yearValue(y))));
  yearTicks = computed(() => {
    const ys = this.visibleYears();
    if (!ys.length) return [];
    const step = ys.length > 40 ? 10 : 5;
    return ys.filter((y) => y.year % step === 0).map((y) => ({ year: y.year, left: (ys.indexOf(y) + 0.5) / ys.length * 100 }));
  });
  peakYear = computed(() => {
    const ys = this.visibleYears();
    return ys.length ? ys.reduce((a, b) => (this.yearValue(b) > this.yearValue(a) ? b : a)) : null;
  });

  // ---- Genres ----
  genreMetric = signal<GenreMetric>('movie_count');
  sortedGenres = computed(() => {
    const m = this.genreMetric();
    return [...this.genreStats()].sort((a, b) => (b[m] ?? 0) - (a[m] ?? 0));
  });
  genreMax = computed(() => Math.max(1e-9, ...this.genreStats().map((g) => g[this.genreMetric()] ?? 0)));

  // ---- Buckets ----
  bucketSource = signal<BucketSource>('budget');
  bucketMetric = signal<BucketMetric>('median_roi');
  hoverBucket = signal<BucketStats | null>(null);
  buckets = computed(() => (this.bucketSource() === 'budget' ? this.budgetTiers() : this.runtimes()).filter((b) => b.movie_count > 0));
  bucketMax = computed(() => Math.max(1e-9, ...this.buckets().map((b) => b[this.bucketMetric()] ?? 0)));

  // ---- Leaderboards ----
  board = signal<Board>('grossing');
  boardGenre = signal('');
  boardRows = signal<Row[]>([]);
  boardLoading = signal(true);
  boardMax = computed(() => Math.max(1e-9, ...this.boardRows().map((r) => r.value)));

  // ---- Talent ----
  talentKind = signal<RankingKind>('directors');
  talentSort = signal<RankingSort>('revenue');
  talent = signal<RankedEntity[]>([]);
  talentLoading = signal(true);
  talentMax = computed(() => Math.max(1e-9, ...this.talent().map((t) => this.talentValue(t))));

  countryMax = computed(() => Math.max(1, ...this.countries().map((c) => c.movie_count)));

  ngOnInit(): void {
    this.loadBase();
    this.loadBoard();
    this.loadTalent();
  }

  loadBase(): void {
    this.baseLoading.set(true);
    this.error.set(false);
    forkJoin({
      overview: this.api.overview(),
      genres: this.api.genres(),
      years: this.api.years(),
      budget: this.api.budgetTiers(),
      runtimes: this.api.runtimes(),
      countries: this.api.countries(8),
    }).subscribe({
      next: (d) => {
        this.overview.set(d.overview);
        this.genreStats.set(d.genres);
        this.yearStats.set(d.years.sort((a, b) => a.year - b.year));
        this.budgetTiers.set(d.budget);
        this.runtimes.set(d.runtimes);
        this.countries.set(d.countries);
        this.baseLoading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.baseLoading.set(false);
      },
    });
  }

  setBoard(board: Board): void {
    this.board.set(board);
    this.loadBoard();
  }

  setBoardGenre(genre: string): void {
    this.boardGenre.set(genre);
    this.loadBoard();
  }

  private boardSeq = 0;
  private talentSeq = 0;

  private loadBoard(): void {
    this.boardLoading.set(true);
    const genre = this.boardGenre() || undefined;
    // Tabs can be clicked faster than responses arrive; only the latest request may land.
    const seq = ++this.boardSeq;
    const done = (rows: Row[]) => {
      if (seq !== this.boardSeq) return;
      this.boardRows.set(rows);
      this.boardLoading.set(false);
      this.posters.load(rows.map((r) => ({ id: r.id, title: r.title, release_date: r.date })));
    };
    const fail = () => done([]);
    const fin = (m: MovieFinancials, value: number, display: string, detail: string): Row =>
      ({ id: m.id, title: m.title, date: m.release_date, value, display, detail });

    switch (this.board()) {
      case 'grossing':
        this.api.topGrossing(8, genre).subscribe({
          next: (r) => done(r.map((m) => fin(m, m.revenue, money(m.revenue), `Presupuesto ${money(m.budget)}`))),
          error: fail,
        });
        break;
      case 'profit':
        this.api.mostProfitable(8, 'profit', genre).subscribe({
          next: (r) => done(r.map((m) => fin(m, m.profit, money(m.profit), `${money(m.budget)} → ${money(m.revenue)}`))),
          error: fail,
        });
        break;
      case 'roi':
        this.api.mostProfitable(8, 'roi', genre).subscribe({
          next: (r) => done(r.map((m) => fin(m, m.roi ?? 0, multiple(m.roi), `${money(m.budget)} → ${money(m.revenue)}`))),
          error: fail,
        });
        break;
      case 'rated':
        this.api.topRated(8, genre).subscribe({
          next: (r: RatedMovie[]) => done(r.map((m) => ({
            id: m.id, title: m.title, date: m.release_date, value: m.weighted_rating,
            display: m.weighted_rating.toFixed(2), detail: `★ ${m.vote_average.toFixed(1)} · ${compact(m.vote_count)} votos`,
          }))),
          error: fail,
        });
        break;
    }
  }

  setTalent(kind: RankingKind): void {
    this.talentKind.set(kind);
    this.loadTalent();
  }

  setTalentSort(sort: RankingSort): void {
    this.talentSort.set(sort);
    this.loadTalent();
  }

  private loadTalent(): void {
    this.talentLoading.set(true);
    // Rating rankings get noisy with tiny filmographies, so demand a bigger body of work.
    const minMovies = this.talentSort() === 'rating' ? 6 : 3;
    const seq = ++this.talentSeq;
    const done = (r: RankedEntity[]) => { if (seq !== this.talentSeq) return; this.talent.set(r); this.talentLoading.set(false); };
    this.api.ranking(this.talentKind(), this.talentSort(), 8, minMovies).subscribe({ next: done, error: () => done([]) });
  }

  // ---- Value accessors ----

  yearValue(y: YearStats): number {
    return (y[this.yearMetric()] as number | null) ?? 0;
  }

  yearDisplay(y: YearStats): string {
    switch (this.yearMetric()) {
      case 'movie_count': return `${y.movie_count} películas`;
      case 'total_revenue': return money(y.total_revenue);
      case 'average_rating': return `★ ${rating(y.average_rating)}`;
    }
  }

  genreDisplay(g: GenreStats): string {
    switch (this.genreMetric()) {
      case 'movie_count': return g.movie_count.toLocaleString('es');
      case 'average_rating': return rating(g.average_rating);
      case 'median_roi': return multiple(g.median_roi);
      case 'total_revenue': return money(g.total_revenue);
    }
  }

  bucketDisplay(b: BucketStats): string {
    switch (this.bucketMetric()) {
      case 'median_roi': return multiple(b.median_roi);
      case 'average_rating': return rating(b.average_rating);
      case 'profitable_share': return percent(b.profitable_share);
    }
  }

  talentValue(t: RankedEntity): number {
    switch (this.talentSort()) {
      case 'movie_count': return t.movie_count;
      case 'rating': return t.average_rating ?? 0;
      case 'revenue': return t.total_revenue;
    }
  }

  talentDisplay(t: RankedEntity): string {
    switch (this.talentSort()) {
      case 'movie_count': return `${t.movie_count}`;
      case 'rating': return rating(t.average_rating);
      case 'revenue': return money(t.total_revenue);
    }
  }

  width(value: number | null | undefined, max: number): number {
    return Math.max(2, ((value ?? 0) / max) * 100);
  }

  year(date: string | null): string {
    return year(date);
  }
}
