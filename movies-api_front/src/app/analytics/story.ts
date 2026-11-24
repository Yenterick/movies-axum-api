import { Component, Input } from '@angular/core';

/** A run of narrative text; `{ b }` parts are the data points, rendered in bold. */
export type StoryPart = string | { b: string };

export interface Story {
  /** Takeaway headline: what the chart shows, stated as a conclusion. */
  title: string;
  parts: StoryPart[];
}

/** Tagged template: every interpolated value becomes a highlighted data point. */
export function tell(strings: TemplateStringsArray, ...values: (string | number)[]): StoryPart[] {
  const parts: StoryPart[] = [];
  strings.forEach((text, i) => {
    if (text) parts.push(text);
    if (i < values.length && values[i] !== '') parts.push({ b: String(values[i]) });
  });
  return parts;
}

@Component({
  selector: 'app-story',
  standalone: true,
  template: `
    @if (parts.length) {
      <p class="story">
        <span class="story-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13"/></svg>
        </span>
        <span>@for (p of parts; track $index) {@if (isData(p)) {<strong>{{ p.b }}</strong>} @else {<ng-container>{{ p }}</ng-container>}}</span>
      </p>
    }
  `,
  styles: `
    :host { display: block; }
    .story { display: flex; gap: 12px; margin: 18px 0 0; padding: 14px 16px; border: 1px solid var(--line); border-left: 2px solid var(--amber); border-radius: 4px 12px 12px 4px; background: linear-gradient(90deg, rgba(255, 196, 107, .06), transparent 70%); color: var(--ink-2); font-size: 13.5px; line-height: 1.6; animation: fade .4s both; }
    .story strong { color: var(--ink); font-weight: 600; }
    .story-mark { flex: none; width: 18px; height: 18px; margin-top: 2px; color: var(--amber); }
    .story-mark svg { width: 100%; height: 100%; }
  `,
})
export class StoryText {
  @Input() parts: StoryPart[] = [];

  isData(part: StoryPart): part is { b: string } {
    return typeof part !== 'string';
  }
}
