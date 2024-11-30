// TODO form submission
// TODO after user selection create form
// On click off remove selection and form
// After form submission swap it out with comment

// Form at edge of screen, don't let it go over bounds
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

    this.charHoverPadding = this.getCharacterWidth("m")
    this.charHoverPaddingMouse = this.getCharacterWidth("m") / (parseFloat(this.fontSize) / 10);
    this.formIsActive = false
    this.#addEventListeners();
    this.createTextHighlight(737, 750, this.contentTextCleaned, "Woah this is going somewhere woo hoo")
  }

  addAttributes(start, end, element) {
    let hold = Number.parseFloat(end) + 1

    const selectedText = this.contentTextCleaned.substring(start, hold);

    element.style.width = `${this.getWordWidth(selectedText)}px`;
    element.setAttribute("start", start);
    element.setAttribute("end", end);
    let realNum = Number.parseFloat(start)
    const colTop = this.findYValueFromIndex(realNum);
    element.style.top = `${colTop - 5 + this.mouseTopOffset}px`;
    const colPadding = this.getPaddingForIndex(realNum);
    element.style.left = `${colPadding + this.getLeftPadding() + 2}px`;
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
            floatingDiv.setAttribute("col", c);
            floatingDiv.setAttribute("rawId", elementsRawUniqueId);

            // TODO flat line end

            if (c === lowerCol) {
              // First column
              let firstColStartIndex = startId;
              let firstColEndIndex = this.wordStats[yCol1 + 1][1];

              this.addAttributes(firstColStartIndex, firstColEndIndex, floatingDiv)
            } else if (c === upperCol - 1) {
              // Last column
              let lastColStartIndex = this.wordStats[c][1];
              this.addAttributes(lastColStartIndex, endId, floatingDiv)
            } else {
              // Middle columns
              let colStartIndex = this.wordStats[c][1];
              let colEndIndex = this.wordStats[c + 1][1];

              this.addAttributes(colStartIndex, colEndIndex, floatingDiv)
            }

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
  #positionFloatingForm(element) {
    const startId = element.getAttribute("start")
    let yColStartIndex = this.getPaddingForIndex(startId);

    console.log(` ${yColStartIndex} `)

    let top = this.findYValueFromIndex(startId);

    element.style.top = `${top + 25}px`;
    element.style.left = `${yColStartIndex + this.getLeftPadding() + 2}px`;
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
    let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, this.relativeX, false);

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.getCharacterWidth(char);
      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.#getCumulativeWidth(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}`;
    }
    this.hoveringComment(this.relativeX)
    // this.endLetterIndex = letterIndex;
  };
  hoveringComment(relativeX) {
    this.floatingDivsMapTwo.forEach((div, key) => {
      let hoverItem = document.getElementById(`floating-${key}`);

      if (hoverItem) {
        // console.log("gover2")
        const ids = hoverItem.id
          .replace("floating-", "")
          .split("-");
        const xIndex = parseInt(ids[0])
        const yIndex = parseInt(ids[1])

        const xCol = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(xIndex))

        const top = this.findYValueFromIndex(yIndex);
        const topBorder = top;
        const bottomBorder = top + 20;


        const minXBorder = xCol;
        const maxXBorder = xCol + this.getWordWidth(div.textContent)
        const newRelY = event.clientY

        const isInsideX = relativeX >= minXBorder && relativeX <= maxXBorder;
        const isInsideY = newRelY >= topBorder && newRelY <= bottomBorder;
        const isInside = isInsideX && isInsideY;

        if (isInside) {
          div.setAttribute('active', true)
          div.style.display = "block"
          console.log("inside")
        } else if (!div.getAttribute('active')) {
          div.style.display = "none";  // Use "none" instead of "hidden"
          console.log("sss");
        }
      }
    });
  }
  // Binary search for letter index based on width
  #findLetterIndexByWidth(start, end, targetWidth, testing) {
    let low = start;
    let high = end;
    let cumulativeWidth = 0;
    if (testing) {
      console.log(`low ${low} high ${high}`)

    }
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
    let relativeX = event.clientX - this.getLeftPadding() + 2;
    const wordStatsLengthReal = this.wordStats.length - 1;

    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === wordStatsLengthReal
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX, false);
    this.startLetterIndex = letterIndex;

  };

  #handleMouseUp = (event) => {
    // need the mouse to be over the whole char so consider it selected
    let relativeX = event.clientX - this.getLeftPadding();
    const wordStatsLengthReal = this.wordStats.length;

    if (relativeX % this.charHoverPadding != 0) {
      relativeX -= this.charHoverPaddingMouse
    }

    this.mouseCol = Math.floor(this.relativeY / this.getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, wordStatsLengthReal));

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === wordStatsLengthReal
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX, true);
    this.endLetterIndex = letterIndex;

    if (this.startLetterIndex > this.endLetterIndex) {
      [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
      this.startLetterIndex++
    }
    let totalLength = this.endLetterIndex - this.startLetterIndex;
    if (totalLength > 1) {

      this.formIsActive = true;

      this.#createHighlight();
    }

  };
  removeHighlights(id) {
    console.log(id)
    let highlighted = document.querySelectorAll(`[rawid='${id}']`);
    highlighted.forEach((div) => {
      div.remove()
    });
  }
  removeForm(id) {
    let form = document.getElementById(id)
    if (form) {

      window.getSelection().removeAllRanges();
      form.remove()
      this.formIsActive = false;
      let x = form.getAttribute("start")
      let y = form.getAttribute("end")
      // this.removeHighlights(`${x}-${y}`)
    }
  }

  formCommentSubmission(submission) {
    const form = submission.target;
    const startIndex = parseInt(form.closest('.floatingForm').getAttribute('start'));
    const endIndex = parseInt(form.closest('.floatingForm').getAttribute('end'));
    const comment = form.comment.value;

    // Prevent default form submission
    submission.preventDefault();

    // Create the highlight with the comment
    this.createTextHighlight(startIndex, endIndex, this.contentTextCleaned, comment);

    // Remove the form after submission
    const formId = `form-${startIndex}-${endIndex}`;
    this.removeForm(formId);
  }
  createForm(startIndex, endIndex) {
    const id = `form-${startIndex}-${endIndex}`;
    const elementString = `
      <div class="floatingForm">
        <form action="">
          <label for="text">Content</label>
          <textarea id="text" name="comment"></textarea>
          <button type="submit">Comment</button>
        </form>
        <button type="button" class="close-btn">X</button>
      </div>
    `;

    const parser = new DOMParser();
    const doc = parser.parseFromString(elementString, 'text/html');
    const floatingDivForm = doc.body.firstElementChild;

    floatingDivForm.id = id;
    floatingDivForm.className = "floatingForm";
    floatingDivForm.setAttribute("start", startIndex);
    floatingDivForm.setAttribute("end", endIndex);
    floatingDivForm.setAttribute("rawId", `${startIndex}-${endIndex}`);

    // Add event listener to close button
    const closeButton = floatingDivForm.querySelector('.close-btn');
    closeButton.addEventListener('click', () => this.removeForm(id));
    const form = floatingDivForm.querySelector('form');
    form.addEventListener('submit', (event) => this.formCommentSubmission(event));

    return floatingDivForm;
  }

  #createHighlight() {
    if (this.startLetterIndex > this.endLetterIndex) {
      [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
      this.startLetterIndex++
    }

    if (this.contentTextCleaned[this.startLetterIndex] === " ") this.startLetterIndex++;
    if (this.contentTextCleaned[this.endLetterIndex] === " ") this.endLetterIndex--;
    // add example spans below
    const uniqueId = `floating-highlighted-${this.startLetterIndex}-${this.endLetterIndex}`;
    const rawUniqueId = `${this.startLetterIndex}-${this.endLetterIndex}`;
    const selectedText = this.contentTextCleaned.slice(this.startLetterIndex, this.endLetterIndex + 1);


    if (!this.floatingDivsMap.has(rawUniqueId)) {
      const floatingDiv = document.createElement("div");
      // const floatingDivContent = document.createElement("div");

      // let demo_test = "Here is some long content to test this"

      let width = this.getNextLowestDivisibleByNinePointSix(this.getWordWidth(selectedText))

      floatingDiv.id = uniqueId;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${width}px`;
      floatingDiv.setAttribute("start", this.startLetterIndex)
      floatingDiv.setAttribute("end", this.endLetterIndex)
      floatingDiv.setAttribute("rawId", rawUniqueId)

      // floatingDivContent.className = "floatingContent";
      // floatingDivContent.id = `floating-${this.startLetterIndex}-${this.endLetterIndex}`;
      // floatingDivContent.textContent = demo_test
      // floatingDivContent.style.width = `${this.getWordWidth(demo_test)}px`;
      // floatingDivContent.setAttribute("start", this.startLetterIndex)
      // floatingDivContent.setAttribute("end", this.endLetterIndex)
      // floatingDivContent.setAttribute("rawId", rawUniqueId)

      this.floatingDivsMap.set(rawUniqueId, floatingDiv);
      // this.floatingDivsMapTwo.set(rawUniqueId, floatingDivContent);

      document.body.appendChild(floatingDiv);
      // document.body.appendChild(floatingDivContent);
      if (this.formIsActive) {
        console.log("aa")
        const getStuff = this.createForm(this.startLetterIndex, this.endLetterIndex)
        document.body.appendChild(getStuff);
        this.#positionFloatingComment(getStuff);

      }
    }
    // Add the div element relative to the span
    this.#positionFloatingComment(this.floatingDivsMap.get(rawUniqueId));
    // this.#positionFloatingCommentContent(this.floatingDivsMapTwo.get(rawUniqueId));

    // Initially position the div
    this.#repositionItems()
  }

  #positionFloatingCommentContent(element) {
    if (element) {
      const startId = element.getAttribute("start")
      let yColStartIndex = this.getPaddingForIndex(startId);

      console.log(` ${yColStartIndex} `)

      let top = this.findYValueFromIndex(startId);

      element.style.top = `${top + 25}px`;
      element.style.left = `${yColStartIndex + this.getLeftPadding() + 2}px`;
    }
    console.log(element)

  }

  // #region Utility
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

    // TODO Just use the divs
    this.floatingDivsMapTwo.forEach((div) => {
      this.#positionFloatingCommentContent(div);
    });

    this.floatingDivsMap.forEach((div) => {
      this.#positionFloatingComment(div)
      let key = div.id;
      console.log(key)
      let hoverItem = document.getElementById(`form-${div.getAttribute("start")}-${div.getAttribute("end")}`);
      if (hoverItem) {
        this.#positionFloatingForm(hoverItem)
      }
    });
    this.floatingDivsSplit.forEach((div, key) => {
      let hoverItem = document.getElementById(key);
      if (hoverItem) {
        this.#positionFloatingComment(hoverItem)
      }
    });

  }

  getNextLowestDivisibleByNinePointSix(num) {
    return num % this.charHoverPadding === 0 ? num : num - (num % this.charHoverPadding);
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

  getLeftPadding() {
    return this.divRect.left
  }

  getTopWordPadding() {
    return this.divRect.top
  }

  getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(2));
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

        return previousValue !== null ? previousValue : yPx;
      }
      previousValue = yPx;
    }

    return null;
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
  // TODO undo comments for testing premade content
  createTextHighlight(startIndex, endIndex, textContent, comment) {
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }
    console.log(startIndex)
    console.log(endIndex)
    if (textContent[startIndex] === " ") startIndex++;
    if (textContent[endIndex] === " ") endIndex--;
    // add example spans below
    const uniqueId = `floating-highlighted-${startIndex}-${endIndex}`;
    const rawUniqueId = `${startIndex}-${endIndex}`;
    const selectedText = textContent.slice(startIndex, endIndex + 1);
    if (!this.floatingDivsMapTwo.has(rawUniqueId)) {
      const floatingDivContent = document.createElement("div");

      floatingDivContent.id = `floating-${startIndex}-${endIndex}`;
      floatingDivContent.className = "floatingContent";
      floatingDivContent.textContent = comment
      floatingDivContent.style.width = `${this.getWordWidth(comment)}px`;
      floatingDivContent.setAttribute("start", startIndex)
      floatingDivContent.setAttribute("end", endIndex)
      floatingDivContent.setAttribute("rawId", rawUniqueId)
      this.floatingDivsMapTwo.set(rawUniqueId, floatingDivContent);
      document.body.appendChild(floatingDivContent);
    }
    if (!this.floatingDivsMap.has(rawUniqueId)) {
      const floatingDiv = document.createElement("div");

      let width = this.getNextLowestDivisibleByNinePointSix(this.getWordWidth(selectedText))

      floatingDiv.id = uniqueId;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${width}px`;
      floatingDiv.setAttribute("start", startIndex)
      floatingDiv.setAttribute("end", endIndex)
      floatingDiv.setAttribute("rawId", rawUniqueId)

      this.floatingDivsMap.set(rawUniqueId, floatingDiv);

      document.body.appendChild(floatingDiv);
    }
    // Add the div element relative to the span
    this.#positionFloatingComment(this.floatingDivsMap.get(rawUniqueId));
    this.#positionFloatingCommentContent(this.floatingDivsMapTwo.get(rawUniqueId));
    // Initially position the div
    this.#repositionItems()
  }
  // #endregion
}
