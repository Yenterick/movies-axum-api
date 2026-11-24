import { DecimalPipe } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { SkeletonComponent } from 'boneyard-js/angular';
import { forkJoin } from 'rxjs';
import {
  ApiService, BucketStats, CountryStats, GENRES, GenreStats, MovieFinancials, Overview, RankedEntity,
  RankingKind, RankingSort, RatedMovie, YearStats, genreLabel,
} from '../api.service';
import { PosterService } from '../poster.service';
import { compact, countryName, flag, money, multiple, percent, rating, year } from '../format';
import { Story, StoryPart, StoryText, tell } from './story';

type YearMetric = 'movie_count' | 'total_revenue' | 'average_rating';
type GenreMetric = 'movie_count' | 'average_rating' | 'median_roi' | 'total_revenue';
type BucketSource = 'budget' | 'runtime';
type BucketMetric = 'median_roi' | 'average_rating' | 'profitable_share';
type Board = 'grossing' | 'profit' | 'roi' | 'rated';

interface Row {
  id: number; title: string; date: string | null; value: number; display: string; detail: string;
  budget?: number; revenue?: number; profit?: number; voteAverage?: number; voteCount?: number;
}

/** Buckets and genres this small swing wildly, so the narrative ignores them. */
const MIN_SAMPLE = 20;

const BUCKET_NAMES: Record<string, string> = {
  Micro: 'Micro', Low: 'Bajo', Mid: 'Medio', High: 'Alto', Blockbuster: 'Superproducción',
  Short: 'Corta', Standard: 'Estándar', Long: 'Larga', 'Very long': 'Muy larga', Epic: 'Épica',
};

const weightedRating = (ys: YearStats[]): number | null => {
  const rated = ys.filter((y) => y.average_rating !== null && y.movie_count > 0);
  const n = rated.reduce((a, y) => a + y.movie_count, 0);
  return n ? rated.reduce((a, y) => a + y.average_rating! * y.movie_count, 0) / n : null;
};

