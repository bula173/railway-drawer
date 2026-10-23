import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';
/**
 * @file scenario-autoplay.ts
 * @brief Timer of the scenario view's autoplay: advances one step per interval, stops at the last
 *        step (or wraps to the first with "loop"). Settings (interval, loop) are remembered in
 *        localStorage `rd.scenario.autoplay`.
 */

export const AUTOPLAY_KEY = STORAGE_KEYS.scenarioAutoplay;
export const AUTOPLAY_INTERVALS = [1, 2, 3, 5, 10, 20] as const;
export const DEFAULT_AUTOPLAY_SECONDS = 3;

export interface AutoplaySettings {
  seconds: number;
  loop: boolean;
}

export function readAutoplaySettings(): AutoplaySettings {
  try {
    const raw = JSON.parse(readItem(AUTOPLAY_KEY) ?? 'null') as Partial<AutoplaySettings> | null;
    const seconds = Number(raw?.seconds);
    return {
      seconds: Number.isFinite(seconds) && seconds >= 0.2 && seconds <= 600 ? seconds : DEFAULT_AUTOPLAY_SECONDS,
      loop: raw?.loop === true,
    };
  } catch {
    return { seconds: DEFAULT_AUTOPLAY_SECONDS, loop: false };
  }
}

export function writeAutoplaySettings(settings: AutoplaySettings): void {
  try {
    writeItem(AUTOPLAY_KEY, JSON.stringify(settings));
  } catch {
    // storage blocked: kept for this page only
  }
}

export interface AutoplayHost {
  /** Current 0-based step index and step count (null: nothing shown). */
  position(): { index: number; total: number } | null;
  /** Shows step `index`. */
  show(index: number): void;
  /** Play state changed (button label). */
  onChange?(playing: boolean): void;
}

export class ScenarioAutoplay {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private settings: AutoplaySettings = readAutoplaySettings();

  constructor(private readonly host: AutoplayHost) {}

  isPlaying(): boolean {
    return this.timer !== null;
  }

  getSettings(): AutoplaySettings {
    return { ...this.settings };
  }

  setSettings(change: Partial<AutoplaySettings>): void {
    this.settings = { ...this.settings, ...change };
    writeAutoplaySettings(this.settings);
    if (this.isPlaying()) this.schedule();
  }

  /** Starts playing; at the last step (without loop) it first goes back to step 1. */
  play(): void {
    const pos = this.host.position();
    if (!pos || pos.total < 2) return;
    if (pos.index >= pos.total - 1 && !this.settings.loop) this.host.show(0);
    this.schedule();
    this.host.onChange?.(true);
  }

  pause(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.host.onChange?.(false);
  }

  toggle(): void {
    if (this.isPlaying()) this.pause();
    else this.play();
  }

  /** A manual step change while playing restarts the interval. */
  restartInterval(): void {
    if (this.isPlaying()) this.schedule();
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tick(), Math.round(this.settings.seconds * 1000));
  }

  private tick(): void {
    this.timer = null;
    const pos = this.host.position();
    if (!pos) {
      this.host.onChange?.(false);
      return;
    }
    if (pos.index < pos.total - 1) {
      this.host.show(pos.index + 1);
    } else if (this.settings.loop && pos.total > 1) {
      this.host.show(0);
    } else {
      this.host.onChange?.(false);
      return;
    }
    const after = this.host.position();
    if (after && (after.index < after.total - 1 || this.settings.loop)) this.schedule();
    else this.host.onChange?.(false);
  }
}
