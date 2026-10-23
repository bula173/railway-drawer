/**
 * @file project-sections.ts
 * @brief Feature parts of the project file, registered by the features themselves.
 *
 * ProjectService (document layer) writes and reads the draw.io `<mxfile>`; features add their own
 * data to it through a ProjectSection: attributes on the main page's `<diagram>`, extra pages
 * after it, and pages of an opened file they claim back (scenarios: one page per step + an index;
 * Railway Script: an attribute). The services layer never imports the features.
 *
 * Sections register when their module is imported (scenarios/project-section.ts,
 * railway-script/project-section.ts; imported by ui/saveload.ts and the unit test setup). Each
 * section also adds its typed property to ProjectService / ParsedProject (module augmentation).
 */

/** A page (2..n) of an opened file claimed by a section, with its model XML. */
export interface ClaimedPage {
  page: Element;
  xml: string;
}

export interface ProjectSection<State = unknown, Parsed = unknown> {
  /** Property name of the section's state on ProjectService and of its value on ParsedProject. */
  readonly key: string;
  /** Write/read order among the sections (attributes and pages follow it). */
  readonly order: number;
  /** A new, empty state (one per ProjectService). */
  create(): State;
  /** Attributes of the main page's `<diagram>`. */
  mainPageAttributes(state: State): Record<string, string>;
  /** Pages written after the main page (serialised `<diagram>` elements); `usedIds` are taken page ids. */
  pages?(state: State, usedIds: Set<string>): string[];
  /** Whether a page (2..n) of an opened file is this section's (it is then parsed, not kept as a page). */
  claimsPage?(page: Element): boolean;
  /** The section's value of an opened `<mxfile>`. */
  parse(mainPage: Element | undefined, claimed: ClaimedPage[]): Parsed;
  /** The section's value of files without sections (legacy `<project>`, a bare model). */
  empty(): Parsed;
}

const SECTIONS: ProjectSection[] = [];

/** Registers a section (once per key). */
export function registerProjectSection<State, Parsed>(section: ProjectSection<State, Parsed>): void {
  if (SECTIONS.some((s) => s.key === section.key)) return;
  SECTIONS.push(section as unknown as ProjectSection);
  SECTIONS.sort((a, b) => a.order - b.order);
}

/** The registered sections, in order. */
export function projectSections(): readonly ProjectSection[] {
  return SECTIONS;
}
