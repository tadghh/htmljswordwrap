// text-highlighter.test.js
import { TextHighlighter } from "./wordWorker.js";
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
// First, extend the TextHighlighter class for testing


describe('TextHighlighter', () => {
  let textHighlighter;
  // let hoverableDiv;
  // let output;
  // let outputHover;
  // const array2D = [
  //   [0, 0], [1, 73],
  //   [2, 140], [3, 207],
  //   [4, 273], [5, 344],
  //   [6, 415], [7, 486],
  //   [8, 557], [9, 629],
  //   [10, 700], [11, 768],
  //   [12, 837], [13, 909]
  // ];
  // Setup mock DOM environment before each test
  beforeEach(() => {
    // Setup our document body
    document.body.innerHTML = `
    <body style="width: 420px;">
          <div id="hoverable" style="font-size: 20px; font-family: serif; display: inline;">Whenever a pirate vessel comes into view, they all take turns looking at
it through the sight, playing with all the different sensor modes:
visible, infrared, and so on. Eliot has spent enough time knocking around
the Rim that he has become familiar with the colors of the different
pirate groups, so by examining them through the sight he can tell who they
are: Clint Eastwood and his band parallel them for a few minutes one day,
checking them out, and the Magnificent Seven send out one of their small
boats to zoom by them and look for potential booty. Hiro's almost hoping
they get taken prisoner by the Seven, because they have the nicest looking
pirate ship: a former luxury yacht with Exocet launch tubes kludged to the
foredeck. But this reconnaissance leads nowhere. The pirates, unschooled
in thermodynamics, do not grasp the implications of the eternal plume of
			steam coming from beneath the life raft.</div>
          <div id="output"></div>
          <div id="outputHover"></div>
      </body>`;

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 580,
      height: 800,
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

      expect(textHighlighter.startLetterIndex).toBe(-1);
      expect(textHighlighter.endLetterIndex).toBe(-1);
      expect(textHighlighter.mouseCol).toBe(0);
      expect(textHighlighter.mouseColSafe).toBe(0);
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

  describe('Index Finding', () => {
    test('should find correct start index', () => {

      const result = textHighlighter.findStartIndexFromIndex(12);
      expect(result).toBe(0);
    });

    test('find start index on itself', () => {

      const result = textHighlighter.findStartIndexFromIndex(73);
      expect(result).toBe(73);
    });
  });

  describe('Y Value from index Calculations', () => {
    test('should calculate correct Y value for given index', () => {
      const result = textHighlighter.findYValueFromIndex(5);
      expect(typeof result).toBe('number');
    });

    test('should calculate correct Y value for given index on start col', () => {
      const result = textHighlighter.findYValueFromIndex(73);
      expect(result).toBe(57.142857142857146);
    });

    test('should calculate correct Y value for given index on end col', () => {
      const result = textHighlighter.findYValueFromIndex(139);
      expect(result).toBe(57.142857142857146);
    });

    test('should handle index beyond text length', () => {
      const lastIndex = textHighlighter.contentTextCleaned.length + 10;
      const result = textHighlighter.findYValueFromIndex(lastIndex);
      expect(result).not.toBeNull();
    });

    test('last row last index', () => {
      const lastIndex = textHighlighter.contentTextCleaned.length;
      const result = textHighlighter.findYValueFromIndex(lastIndex);
      //console.log(textHighlighter.wordStats)
      expect(result).toBe(742.8571428571429);
    });

    test('on edge last index', () => {
      const lastIndex = 909;
      const result = textHighlighter.findYValueFromIndex(lastIndex);
      expect(result).toBe(742.8571428571429);
    });

    test('first col 0', () => {
      const lastIndex = 0;
      const result = textHighlighter.findYValueFromIndex(lastIndex);
      expect(result).toBe(0);
    });
  });

  describe('Find col from index', () => {
    test('should handle middle index', () => {
      const lastIndex = 486;
      const result = textHighlighter.findColFromIndex(lastIndex);
      expect(result).toBe(7);
    });
  });

  describe('Get width Calculations', () => {
    test('should calculate correct Y value for given index', () => {
      const startIndex = 1;

      const result = textHighlighter.getPaddingForIndex(startIndex);
      expect(typeof result).toBe('number');
    });

    test('should handle index beyond text length', () => {

      const startIndex = 0;
      const result = textHighlighter.getPaddingForIndex(startIndex);
      expect(result).not.toBeNull();
    });

    test('No padding start on last row', () => {
      const startIndex = 909;
      const result = textHighlighter.getPaddingForIndex(startIndex);
      expect(result).toBe(0);
    });
    // TODO fix zero width
    // TODO fix its null because 0 or something, returning
    test('on edge last index', () => {

      const startIndex = textHighlighter.contentTextCleaned.length - 1;
      console.log(startIndex)
      const result = textHighlighter.getPaddingForIndex(startIndex);
      expect(result).toBe(32);
    });

    test('first col 0', () => {

      const result = textHighlighter.getPaddingForIndex(startIndex);
      const startIndex = 0;
      expect(result).toBe(0);
    });
  });
});