const maxBy = <T>(xs: T[], f: (x: T) => number): T => xs.reduce((a, b) => (f(b) > f(a) ? b : a));
const minBy = <T>(xs: T[], f: (x: T) => number): T => xs.reduce((a, b) => (f(b) < f(a) ? b : a));

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [SkeletonComponent, DecimalPipe, StoryText],
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
  readonly countryName = countryName;

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
    const fin = (m: MovieFinancials, value: number, display: string, detail: string): Row => ({
      id: m.id, title: m.title, date: m.release_date, value, display, detail,
      budget: m.budget, revenue: m.revenue, profit: m.profit,
    });

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
            voteAverage: m.vote_average, voteCount: m.vote_count,
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

  bucketLabel(label: string): string {
    const [name, ...rest] = label.split(' (');
    const range = rest.join(' (').replace(' - ', '–').replace('>= ', '≥ ');
    return `${BUCKET_NAMES[name] ?? name}${range ? ` (${range}` : ''}`;
  }

  width(value: number | null | undefined, max: number): number {
    return Math.max(2, ((value ?? 0) / max) * 100);
  }

  year(date: string | null): string {
    return year(date);
  }

  // ================= Storytelling =================
  // Every chart carries a takeaway headline and a short narrative computed from the same data
  // it draws, so the story follows the metric/filter the viewer picks.

  /** The catalogue at a glance, told before the first chart. */
  overviewStory = computed<StoryPart[]>(() => {
    const o = this.overview();
    if (!o) return [];
    return [
      ...tell`Entre ${year(o.earliest_release)} y ${year(o.latest_release)} el catálogo reúne ${o.total_movies.toLocaleString('es')} películas que recaudaron ${money(o.total_revenue)} a partir de ${money(o.total_budget)} invertidos. `,
      ...tell`Pero el éxito no se reparte por igual: la película típica devuelve ${multiple(o.median_roi)} su presupuesto y `,
      (o.profitable_share ?? 0) < 0.6 ? 'solo ' : '',
      ...tell`${percent(o.profitable_share)} de las que tienen datos financieros lo recuperó. `,
      'Los capítulos siguientes cuentan cuándo, qué, cuánto cuesta, quién y dónde.',
    ];
  });

  timelineStory = computed<Story | null>(() => {
    const ys = this.visibleYears();
    const peak = this.peakYear();
    if (ys.length < 10 || !peak) return null;
    const first = ys[0];
    const last = ys[ys.length - 1];
    switch (this.yearMetric()) {
      case 'movie_count': {
        const early = ys.slice(0, 5).reduce((a, y) => a + y.movie_count, 0) / 5;
        const growth = peak.movie_count / Math.max(early, 1);
        const parts = tell`A comienzos del período (${first.year}) el catálogo registra unos ${Math.round(early)} estrenos al año; el pico llega en ${peak.year} con ${peak.movie_count}. `;
        if (last.movie_count < peak.movie_count * 0.5) {
          parts.push(...tell`La caída final (${last.movie_count} en ${last.year}) no indica una crisis: lo más probable es que el conjunto de datos se cerrara antes de que esos años quedaran completos.`);
        }
        return { title: growth >= 2 ? `La producción se multiplicó ×${growth.toFixed(0)}` : `El ritmo de estrenos tocó techo en ${peak.year}`, parts };
      }
      case 'total_revenue': {
        const all = this.yearStats();
        const total = all.reduce((a, y) => a + y.total_revenue, 0) || 1;
        const recent = all.filter((y) => y.year >= 2000).reduce((a, y) => a + y.total_revenue, 0) / total;
        return {
          title: `${percent(recent)} de la taquilla llegó después del 2000`,
          parts: tell`El año récord es ${peak.year}, con ${money(peak.total_revenue)} en un solo año. Ojo al leerlo: son dólares nominales, sin ajustar por inflación, y hoy se estrenan muchas más películas que hace 50 años; ambas cosas inflan las cifras recientes.`,
        };
      }
      case 'average_rating': {
        const early = weightedRating(ys.slice(0, 10));
        const late = weightedRating(ys.slice(-10));
        if (early === null || late === null) return null;
        const span = (a: YearStats[]) => `${a[0].year}–${a[a.length - 1].year}`;
        if (early - late >= 0.15) {
          return {
            title: 'El cine de antes puntúa mejor',
            parts: tell`Las películas de ${span(ys.slice(0, 10))} promedian ${'★ ' + rating(early)}, frente a ${'★ ' + rating(late)} de ${span(ys.slice(-10))}. No es que antes se hiciera mejor cine: es sesgo de supervivencia. Del pasado solo se recuerdan (y se catalogan) los clásicos, mientras que del presente entra todo lo que se estrena.`,
          };
        }
        const parts = tell`Las películas de ${span(ys.slice(0, 10))} promedian ${'★ ' + rating(early)} y las de ${span(ys.slice(-10))}, ${'★ ' + rating(late)}. `;
        const sizable = ys.filter((y) => y.movie_count >= 5);
        if (sizable.length) {
          const best = maxBy(sizable, (y) => y.average_rating ?? 0);
          parts.push(...tell`El año mejor valorado (con al menos 5 estrenos) es ${best.year}, con ${'★ ' + rating(best.average_rating)}.`);
        }
        return { title: late - early >= 0.15 ? 'El público valora mejor el cine reciente' : 'La calificación media apenas cambia con los años', parts };
      }
    }
  });

  genreStory = computed<Story | null>(() => {
    const all = this.genreStats();
    if (!all.length) return null;
    const reliable = all.filter((g) => g.movie_count >= MIN_SAMPLE * 5);
    const pool = reliable.length >= 3 ? reliable : all;
    const total = this.overview()?.total_movies ?? 0;
    const name = (g: GenreStats) => genreLabel(g.genre);
    const common = maxBy(all, (g) => g.movie_count);
    switch (this.genreMetric()) {
      case 'movie_count': {
        const rare = minBy(all, (g) => g.movie_count);
        return {
          title: `${name(common)} domina el catálogo`,
          parts: [
            ...tell`${name(common)} aparece en ${total ? percent(common.movie_count / total) : common.movie_count} de las películas (${common.movie_count.toLocaleString('es')}). En el otro extremo, ${name(rare)} suma apenas ${rare.movie_count}. `,
            'Una película puede tener varios géneros, por eso los porcentajes no suman 100%.',
          ],
        };
      }
      case 'average_rating': {
        const top = maxBy(pool, (g) => g.average_rating ?? 0);
        const low = minBy(pool, (g) => g.average_rating ?? 10);
        const gap = (top.average_rating ?? 0) - (low.average_rating ?? 0);
        const parts = [
          ...tell`Con ${'★ ' + rating(top.average_rating)} de promedio, ${name(top)} supera `,
          gap >= 0.5 ? 'con holgura a ' : 'a ',
          ...tell`${name(low)} (${'★ ' + rating(low.average_rating)}), el peor valorado. `,
        ];
        if (common !== top) parts.push(...tell`El género más producido, ${name(common)}, se queda en ${'★ ' + rating(common.average_rating)}: hacer más no significa gustar más.`);
        return { title: `${name(top)} es el género mejor valorado`, parts };
      }
      case 'median_roi': {
        const top = maxBy(pool, (g) => g.median_roi ?? -Infinity);
        const low = minBy(pool, (g) => g.median_roi ?? Infinity);
        const parts = tell`La película mediana de ${name(top)} recauda ${multiple(top.median_roi)} lo que costó, frente a ${multiple(low.median_roi)} en ${name(low)}. `;
        const budgets = pool.map((g) => g.average_budget ?? 0).sort((x, y) => x - y);
        if ((top.average_budget ?? Infinity) < budgets[Math.floor(budgets.length / 2)]) {
          parts.push(...tell`Y lo logra con presupuestos por debajo de la media (${money(top.average_budget)} por película): la rentabilidad viene de apuestas contenidas, no de gastar más.`);
        }
        return { title: `${name(top)}: el género más rentable`, parts };
      }
      case 'total_revenue': {
        const [top, second] = [...all].sort((a, b) => b.total_revenue - a.total_revenue);
        return {
          title: `${name(top)} es el género que más dinero mueve`,
          parts: tell`Sus películas acumulan ${money(top.total_revenue)} en taquilla, ${(top.total_revenue / Math.max(second.total_revenue, 1)).toFixed(1) + '×'} lo de ${name(second)}, el segundo. Detrás hay presupuestos de ${money(top.average_budget)} en promedio por película.`,
        };
      }
    }
  });

  bucketStory = computed<Story | null>(() => {
    const all = this.buckets();
    const bs = all.filter((b) => b.movie_count >= MIN_SAMPLE);
    if (bs.length < 2) return null;
    const metric = this.bucketMetric();
    const value = (b: BucketStats) => b[metric] ?? 0;
    const show = (b: BucketStats) => metric === 'average_rating' ? `★ ${rating(b.average_rating)}` : this.bucketDisplay(b);
    const budget = this.bucketSource() === 'budget';
    const unit = (v: number) => (budget ? money(v) : `${v} min`);
    const phrase = (b: BucketStats) =>
      b.upper_bound === null ? `de ${unit(b.lower_bound)} o más`
        : b.lower_bound === 0 ? `de menos de ${unit(b.upper_bound)}`
          : `de ${unit(b.lower_bound)} a ${unit(b.upper_bound)}`;
    const [first, last] = [bs[0], bs[bs.length - 1]];
    const best = maxBy(bs, value);
    // Ratings move in tenths, the other two metrics in whole multiples / percentage points.
    const threshold = metric === 'average_rating' ? 0.15 : metric === 'profitable_share' ? 0.05 : 0.3;
    const trend = value(last) - value(first) > threshold ? 'up' : value(first) - value(last) > threshold ? 'down' : 'flat';

    const titles: Record<string, Record<BucketMetric, Record<string, string>>> = {
      budget: {
        median_roi: { up: 'A más presupuesto, más retorno', down: 'Más dinero no compra más rentabilidad', flat: 'El retorno apenas depende del presupuesto' },
        average_rating: { up: 'Las grandes producciones gustan más', down: 'El dinero no compra calidad', flat: 'El presupuesto casi no mueve la calificación' },
        profitable_share: { up: 'Gastar más reduce el riesgo de perder', down: 'Las grandes apuestas fracasan más', flat: 'El riesgo es parecido con cualquier presupuesto' },
      },
      runtime: {
        median_roi: { up: 'Las películas largas rinden más', down: 'Las películas cortas rinden más', flat: 'La duración apenas cambia el retorno' },
        average_rating: { up: 'Cuanto más larga, mejor valorada', down: 'El público prefiere películas cortas', flat: 'La duración apenas cambia la calificación' },
        profitable_share: { up: 'Las películas largas fracasan menos', down: 'Las películas cortas fracasan menos', flat: 'La duración no cambia el riesgo' },
      },
    };

    const parts = tell`Las películas ${phrase(first)} logran ${show(first)} y las ${phrase(last)}, ${show(last)}. El mejor tramo es el ${phrase(best)}: ${show(best)} en ${best.movie_count.toLocaleString('es')} películas. `;
    if (budget && metric !== 'average_rating' && trend === 'down') parts.push('Las superproducciones recaudan más en términos absolutos, pero cada dólar invertido rinde menos.');
    if (!budget && metric === 'average_rating' && trend === 'up') parts.push('Ojo: las películas largas suelen ser dramas y épicas de prestigio, así que la duración por sí sola no explica la nota.');
    if (all.length > bs.length) parts.push(`(Se omiten tramos con menos de ${MIN_SAMPLE} películas.)`);
    return { title: titles[this.bucketSource()][metric][trend], parts };
  });

  boardStory = computed<Story | null>(() => {
    const rows = this.boardRows();
    if (!rows.length || this.boardLoading()) return null;
    const top = rows[0];
    const where = this.boardGenre() ? ` en ${genreLabel(this.boardGenre()).toLowerCase()}` : '';
    const label = `${top.title} (${year(top.date)})`;
    switch (this.board()) {
      case 'grossing': {
        const recent = rows.filter((r) => Number(year(r.date)) >= 2000).length;
        return {
          title: `${top.title} reina en taquilla${where}`,
          parts: [
            ...tell`${label} encabeza la lista con ${money(top.revenue)} recaudados. ${recent} de estas ${rows.length} películas se estrenaron en el siglo XXI`,
            recent >= rows.length / 2
              ? ': la era de las franquicias globales (y de la inflación) se apoderó de la taquilla.'
              : ': los clásicos todavía resisten frente a los estrenos recientes.',
          ],
        };
      }
      case 'profit':
        return {
          title: `${top.title}: la mayor ganancia${where}`,
          parts: tell`Tras invertir ${money(top.budget)}, ${label} recaudó ${money(top.revenue)}: una ganancia neta de ${money(top.profit)}. En dólares absolutos siempre ganan las grandes apuestas; cambia a ROI para ver las verdaderas sorpresas.`,
        };
      case 'roi': {
        const budgets = rows.map((r) => r.budget ?? 0).sort((a, b) => a - b);
        const median = budgets[Math.floor(budgets.length / 2)];
        const parts = tell`Con ${(top.budget ?? 0) < 20e6 ? 'apenas ' : ''}${money(top.budget)}, ${label} recaudó ${money(top.revenue)}: ${top.display} su presupuesto. `;
        if (median < 20e6) parts.push(...tell`El presupuesto mediano de este top es de ${money(median)}: las inversiones más rentables son apuestas pequeñas que se convierten en fenómenos.`);
        return { title: `${top.title} multiplicó ${top.display} su inversión`, parts };
      }
      case 'rated':
        return {
          title: `${top.title}, la favorita del público${where}`,
          parts: tell`Su puntaje de ${top.display} combina el promedio (${'★ ' + rating(top.voteAverage)}) con el peso de ${compact(top.voteCount)} votos. Esta fórmula bayesiana evita que una película con diez votos perfectos supere a un clásico votado por miles.`,
        };
    }
  });

  talentStory = computed<Story | null>(() => {
    const t = this.talent();
    if (!t.length || this.talentLoading()) return null;
    const top = t[0];
    const plural = { directors: 'directores', actors: 'actores', companies: 'estudios' }[this.talentKind()];
    switch (this.talentSort()) {
      case 'revenue': {
        const parts = tell`Las ${top.movie_count} películas de ${top.name} suman ${money(top.total_revenue)}, ${money(top.average_revenue)} por título. `;
        const perFilm = maxBy(t, (x) => x.average_revenue ?? 0);
        if (perFilm !== top) parts.push(...tell`Pero película por película nadie supera a ${perFilm.name}: ${money(perFilm.average_revenue)} cada una.`);
        return { title: `${top.name} es quien más taquilla mueve`, parts };
      }
      case 'rating': {
        const parts = tell`Con ${'★ ' + rating(top.average_rating)} de promedio en ${top.movie_count} películas, lidera a los ${plural} con al menos 6 títulos. `;
        const richest = maxBy(t, (x) => x.total_revenue);
        if (richest !== top && richest.total_revenue > top.total_revenue) {
          parts.push(...tell`La calidad no siempre paga: ${richest.name} recaudó más (${money(richest.total_revenue)}) con ${'★ ' + rating(richest.average_rating)}.`);
        }
        return { title: `${top.name}: la calificación más alta`, parts };
      }
      case 'movie_count': {
        const parts = tell`Con ${top.movie_count} películas en el catálogo, ninguno de los ${plural} tiene más títulos. `;
        const best = maxBy(t, (x) => x.average_rating ?? 0);
        if (best !== top && (best.average_rating ?? 0) - (top.average_rating ?? 0) >= 0.2) {
          parts.push(...tell`Su promedio es ${'★ ' + rating(top.average_rating)}, frente a ${'★ ' + rating(best.average_rating)} de ${best.name}: cantidad no es lo mismo que calidad.`);
        } else {
          parts.push(...tell`Y lo hace con un promedio de ${'★ ' + rating(top.average_rating)}.`);
        }
        return { title: `${top.name} lidera en volumen`, parts };
      }
    }
  });

  countryStory = computed<Story | null>(() => {
    const cs = this.countries();
    const total = this.overview()?.total_movies;
    if (cs.length < 2 || !total) return null;
    const [top, ...rest] = cs;
    const restSum = rest.reduce((a, c) => a + c.movie_count, 0);
    const name = (c: CountryStats) => countryName(c.iso_3166_1, c.name);
    const parts = tell`${name(top)} participa en ${percent(top.movie_count / total)} de las películas del catálogo`;
    if (top.movie_count > restSum) parts.push(rest.length === 1 ? `, más que ${name(rest[0])}. ` : `, más que los otros ${rest.length} países de esta lista juntos. `);
    else parts.push('. ');
    const best = maxBy(cs, (c) => c.average_rating ?? 0);
    if (best !== top) parts.push(...tell`Pero en calidad destaca ${name(best)}, con ${'★ ' + rating(best.average_rating)} de promedio frente a ${'★ ' + rating(top.average_rating)}. `);
    parts.push('Las coproducciones cuentan para cada país participante.');
    return { title: `${flag(top.iso_3166_1)} ${name(top)} domina la producción mundial`, parts };
  });

  /** Closing chapter: the headline of each chapter, in reading order. */
  takeaways = computed(() =>
    [this.timelineStory(), this.genreStory(), this.bucketStory(), this.boardStory(), this.talentStory(), this.countryStory()]
      .filter((s): s is Story => !!s)
      .map((s) => s.title));
}
