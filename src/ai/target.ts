/**
 * @file target.ts
 * @brief What the AI tools operate on: one diagram tab (its graph, undo history, Railway Script
 *        store and session) plus optional services (shape catalogue, templates, image rendering,
 *        downloads, new tabs). The app builds one from the active tab (app-target.ts); tests build
 *        one from a test graph. Keeping this an interface makes the tools testable in jsdom and lets
 *        the shape catalogue grow (feature/all-shapes) without touching the tools.
 */
import type { Graph } from '@maxgraph/core';
import type { PaletteEntry } from '../drawio-shapes/palettes';
import type { RailwayScriptStore } from '../railway-script/script-store';
import type { ApplyOutcome, SessionStatus } from '../railway-script/session';
import type { DiagramTemplate } from '../ui/templates/template-types';

/** The part of ScriptSession the tools use. */
export interface AiScriptSession {
  apply(): Promise<ApplyOutcome>;
  status(): SessionStatus;
  isDirty(): boolean;
}

/** One shape of the catalogue: a palette entry plus where it comes from. */
export interface CatalogShape {
  /** Stable name for add_shapes (`<palette>-<index>-<slug>` = the palette entry id). */
  name: string;
  title: string;
  /** Palette / library title ("General", "ERTMS", "My library"...). */
  palette: string;
  entry: PaletteEntry;
}

/**
 * Shape catalogue. Tolerant on purpose: any source that can list palette entries can back it
 * (draw.io palettes, ERTMS library, user libraries, palettes added later).
 */
export interface ShapeCatalog {
  /** Every shape (loads lazily; may be slow the first time). */
  all(): Promise<CatalogShape[]>;
}

export interface AiTarget {
  /** Graph of the tab the tools act on. */
  readonly graph: Graph;
  /** Tab / project name. */
  tabName(): string;
  readonly scriptStore: RailwayScriptStore;
  /** The tab's Railway Script session (one per tab; created on demand). */
  scriptSession(): Promise<AiScriptSession>;
  undo(): void;
  canUndo(): boolean;
  /** draw.io `<mxGraphModel>` of the tab. */
  modelXml(): string;
  /** The tab as a `.drawio` file (`<mxfile>`). */
  projectXml(): string;
  catalog?: ShapeCatalog;
  templates?(): Promise<DiagramTemplate[]>;
  /** Opens a template as a new tab (and makes it active); returns the tab name. */
  openTemplateInNewTab?(template: DiagramTemplate): string;
  /** PNG (base64, no data: prefix) of a model XML. */
  renderPng?(modelXml: string): Promise<string>;
  /** SVG document text of a model XML. */
  renderSvg?(modelXml: string): Promise<string>;
  /** Saves a file in the user's browser. */
  download?(name: string, content: string | Blob, mime: string): void;
}
