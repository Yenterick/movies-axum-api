import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const API_BASE = 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'token';
const USER_KEY = 'username';

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family',
  'Fantasy', 'Foreign', 'History', 'Horror', 'Music', 'Mystery', 'Romance', 'ScienceFiction',
  'Thriller', 'TvMovie', 'War', 'Western',
] as const;
export type Genre = (typeof GENRES)[number];

const GENRE_LABELS: Record<string, string> = {
  Action: 'Acción', Adventure: 'Aventura', Animation: 'Animación', Comedy: 'Comedia',
  Crime: 'Crimen', Documentary: 'Documental', Drama: 'Drama', Family: 'Familia',
  Fantasy: 'Fantasía', Foreign: 'Extranjera', History: 'Historia', Horror: 'Terror',
  Music: 'Música', Mystery: 'Misterio', Romance: 'Romance', ScienceFiction: 'Ciencia ficción',
  Thriller: 'Suspenso', TvMovie: 'Película de TV', War: 'Bélica', Western: 'Western',
};

export function genreLabel(genre: string): string {
  return GENRE_LABELS[genre] ?? genre;
}

export interface Movie {
  id: number;
  title: string;
  original_title: string;
  overview: string | null;
  tagline: string | null;
  genres: Genre[];
  release_date: string | null;
  runtime: number | null;
  budget: number;
  revenue: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  homepage: string | null;
  keywords: string[];
  cast: string[];
  director: string | null;
  production_companies: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; name: string }[];
  status: string;
}

export interface MovieFilters {
  search?: string;
  genre?: string;
  keyword?: string;
  language?: string;
  country?: string;
}

export interface Overview {
  total_movies: number;
  released_movies: number;
  total_budget: number;
  total_revenue: number;
  total_votes: number;
  average_budget: number | null;
  average_revenue: number | null;
  average_rating: number | null;
  average_runtime: number | null;
  median_roi: number | null;
  profitable_share: number | null;
  earliest_release: string | null;
  latest_release: string | null;
  genre_count: number;
  language_count: number;
  country_count: number;
  company_count: number;
}

export interface GenreStats {
  genre: Genre;
  movie_count: number;
  average_rating: number | null;
  average_runtime: number | null;
  average_budget: number | null;
  average_revenue: number | null;
  total_revenue: number;
  median_roi: number | null;
}

export interface YearStats {
  year: number;
  movie_count: number;
  total_budget: number;
  total_revenue: number;
  average_rating: number | null;
  average_runtime: number | null;
}

export interface MovieFinancials {
  id: number;
  title: string;
  release_date: string | null;
  budget: number;
  revenue: number;
  profit: number;
  roi: number | null;
}

export interface RatedMovie {
  id: number;
  title: string;
  release_date: string | null;
  vote_average: number;
  vote_count: number;
  weighted_rating: number;
}

export interface RankedEntity {
  id: number | string;
  name: string;
  movie_count: number;
  average_rating: number | null;
  total_budget: number;
  total_revenue: number;
  average_revenue: number | null;
}

export interface CountryStats extends RankedEntity {
  iso_3166_1: string;
}

export interface BucketStats {
  label: string;
  lower_bound: number;
  upper_bound: number | null;
  movie_count: number;
  average_rating: number | null;
  average_budget: number | null;
  average_revenue: number | null;
  median_roi: number | null;
  profitable_share: number | null;
}

export type MovieStatus = 'Released' | 'PostProduction' | 'Rumored';

/** Body of POST /movies. The API assigns the id when it is omitted. */
export interface MovieCreate {
  title: string;
  original_title: string;
  overview: string | null;
  tagline: string | null;
  genres: string[];
  keywords: string[];
  cast: string[];
  director: string | null;
  release_date: string | null;
  runtime: number | null;
  budget: number;
  revenue: number;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  homepage: string | null;
  status: MovieStatus;
  production_companies: { id: number; name: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; name: string }[];
  crew: never[];
}

/** Body of PATCH /movies/{id}: only scalar fields can change, absent ones are kept. */
export type MoviePatch = Partial<Pick<MovieCreate,
  'title' | 'original_title' | 'overview' | 'tagline' | 'director' | 'release_date' | 'runtime' | 'budget' |
  'revenue' | 'vote_average' | 'vote_count' | 'popularity' | 'original_language' | 'homepage' | 'status'>>;

export type RankingSort = 'movie_count' | 'rating' | 'revenue';
export type RankingKind = 'directors' | 'actors' | 'companies';

