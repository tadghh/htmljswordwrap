export class TextHighlighter {
  static TEXT_RENDER_BUFFER = 3;
  // Cache cumulative widths
  #widthSums = new Map();
  constructor(highlightedDiv, outputId, outputHoverId) {
    this.widthCache = {};
    this.startLetterIndex = -1;
    this.endLetterIndex = -1;
    this.mouseCol = 0;
    this.mouseColSafe = 0;
    this.relativeY = 0;
    this.relativeX = 0;
    this.floatingDivsMap = new Map();
    this.floatingSelectionCols = new Map();
    this.floatingSelectionWrapped = new Map();
    this.floatingDivsMapTwo = new Map();
    this.floatingDivsSplit = new Map();

    this.mouseTopOffset = 0;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.highlightedDiv = document.getElementById("highlightedDiv");
    this.output = document.getElementById(outputId);
    this.outputHover = document.getElementById(outputHoverId);

    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontFamily = computedStyle.fontFamily;

    this.divRect = this.highlightedDiv.getBoundingClientRect();

    this.context.font = `${this.fontSize} ${this.fontFamily}`;
    this.contentTextCleaned = this.highlightedDiv.textContent.trim().replace(/\t/g, "").replace(/\n/g, " ");
    this.spaceSize = this.getWordWidth(" ");
    this.wordArray = this.contentTextCleaned.split(" ").map((word, i, arr) =>
      i < arr.length - 1 ? word + " " : word
    );
    this.wordStats = this.calcWordPositions(this.contentTextCleaned);
    console.log("font")
    console.log(parseFloat(this.fontSize))
    console.log(parseFloat(this.fontSize) / 10)
    this.charHoverPadding = this.getCharacterWidth("m") / (parseFloat(this.fontSize) / 10);
    this.#addEventListeners();
  }

  getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(2));
    }
    return this.widthCache[char];
  }

  getLeftPadding() {
    return this.divRect.left
  }

  getTopWordPadding() {
    return this.divRect.top
  }

  getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.getCharacterWidth(char), 0);
  }

  findStartIndexFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastSize = this.wordStats[this.wordStats.length - 1][1]
    if (startLetterIndex == 0) {
      return 0
    }
    if (lastSize <= startLetterIndex) {
      return lastSize
    }
    for (const value of Object.values(this.wordStats)) {
      if (startLetterIndex === value[1]) {
        return value[1];  // Exact match on boundary
      }
      if (startLetterIndex < value[1]) {
        return previousValue ? previousValue[1] : 0;  // Return previous boundary
      }
      previousValue = value;
    }

    return null;
  }

  findColFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastSize = this.wordStats[this.wordStats.length - 1][1]

    if (lastSize <= startLetterIndex) {
      return this.wordStats[this.wordStats.length - 1][0]
    }
    for (const value of Object.values(this.wordStats)) {
      if (startLetterIndex < value[1]) {

        return previousValue ? previousValue[0] : null;
      }
      previousValue = value;
    }

    return null;
  }

  findYValueFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastColIndex = this.wordStats[this.wordStats.length - 1][1]

    if (lastColIndex <= startLetterIndex) {
      return ((this.wordStats.length - 1) * this.getTextYSections()) + this.getTopWordPadding();
    }

    for (const value of Object.values(this.wordStats)) {
      let yPx = (value[0] * this.getTextYSections()) + this.getTopWordPadding();

      if (startLetterIndex < value[1]) {
        console.log(`split on ${yPx} current ${(value[0] * this.getTextYSections())} ${(this.getTextYSections())}  end ${this.getTopWordPadding()} max `)
        return previousValue !== null ? previousValue : yPx;
      }
      previousValue = yPx;
    }

    return null;
  }

  getWidthFromRange(startIndex, yColIndex) {
    if (startIndex < 0 || yColIndex < 0) return null
    // if (yColIndex < startIndex) return null
    let cumulativeWidth = 0;
    for (let i = startIndex; i < this.contentTextCleaned.length; i++) {
      if (i == yColIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  getPaddingForIndex(startIndex) {
    if (startIndex < 0) return null

    let colStartIndex = this.findStartIndexFromIndex(startIndex);

    if (colStartIndex < 0) return null

    let cumulativeWidth = 0;
    for (let i = colStartIndex; i < this.contentTextCleaned.length; i++) {
      if (i == startIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  getMaxWidth() {
    return this.divRect.width
  }
  calcWordPositions() {
    const widthCache = [[0, 0]];
    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;

    const maxWidth = this.getMaxWidth();  // Cache this value
    this.wordArray.forEach((word, iter) => {
      const currentWordWidth = this.getWordWidth(word);
      const testWidth = currentWidth + currentWordWidth;


      // First test: does word fit on current line with space?
      if (testWidth <= maxWidth) {
        currentWidth = testWidth;
      } else {
        // If it doesn't fit, test without trailing space
        // Only subtract space if not last word and word has a space
        const spaceToRemove = (iter === this.wordArray.length - 1 || !word.endsWith(' '))
          ? 0
          : this.spaceSize;
        const endTest = Math.ceil(testWidth - spaceToRemove - 2);



        if (endTest < maxWidth) {
          // Word fits without its trailing space
          currentWidth = endTest;
        } else if (endTest > maxWidth) {
          // Word doesn't fit, wrap to new line

          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
          currentWidth = currentWordWidth;
        } else if (endTest == maxWidth) {
          // Word doesn't fit, wrap to new line

          currentWidth = endTest;
        }
      }
      currentStringIndex += word.length;
    });

    return widthCache;
  }
  getTextYSections() {

    return this.divRect.height / (this.wordStats.length);
  }
  updateDivValues() {
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.wordStats = this.calcWordPositions();
  }

  #handleResizeOrScroll = () => {
    this.updateDivValues();
    this.#repositionItems();
  };

  #calcCols(startIndex, endIndex) {
    // there is always one col
    return (this.findColFromIndex(endIndex) - this.findColFromIndex(startIndex)) + 1
  }

  #positionFloatingComment(element) {
    if (!element) {
      console.warn('Element is undefined or null in positionFloatingComment');
      return;
    }

    const startId = element.getAttribute("start");
    const endId = element.getAttribute("end");

    if (!startId || !endId) {
      console.warn('Missing required attributes (start or end) on element');
      return;
    }

    try {
      let linePadding = this.getPaddingForIndex(startId);
      let top = this.findYValueFromIndex(startId);
      let yCol1 = this.findColFromIndex(startId);
      let yCol2 = this.findColFromIndex(endId);

      if (element.id && element.id.includes("floating-highlighted")) {
        const spanningColCount = this.#calcCols(startId, endId);
        const elementsRawUniqueId = element.getAttribute("rawId");

        if (spanningColCount > 1) {
          element.style.display = "none";
          let lowerCol = yCol1;
          let upperCol = yCol1 + spanningColCount;
          const oldSpanCount = this.floatingSelectionCols.get(elementsRawUniqueId) || 0;

          if (oldSpanCount != spanningColCount) {
            if (spanningColCount >= 2) {
              const splits = document.querySelectorAll(`[rawId="${elementsRawUniqueId}"].split`);
              if (splits.length > 0) {
                let lowestColSplit = null;
                let lowestCol = Infinity;

                splits.forEach(split => {
                  const colVal = parseInt(split.getAttribute("col"));
                  if (colVal < lowestCol) {
                    lowestCol = colVal;
                    lowestColSplit = split;
                  }
                });

                if (lowestColSplit) {
                  const splitId = lowestColSplit.id;
                  this.floatingDivsSplit.delete(splitId);
                  lowestColSplit.remove();
                }
              }
            }

          }
          // Update or set the column count in the map
          this.floatingSelectionCols.set(elementsRawUniqueId, spanningColCount);

          for (let c = lowerCol; c < upperCol; c++) {
            const splitId = `split-${elementsRawUniqueId}-col-${c}`;
            let floatingDiv = this.floatingDivsSplit.get(splitId);
            let isNewDiv = false;

            if (!floatingDiv) {
              floatingDiv = document.createElement("div");
              floatingDiv.id = splitId;
              floatingDiv.className = "floating-highlighted split";
              isNewDiv = true;
            }

            // Set or update attributes and content based on column position
            if (c === lowerCol) {
              // First column
              let firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;
              let firstColStartIndex = startId;
              const selectedText = this.contentTextCleaned.substring(firstColStartIndex, firstColEndIndex);
              floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
              floatingDiv.setAttribute("start", firstColStartIndex);
              floatingDiv.setAttribute("end", firstColEndIndex);
            } else if (c === upperCol - 1) {
              // Last column
              let lastColStartIndex = this.wordStats[c][1];
              const selectedText = this.contentTextCleaned.substring(lastColStartIndex, endId);
              floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
              floatingDiv.setAttribute("start", lastColStartIndex);
              floatingDiv.setAttribute("end", endId);
            } else {
              // Middle columns
              let colStartIndex = this.wordStats[c][1];
              let colEndIndex = this.wordStats[c + 1][1] - 1;
              const selectedText = this.contentTextCleaned.substring(colStartIndex, colEndIndex);
              floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
              floatingDiv.setAttribute("start", colStartIndex);
              floatingDiv.setAttribute("end", colEndIndex);
            }

            floatingDiv.setAttribute("col", c);
            floatingDiv.setAttribute("rawId", elementsRawUniqueId);

            // Update position for all splits (both new and existing)
            const colTop = this.findYValueFromIndex(floatingDiv.getAttribute("start"));
            floatingDiv.style.top = `${colTop - 5 + this.mouseTopOffset}px`;
            const colPadding = this.getPaddingForIndex(floatingDiv.getAttribute("start"));
            floatingDiv.style.left = `${colPadding + this.getLeftPadding() + 2}px`;

            // Only add to map and DOM if it's a new div
            if (isNewDiv) {
              this.floatingDivsSplit.set(splitId, floatingDiv);
              document.body.appendChild(floatingDiv);
            }
          }

          this.floatingSelectionWrapped.set(elementsRawUniqueId, spanningColCount);
        } else if (element.style.display === "none" && (yCol1 === yCol2)) {
          element.style.display = "inline";
          const rowId = element.getAttribute("rawId");

          if (rowId) {
            let splits = document.querySelectorAll(`[rawId="${rowId}"][id*="split"]`);
            splits.forEach(splitElement => {
              if (splitElement) {
                const splitId = splitElement.id;
                this.floatingDivsSplit.delete(splitId);
                splitElement.remove();
              }
            });
          }
        }
      }
      // console.log(this.divRect)
      this.updateDivValues()
      // Apply styles safely
      if (typeof top === 'number' && !isNaN(top)) {
        element.style.top = `${top - 5 + this.mouseTopOffset}px`;
      }

      if (typeof linePadding === 'number' && !isNaN(linePadding) &&
        typeof this.getLeftPadding() === 'number' && !isNaN(this.getLeftPadding())) {
        element.style.left = `${linePadding + this.getLeftPadding() + 2}px`;
      }
    } catch (error) {
      console.error('Error in positionFloatingComment:', error);
    }
  }

  #handleMouseMove = (event) => {
    this.relativeX = event.clientX - this.getLeftPadding();
    this.relativeY = event.clientY - this.getTopWordPadding();
    const wordStatsLengthReal = this.wordStats.length - 1;

    // Single division operation
    this.mouseCol = Math.floor(this.relativeY / this.getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, wordStatsLengthReal));

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === wordStatsLengthReal
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, this.relativeX);

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.getCharacterWidth(char);
      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.#getCumulativeWidth(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}`;
    }

    this.endLetterIndex = letterIndex;
  };

  // Binary search for letter index based on width
  #findLetterIndexByWidth(start, end, targetWidth) {
    let low = start;
    let high = end - 1;
    let cumulativeWidth = 0;

    // First check if we're beyond the total width
    const totalWidth = this.#getCumulativeWidth(start, end);
    if (targetWidth >= totalWidth) {
      return end - 1;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      cumulativeWidth = this.#getCumulativeWidth(start, mid + 1);

      if (cumulativeWidth === targetWidth) {
        return mid;
      }

      if (cumulativeWidth < targetWidth) {
        if (mid + 1 <= high &&
          this.#getCumulativeWidth(start, mid + 2) > targetWidth) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        if (mid - 1 >= low &&
          this.#getCumulativeWidth(start, mid) < targetWidth) {
          return mid;
        }
        high = mid - 1;
      }
    }

    return low;
  }

  #getCumulativeWidth(start, end) {
    const key = `${start}-${end}`;
    if (!this.#widthSums.has(key)) {
      let sum = 0;
      for (let i = start; i < end; i++) {
        sum += this.getCharacterWidth(this.contentTextCleaned[i]);
      }
      this.#widthSums.set(key, sum);
    }
    return this.#widthSums.get(key);
  }

  #handleMouseDown = (event) => {

    const relativeX = event.clientX - this.getLeftPadding();
    let cumulativeWidth = 0;

    for (let i = this.wordStats[this.mouseColSafe][1]; i < this.contentTextCleaned.length; i++) {
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
      if (cumulativeWidth >= relativeX) {
        this.startLetterIndex = i;
        // this.endLetterIndex = i;
        break;
      }
    }

    // if (this.endLetterIndex >= 0 && this.endLetterIndex < this.contentTextCleaned.length) {
    //   this.output.textContent = `Selected text: ${this.contentTextCleaned.slice(
    //     this.startLetterIndex,
    //     this.endLetterIndex + 1
    //   )}`;
    // }
  };

  #handleMouseUp = () => {
    // need the mouse to be over the whole char so consider it selected
    const relativeX = event.clientX - this.getLeftPadding() - this.charHoverPadding;
    let cumulativeWidth = 0;

    for (let i = this.wordStats[this.mouseColSafe][1]; i < this.contentTextCleaned.length; i++) {
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
      if (cumulativeWidth >= relativeX) {
        // this.startLetterIndex = i;
        this.endLetterIndex = i;
        break;
      }
    }

    // if (this.endLetterIndex >= 0 && this.endLetterIndex < this.contentTextCleaned.length) {
    //   this.output.textContent = `Selected text: ${this.contentTextCleaned.slice(
    //     this.startLetterIndex,
    //     this.endLetterIndex + 1
    //   )}`;
    // }
    if (this.startLetterIndex !== -1 && this.endLetterIndex !== -1) {
      this.#createHighlight();
    }
    this.output.textContent = `Selected text: ${this.contentTextCleaned.slice(
      this.startLetterIndex,
      this.endLetterIndex + 1
    )}`;
  };

  #createHighlight() {
    if (this.contentTextCleaned[this.startLetterIndex] === " ") this.startLetterIndex++;
    if (this.contentTextCleaned[this.endLetterIndex] === " ") this.endLetterIndex--;
    if (this.startLetterIndex > this.endLetterIndex) {
      [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
    }

    const uniqueId = `floating-highlighted-${this.startLetterIndex}-${this.endLetterIndex}`;
    const rawUniqueId = `${this.startLetterIndex}-${this.endLetterIndex}`;
    const selectedText = this.contentTextCleaned.slice(this.startLetterIndex, this.endLetterIndex + 1);

    if (!this.floatingDivsMap.has(rawUniqueId)) {
      const floatingDiv = document.createElement("div");
      floatingDiv.id = uniqueId;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
      floatingDiv.setAttribute("start", this.startLetterIndex)
      floatingDiv.setAttribute("end", this.endLetterIndex)
      floatingDiv.setAttribute("rawId", rawUniqueId)
      document.body.appendChild(floatingDiv);
      this.floatingDivsMap.set(rawUniqueId, floatingDiv);
    }
    // Add the div element relative to the span
    this.#positionFloatingComment(this.floatingDivsMap.get(rawUniqueId));
    // Initially position the div
    this.#repositionItems()
  }

  #positionFloatingCommentContent(element) {
    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")
    let yColIndex = this.findStartIndexFromIndex(startId);
    let xCol = this.getWidthFromRange(
      yColIndex,
      endId
    );
    let top = this.findYValueFromIndex(startId);

    element.style.top = `${top + 25}px`;
    element.style.left = `${xCol + this.getLeftPadding() + 2}px`;
  }

  printOutWordStats() {
    let printString = ""
    for (let i = 0; i < this.wordStats.length - 1; i++) {
      const start = this.wordStats[i][1];
      const end = this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)} ${this.getWidthFromRange(start, end)}\n`;
    }
    // Print last line
    const lastIndex = this.wordStats[this.wordStats.length - 1];
    printString += `${this.wordStats.length - 1} ${this.contentTextCleaned.slice(lastIndex[1])}`;
    console.log(printString)
  }

  #addEventListeners() {
    window.addEventListener("resize", this.#handleResizeOrScroll);
    window.addEventListener("scroll", () => {
      this.mouseTopOffset = window.scrollY;
      this.#handleResizeOrScroll();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'g') {
        this.printOutWordStats()
      }
    });
    this.highlightedDiv.addEventListener("mousemove", this.#handleMouseMove);
    this.highlightedDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.highlightedDiv.addEventListener("mouseup", this.#handleMouseUp);
  }

  #repositionItems() {
    this.floatingDivsMapTwo.forEach((div, key) => {
      let hoverItem = document.getElementById(`${key} `);
      if (hoverItem) {
        this.#positionFloatingCommentContent(hoverItem);
      }
    });

    this.floatingDivsMap.forEach((div) => {
      this.#positionFloatingComment(div)
    });
    this.floatingDivsSplit.forEach((div, key) => {
      let hoverItem = document.getElementById(key);
      if (hoverItem) {
        this.#positionFloatingComment(hoverItem)
      }
    });
  }
}
