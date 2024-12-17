export class TextCalibrator {
  constructor(highlightedDivId) {
    this.widthSums = new Map();
    this.highlightedDiv = document.getElementById(highlightedDivId);
    this.contentTextCleaned = this.highlightedDiv.textContent
      .trim()
      .replace(/\t/g, "")
      .replace(/\n/g, " ");

    this.wordArray = this.contentTextCleaned
      .split(" ")
      .map((word, i, arr) => i < arr.length - 1 ? word + " " : word);
    this.widthCache = {};

    this.context = document.createElement("canvas").getContext("2d");
    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontSizeRaw = Number.parseFloat(this.fontSize);
    this.fontFamily = computedStyle.fontFamily;
    this.lineHeight = parseFloat(computedStyle.fontSize) * 1.2;
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.context.font = `${this.fontSize} ${this.fontFamily}`;

    this.characterWidth = this.#getCharacterWidth(" ");
    this.wordStats = this.calcWordPositions();
  }

  getHighlightAreaTopPadding() {
    return this.divRect.top;
  }

  getEndIndex(mouseColSafe) {
    return mouseColSafe === this.getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[mouseColSafe + 1][1] - 1;
  }

  getIndexFromMouse(relativeX, mouseColSafe) {
    return this.getLetterIndexByWidth(this.wordStats[mouseColSafe][1], mouseColSafe === this.getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[mouseColSafe + 1][1], relativeX)
  }

  getTotalAreaWidth() {
    const textNode = this.highlightedDiv.firstChild; // Assuming the text node is the first child
    let exactWidth = 0
    if (textNode.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const { width } = range.getBoundingClientRect();
      exactWidth = width
    }
    return exactWidth
  }

  getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.getCharacterWidth(char), 0);
  }

  getStartIndexForIndex(index) {
    // Handle edge cases
    if (index === 0) {
      return 0;
    }

    let lastSize = this.wordStats[this.getWordColCount()][1];
    if (lastSize <= index) {
      return lastSize;
    }

    // Convert wordStats to array for binary search
    const entries = Object.values(this.wordStats);
    let left = 0;
    let right = entries.length - 1;

    // If index is less than first entry's size, return 0
    if (index < entries[0][1]) {
      return 0;
    }

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const currentSize = entries[mid][1];

      // Exact match on boundary
      if (index === currentSize) {
        return currentSize;
      }

      // Check if index falls between current and previous size
      const prevSize = mid > 0 ? entries[mid - 1][1] : 0;
      if (prevSize < index && index < currentSize) {
        return prevSize;
      }

      if (currentSize > index) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

  getCumulativeWidthInsideIndexRange(startIndex, endIndex) {
    if (startIndex < 0 || endIndex < 0) return null
    let cumulativeWidth = 0;
    for (let i = startIndex; i < this.contentTextCleaned.length; i++) {
      if (i == endIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  // Binary search for letter index based on width
  getLetterIndexByWidth(startIndex, endIndex, targetWidth) {
    let low = startIndex;
    let high = endIndex;

    // First check if we're beyond the total width
    const totalWidth = this.getCumulativeWidthForIndexRange(startIndex, endIndex);
    if (targetWidth >= totalWidth) {
      return endIndex - 1;
    }

    while (low <= high) {
      const mid = Math.ceil((low + high) / 2);

      // Get width up to mid (exclusive)
      const widthToMid = this.getCumulativeWidthForIndexRange(startIndex, mid + 1);

      if (widthToMid === targetWidth) {
        return mid;
      }

      if (widthToMid < targetWidth) {
        // Check if adding the next character would exceed target
        const widthToNext = this.getCumulativeWidthForIndexRange(startIndex, mid + 2);
        if (mid + 1 <= high && widthToNext > targetWidth) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        // Check if removing the current character would be less than target
        const widthToPrev = this.getCumulativeWidthForIndexRange(startIndex, mid);
        if (mid - 1 >= low && widthToPrev < targetWidth) {
          return mid;
        }
        high = mid - 1;
      }
    }

    return low;
  }

  getCumulativeWidthForIndexRange(startIndex, endIndex) {
    const key = `${startIndex}-${endIndex}`;
    if (!this.widthSums.has(key)) {
      let sum = 0;
      for (let i = startIndex; i <= endIndex; i++) {
        sum += this.getCharacterWidth(this.contentTextCleaned[i]);
      }
      this.widthSums.set(key, sum);
    }
    return this.widthSums.get(key);
  }

  // Creates an array that corresponds to the text on screen
  calcWordPositions() {
    // Preallocate array with reasonable size to avoid resizing
    const widthCache = [[0, 0]];
    const maxWidth = Math.ceil(this.#getHighlightAreaMaxWidth());
    const bufferWidth = maxWidth + this.characterWidth;

    // Local variables for better performance
    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;


    for (const word of this.wordArray) {
      const currentWordWidth = this.#getWordWidth(word);
      const testWidth = currentWidth + currentWordWidth;
      // Avoid the endsWith check if possible by doing arithmetic
      const extra = word[word.length - 1] === ' ' ? 0 : -this.characterWidth;

      if (testWidth <= bufferWidth + extra) {
        currentWidth = testWidth;
      } else if (testWidth <= maxWidth) {
        currentWidth = testWidth;
      } else {
        widthCache.push([wordColumnIndex, currentStringIndex]);
        wordColumnIndex++;
        currentWidth = currentWordWidth;
      }

      currentStringIndex += word.length;
    }

    return widthCache;
  }

  // Gets the cumulative width of the given word
  #getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.#getCharacterWidth(char), 0);
  }

  #getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(0));
    }
    return this.widthCache[char];
  }

  #getTotalAreaWidth() {
    const textNode = this.highlightedDiv.firstChild; // Assuming the text node is the first child
    let exactWidth = 0
    if (textNode.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const { width } = range.getBoundingClientRect();
      exactWidth = width
    }
    return exactWidth
  }

  // gets the max width of the highlight area
  #getHighlightAreaMaxWidth() {
    return this.#getTotalAreaWidth()
  }

  getTextContentVerticalSectionCount() {
    return this.divRect.height / (this.wordStats.length);
  }

  getWordColCount() {
    return this.wordStats.length - 1
  }

  getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(0));
    }
    return this.widthCache[char];
  }

  calcColsInRange(startIndex, endIndex) {
    return (this.getColumnForIndex(endIndex) - this.getColumnForIndex(startIndex)) + 1
  }

  // Gets the column for the given index
  getColumnForIndex(index) {
    // Handle case where index is beyond the last size
    let lastSize = this.wordStats[this.getWordColCount()][1];
    if (lastSize <= index) {
      return this.wordStats[this.getWordColCount()][0];
    }

    // Convert wordStats to array for binary search
    const entries = Object.values(this.wordStats);
    let left = 0;
    let right = entries.length - 1;

    // If index is less than first entry's size, return null
    if (index < entries[0][1]) {
      return null;
    }

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const currentSize = entries[mid][1];
      const nextSize = mid + 1 < entries.length ? entries[mid + 1][1] : Infinity;

      // Check if index falls between current and next size
      if (currentSize <= index && index < nextSize) {
        return entries[mid][0];
      }

      if (currentSize > index) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

  getPaddingForIndex(index) {
    if (index < 0) return null;

    const colStartIndex = this.getStartIndexForIndex(index);
    if (colStartIndex < 0) return null;

    // Early return if the index is the start of the column
    if (index === colStartIndex) return 0;

    let cumulativeWidth = 0;
    // Direct iteration avoids memory allocation from slice()
    for (let i = colStartIndex; i < index; i++) {
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
    }
    return cumulativeWidth;
  }

  recalibrate() {
    this.wordStats = this.calcWordPositions();
    this.divRect = this.highlightedDiv.getBoundingClientRect();
  }
}