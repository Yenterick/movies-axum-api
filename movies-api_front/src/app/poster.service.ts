import { Injectable, signal } from '@angular/core';

/**
 * The dataset has no artwork, so posters come from Wikipedia: a film article's lead image is
 * almost always its theatrical poster. Lookups are batched (one request covers a page of the
 * catalog) and cached in localStorage, so each title is only ever resolved once per browser.
 */
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const CACHE_KEY = 'posters-v1';
const MAX_TITLES_PER_REQUEST = 50;

export interface PosterQuery {
  id: number;
  title: string;
  release_date: string | null;
}

interface WikiPage { title: string; missing?: string; thumbnail?: { source: string } }
interface WikiResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, WikiPage>;
  };
}

@Injectable({ providedIn: 'root' })
export class PosterService {
  /** id → poster URL, or null once we know there is none. Missing key = not looked up yet. */
  readonly posters = signal<Record<number, string | null>>(this.restore());
  private inflight = new Set<number>();

  get(id: number): string | null | undefined {
    return this.posters()[id];
  }

  /** Marks a poster as broken, e.g. when the image fails to load. */
  forget(id: number): void {
    this.commit({ [id]: null });
  }

  async load(movies: PosterQuery[]): Promise<void> {
    if (typeof window === 'undefined') return;
    const known = this.posters();
    const todo = movies.filter((m) => !(m.id in known) && !this.inflight.has(m.id));
    if (!todo.length) return;
    todo.forEach((m) => this.inflight.add(m.id));

    try {
      const found = await this.byExactTitle(todo);
      const missing = todo.filter((m) => !found[m.id]);
      // Titles that don't match an article name directly get a full-text search, a few at a time.
      for (let i = 0; i < missing.length; i += 4) {
        const batch = missing.slice(i, i + 4);
        const results = await Promise.all(batch.map((m) => this.bySearch(m)));
        batch.forEach((m, j) => (found[m.id] = results[j]));
      }
      const update: Record<number, string | null> = {};
      todo.forEach((m) => (update[m.id] = found[m.id] ?? null));
      this.commit(update);
    } catch {
      // Offline or blocked: leave these uncached so a later page view can retry.
    } finally {
      todo.forEach((m) => this.inflight.delete(m.id));
    }
  }

  /** Tries "Title (YEAR film)", "Title (film)" and "Title" for every movie in as few requests as possible. */
  private async byExactTitle(movies: PosterQuery[]): Promise<Record<number, string | null>> {
    const candidates = new Map<number, string[]>();
    for (const m of movies) {
      const year = m.release_date?.slice(0, 4);
      const list = [year ? `${m.title} (${year} film)` : '', `${m.title} (film)`, m.title].filter(Boolean);
      candidates.set(m.id, list);
    }
    const allTitles = [...new Set([...candidates.values()].flat())];
    const thumbs = new Map<string, string>();

    for (let i = 0; i < allTitles.length; i += MAX_TITLES_PER_REQUEST) {
      const chunk = allTitles.slice(i, i + MAX_TITLES_PER_REQUEST);
      const data = await this.query({ titles: chunk.join('|'), redirects: '1' });
      const q = data.query;
      if (!q?.pages) continue;
      const byTitle = new Map(Object.values(q.pages).map((p) => [p.title, p]));
      const normalized = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
      const redirects = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
      for (const title of chunk) {
        let resolved = normalized.get(title) ?? title;
        resolved = redirects.get(resolved) ?? resolved;
        const thumb = byTitle.get(resolved)?.thumbnail?.source;
        if (thumb) thumbs.set(title, thumb);
      }
    }

    const result: Record<number, string | null> = {};
    for (const [id, list] of candidates) {
      result[id] = list.map((t) => thumbs.get(t)).find(Boolean) ?? null;
    }
    return result;
  }

  private async bySearch(m: PosterQuery): Promise<string | null> {
    const year = m.release_date?.slice(0, 4) ?? '';
    const data = await this.query({ generator: 'search', gsrsearch: `${m.title} ${year} film`, gsrlimit: '1' });
    const page = Object.values(data.query?.pages ?? {})[0];
    return page?.thumbnail?.source ?? null;
  }

  private async query(params: Record<string, string>): Promise<WikiResponse> {
    const url = new URL(WIKI_API);
    const all = {
      action: 'query', format: 'json', origin: '*', prop: 'pageimages', piprop: 'thumbnail',
      pithumbsize: '500', pilicense: 'any', ...params,
    };
    Object.entries(all).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
    return res.json();
  }

  private commit(update: Record<number, string | null>): void {
    this.posters.update((current) => ({ ...current, ...update }));
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.posters()));
    } catch {
      // Storage full or unavailable; the in-memory cache still works for this session.
    }
  }

  private restore(): Record<number, string | null> {
    try {
      return typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') : {};
    } catch {
      return {};
    }
  }
}
