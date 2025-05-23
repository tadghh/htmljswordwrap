

// Used to determine how text appears on the page
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

    // Get complete font string including weight, style, etc.
    const fontWeight = computedStyle.fontWeight;
    const fontStyle = computedStyle.fontStyle;
    this.fontSize = computedStyle.fontSize;
    this.fontSizeRaw = Number.parseFloat(this.fontSize);
    this.fontFamily = computedStyle.fontFamily;
    this.context.textBaseline = 'alphabetic';
    this.context.textAlign = 'left';
    // Optional: force subpixel rendering
    this.context.imageSmoothingEnabled = false;
    // Construct complete font string in correct order
    this.context.font = `${fontStyle} ${fontWeight} ${this.fontSize} ${this.fontFamily}`;

    // Get actual line height from computed style instead of assuming 1.2
    this.lineHeight = parseFloat(computedStyle.lineHeight) ||
      parseFloat(this.fontSize) * 1.2; // fallback if lineHeight is 'normal'

    // Letter spacing needs to be accounted for
    this.letterSpacing = parseFloat(computedStyle.letterSpacing) || 0;

    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.spaceWidth = this.getCharacterWidth(" ");
    this.wordStats = this.calcWordPositions();
    this.textWidthSensitivity = 0
  }

  // non monospaced fonts are more sensitive. use this if there are graphical glitches
  setTextWidthSensitivity(newSensitivity) {
    this.textWidthSensitivity = newSensitivity
  }

  // gets the end text index for the provided col
  getEndIndex(col) {
    return col === this.getWordColCount()
      ? this.contentTextCleaned.length - 1
      : this.wordStats[col + 1][1] - 1;
  }

  // gets the start text index for the provided col
  getStartIndex(col) {
    return this.wordStats[col][1]
  }

  getIndexFromMouse(relativeX, mouseColSafe) {
    return this.getLetterIndexByWidth(this.getStartIndex(mouseColSafe), this.getEndIndex(mouseColSafe), relativeX)
  }

  // Check if the mouse is over the last index of a row.
  isRangeLastIndex(relativeX, mouseColSafe) {
    return this.wordStats
      .slice(1)
      .some(stat => (stat[1] - 1) === this.getIndexFromMouse(relativeX, mouseColSafe));
  }

  // returns the content thats withing bounds for the given index
  getIndexOnBounds(index) {
    return (this.wordStats[index + 1] ? this.wordStats[index + 1][1] - 1 : this.wordStats[index][1] - 1)
  }

  // gets the exact size of the text node
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

  // gets the width of a word, this includes kerning and other nonsense
  getWordWidth(word) {
    // Measure the whole word at once instead of character by character
    if (this.widthCache[word] === undefined) {
      const width = Number.parseFloat(
        this.context.measureText(word).width.toFixed(this.textWidthSensitivity)
      );
      // Add letter spacing for each character except the last one
      const letterSpacingTotal = this.letterSpacing * (word.length - 1);
      this.widthCache[word] = width + letterSpacingTotal;
    }
    return this.widthCache[word];
  }


  // calculates and returns the offsets for a highlight objects start index
  getHighlighOffsets(startIndexHighlight) {
    const yOffset = this.getTopPaddingForIndex(startIndexHighlight) + this.mouseTopOffset
    const xOffset = this.getPaddingForIndex(startIndexHighlight) + this.getHighlightAreaLeftPadding() + this.mouseLeftOffset
    return [xOffset, yOffset]
  }

  // calculates and returns the offsets for a comment object
  getCommentOffsets(commentObj) {
    const { start: startIndexComment, end: endIndexComment, elem: element } = commentObj;
    const wordWidth = this.getWordWidth(element.textContent);
    const maxWidth = this.getTotalAreaWidth();
    const isOutOfBounds = this.getPaddingForIndex(startIndexComment) + wordWidth > maxWidth;
    const endLineStartIndex = this.getStartIndexForIndex(endIndexComment)
    const isMultiLine = this.calcColsInRange(startIndexComment, endIndexComment) > 1
    const top = this.getTopPaddingForIndex(isMultiLine ? endIndexComment : startIndexComment);
    const yOffset = top + this.fontSizeRaw + this.mouseTopOffset

    let xOffset = this.getPaddingForIndex(startIndexComment)

    // make sure comment doesn't go off screen
    if (isOutOfBounds || isMultiLine) {

      xOffset = this.getCumulativeWidthForIndexRange(endLineStartIndex, endIndexComment) - this.getWordWidth(element.textContent);
    }

    // make sure its not offscreen on the left
    if (xOffset < 0) {
      xOffset = 0
    }

    xOffset += this.getHighlightAreaLeftPadding() + this.mouseLeftOffset

    return [xOffset, yOffset]
  }

  // gets the padding for the top of and index, this would technically be index -1 since we don't include the font size here
  getTopPaddingForIndex(index) {
    // First check if index is beyond the last column
    let lastColIndex = this.wordStats[this.getWordColCount()][1];
    if (lastColIndex <= index) {
      return (this.getWordColCount() * this.getTextContentVerticalSectionCount()) +
        this.getHighlightAreaTopPadding();
    }

    // Binary search to find the correct column
    let left = 0;
    let right = this.getWordColCount();

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const colStats = this.wordStats[mid];

      if (!colStats) break;

      if (index < colStats[1]) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    // Calculate y position using the found column
    return (left - 1) * this.getTextContentVerticalSectionCount() +
      this.getHighlightAreaTopPadding();
  }

  printOutWordStats() {
    let printString = ""
    for (let i = 0; i <= this.getWordColCount(); i++) {
      const start = this.wordStats[i][1];
      const end = (i === this.getWordColCount())
        ? this.contentTextCleaned.length - 1
        : this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)} ${this.getWordWidth(this.contentTextCleaned.slice(start, end))}\n`;
    }

    console.log(printString)
    console.log(this.wordStats)
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
    let holderString = ""
    for (let i = startIndex; i <= endIndex; i++) {
      holderString += this.contentTextCleaned[i]

      if (this.getWordWidth(holderString) >= targetWidth) {
        return i
      }
    }
  }

  getCumulativeWidthForIndexRange(startIndex, endIndex) {
    const key = `${startIndex}-${endIndex}`;
    let safeEndIndex = endIndex < this.contentTextCleaned.length ? endIndex : this.contentTextCleaned.length - 1
    if (!this.widthSums.has(key)) {
      let sum = this.getWordWidth(this.contentTextCleaned.slice(startIndex, safeEndIndex + 1));
      this.widthSums.set(key, sum);
    }
    return this.widthSums.get(key);
  }

  calcWordPositions() {
    const widthCache = [[0, 0]];
    const maxWidth = this.getTotalAreaWidth();
    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentLineString = "";
    // This a margin before the browser considers wrapping a word (testing in firefox)
    let endBuffer = this.spaceWidth + (this.spaceWidth / 10)
    for (const word of this.wordArray) {
      // Add space between words if not first word in line
      const testString = currentLineString.length > 0 ?
        currentLineString + word : word;
      const lineWidth = this.getWordWidth(testString);

      let bad = word.endsWith(" ")
      if (lineWidth <= maxWidth + (!bad ? 0 : endBuffer)) { // small tolerance
        currentLineString = testString;
      }
      // Line is too long, wrap
      else {
        // Don't push empty lines
        if (currentLineString.length > 0) {
          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
          // Start new line with current word
          currentLineString = word;
        } else {
          // Handle case where single word is wider than max width
          currentLineString = word;
          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
        }
      }
      currentStringIndex += word.length;
    }
    return widthCache;
  }

  // gets the width of char given the context. font size and type
  getCharacterWidth(char) {
    const cacheKey = char;
    if (this.widthCache[cacheKey] === undefined) {
      // Get the precise width including letter spacing
      let width = this.context.measureText(char).width;
      // Add letter spacing if it exists
      width += this.letterSpacing;
      // Round to specified precision
      width = Number.parseFloat(width.toFixed(this.textWidthSensitivity));
      this.widthCache[cacheKey] = width;
    }
    return this.widthCache[cacheKey];
  }

  // gets the amount of columns between two indexes
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

  // gets the left padding for the index
  getPaddingForIndex(index) {
    if (index < 0) return null;

    const colStartIndex = this.getStartIndexForIndex(index);
    if (colStartIndex < 0) return null;

    // Early return if the index is the start of the column
    if (index === colStartIndex) return 0;

    // Direct iteration avoids memory allocation from slice()
    let calcString = ""
    for (let i = colStartIndex; i < index; i++) {
      calcString += this.contentTextCleaned[i]
      // cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
    }
    return this.getWordWidth(calcString);
  }
  getPaddingForIndexInclusive(index) {
    if (index < 0) return null;

    const colStartIndex = this.getStartIndexForIndex(index);
    if (colStartIndex < 0) return null;

    // Early return if the index is the start of the column
    if (index === colStartIndex) return 0;

    // Direct iteration avoids memory allocation from slice()
    let calcString = ""
    for (let i = colStartIndex; i <= index; i++) {
      calcString += this.contentTextCleaned[i]
    }
    return this.getWordWidth(calcString);
  }

  // Gets the start index for a given index
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

  getHighlightAreaLeftPadding() {
    return this.divRect.left
  }

  getHighlightAreaTopPadding() {
    return this.divRect.top;
  }

  getTextContentVerticalSectionCount() {
    return this.divRect.height / (this.wordStats.length);
  }

  getWordColCount() {
    return this.wordStats.length - 1
  }

  updateWordCalc() {
    this.wordStats = this.calcWordPositions();
  }
  // updates values
  recalibrate() {
    this.mouseLeftOffset = window.scrollX;
    this.mouseTopOffset = window.scrollY;
    this.divRect = this.highlightedDiv.getBoundingClientRect();
  }
}