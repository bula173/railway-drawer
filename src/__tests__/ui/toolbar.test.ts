/**
 * Toolbar chrome (src/ui/toolbar.ts): every icon is valid SVG markup, buttons get their accessible
 * name and a tooltip with the real shortcut, the Align / distribute dropdown follows the menu
 * button keyboard pattern.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { applyInlineIcons, decorateToolbarButtons, installToolbar, setInlineIcon } from '../../ui/toolbar';
import { TOOLBAR_ICONS, createToolbarIcon } from '../../core/icons';
import indexHtml from '../../../index.html?raw';
import { shortcutForAction } from '../../ui/shortcut-keys';
import { registerAppCommands } from '../../ui/commands';

// tooltips show the commands' shortcuts
registerAppCommands();

describe('toolbar icons', () => {
  it('every icon parses to SVG elements only (no text, no emoji)', () => {
    for (const [name, body] of Object.entries(TOOLBAR_ICONS)) {
      const svg = createToolbarIcon(name)!;
      expect(svg.getAttribute('aria-hidden'), name).toBe('true');
      expect(svg.children.length, name).toBeGreaterThan(0);
      expect(svg.textContent, name).toBe('');
      expect(body, name).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const child of Array.from(svg.children)) expect(['path', 'rect', 'circle', 'ellipse'], name).toContain(child.localName);
    }
    expect(createToolbarIcon('nope')).toBeNull();
  });

  it('decorates buttons: icon, aria-label, tooltip with the shortcut', () => {
    document.body.innerHTML = '<div id="tb"><button data-icon="undo" data-label="Undo" data-shortcut="undo"></button><button data-icon="grid" data-label="Grid"></button></div>';
    decorateToolbarButtons(document.getElementById('tb')!);
    decorateToolbarButtons(document.getElementById('tb')!);
    const [undo, grid] = Array.from(document.querySelectorAll('button'));
    expect(undo.querySelectorAll('svg')).toHaveLength(1);
    expect(undo.getAttribute('aria-label')).toBe('Undo');
    expect(undo.title).toBe(`Undo (${shortcutForAction('undo')})`);
    expect(grid.title).toBe('Grid');
  });
});

describe('Align / distribute dropdown', () => {
  beforeAll(() => {
    document.body.innerHTML = `
      <div class="menu-dropdown"><div data-action="railwayRoute:toggleKmRuler" aria-checked="false"></div></div>
      <div id="toolbar-container"><button id="btn-align" data-icon="align" data-label="Align"></button>
        <button id="btn-km-ruler" data-icon="ruler" data-label="km ruler" data-mirror-action="railwayRoute:toggleKmRuler"></button></div>
      <div id="align-menu" role="menu" hidden>
        <button role="menuitem" id="btn-align-top">Top</button><button role="menuitem" id="btn-align-left">Left</button>
      </div>`;
    installToolbar();
  });

  it('opens on click with the first item focused, arrows move, Escape closes back to the button', () => {
    const button = document.getElementById('btn-align')!;
    const menu = document.getElementById('align-menu')!;
    button.click();
    expect(menu.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.id).toBe('btn-align-top');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement?.id).toBe('btn-align-left');
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
    // an item click closes it too
    button.click();
    document.getElementById('btn-align-left')!.click();
    expect(menu.hidden).toBe(true);
  });

  it('mirrors the menu item state as aria-pressed', async () => {
    const button = document.getElementById('btn-km-ruler')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    document.querySelector('[data-action="railwayRoute:toggleKmRuler"]')!.setAttribute('aria-checked', 'true');
    await Promise.resolve();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('chrome without emoji', () => {
  it('index.html has no emoji (logo, Share, Properties text alignment use inline SVG icons)', () => {
    expect(indexHtml).not.toMatch(/\p{Extended_Pictographic}|[\u2B05-\u2B07]|\uFE0F/u);
    for (const name of ['train', 'share', 'textLeft', 'textCenter', 'textRight', 'valignTop', 'valignMiddle', 'valignBottom']) {
      expect(indexHtml, name).toContain(`data-rd-icon="${name}"`);
    }
  });

  it('applyInlineIcons prepends one icon, names icon-only buttons by their title; setInlineIcon swaps it', () => {
    document.body.innerHTML = '<div id="r"><button data-rd-icon="share" title="Share it">Share</button><button data-rd-icon="eye" title="Hide layer"></button></div>';
    const root = document.getElementById('r')!;
    applyInlineIcons(root);
    applyInlineIcons(root);
    const [share, eye] = Array.from(root.querySelectorAll('button'));
    expect(share.querySelectorAll('svg.rd-icon')).toHaveLength(1);
    expect(share.getAttribute('aria-label')).toBeNull();
    expect(share.title).toBe('Share it');
    expect(eye.getAttribute('aria-label')).toBe('Hide layer');
    setInlineIcon(eye, 'eyeOff');
    expect(eye.querySelectorAll('svg.rd-icon')).toHaveLength(1);
    expect(eye.dataset.rdIcon).toBe('eyeOff');
  });
});
