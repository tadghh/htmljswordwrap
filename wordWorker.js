
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

    // 300ms in the css
    this.hoverTransitionDuration = 333;
    this.unfocusedOpacity = 1;
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
    // 1.2 is 'default' line height
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


  #position_highlight(element, startId, endId) {
    const selectedText = this.contentTextCleaned.substring(startId, endId + 1).trim();
    const yOffset = this.findYValueFromIndex(startId) - this.charHoverPaddingMouse + this.mouseTopOffset
    const xOffset = this.getPaddingForIndex(startId) + Math.floor(this.charHoverPaddingMouse) + this.getLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 5)
    const elementBody = document.body;

    // Seems that some browsers discard the real width of elements
    const window_size_remainder = Math.round(elementBody.getBoundingClientRect().width) - elementBody.getBoundingClientRect().width
    const window_size_odd = Math.round(elementBody.getBoundingClientRect().width) - Math.floor(elementBody.getBoundingClientRect().width)
    const window_ratio_offset = window_size_odd + window_size_remainder

    element.style.width = `${Math.ceil(this.getWordWidth(selectedText))}px`;
    element.style.transform = `translate(${Math.ceil(xOffset + window_ratio_offset)}px, ${yOffset}px)`;
  }

  #positionHighlightTwo(element2, key) {
    if (!element2) {
      console.warn('Element is undefined or null in positionFloatingComment');
      return;
    }
    const startId = Number.parseInt(element2["start"]);
    const endId = element2["end"];
    const isHead = element2["head"] == true;

    let element = element2[
      "elem"
    ]

    try {
      this.#updateDivValues()
      let linePadding = this.getPaddingForIndex(startId);
      let yCol1 = this.findColFromIndex(startId);
      let yCol2 = this.findColFromIndex(endId);

      const spanningColCount = this.#calcCols(startId, endId);
      if (spanningColCount >= 1 && isHead) {
        const elementsRawUniqueId = key;

        element.style.display = "none";
        let colorInt = element2["colorId"]
        let backgroundColor = this.getColor(Number.parseInt(colorInt))
        console.log(backgroundColor)
        let lowerCol = yCol1;
        let upperCol = yCol1 + spanningColCount;

        // Update or set the column count in the map
        this.floatingSelectionCols.set(elementsRawUniqueId, spanningColCount);
        this.floatingDivsSplit.set(
          elementsRawUniqueId,
          this.floatingDivsSplit
            .get(elementsRawUniqueId)
            .filter((item) => {
              if (item.col >= spanningColCount) {
                item["elem"].remove(); // Remove the element
                return false; // Exclude this item from the array
              }
              return true; // Keep this item in the array
            })
        );
        let floatingDivSplit = this.floatingDivsSplit.get(elementsRawUniqueId);

        for (let c = lowerCol; c <= upperCol - 1; c++) {
          let floatingDiv = null
          let isNewDiv = false;
          let currentHead = false
          let current_highlight_data = undefined
          if (floatingDivSplit.len != 0) {
            let current_highlight = floatingDivSplit.find(entry => entry.col == c)

            if (current_highlight && current_highlight["elem"]) {
              current_highlight_data = current_highlight;
              floatingDiv = current_highlight_data["elem"];
              if (current_highlight["head"] !== undefined) {
                currentHead = current_highlight["head"];
              }
            } else {
              isNewDiv = true
            }

            if (isNewDiv) {
              floatingDiv = document.createElement("div");
              floatingDiv.style.backgroundColor = backgroundColor
              floatingDiv.className = "highlightedText split";
            }

            floatingDiv.style.borderBottom = "2px solid transparent";
            floatingDiv.style.backgroundColor = backgroundColor
            let firstColStartIndex = this.wordStats[c][1];
            let firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;

            if (upperCol - 1 == lowerCol) {
              firstColEndIndex = endId
              firstColStartIndex = startId;
            } else if (c === lowerCol) {
              // First column
              firstColStartIndex = startId;
              firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;
            } else if (c === upperCol - 1) {
              // Last column
              firstColStartIndex = this.wordStats[c][1];
              firstColEndIndex = endId
              floatingDiv.style.borderBottom = "2px solid blue";
            } else {
              // Middle columns
              firstColStartIndex = this.wordStats[c][1];
              firstColEndIndex = this.wordStats[c + 1][1] - 1;
            }

            this.#position_highlight(floatingDiv, firstColStartIndex, firstColEndIndex)
            if (isNewDiv) {
              this.floatingDivsSplit.get(elementsRawUniqueId).push({
                col: c,
                elem: floatingDiv,
                start: firstColStartIndex,
                end: firstColEndIndex
              });
              document.body.appendChild(floatingDiv);
            } else if (!currentHead) {
              current_highlight_data["elem"] = floatingDiv
              current_highlight_data["start"] = firstColStartIndex
              current_highlight_data["end"] = firstColEndIndex
            }
          }
        }

        this.floatingSelectionWrapped.set(elementsRawUniqueId, spanningColCount);
      } else if (element.style.display === "none" && (yCol1 === yCol2)) {
        element.style.display = "inline";
      }

      // TODO user the word size cache
      this.#position_highlight(element, startId, endId)
    } catch (error) {
      console.error('Error in positionFloatingComment:', error);
    }
  }

  #positionCommentForm(element) {
    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")
    let paddingOffset = Number.parseFloat(window.getComputedStyle(element, null).getPropertyValue('border-left-width'))

    element.style.top = `${this.findYValueFromIndex(endId) + Number.parseFloat(this.fontSize) + Math.ceil(this.charHoverPaddingMouse) - paddingOffset - (Number.parseFloat(this.fontSize) / 10)}px`;

    let linePadding = this.getPaddingForIndex(startId);

    element.style.left = `${Math.ceil(linePadding) + this.getLeftPadding() + Math.floor(paddingOffset) + this.mouseLeftOffset}px`;
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
        let maxXBorder = this.getPaddingForIndex(endId)

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
        // const splits = document.querySelectorAll(`[rawId="${startId}-${endId}"].split`);
        const splits = this.floatingDivsSplit.get(`${startId}-${endId}`)
        if (splits) {
          if (isInside) {
            div.setAttribute('active', true)

            div.style.opacity = 1
            div.style.zIndex = 50

            splits.forEach(item => {

              item["elem"].style.opacity = 1;
            });
          } else {
            if (div.style.opacity == 1) {
              div.style.opacity = 0
              setTimeout(() => {
                div.style.zIndex = 5;
              }, this.hoverTransitionDuration);
            }

            splits.forEach(item => {
              item["elem"].style.opacity = this.unfocusedOpacity;
            });
          }
        }

      }
    });
  }


  #handleMouseDown = (event) => {
    let relativeX = event.clientX - this.getLeftPadding() + 2;
    const wordStatsLengthReal = this.wordStats.length - 1;
    this.mouseCol = Math.floor(this.relativeY / this.getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, wordStatsLengthReal));
    if (!this.formIsActive) {
      const startIndex = this.wordStats[this.mouseColSafe][1];
      const endIndex = this.mouseColSafe === wordStatsLengthReal
        ? this.contentTextCleaned.length
        : this.wordStats[this.mouseColSafe + 1][1];

      // Use binary search to find letter index
      let letterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX);
      this.startLetterIndex = letterIndex;
    }
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
    if (!this.formIsActive) {
      this.endLetterIndex = this.#findLetterIndexByWidth(startIndex, endIndex, relativeX);;

      if (this.startLetterIndex > this.endLetterIndex) {
        [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
        this.startLetterIndex++
      }

      let totalLength = this.endLetterIndex - this.startLetterIndex;

      if (totalLength > 1) {
        if (!this.formIsActive) {
          this.#createHighlight();
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
    }
  };

  removeHighlights(id) {
    let highlighted = document.querySelectorAll(`[rawid='${id}']`);
    highlighted.forEach((div) => {
      div.remove()
    });
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

    // Remove the form after submission
    const formId = `form-${startIndex}-${endIndex}`;
    this.removeForm(formId);
  }

  createForm(startIndex, endIndex) {
    this.formIsActive = true;
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
    let ass = this.floatingDivsSplit.get(rawId)
    ass.forEach((divsplit) => {
      divsplit["elem"].style.opacity = 1;
    });

    floatingDivForm.style.top = `${this.charHoverPaddingMouse + this.mouseTopOffset}px`;
    // let head = ass
    //   .filter((item) => {
    //     if (item.col == 2) {
    //       return true; // Exclude this item from the array
    //     }
    //     return false; // Keep this item in the array
    //   })
    console.log("head")
    // console.log(ass)
    // console.log(head[0])
    // console.log(ass.indexOf(head[0]))
    // let head_index = ass.indexOf(head[0]);
    // Add event listener for radio button selection
    const radioButtons = floatingDivForm.querySelectorAll('input[name="commentType"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        const selectedId = parseInt(event.target.value, 10);
        const color = this.getColor(selectedId);

        // Update the highlight in commentHighlights if applicable
        if (this.floatingDivsSplit && this.floatingDivsSplit.get(rawId)) {
          const highlight = this.commentHighlights.get(rawId);
          highlight.color = color;
          highlight.setAttribute("commentType", selectedId)
          this.#updateHighlightColorsId(rawId, selectedId)

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
      const commentHighlight = document.createElement("div");
      commentHighlight.className = "highlightedText split";
      this.commentHighlights.set(rawUniqueId, commentHighlight);
      let floatingDivSplit = this.floatingDivsSplit.get(rawUniqueId);

      let newObj = {
        head: true,
        elem: commentHighlight,
        start: Number.parseInt(startIndex),
        end: Number.parseInt(endIndex),
        colorId: Number.parseInt(1)
      }

      if (!floatingDivSplit) {
        // Initialize with an array containing the first object
        // two comments wont have the same sawUniqueId so we should awlays make it here
        // unique id is gen by mouse down letter index  and mouse up letter index
        this.floatingDivsSplit.set(rawUniqueId, [newObj]);
      }

      this.#positionHighlightTwo(newObj, rawUniqueId);
      document.body.appendChild(commentHighlight);
    }
    // Add the div element relative to the span

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
      element.style.paddingLeft = `${(Number.parseInt(this.fontSize) / 10)}px`
      let yColStartIndex = this.getPaddingForIndex(startId);
      let linePadding = this.getPaddingForIndex(startId);

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
        linePadding = this.getPaddingForIndex(endId);
        element.style.left = `${Math.ceil(linePadding) + Math.round(this.charHoverPadding) + this.getLeftPadding() + this.mouseLeftOffset - Math.floor(wordWidth)}px`;
      } else {
        top = this.findYValueFromIndex(startId);
        element.style.left = `${linePadding + Math.floor(this.charHoverPaddingMouse) + this.getLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 10)}px`;
      }

      element.style.top = `${top + Number.parseFloat(this.fontSize) + this.mouseTopOffset}px`;
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
        console.log(this.wordStats)
        console.log(this.floatingDivsSplit)
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
      // TODO slow
      let hoverItem = document.getElementById(`form-${div.getAttribute("start")}-${div.getAttribute("end")}`);
      if (hoverItem) {
        this.#positionCommentForm(hoverItem)
      }
    });

    this.floatingDivsSplit.forEach((divArray, key) => {
      divArray.forEach((divsplit) => {
        this.#positionHighlightTwo(divsplit, key);
      });
    });
  }

  calcWordPositions() {
    const widthCache = [[0, 0]];
    let maxWidth = Math.ceil(this.getMaxWidth());
    let window_size_remainder = Math.round(maxWidth) - maxWidth

    let window_size_odd = Math.round(maxWidth) - Math.floor(maxWidth)
    let window_ratio_offset = window_size_odd + window_size_remainder
    if (maxWidth % 2 != 0) {
      maxWidth += window_ratio_offset
    }
    let otherOff = Number.parseFloat(this.fontSize) / 10
    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;

    this.wordArray.forEach((word, iter) => {
      const currentWordWidth = this.getWordWidth(word);
      const testWidth = currentWidth + currentWordWidth;
      let extra = word.endsWith(" ") ? 0 : this.spaceSize * -1;
      // First test: does word fit on current line with space?
      if (testWidth <= maxWidth + this.spaceSize + extra) {
        currentWidth = testWidth;
      } else {
        // If it doesn't fit, test without trailing space
        // Only subtract space if not last word and word has a space

        const endTest = Math.ceil(testWidth);

        if (endTest <= maxWidth + otherOff) {
          // && endTest + 2 != maxWidth

          currentWidth = endTest;
        } else if (endTest >= maxWidth + otherOff) {
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

  #updateDivValues() {
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.wordStats = this.calcWordPositions();
  }

  #handleResizeOrScroll = () => {
    this.#updateDivValues();
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
    const rawUniqueId = `${startIndex}-${endIndex}`;
    const selectedId = parseInt(colorId);
    const color = this.getColor(selectedId);
    if (!this.floatingComments.has(rawUniqueId)) {
      const floatingComment = document.createElement("div");

      floatingComment.id = `floating-${startIndex}-${endIndex}`;
      floatingComment.className = "highlightComment";
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
      commentHighlight.className = "highlightedText split";
      this.commentHighlights.set(rawUniqueId, commentHighlight);
      let floatingDivSplit = this.floatingDivsSplit.get(rawUniqueId);

      let newObj = {
        head: true,
        elem: commentHighlight,
        start: Number.parseInt(startIndex),
        end: Number.parseInt(endIndex),
        colorId: Number.parseInt(colorId)
      }

      if (!floatingDivSplit) {
        // Initialize with an array containing the first object
        // two comments wont have the same sawUniqueId so we should awlays make it here
        // unique id is gen by mouse down letter index  and mouse up letter index
        this.floatingDivsSplit.set(rawUniqueId, [newObj]);
      }

      this.#positionHighlightTwo(newObj, rawUniqueId);
      document.body.appendChild(commentHighlight);
    }
    //  this.#positionHighlight(this.commentHighlights.get(rawUniqueId));
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
        return 'lightgreen'; // Default color for unknown IDs
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



  #updateHighlightColorsId(rawId, colorId) {
    let items = this.floatingDivsSplit.get(rawId)
    if (items) {
      const selectedId = parseInt(colorId);
      const color = this.getColor(selectedId);
      items.map((item) => {
        item["elem"].style.backgroundColor = color
        if (item["head"] == true) {
          item["colorId"] = selectedId
        }
      })
    }
  }

  // #endregion
}
