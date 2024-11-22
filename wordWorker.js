export class TextHighlighter {
  constructor(hoverableDivId, outputId, outputHoverId) {
    this.widthCache = {};
    this.startLetterIndex = -1;
    this.endLetterIndex = -1;
    this.mouseCol = 0;
    this.mouseColSafe = 0;
    this.relativeY = 0;
    this.floatingDivsMap = new Map();
    this.floatingDivsMapTwo = new Map();
    this.floatingDivsSplit = new Map();
    this.mouseTopOffset = 0;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.hoverableDiv = document.getElementById(hoverableDivId);
    this.output = document.getElementById(outputId);
    this.outputHover = document.getElementById(outputHoverId);

    const computedStyle = getComputedStyle(this.hoverableDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontFamily = computedStyle.fontFamily;

    this.divRect = this.hoverableDiv.getBoundingClientRect();
    this.divWidth = this.divRect.width;
    this.divStartY = this.divRect.top;

    this.context.font = `${this.fontSize} ${this.fontFamily}`;
    // console.log(this.context.font)
    this.contentTextCleaned = this.hoverableDiv.textContent.trim().replace(/\t/g, "").replace(/\n/g, " ");
    this.spaceSize = this.getWordWidth(" ");
    this.wordArray = this.contentTextCleaned.split(" ").map((word, i, arr) =>
      i < arr.length - 1 ? word + " " : word
    );
    this.wordStats = this.calcWordPositions(this.contentTextCleaned);
    this.textAreaYSections = this.divRect.height / this.wordStats.length;

    this.#addEventListeners();
  }

  getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = this.context.measureText(char).width;
    }
    return this.widthCache[char];
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
    // chaanf
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
      return ((this.wordStats.length - 1) * this.textAreaYSections) + this.divStartY;
    }

    for (const value of Object.values(this.wordStats)) {
      let yPx = (value[0] * this.textAreaYSections) + this.divStartY;

      if (startLetterIndex < value[1]) {
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

  calcWordPositions() {
    const widthCache = [[0, 0]];


    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;
    this.wordArray.forEach((word, iter) => {
      let currentWordWidth = this.getWordWidth(word)
      let testWidth = currentWidth + currentWordWidth;

      if (testWidth <= this.divWidth) {
        currentWidth = testWidth;
      } else {
        const endTest = iter === this.wordArray.length - 1 ? testWidth : testWidth - this.spaceSize;
        if (endTest <= this.divWidth) {
          currentWidth = testWidth;
        } else {
          currentWidth = currentWordWidth;
          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
        }
      }
      currentStringIndex += word.length;
    });

    return widthCache;
  }

  updateDivValues() {
    this.divRect = this.hoverableDiv.getBoundingClientRect();
    this.divWidth = this.divRect.width;
    this.divStartY = this.divRect.top;

    this.wordStats = this.calcWordPositions();
    this.textAreaYSections = this.divRect.height / this.wordStats.length;
    // console.log(this.wordStats)
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
    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")
    let yColIndex = this.findStartIndexFromIndex(startId);
    let linePadding = this.getPaddingForIndex(startId);
    let top = this.findYValueFromIndex(startId);
    let yCol1 = this.findColFromIndex(startId)
    let yCol2 = this.findColFromIndex(endId)

    if (element.id.includes("floating-highlighted")) {
      // check how many cols spanned
      // enter if creater than one
      let spanningColCount = this.#calcCols(startId, endId)
      console.log(spanningColCount)
      if (spanningColCount > 1) {
        element.style.display = "none"
        console.log(spanningColCount)
        // for loop on col count
        // create element, + tag with rawid
        // tag each with uniqueid and col number
        // if we arent the start or end set width the whole line
        // add elements to map,
      } else if (element.style.display == "none" && (yCol1 === yCol2)) {
        element.style.display = "inline"
        const rowId = element.getAttribute("rawId")
        let splits = document.querySelectorAll(`[rawId="${rowId}"][id*="split"]`);

        splits.forEach(element => {
          const splitId = element.id; // Get the ID of the element
          this.floatingDivsSplit.delete(splitId); // Remove the entry from the Map
          element.remove(); // Remove the element from the DOM
        });
      }
    }

    element.style.top = `${top - 5 + this.mouseTopOffset}px`;
    element.style.left = `${linePadding + this.divRect.left + 2}px`;
  }


  #handleMouseMove = (event) => {
    const relativeX = event.clientX - this.divRect.left;
    this.relativeY = event.clientY - this.divStartY;
    this.mouseCol = Math.floor(this.relativeY / this.textAreaYSections);
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.wordStats.length - 1));

    let cumulativeWidth = 0;
    let letterIndex = -1;

    for (let i = this.wordStats[this.mouseColSafe][1]; i < this.contentTextCleaned.length; i++) {
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
      if (cumulativeWidth >= relativeX) {
        letterIndex = i;
        this.endLetterIndex = i;
        break;
      }
    }

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      this.outputHover.textContent = `Letter under mouse: ${this.contentTextCleaned[letterIndex]}`;
    }
  };

  #handleMouseDown = (event) => {
    const relativeX = event.clientX - this.divRect.left;
    let cumulativeWidth = 0;

    for (let i = this.wordStats[this.mouseColSafe][1]; i < this.contentTextCleaned.length; i++) {
      cumulativeWidth += this.getCharacterWidth(this.contentTextCleaned[i]);
      if (cumulativeWidth >= relativeX) {
        this.startLetterIndex = i;
        this.endLetterIndex = i;
        break;
      }
    }

    if (this.endLetterIndex >= 0 && this.endLetterIndex < this.contentTextCleaned.length) {
      this.output.textContent = `Selected text: ${this.contentTextCleaned.slice(
        this.startLetterIndex,
        this.endLetterIndex + 1
      )}`;
    }
  };

  #handleMouseUp = () => {
    if (this.startLetterIndex !== -1 && this.endLetterIndex !== -1) {
      this.#updateHighlightedText();
    }
    this.output.textContent = `Selected text: ${this.contentTextCleaned.slice(
      this.startLetterIndex,
      this.endLetterIndex + 1
    )}`;
  };

  #updateHighlightedText() {
    if (this.contentTextCleaned[this.startLetterIndex] === " ") this.startLetterIndex++;
    if (this.contentTextCleaned[this.endLetterIndex] === " ") this.endLetterIndex--;
    if (this.startLetterIndex > this.endLetterIndex) {
      [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
    }

    const uniqueId = `floating-highlighted-${this.startLetterIndex}-${this.endLetterIndex}`;
    const selectedText = this.contentTextCleaned.slice(this.startLetterIndex, this.endLetterIndex + 1);



    if (!this.floatingDivsMap.has(uniqueId)) {
      const floatingDiv = document.createElement("div");
      floatingDiv.id = uniqueId;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
      floatingDiv.setAttribute("start", this.startLetterIndex)
      floatingDiv.setAttribute("end", this.endLetterIndex)
      floatingDiv.setAttribute("rawId", `${this.startLetterIndex}-${this.endLetterIndex}`)
      document.body.appendChild(floatingDiv);
      this.floatingDivsMap.set(uniqueId, floatingDiv);
    }
    // Add the div element relative to the span
    const floatingDiv = this.floatingDivsMap.get(uniqueId);
    this.#positionFloatingComment(floatingDiv, this.endLetterIndex, this.startLetterIndex);
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
    element.style.left = `${xCol + this.divRect.left + 2}px`;
  }
  printOutWordStats() {
    let printString = ""
    for (let i = 0; i < this.wordStats.length - 1; i++) {
      const start = this.wordStats[i][1];
      const end = this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)}\n`;
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
    this.hoverableDiv.addEventListener("mousemove", this.#handleMouseMove);
    this.hoverableDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.hoverableDiv.addEventListener("mouseup", this.#handleMouseUp);
  }

  #repositionItems() {
    this.floatingDivsMapTwo.forEach((div, key) => {
      let hoverItem = document.getElementById(`${key} `);
      if (hoverItem) {

        this.#positionFloatingCommentContent(hoverItem);
      }
    });

    this.floatingDivsMap.forEach((div, key) => {
      let hoverItem = document.getElementById(key);
      if (hoverItem) {

        this.#positionFloatingComment(hoverItem)
      }
    });
    this.floatingDivsSplit.forEach((div, key) => {
      let hoverItem = document.getElementById(key);
      // console.log(key)
      if (hoverItem) {
        // console.log("found split")
        this.#positionFloatingComment(hoverItem)
      }
    });
  }
}
