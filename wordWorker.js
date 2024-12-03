
// TODO Form at edge of screen, don't let it go over bounds

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
    this.commentHighlights = new Map();
    this.floatingSelectionCols = new Map();
    this.floatingSelectionWrapped = new Map();
    this.floatingComments = new Map();
    this.floatingDivsSplit = new Map();


    this.unfocusedOpacity = 0.21;
    this.mouseTopOffset = window.scrollY;
    this.mouseLeftOffset = window.scrollX;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.highlightedDiv = document.getElementById("highlightedDiv");
    this.output = document.getElementById(outputId);
    this.outputHover = document.getElementById(outputHoverId);

    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontFamily = computedStyle.fontFamily;
    this.lineHeight = parseFloat(computedStyle.fontSize) * 1.2;

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
    this.createTextHighlight(739, 752, this.contentTextCleaned, "Woah this is going somewhere woo hoo", 2)
  }

  addAttributes(start, end, element) {
    let hold = Number.parseFloat(end) + 1
    const selectedText = this.contentTextCleaned.substring(start, hold).trim();

    element.style.width = `${this.getWordWidth(selectedText)}px`;
    element.setAttribute("start", start);
    element.setAttribute("end", end);
    let realNum = Number.parseFloat(start)

    element.style.top = `${this.findYValueFromIndex(realNum) + this.mouseTopOffset}px`;
    element.style.left = `${this.getPaddingForIndex(realNum) + this.getLeftPadding()}px`;
  }

  #positionHighlight(element) {
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
      this.updateDivValues()
      let linePadding = this.getPaddingForIndex(startId);
      let top = this.findYValueFromIndex(startId);
      let yCol1 = this.findColFromIndex(startId);
      let yCol2 = this.findColFromIndex(endId);

      if (element.id && element.id.includes("floating-highlighted")) {
        const spanningColCount = this.#calcCols(startId, endId);
        const elementsRawUniqueId = element.getAttribute("rawId");
        if (spanningColCount > 1) {

          element.style.display = "none";
          let colorInt = element.getAttribute("commentType")
          let backgroundColor = this.getColor(Number.parseInt(colorInt))
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
            const splits = document.querySelectorAll(`[rawId="${elementsRawUniqueId}"].split`);

            splits.forEach(split => {
              const colVal = parseInt(split.getAttribute("col"));
              split.style.opacity = 0.21
              if (colVal >= spanningColCount) {
                const splitId = split.id;
                this.floatingDivsSplit.delete(splitId);
                split.remove();
              }
            });
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
              floatingDiv.style.backgroundColor = backgroundColor
              floatingDiv.setAttribute('commentType', colorInt)
              floatingDiv.className = "highlightedText split";
              isNewDiv = true;
            }

            floatingDiv.setAttribute("col", c);
            floatingDiv.setAttribute("rawId", elementsRawUniqueId);
            floatingDiv.style.borderBottom = "2px solid transparent";
            if (c === lowerCol) {
              // First column
              let firstColStartIndex = startId;
              let firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;

              this.addAttributes(firstColStartIndex, firstColEndIndex, floatingDiv)

            } else if (c === upperCol - 1) {
              // Last column
              let lastColStartIndex = this.wordStats[c][1];
              floatingDiv.style.borderBottom = "2px solid blue";
              this.addAttributes(lastColStartIndex, endId, floatingDiv)
            } else {
              // Middle columns
              let colStartIndex = this.wordStats[c][1];
              let colEndIndex = this.wordStats[c + 1][1] - 1;

              this.addAttributes(colStartIndex, colEndIndex, floatingDiv)
            }

            // Only add to map and DOM if it's a new div
            if (isNewDiv) {
              this.floatingDivsSplit.set(splitId, floatingDiv);
              document.body.appendChild(floatingDiv);
            }
            this.#repositionItems
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

      // Apply styles safely
      if (typeof top === 'number' && !isNaN(top)) {
        element.style.top = `${top - Math.floor(this.charHoverPaddingMouse) + this.mouseTopOffset}px`;
      }
      console.log(Math.floor(this.charHoverPaddingMouse))
      element.style.left = `${linePadding + Math.floor(this.charHoverPaddingMouse) + this.getLeftPadding() + this.mouseLeftOffset}px`;

    } catch (error) {
      console.error('Error in positionFloatingComment:', error);
    }
  }

  #positionCommentForm(element) {
    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")

    element.style.top = `${this.findYValueFromIndex(endId) + Number.parseFloat(this.fontSize) + 3}px`;
    element.style.left = `${this.getPaddingForIndex(startId) + this.getLeftPadding()}px`;
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
      let formHoveringIndicator = document.getElementById("formHoverIndicator")
      if (formHoveringIndicator) {
        formHoveringIndicator.textContent = `Last Hovered: (${letterIndex},${this.mouseColSafe}) - ${char}`
      }
      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.#getCumulativeWidth(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}`;
    }
    this.hoveringComment()
  };

  hoveringComment() {
    this.floatingComments.forEach((div) => {
      let hoverItem = div;

      if (hoverItem) {
        const startId = hoverItem.getAttribute("start");
        const endId = hoverItem.getAttribute("end");

        let startCol = this.findColFromIndex(startId)
        let endCol = this.findColFromIndex(endId)
        const isMultiLine = startCol != endCol
        const mouseTopOffset = this.mouseTopOffset

        const fontSizeRaw = Number.parseFloat(this.fontSize)
        const xCol = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(startId))

        const newRelY = this.relativeY + this.getTopWordPadding() + mouseTopOffset;

        const relativeX = this.relativeX
        const top = this.findYValueFromIndex(startId) + mouseTopOffset;
        let minXBorder = xCol;
        let maxXBorder = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(endId))

        let topBorder = top;
        let bottomBorder = top + fontSizeRaw;

        let isInsideX = relativeX >= minXBorder && relativeX <= maxXBorder;
        let isInsideY = newRelY >= topBorder && newRelY <= bottomBorder;
        let isInside = isInsideX && isInsideY;

        // TODO clean this up spaghetti mess
        // Were checking if the mouse is in the middle rows of the text or the top or bottom row
        if (isMultiLine) {
          let middleStart = this.wordStats[endCol - 1][1];
          let bottomTop = this.findYValueFromIndex(endId) + mouseTopOffset
          bottomBorder = bottomTop

          maxXBorder = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(middleStart - 1))
          let middleStartIndex = this.getLeftPadding();
          let middleStartYIndex = this.findYValueFromIndex(this.wordStats[startCol + 1][1]) + mouseTopOffset;
          let middleEndColIndex = maxXBorder;
          let middleEndColYIndex = this.findYValueFromIndex(this.wordStats[endCol][1]) + mouseTopOffset

          let isMiddleX = relativeX >= middleStartIndex && relativeX <= middleEndColIndex;
          let isMiddleY = newRelY >= middleStartYIndex && newRelY <= middleEndColYIndex

          let firstTop = top;
          let LastBottom = bottomTop;

          let isInsideFirstY = newRelY >= firstTop && newRelY <= firstTop + fontSizeRaw;
          let isInsideLastY = newRelY >= LastBottom && newRelY <= LastBottom + fontSizeRaw;

          let minXBorderFirst = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(startId))
          let maxXBorderLast = this.getNextLowestDivisibleByNinePointSix(this.getPaddingForIndex(endId))
          let minXBorderLast = this.getLeftPadding()

          let isInsideXFirstLine = relativeX >= minXBorderFirst && relativeX <= maxXBorder;
          let isInsideXLastLine = relativeX >= minXBorderLast && relativeX <= maxXBorderLast;

          isInside = (isInsideX && isInsideY) || (isInsideXFirstLine && isInsideFirstY) || (isInsideXLastLine && isInsideLastY) || (isMiddleY && isMiddleX);
        }

        if (isInside) {
          div.setAttribute('active', true)
          const splits = document.querySelectorAll(`[rawId="${startId}-${endId}"]`);
          splits.forEach(item => {
            item.style.opacity = 1;
          });
        } else {
          div.style.opacity = this.unfocusedOpacity
          const splits = document.querySelectorAll(`[rawId="${startId}-${endId}"].split`);
          splits.forEach(item => {
            item.style.opacity = this.unfocusedOpacity;
          });
        }
      }
    });
  }


  #handleMouseDown = (event) => {
    let relativeX = event.clientX - this.getLeftPadding() + 2;
    const wordStatsLengthReal = this.wordStats.length - 1;
    this.mouseCol = Math.floor(this.relativeY / this.getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, wordStatsLengthReal));

    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === wordStatsLengthReal
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX);
    this.startLetterIndex = letterIndex;
  };

  #handleMouseUp = (event) => {
    // need the mouse to be over the whole char so consider it selected
    let relativeX = event.clientX - this.getLeftPadding();
    const wordStatsLengthReal = this.wordStats.length - 1;

    if (relativeX % this.charHoverPadding != 0) {
      relativeX -= this.charHoverPaddingMouse
    }

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === wordStatsLengthReal
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    this.endLetterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX);;

    if (this.startLetterIndex > this.endLetterIndex) {
      [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
      this.startLetterIndex++
    }

    let totalLength = this.endLetterIndex - this.startLetterIndex;

    if (totalLength > 1) {
      this.#createHighlight();
      this.formIsActive = true;

      if (this.formIsActive) {
        let startIndexForm = document.getElementById("startIndexForm")
        let endIndexForm = document.getElementById("endIndexForm")

        document.body.appendChild(this.createForm(this.startLetterIndex, this.endLetterIndex));
        this.#repositionItems()
        if (startIndexForm && endIndexForm) {
          startIndexForm.textContent = `Start: ${this.contentTextCleaned[this.startLetterIndex]}`
          endIndexForm.textContent = `End: ${this.contentTextCleaned[this.endLetterIndex]}`
        }
      }
    }
  };

  removeHighlights(id) {
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
    }
  }

  closeForm(id) {
    let form = document.getElementById(id)
    if (form) {
      this.removeForm(id)
      let x = form.getAttribute("start")
      let y = form.getAttribute("end")
      this.removeHighlights(`${x}-${y}`)
    }
  }

  formCommentSubmission(submission) {
    const form = submission.target;
    const startIndex = parseInt(form.closest('.floatingForm').getAttribute('start'));
    const endIndex = parseInt(form.closest('.floatingForm').getAttribute('end'));
    const comment = form.comment.value;
    const selectedRadio = form.querySelector('input[name="commentType"]:checked');
    if (!selectedRadio) {
      console.error('No comment type selected');
      return;
    }
    const commentTypeId = parseInt(selectedRadio.value);
    // Prevent default form submission
    submission.preventDefault();
    // TODO Api call

    // TODO swap out client side
    // Create the highlight with the comment
    this.createTextHighlight(startIndex, endIndex, this.contentTextCleaned, comment, commentTypeId);
    const commentColor = this.getColor(commentTypeId);

    let commentElement = document.getElementById(`floating-${startIndex}-${endIndex}`)
    if (commentElement) {
      commentElement.style.backgroundColor = commentColor
    }
    // Remove the form after submission
    const formId = `form-${startIndex}-${endIndex}`;
    this.removeForm(formId);
  }

  createForm(startIndex, endIndex) {
    const id = `form-${startIndex}-${endIndex}`;
    const elementString = `
    <div class="floatingForm">
        <form action="">
            <div id="commentFormHeader">
                <label for="text">Content</label>
                <div id="selectionRange">
                    <div id="startIndexForm"></div>
                    <div id="endIndexForm"></div>
                    <small id="formHoverIndicator"></small>
                </div>
            </div>

            <textarea id="text" name="comment"></textarea>

            <div id="commentType">
                <label>Type:</label>
                <div>
                    <input type="radio" id="misc" name="commentType" value="1" checked>
                    <label for="misc">Misc Comments</label>
                </div>
                <div>
                    <input type="radio" id="incorrect" name="commentType" value="2">
                    <label for="incorrect">Incorrect Info</label>
                </div>
                <div>
                    <input type="radio" id="sources" name="commentType" value="3">
                    <label for="sources">Sources?</label>
                </div>
                <div>
                    <input type="radio" id="question" name="commentType" value="4">
                    <label for="question">Question</label>
                </div>
            </div>

            <button type="submit">Comment</button>
        </form>
        <button type="button" class="close-btn">X</button>
    </div>
`;

    const parser = new DOMParser();
    const doc = parser.parseFromString(elementString, 'text/html');
    const floatingDivForm = doc.body.firstElementChild;
    const rawId = `${startIndex}-${endIndex}`;
    floatingDivForm.id = id;
    floatingDivForm.className = "floatingForm";
    floatingDivForm.setAttribute("start", startIndex);
    floatingDivForm.setAttribute("end", endIndex);

    floatingDivForm.style.top = `${this.charHoverPaddingMouse + this.mouseTopOffset}px`;
    // Add event listener for radio button selection
    const radioButtons = floatingDivForm.querySelectorAll('input[name="commentType"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        const selectedId = parseInt(event.target.value, 10);
        const color = this.getColor(selectedId);

        // Update the highlight in commentHighlights if applicable
        if (this.commentHighlights && this.commentHighlights.get(rawId)) {
          const highlight = this.commentHighlights.get(rawId);
          highlight.color = color;
          highlight.setAttribute("commentType", selectedId)
          const splits = document.querySelectorAll(`[rawId="${startIndex}-${endIndex}"]`);
          splits.forEach(item => {
            item.style.backgroundColor = color;
            item.setAttribute('commentType', selectedId);
          });
        }
      });
    });

    // Add event listener to close button
    const closeButton = floatingDivForm.querySelector('.close-btn');
    closeButton.addEventListener('click', () => this.closeForm(id));

    // Add event listener for form submission
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
    const startIndex = this.startLetterIndex
    const endIndex = this.endLetterIndex
    const rawUniqueId = `${startIndex}-${endIndex}`;

    if (!this.commentHighlights.has(rawUniqueId)) {
      const uniqueId = `floating-highlighted-${startIndex}-${endIndex}`;
      const selectedText = this.contentTextCleaned.slice(startIndex, endIndex + 1);
      const commentHighlight = document.createElement("div");
      const selectedId = parseInt(1);
      const color = this.getColor(selectedId);
      const width = this.getWordWidth(selectedText)

      commentHighlight.id = uniqueId;
      commentHighlight.className = "highlightedText";
      commentHighlight.style.width = `${width}px`;

      commentHighlight.setAttribute("start", startIndex)
      commentHighlight.setAttribute("end", endIndex)
      commentHighlight.setAttribute("commentType", selectedId)
      commentHighlight.style.backgroundColor = color;
      commentHighlight.setAttribute("rawId", rawUniqueId)
      this.commentHighlights.set(rawUniqueId, commentHighlight);
      document.body.appendChild(commentHighlight);
    }
    // Add the div element relative to the span
    this.#positionHighlight(this.commentHighlights.get(rawUniqueId));
    this.#positionCommentContent(this.floatingComments.get(rawUniqueId));

    // Initially position the div
    this.#repositionItems()
  }
  // TODO from here use positioning logic on form
  #positionCommentContent(element) {
    if (element) {
      const startId = element.getAttribute("start");
      const endId = element.getAttribute("end");

      const wordWidth = this.getWordWidth(element.textContent);
      const maxWidth = this.getMaxWidth();

      let yColStartIndex = this.getPaddingForIndex(startId);

      let startCol = this.findColFromIndex(startId)
      let endCol = this.findColFromIndex(endId)
      let top = this.findYValueFromIndex(endId);
      let lastColIndex = this.findStartIndexFromIndex(endId);
      let bottomLineWidth = this.getWidthFromRange(lastColIndex, endId)

      if (yColStartIndex + wordWidth > maxWidth) {
        yColStartIndex = this.getPaddingForIndex(endId);
        yColStartIndex -= (wordWidth) - this.charHoverPadding;
      }

      if (endCol - startCol >= 1) {
        top = this.findYValueFromIndex(endId);
        yColStartIndex = bottomLineWidth - wordWidth
      } else {
        top = this.findYValueFromIndex(startId);
      }

      element.style.top = `${top + Number.parseFloat(this.fontSize) + this.charHoverPaddingMouse + this.mouseTopOffset}px`;
      element.style.left = `${yColStartIndex + this.charHoverPaddingMouse + this.getLeftPadding() + this.mouseLeftOffset}px`;
    }
  }

  // #region Utility


  #addEventListeners() {
    window.addEventListener("resize", this.#handleResizeOrScroll);
    window.addEventListener("scroll", () => {
      this.mouseTopOffset = window.scrollY;
      this.mouseLeftOffset = window.scrollX;
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
    this.floatingComments.forEach((div) => {
      this.#positionCommentContent(div);
    });

    this.commentHighlights.forEach((div) => {
      this.#positionHighlight(div)

      // TODO slow
      let hoverItem = document.getElementById(`form-${div.getAttribute("start")}-${div.getAttribute("end")}`);
      if (hoverItem) {
        this.#positionCommentForm(hoverItem)
      }
    });

    this.floatingDivsSplit.forEach((div) => {
      this.#positionHighlight(div)
    });
  }


  calcWordPositions() {
    const widthCache = [[0, 0]];
    let maxWidth = Math.ceil(this.getMaxWidth());
    if (maxWidth % 2 != 0) {
      maxWidth--
    }
    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;

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
        const endTest = Math.ceil(testWidth - spaceToRemove);

        if (((endTest < maxWidth) || testWidth == maxWidth + 2 || endTest == maxWidth - 1)) {
          // && endTest + 2 != maxWidth

          currentWidth = endTest;
        } else if (endTest >= maxWidth) {
          // Word doesn't fit, wrap to new lin

          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
          currentWidth = currentWordWidth;
        } else {

          widthCache.push([wordColumnIndex, currentStringIndex]);
          wordColumnIndex++;
          currentWidth = currentWordWidth;
        }
      }
      currentStringIndex += word.length;
    });

    return widthCache;
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

  createTextHighlight(startIndex, endIndex, textContent, comment, colorId) {
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }

    if (textContent[startIndex] === " ") startIndex++;
    if (textContent[endIndex] === " ") endIndex--;
    // add example spans below
    const uniqueId = `floating-highlighted-${startIndex}-${endIndex}`;
    const rawUniqueId = `${startIndex}-${endIndex}`;
    const selectedText = textContent.slice(startIndex, endIndex + 1);

    if (!this.floatingComments.has(rawUniqueId)) {
      const floatingComment = document.createElement("div");
      const selectedId = parseInt(colorId);
      const color = this.getColor(selectedId);
      floatingComment.id = `floating-${startIndex}-${endIndex}`;
      floatingComment.className = "highlightComment ";
      floatingComment.textContent = comment
      floatingComment.style.width = `${this.getWordWidth(comment)}px`;
      floatingComment.setAttribute("start", startIndex)
      floatingComment.setAttribute("end", endIndex)
      floatingComment.setAttribute("rawId", rawUniqueId)
      floatingComment.setAttribute("commentType", selectedId)
      floatingComment.style.backgroundColor = color;
      this.floatingComments.set(rawUniqueId, floatingComment);
      document.body.appendChild(floatingComment);
    }

    if (!this.commentHighlights.has(rawUniqueId)) {
      const commentHighlight = document.createElement("div");
      commentHighlight.id = uniqueId;
      commentHighlight.className = "highlightedText split";
      commentHighlight.style.width = `${this.getWordWidth(selectedText)}px`;
      commentHighlight.setAttribute("start", startIndex)
      commentHighlight.setAttribute("end", endIndex)
      commentHighlight.setAttribute("rawId", rawUniqueId)
      this.commentHighlights.set(rawUniqueId, commentHighlight);
      document.body.appendChild(commentHighlight);
    }
    this.#positionHighlight(this.commentHighlights.get(rawUniqueId));
    this.#positionCommentContent(this.floatingComments.get(rawUniqueId));

    this.#repositionItems()
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

  getColor(id) {
    switch (id) {
      case 1:
        return 'white'; // Misc comments
      case 2:
        return 'pink'; // Incorrect info
      case 3:
        return 'lightblue'; // Sources?
      case 4:
        return 'skyblue'; // Question
      default:
        return 'transparent'; // Default color for unknown IDs
    }
  }
  // Binary search for letter index based on width
  #findLetterIndexByWidth(start, end, targetWidth) {
    let low = start;
    let high = end;
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


  // #endregion
}
