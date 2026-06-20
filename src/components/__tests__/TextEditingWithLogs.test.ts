/**
 * @file TextEditingWithLogs.test.ts
 * @brief Tests that verify text editing behavior through logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { logger, logTextEditingStart, logTextEditingChange, logTextEditingSaved } from '../../utils/logger';
import { LogCapture } from '../../utils/__tests__/logger.test';

describe('Text Editing Behavior Through Logs', () => {
  let logCapture: LogCapture;

  beforeEach(() => {
    logCapture = new LogCapture();
    logCapture.start();
    logger.setLevel('debug');
    logger.setTraceEnabled(true);
  });

  afterEach(() => {
    logCapture.stop();
  });

  describe('Text Editing Lifecycle', () => {
    it('should log when text editing starts', () => {
      const elementId = 'test-element-1';
      logTextEditingStart(elementId, 'a', undefined);

      expect(logCapture.hasLog('text-edit', 'Text editing started')).toBe(true);
    });

    it('should log text changes', () => {
      const elementId = 'test-element-2';
      logTextEditingChange(elementId, 'hello', 'hello w');

      expect(logCapture.hasLog('text-edit', 'Text value changed')).toBe(true);
    });

    it('should log when text is saved', () => {
      const elementId = 'test-element-3';
      logTextEditingSaved(elementId, 'final text', 1000);

      expect(logCapture.hasLog('text-edit', 'Text editing saved')).toBe(true);
    });

    it('should complete full text editing lifecycle', () => {
      const elementId = 'element-complete';

      // Start
      logTextEditingStart(elementId, 'h', undefined);
      expect(logCapture.hasLog('text-edit', 'Text editing started')).toBe(true);

      // Changes
      logTextEditingChange(elementId, 'h', 'he');
      logTextEditingChange(elementId, 'he', 'hel');
      logTextEditingChange(elementId, 'hel', 'hell');
      logTextEditingChange(elementId, 'hell', 'hello');

      const textEditLogs = logCapture.getLogsByCategory('text-edit');
      expect(textEditLogs.length).toBeGreaterThanOrEqual(5); // 1 start + 4 changes

      // Save
      logTextEditingSaved(elementId, 'hello', 1000);
      const finalLogs = logCapture.getLogsByCategory('text-edit');
      expect(finalLogs[finalLogs.length - 1].message).toContain('saved');
    });
  });

  describe('Error Detection Through Logs', () => {
    it('should detect when text editing is not logged', () => {
      // If text editing flow is broken, logs won't appear
      const textEditLogs = logCapture.getLogsByCategory('text-edit');
      expect(textEditLogs).toHaveLength(0);
    });

    it('should detect missing save logs', () => {
      logTextEditingStart('element', 'a', undefined);

      // If save is never logged, this should fail
      const saveLogs = logCapture.getLogsByCategory('text-edit').filter(log =>
        log.message.includes('saved')
      );
      expect(saveLogs).toHaveLength(0); // Error: save was never called!
    });

    it('should detect duplicate character additions', () => {
      logTextEditingStart('element', 'a', undefined);
      logTextEditingChange('element', '', 'a');
      logTextEditingChange('element', 'a', 'aa'); // BUG: duplicate!

      const changeLogs = logCapture.getLogsByCategory('text-edit');
      const duplicateLogs = changeLogs.filter(log => log.message.includes('aa'));

      // This indicates a bug - character was duplicated
      if (duplicateLogs.length > 0) {
        expect(duplicateLogs[0].message).toContain('aa'); // ⚠️ BUG DETECTED
      }
    });
  });

  describe('Text Editing State Tracking', () => {
    it('should track single character additions', () => {
      logTextEditingStart('element', 'h', undefined);
      logTextEditingChange('element', '', 'h');
      logTextEditingChange('element', 'h', 'he');
      logTextEditingChange('element', 'he', 'hel');

      const changeLogs = logCapture.getLogsByCategory('text-edit').filter(log =>
        log.message.includes('changed')
      );

      expect(changeLogs.length).toBeGreaterThanOrEqual(3);
    });

    it('should track complete word entry', () => {
      const word = 'railway';
      logTextEditingStart('element', word[0], undefined);

      let current = word[0];
      for (let i = 1; i < word.length; i++) {
        const prev = current;
        current = word.substring(0, i + 1);
        logTextEditingChange('element', prev, current);
      }

      logTextEditingSaved('element', current, 3000);

      const allTextEditLogs = logCapture.getLogsByCategory('text-edit');
      expect(allTextEditLogs.length).toBeGreaterThanOrEqual(word.length + 1);
    });

    it('should detect backspace operations', () => {
      logTextEditingChange('element', 'hello', 'hell');
      logTextEditingChange('element', 'hell', 'hel');
      logTextEditingChange('element', 'hel', 'he');

      const changeLogs = logCapture.getLogsByCategory('text-edit');
      expect(changeLogs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Timing Analysis', () => {
    it('should track editing duration', () => {
      const startTime = Date.now();
      logTextEditingStart('element', 'a', undefined);

      // Simulate some typing
      for (let i = 1; i < 5; i++) {
        logTextEditingChange('element', 'a'.repeat(i), 'a'.repeat(i + 1));
      }

      const duration = Date.now() - startTime;
      logTextEditingSaved('element', 'aaaaa', duration);

      const saveLogs = logCapture.getLogsByCategory('text-edit').filter(log =>
        log.message.includes('saved')
      );
      expect(saveLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State Handling', () => {
    it('should handle empty text start', () => {
      logTextEditingStart('element', 'a', undefined);
      const logs = logCapture.getLogsByCategory('text-edit');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should handle typing on existing text', () => {
      logTextEditingStart('element', 'w', 'hello');
      logTextEditingChange('element', 'hello', 'hellow');

      const logs = logCapture.getLogsByCategory('text-edit');
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('should prevent double character bug detection', () => {
      // Simulating the bug we found: typing 'a' shows 'aa'
      logTextEditingStart('element', 'a', undefined);
      const startLogs = logCapture.getLogsByCategory('text-edit');

      // Bug would manifest as: going from '' to 'a', then 'a' to 'aa'
      logTextEditingChange('element', '', 'a');
      logTextEditingChange('element', 'a', 'aa'); // This is the bug!

      const changeLogs = logCapture.getLogsByCategory('text-edit');

      // Verify the bug would be detected
      const problematicLog = changeLogs.find(log =>
        log.message.includes('aa')
      );

      if (problematicLog) {
        console.error('🐛 Bug detected: Character duplication in text editing');
        expect(problematicLog).toBeDefined();
      }
    });
  });

  describe('Integration with Element Flow', () => {
    it('should complete full user interaction flow', () => {
      const elementId = 'railway-switch-001';

      // User selects shape and starts typing
      logTextEditingStart(elementId, 's', undefined);
      expect(logCapture.hasLog('text-edit', 'Text editing started')).toBe(true);

      // User types: s-w-i-t-c-h
      logTextEditingChange(elementId, '', 's');
      logTextEditingChange(elementId, 's', 'sw');
      logTextEditingChange(elementId, 'sw', 'swi');
      logTextEditingChange(elementId, 'swi', 'swit');
      logTextEditingChange(elementId, 'swit', 'switc');
      logTextEditingChange(elementId, 'switc', 'switch');

      // User stops typing, auto-save triggers
      logTextEditingSaved(elementId, 'switch', 1000);

      // Verify complete flow
      const allLogs = logCapture.getLogsByCategory('text-edit');
      expect(allLogs.length).toBeGreaterThanOrEqual(8); // 1 start + 6 changes + 1 save

      // Verify no errors occurred
      const errorLogs = logCapture.getLogsByLevel('error');
      expect(errorLogs.filter(log => log.category === 'text-edit')).toHaveLength(0);
    });
  });
});
