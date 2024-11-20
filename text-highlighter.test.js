// text-highlighter.test.js
import { TextHighlighter } from "./wordWorker.js";
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
// First, extend the TextHighlighter class for testing


describe('TextHighlighter', () => {
  let textHighlighter;
  let hoverableDiv;
  let output;
  let outputHover;

  // Setup mock DOM environment before each test
  beforeEach(() => {
    // Setup our document body
    document.body.innerHTML = `
          <div id="hoverable" style="font-size: 16px; font-family: Arial; width: 500px; height: 200px;">
              This is some sample text for testing the highlighting functionality
          </div>
          <div id="output"></div>
          <div id="outputHover"></div>
      `;

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 500,
      height: 200,
      top: 0
    }));

    // Mock canvas context
    const mockContext = {
      font: '',
      measureText: jest.fn(text => ({ width: text.length * 8 })) // Simple mock implementation
    };

    // Mock canvas creation
    document.createElement = jest.fn((tagName) => {
      if (tagName === 'canvas') {
        return {
          getContext: () => mockContext
        };
      }
      return document.createElement(tagName);
    });

    // Get DOM elements
    hoverableDiv = document.getElementById('hoverable');
    output = document.getElementById('output');
    outputHover = document.getElementById('outputHover');

    // Create instance of testable class
    textHighlighter = new TextHighlighter('hoverable', 'output', 'outputHover');
  });

  describe('Constructor', () => {
    test('should initialize with correct properties', () => {
      expect(textHighlighter.widthCache).toEqual({});
      expect(textHighlighter.startLetterIndex).toBe(-1);
      expect(textHighlighter.endLetterIndex).toBe(-1);
      expect(textHighlighter.mouseCol).toBe(0);
      expect(textHighlighter.mouseColSafe).toBe(0);
    });

    test('should properly clean and store text content', () => {
      const expectedText = 'This is some sample text for testing the highlighting functionality';
      expect(textHighlighter.contentTextCleaned).toBe(expectedText);
    });
  });

  describe('Character Width Calculation', () => {
    test('should cache and return character widths', () => {
      const width = textHighlighter.getCharacterWidth('a');
      expect(typeof width).toBe('number');
      expect(textHighlighter.widthCache['a']).toBe(width);

      // Second call should use cached value
      const cachedWidth = textHighlighter.getCharacterWidth('a');
      expect(cachedWidth).toBe(width);
    });
  });

  describe('Word Calculations', () => {
    test('should calculate word positions correctly', () => {
      const words = 'Short test string';
      const stats = textHighlighter.calcWords(words);

      expect(Array.isArray(stats)).toBe(true);
      expect(stats[0]).toEqual([0, 0]);
      expect(stats.length).toBeGreaterThan(0);
    });

    test('should handle text wider than div width', () => {
      const longText = 'This is a very long text that should definitely wrap to the next line because it exceeds the width of the container div element';
      const stats = textHighlighter.calcWords(longText);

      expect(stats.length).toBeGreaterThan(1);
    });
  });

  describe('Index Finding', () => {
    test('should find correct start index', () => {
      const wordStats = [[0, 5], [1, 10], [2, 15]];
      const result = textHighlighter.findStartIndexFromIndex(wordStats, 12);
      expect(result).toBe(10);
    });

    test('should handle index beyond last position', () => {
      const wordStats = [[0, 5], [1, 10]];
      const result = textHighlighter.findStartIndexFromIndex(wordStats, 15);
      expect(result).toBe(10);
    });
  });

  describe('Y Value Calculations', () => {
    test('should calculate correct Y value for given index', () => {
      const result = textHighlighter.findYValueFromIndex(5);
      expect(typeof result).toBe('number');
    });

    test('should handle index beyond text length', () => {
      const lastIndex = textHighlighter.contentTextCleaned.length + 10;
      const result = textHighlighter.findYValueFromIndex(lastIndex);
      expect(result).not.toBeNull();
    });
  });

  describe('Div Value Updates', () => {
    test('should update values when div changes', () => {
      const originalStats = textHighlighter.wordStats.length;

      // Mock new dimensions
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 300, // Smaller width should cause more line breaks
        height: 200,
        top: 0
      }));

      textHighlighter.updateDivValues();

      expect(textHighlighter.divWidth).toBe(300);
      expect(textHighlighter.wordStats.length).toBeGreaterThan(originalStats);
    });
  });
});