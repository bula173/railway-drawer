/**
 * @file project-section.ts
 * @brief The print sheets' part of the project file (services/project-sections.ts): the document's
 *        title block (`rdTitleBlock`, JSON) and revision table (`rdRevisions`, JSON) as attributes
 *        of the main page's `<diagram>` (draw.io keeps unknown `<diagram>` attributes). Imported for
 *        its registration by ui/saveload.ts (and the unit test setup); adds the typed `titleBlock`
 *        to DiagramDocument, ProjectService and ParsedProject.
 */
import { defineSectionAccessor } from '../document/diagram-document';
import { registerProjectSection } from '../services/project-sections';
import { TitleBlockStore, isEmptyTitleBlock, sanitizeRevisions, sanitizeTitleBlock, type RevisionRow, type TitleBlockValues } from './title-block';

export const PRINT_SECTION = 'titleBlock';
export const TITLE_BLOCK_ATTR = 'rdTitleBlock';
export const REVISIONS_ATTR = 'rdRevisions';

interface ParsedTitleBlock {
  values: TitleBlockValues;
  revisions: RevisionRow[];
}

declare module '../document/diagram-document' {
  interface DiagramDocument {
    /** Title block and revision table of this document (src/print); saved on the main page's `<diagram>`. */
    readonly titleBlock: TitleBlockStore;
  }
}

declare module '../services/project-service' {
  interface ProjectService {
    readonly titleBlock: TitleBlockStore;
  }
  interface ParsedProject {
    /** The main page's title block and revisions. */
    titleBlock: ParsedTitleBlock;
  }
}

function parseJson(text: string | null | undefined): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The `<diagram>` attributes of a title block store (none when empty). */
export function titleBlockAttributes(store: TitleBlockStore): Record<string, string> {
  const out: Record<string, string> = {};
  const values = store.get();
  if (!isEmptyTitleBlock(values)) {
    const compact = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== '' && !(key === 'lang' && value === 'pl')));
    out[TITLE_BLOCK_ATTR] = JSON.stringify(compact);
  }
  const rows = store.revisions();
  if (rows.length > 0) out[REVISIONS_ATTR] = JSON.stringify(rows);
  return out;
}

const empty = (): ParsedTitleBlock => ({ values: sanitizeTitleBlock(null), revisions: [] });

registerProjectSection<TitleBlockStore, ParsedTitleBlock>({
  key: PRINT_SECTION,
  order: 30,
  create: () => new TitleBlockStore(),
  mainPageAttributes: (store) => titleBlockAttributes(store),
  parse: (mainPage) =>
    mainPage
      ? { values: sanitizeTitleBlock(parseJson(mainPage.getAttribute(TITLE_BLOCK_ATTR))), revisions: sanitizeRevisions(parseJson(mainPage.getAttribute(REVISIONS_ATTR))) }
      : empty(),
  empty,
  load: (store, parsed) => store.replace(parsed?.values ?? empty().values, parsed?.revisions ?? []),
  toCache: (store) => {
    const attrs = titleBlockAttributes(store);
    return Object.keys(attrs).length > 0 ? { values: store.get(), revisions: store.revisions() } : undefined;
  },
  fromCache: (store, cached) => {
    const c = cached && typeof cached === 'object' ? (cached as Record<string, unknown>) : {};
    store.replace(sanitizeTitleBlock(c.values), sanitizeRevisions(c.revisions));
  },
  subscribe: (store, listener) => store.subscribe(listener),
});
defineSectionAccessor(PRINT_SECTION);