function params(values: Record<string, string | number | undefined | null>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') p = p.set(key, String(value));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly username = signal<string | null>(this.read(USER_KEY));
  readonly token = signal<string | null>(this.read(TOKEN_KEY));

  constructor(private http: HttpClient) {}

  // ---------- Auth ----------

  login(username: string, password: string): Observable<{ username: string; token: string | null }> {
    return this.http
      .post<{ username: string; token: string | null }>(`${API_BASE}/users/login`, { username, password })
      .pipe(tap((res) => this.storeSession(res.username, res.token)));
  }

  register(username: string, password: string, secretKey: string): Observable<unknown> {
    return this.http.post(`${API_BASE}/users/bootstrap`, { username, password, secret_key: secretKey });
  }

  logout(): void {
    this.write(TOKEN_KEY, null);
    this.write(USER_KEY, null);
    this.token.set(null);
    this.username.set(null);
  }

  isLoggedIn(): boolean {
    return !!this.token();
  }

  // ---------- Movies ----------

  getMovies(limit: number, offset: number, filters: MovieFilters = {}): Observable<Movie[]> {
    return this.http.get<Movie[]>(`${API_BASE}/movies`, {
      params: params({ limit, offset, ...filters }),
    });
  }

  getMovie(id: number): Observable<Movie> {
    return this.http.get<Movie>(`${API_BASE}/movies/${id}`);
  }

  // The auth interceptor attaches the bearer token to these.
  createMovie(movie: MovieCreate): Observable<Movie> {
    return this.http.post<Movie>(`${API_BASE}/movies`, movie);
  }

  updateMovie(id: number, patch: MoviePatch): Observable<Movie> {
    return this.http.patch<Movie>(`${API_BASE}/movies/${id}`, patch);
  }

  deleteMovie(id: number): Observable<unknown> {
    return this.http.delete(`${API_BASE}/movies/${id}`);
  }

  // ---------- Analytics ----------

  overview(): Observable<Overview> {
    return this.http.get<Overview>(`${API_BASE}/analytics/overview`);
  }

  genres(): Observable<GenreStats[]> {
    return this.http.get<GenreStats[]>(`${API_BASE}/analytics/genres`);
  }

  years(from?: number, to?: number): Observable<YearStats[]> {
    return this.http.get<YearStats[]>(`${API_BASE}/analytics/years`, { params: params({ from, to }) });
  }

  topGrossing(limit = 10, genre?: string): Observable<MovieFinancials[]> {
    return this.http.get<MovieFinancials[]>(`${API_BASE}/analytics/movies/top-grossing`, {
      params: params({ limit, genre }),
    });
  }

  mostProfitable(limit = 10, sortBy: 'profit' | 'roi' = 'profit', genre?: string): Observable<MovieFinancials[]> {
    return this.http.get<MovieFinancials[]>(`${API_BASE}/analytics/movies/most-profitable`, {
      params: params({ limit, sort_by: sortBy, genre }),
    });
  }

  topRated(limit = 10, genre?: string, minVotes?: number): Observable<RatedMovie[]> {
    return this.http.get<RatedMovie[]>(`${API_BASE}/analytics/movies/top-rated`, {
      params: params({ limit, genre, min_votes: minVotes }),
    });
  }

  ranking(kind: RankingKind, sortBy: RankingSort = 'movie_count', limit = 10, minMovies?: number): Observable<RankedEntity[]> {
    return this.http.get<RankedEntity[]>(`${API_BASE}/analytics/${kind}`, {
      params: params({ limit, sort_by: sortBy, min_movies: minMovies }),
    });
  }

  countries(limit = 10, sortBy: RankingSort = 'movie_count', minMovies?: number): Observable<CountryStats[]> {
    return this.http.get<CountryStats[]>(`${API_BASE}/analytics/countries`, {
      params: params({ limit, sort_by: sortBy, min_movies: minMovies }),
    });
  }

  budgetTiers(): Observable<BucketStats[]> {
    return this.http.get<BucketStats[]>(`${API_BASE}/analytics/budget-tiers`);
  }

  runtimes(): Observable<BucketStats[]> {
    return this.http.get<BucketStats[]>(`${API_BASE}/analytics/runtimes`);
  }

  // ---------- Storage ----------

  private storeSession(username: string, token: string | null): void {
    this.write(TOKEN_KEY, token);
    this.write(USER_KEY, username);
    this.token.set(token);
    this.username.set(username);
  }

  private read(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      if (typeof localStorage === 'undefined') return;
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); the session just won't persist.
    }
  }
}
