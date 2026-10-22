/**
 * @file project-settings.ts
 * @brief Railway settings of a diagram, stored as draw.io data attributes of the model's root cell
 *        (cell "0": draw.io's Edit Data of the diagram; saved in .drawio files, kept by draw.io),
 *        next to the railML preservation store `rdRailml`.
 *
 * - `rdCountryId`: the default ETCS country / region code NID_C (0–1023) of the diagram. Balise
 *   groups without their own NID_C use it (checks, railML `isEurobaliseGroup countryID`). Missing =
 *   `DEFAULT_COUNTRY_ID` 510 (Poland); an invalid stored value means "no default" (the checks then
 *   warn about every balise group without NID_C).
 *
 * Edited in the Data panel with nothing selected ("Diagram"). One undoable model edit per change.
 */
import type { GraphDataModel } from '@maxgraph/core';
import { isElementValue } from './object-data';
import type { RailObject } from './validation';

export const COUNTRY_ATTR = 'rdCountryId';
/** NID_C used when a diagram does not set its own default (510 = Poland). */
export const DEFAULT_COUNTRY_ID = '510';
export const NID_C_MAX = 1023;

/** The stored attribute of the root cell, or null when it is not set. */
export function readCountryIdRaw(model: GraphDataModel): string | null {
  const value = model.getRoot()?.getValue() as unknown;
  if (!isElementValue(value) || !value.hasAttribute(COUNTRY_ATTR)) return null;
  return value.getAttribute(COUNTRY_ATTR) ?? '';
}

/** A NID_C value as a canonical integer string, or null when it is not an integer 0..1023. */
export function normalizeCountryId(text: string): string | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= NID_C_MAX ? String(n) : null;
}

/** The diagram's default NID_C ('' when the stored value is invalid). */
export function readCountryId(model: GraphDataModel): string {
  const raw = readCountryIdRaw(model);
  if (raw === null || raw.trim() === '') return DEFAULT_COUNTRY_ID;
  return normalizeCountryId(raw) ?? '';
}

/**
 * Sets the diagram's default NID_C ('' or null = back to the built-in default: the attribute is
 * removed). One undoable edit; returns false when nothing changed. Throws on an invalid value.
 */
export function setCountryId(model: GraphDataModel, value: string | null): boolean {
  const root = model.getRoot();
  if (!root) return false;
  const text = (value ?? '').trim();
  const next = text === '' ? null : normalizeCountryId(text);
  if (text !== '' && next === null) throw new Error(`NID_C must be an integer 0–${NID_C_MAX}`);
  const current = root.getValue() as unknown;
  if ((isElementValue(current) ? current.getAttribute(COUNTRY_ATTR) : null) === next) return false;
  let element: Element;
  if (isElementValue(current)) {
    element = current.cloneNode(true) as Element;
  } else {
    if (next === null) return false;
    element = document.implementation.createDocument(null, null, null).createElement('object');
    element.setAttribute('label', typeof current === 'string' ? current : '');
  }
  if (next === null) element.removeAttribute(COUNTRY_ATTR);
  else element.setAttribute(COUNTRY_ATTR, next);
  model.beginUpdate();
  try {
    model.setValue(root, element);
  } finally {
    model.endUpdate();
  }
  return true;
}

/**
 * Fills the diagram defaults into collected objects (in place; `values` are per collection):
 * balise groups without NID_C get the default country. Returns the objects.
 */
export function applyProjectDefaults(objects: RailObject[], countryId: string): RailObject[] {
  if (!countryId) return objects;
  for (const o of objects) {
    if (o.kind.id === 'baliseGroup' && !(o.values.nidC ?? '').trim()) o.values.nidC = countryId;
  }
  return objects;
}
