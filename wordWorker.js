
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
    this.floatingComments = new Map();
    this.floatingDivsSplit = new Map();

    // 300ms in the css
    this.hoverTransitionDuration = 333;
    this.unfocusedOpacity = 0.2;
    this.mouseTopOffset = window.scrollY;
    this.mouseLeftOffset = window.scrollX;
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");

    this.highlightedDiv = document.getElementById("highlightedDiv");
    this.output = document.getElementById(outputId);
    this.outputHover = document.getElementById(outputHoverId);

    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontSizeRaw = Number.parseFloat(this.fontSize)

    this.fontFamily = computedStyle.fontFamily;
    // 1.2 is 'default' line height
    this.lineHeight = parseFloat(computedStyle.fontSize) * 1.2;

    this.divRect = this.highlightedDiv.getBoundingClientRect();

    this.context.font = `${this.fontSize} ${this.fontFamily}`;
    this.contentTextCleaned = this.highlightedDiv.textContent.trim().replace(/\t/g, "").replace(/\n/g, " ");
    this.spaceSize = this.#getWordWidth(" ");
    this.wordArray = this.contentTextCleaned.split(" ").map((word, i, arr) =>
      i < arr.length - 1 ? word + " " : word
    );
    this.wordStats = this.#calcWordPositions();

    this.charHoverPadding = this.#getCharacterWidth("m")
    this.charHoverPaddingMouse = this.#getCharacterWidth("m") / (parseFloat(this.fontSize) / 10);
    this.formIsActive = false
    this.#addEventListeners();
    this.createTextHighlight(739, 752, this.contentTextCleaned, "Woah this is going somewhere woo hoo", 2)

    this.formElement = null;
  }

  #positionCommentContent(element) {
    if (element) {
      // TODO move away from this attribute stuff, store vals in arr
      const startId = element.getAttribute("start");
      const endId = element.getAttribute("end");
      let xOffset = this.#getPaddingForIndex(startId) + Math.floor(this.charHoverPaddingMouse) + this.#getLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 5)
      const wordWidth = this.#getWordWidth(element.textContent);
      const maxWidth = this.#getMaxWidth();
      const elementBodyWidth = document.body.getBoundingClientRect().width;

      // Seems that some browsers discard the real width of elements
      const window_size_remainder = Math.round(elementBodyWidth) - elementBodyWidth
      const window_size_odd = Math.round(elementBodyWidth) - Math.floor(elementBodyWidth)
      const window_ratio_offset = window_size_odd + window_size_remainder

      let yColStartIndex = this.#getPaddingForIndex(startId);
      let top = this.#getYValueFromIndex(endId);

      if (yColStartIndex + wordWidth > maxWidth) {
        yColStartIndex = this.#getPaddingForIndex(endId);
        yColStartIndex -= (wordWidth) - this.charHoverPadding;
      }

      const startCol = this.#getColFromIndex(startId)
      const endCol = this.#getColFromIndex(endId)

      if (endCol - startCol >= 1) {
        top = this.#getYValueFromIndex(endId);
        xOffset = `${this.#getPaddingForIndex(endId) + Math.round(this.charHoverPadding) + this.#getLeftPadding() + this.mouseLeftOffset - Math.floor(wordWidth)}px`;
      } else {
        top = this.#getYValueFromIndex(startId);
      }

      const yOffset = top + Number.parseFloat(this.fontSize) + this.mouseTopOffset
      element.style.transform = `translate(${Math.ceil(xOffset + window_ratio_offset) - 1}px, ${yOffset}px)`;
    }
  }


  #positionHighlight(element, startId, endId) {
    const selectedText = this.contentTextCleaned.substring(startId, endId + 1).trim();
    const yOffset = this.#getYValueFromIndex(startId) - this.charHoverPaddingMouse + this.mouseTopOffset
    const xOffset = this.#getPaddingForIndex(startId) + Math.floor(this.charHoverPaddingMouse) + this.#getLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 5)

    const elementBodyWidth = document.body.getBoundingClientRect().width;

    // Seems that some browsers discard the real width of elements
    const window_size_remainder = Math.round(elementBodyWidth) - elementBodyWidth
    const window_size_odd = Math.round(elementBodyWidth) - Math.floor(elementBodyWidth)
    const window_ratio_offset = window_size_odd + window_size_remainder

    element.style.width = `${Math.ceil(this.#getWordWidth(selectedText))}px`;
    element.style.transform = `translate(${Math.ceil(xOffset + window_ratio_offset) - 1}px, ${yOffset}px)`;
  }

  #positionCommentForm() {
    // TODO switch to arr
    const startId = this.formElement.getAttribute("start")
    const endId = this.formElement.getAttribute("end")
    const rawId = `${startId}-${endId}`;

    const splits = this.floatingDivsSplit.get(rawId)
    splits.forEach(item => {
      item["elem"].style.opacity = 1.0;
    });

    const paddingOffset = Number.parseFloat(window.getComputedStyle(this.formElement, null).getPropertyValue('border-left-width'))
    const yOffset = this.#getYValueFromIndex(endId) + this.fontSizeRaw + Math.ceil(this.charHoverPaddingMouse) - paddingOffset - (this.fontSizeRaw / 10)
    const xOffset = Math.ceil(this.#getPaddingForIndex(startId)) + this.#getLeftPadding() + Math.floor(paddingOffset) + this.mouseLeftOffset

    this.formElement.style.transform = `translate(${Math.ceil(xOffset) - 1}px, ${yOffset}px)`;
  }

  #positionHighlightedText(element, key) {
    if (!element) {
      console.warn('Element is undefined or null in positionFloatingComment');
      return;
    }
    const startId = Number.parseInt(element["start"]);
    const endId = element["end"];
    const isHead = element["head"] == true;
    let highlightElement = element["elem"]

    try {
      this.#updateDivValues()
      let yCol1 = this.#getColFromIndex(startId);
      let yCol2 = this.#getColFromIndex(endId);
      const spanningColCount = this.#calcCols(startId, endId);
      const elementsRawUniqueId = key;

      if (spanningColCount > 1 && isHead) {
        let colorInt = element["colorId"]
        let backgroundColor = this.#getColor(Number.parseInt(colorInt))
        let lowerCol = yCol1;
        let upperCol = yCol2;
        let floatingDivSplit = this.floatingDivsSplit.get(elementsRawUniqueId);

        for (let c = lowerCol; c <= upperCol; c++) {
          let floatingDiv = null
          let isNewDiv = false;
          let currentHead = false
          let current_highlight_data = undefined

          if (floatingDivSplit.len != 0) {
            let current_highlight = floatingDivSplit.find((entry) => entry.col == c)

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
              floatingDiv.className = "highlightedText split";
            }

            floatingDiv.style.borderBottom = "2px solid transparent";
            floatingDiv.style.backgroundColor = backgroundColor

            let firstColStartIndex = this.wordStats[c][1];
            let firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;

            if (c == lowerCol && c == upperCol) {
              firstColEndIndex = endId
              firstColStartIndex = startId;
            } else if (c === lowerCol) {
              // First column
              firstColStartIndex = startId;
              firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;
            } else if (c === upperCol) {
              // Last column
              firstColStartIndex = this.wordStats[c][1];
              firstColEndIndex = endId
              floatingDiv.style.borderBottom = "2px solid blue";
            } else {
              // Middle columns
              firstColStartIndex = this.wordStats[c][1];
              firstColEndIndex = this.wordStats[c + 1][1] - 1;
            }

            this.#positionHighlight(floatingDiv, firstColStartIndex, firstColEndIndex)
            if (isNewDiv) {
              document.body.appendChild(floatingDiv);
              floatingDiv.opacity = this.unfocusedOpacity
              this.floatingDivsSplit.get(elementsRawUniqueId).push({
                col: c,
                elem: floatingDiv,
                start: firstColStartIndex,
                end: firstColEndIndex
              });
            } else if (!currentHead) {
              current_highlight_data["c"] = c
              current_highlight_data["elem"] = floatingDiv
              current_highlight_data["start"] = firstColStartIndex
              current_highlight_data["end"] = firstColEndIndex
            }
          }
        }
        this.floatingDivsSplit.set(
          elementsRawUniqueId,
          this.floatingDivsSplit
            .get(elementsRawUniqueId)
            .filter((item) => {
              if (item.col > upperCol || item.col < lowerCol) {
                item["elem"].remove();
                return false;
              }
              return true;
            })
        );
      } else if (highlightElement.style.display === "none" && (yCol1 === yCol2)) {
        highlightElement.style.display = "inline";
      }
      if (isHead) {
        let colorInt = element["colorId"]
        let backgroundColor = this.#getColor(Number.parseInt(colorInt))
        highlightElement.style.backgroundColor = backgroundColor
      }
      this.#positionHighlight(highlightElement, startId, endId)
    } catch (error) {
      console.error('Error in positionFloatingComment:', error);
    }
  }



  #hoveringComment() {
    this.floatingComments.forEach((div) => {
      const startId = Number.parseInt(div.getAttribute("start"));
      const endId = Number.parseInt(div.getAttribute("end"));
      const currentMouseIndex = this.#getCurrentMouseIndex();

      let isInside = (currentMouseIndex >= startId && currentMouseIndex <= endId) && !this.#isMouseLastIndex()

      const splits = this.floatingDivsSplit.get(`${startId}-${endId}`)
      if (isInside) {
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
    });
  }

  #handleMouseMove = (event) => {
    this.relativeX = event.clientX - this.#getLeftPadding();
    this.relativeY = event.clientY - this.#getTopWordPadding();

    // Single division operation
    this.mouseCol = Math.floor(this.relativeY / this.#getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.#getWordColCount()));

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    let letterIndex = this.#getLetterIndexByWidth(startIndex, endIndex, this.relativeX);

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.#getCharacterWidth(char);

      // TODO move into form create
      let formHoveringIndicator = document.getElementById("formHoverIndicator")
      if (formHoveringIndicator) {
        formHoveringIndicator.textContent = `Last Hovered: (${letterIndex},${this.mouseColSafe}) - ${char}`
      }
      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.#getCumulativeWidth(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}`;
      this.#hoveringComment()
    }
  };




  #handleMouseDown = (event) => {
    let relativeX = event.clientX - this.#getLeftPadding() + this.charHoverPaddingMouse;

    this.mouseCol = Math.floor(this.relativeY / this.#getTextYSections());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.#getWordColCount()));
    if (!this.formIsActive) {
      const startIndex = this.wordStats[this.mouseColSafe][1];
      const endIndex = this.mouseColSafe === this.#getWordColCount()
        ? this.contentTextCleaned.length
        : this.wordStats[this.mouseColSafe + 1][1];

      // Use binary search to find letter index
      let letterIndex = this.#getLetterIndexByWidth(startIndex, endIndex, relativeX);
      this.startLetterIndex = letterIndex;
    }
  };

  #handleMouseUp = (event) => {
    // need the mouse to be over the whole char so consider it selected
    let relativeX = event.clientX - this.#getLeftPadding();

    if (relativeX % this.charHoverPadding != 0) {
      relativeX -= this.charHoverPaddingMouse
    }

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    if (!this.formIsActive) {
      this.endLetterIndex = this.#getLetterIndexByWidth(startIndex, endIndex, relativeX);

      if (this.startLetterIndex > this.endLetterIndex) {
        [this.startLetterIndex, this.endLetterIndex] = [this.endLetterIndex, this.startLetterIndex];
        this.startLetterIndex++
      }

      let totalLength = this.endLetterIndex - this.startLetterIndex;

      if (totalLength > 1) {
        this.#createHighlight();
        this.#createForm(this.startLetterIndex, this.endLetterIndex)
        this.#repositionItems()
      }
    }
  };


  #formCommentSubmission(submission) {
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
    this.#removeForm(formId);
  }

  // TODO fix positioning
  #createForm(startIndex, endIndex) {
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
    this.formElement = floatingDivForm


    const splits = this.floatingDivsSplit.get(rawId)
    splits.forEach(item => {
      item["elem"].style.opacity = 1.0;
    });
    this.#positionCommentForm();
    const radioButtons = floatingDivForm.querySelectorAll('input[name="commentType"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        const selectedId = parseInt(event.target.value, 10);

        // Update the highlight in commentHighlights if applicable
        if (this.floatingDivsSplit.has(rawId)) {
          this.#updateHighlightColorsId(rawId, selectedId)
        }
      });
    });

    // Add event listener to close button
    const closeButton = floatingDivForm.querySelector('.close-btn');
    closeButton.addEventListener('click', () => this.#closeForm());

    // Add event listener for form submission
    const form = floatingDivForm.querySelector('form');
    form.addEventListener('submit', (event) => this.#formCommentSubmission(event));
    document.body.appendChild(floatingDivForm);
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

    if (!this.floatingDivsSplit.has(rawUniqueId)) {
      const commentHighlight = document.createElement("div");
      commentHighlight.className = "highlightedText split";

      let newObj = {
        head: true,
        elem: commentHighlight,
        start: Number.parseInt(startIndex),
        end: Number.parseInt(endIndex),
        colorId: Number.parseInt(1)
      }

      // Initialize with an array containing the first object
      // two comments wont have the same sawUniqueId so we should awlays make it here
      // unique id is gen by mouse down letter index  and mouse up letter index
      this.floatingDivsSplit.set(rawUniqueId, [newObj]);
      this.#positionHighlightedText(newObj, rawUniqueId);
    }
    // Initially position the div
    this.#repositionItems()
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
    document.addEventListener("mousemove", this.#handleMouseMove);
    this.highlightedDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.highlightedDiv.addEventListener("mouseup", this.#handleMouseUp);
  }

  #repositionItems() {
    // TODO Just use the divs
    this.floatingComments.forEach((div) => {
      this.#positionCommentContent(div);
    });

    this.floatingDivsSplit.forEach((divArray, key) => {
      divArray.forEach((divsplit) => {
        this.#positionHighlightedText(divsplit, key);
      });
    });

    if (this.formElement) {
      this.#positionCommentForm()
    }
  }

  #calcWordPositions() {
    const widthCache = [[0, 0]];
    let maxWidth = Math.ceil(this.#getMaxWidth());
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

    this.wordArray.forEach((word) => {
      const currentWordWidth = this.#getWordWidth(word);
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

  #getWidthFromRange(startIndex, yColIndex) {
    if (startIndex < 0 || yColIndex < 0) return null
    let cumulativeWidth = 0;
    for (let i = startIndex; i < this.contentTextCleaned.length; i++) {
      if (i == yColIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  #getPaddingForIndex(startIndex) {
    if (startIndex < 0) return null

    let colStartIndex = this.#getStartIndexFromIndex(startIndex);

    if (colStartIndex < 0) return null

    let cumulativeWidth = 0;
    for (let i = colStartIndex; i < this.contentTextCleaned.length; i++) {
      if (i == startIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  #getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(2));
    }
    return this.widthCache[char];
  }

  #getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.#getCharacterWidth(char), 0);
  }

  #getStartIndexFromIndex(startLetterIndex) {
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

  #getColFromIndex(startLetterIndex) {
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

  #getYValueFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastColIndex = this.wordStats[this.wordStats.length - 1][1]

    if (lastColIndex <= startLetterIndex) {
      return ((this.wordStats.length - 1) * this.#getTextYSections()) + this.#getTopWordPadding();
    }

    for (const value of Object.values(this.wordStats)) {
      let yPx = (value[0] * this.#getTextYSections()) + this.#getTopWordPadding();

      if (startLetterIndex < value[1]) {

        return previousValue !== null ? previousValue : yPx;
      }
      previousValue = yPx;
    }

    return null;
  }

  #updateDivValues() {
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.wordStats = this.#calcWordPositions();
  }

  #handleResizeOrScroll = () => {
    this.#updateDivValues();
    this.#repositionItems();
  };

  #calcCols(startIndex, endIndex) {
    // there is always one col
    return (this.#getColFromIndex(endIndex) - this.#getColFromIndex(startIndex)) + 1
  }

  createTextHighlight(startIndex, endIndex, textContent, comment, colorId) {
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }

    if (textContent[startIndex] === " ") startIndex++;
    if (textContent[endIndex] === " ") endIndex--;

    const rawUniqueId = `${startIndex}-${endIndex}`;
    const selectedId = parseInt(colorId);
    const color = this.#getColor(selectedId);

    if (!this.floatingComments.has(rawUniqueId)) {
      const floatingComment = document.createElement("div");
      floatingComment.id = `floating-${startIndex}-${endIndex}`;
      floatingComment.className = "highlightComment";
      floatingComment.textContent = comment
      floatingComment.style.width = `${this.#getWordWidth(comment)}px`;
      floatingComment.setAttribute("start", startIndex)
      floatingComment.setAttribute("end", endIndex)
      floatingComment.setAttribute("rawId", rawUniqueId)
      floatingComment.setAttribute("commentType", selectedId)
      floatingComment.style.backgroundColor = color;
      this.floatingComments.set(rawUniqueId, floatingComment);
      document.body.appendChild(floatingComment);
    }

    if (!this.floatingDivsSplit.has(rawUniqueId)) {
      const commentHighlight = document.createElement("div");
      commentHighlight.className = "highlightedText split";
      // this.createTextHighlight.set(rawUniqueId, commentHighlight);
      let floatingDivSplit = this.floatingDivsSplit.get(rawUniqueId);

      let newObj = {
        head: true,
        elem: commentHighlight,
        start: Number.parseInt(startIndex),
        end: Number.parseInt(endIndex),
        colorId: Number.parseInt(colorId),
        col: this.#getColFromIndex(Number.parseInt(startIndex))
      }

      if (!floatingDivSplit) {
        // Initialize with an array containing the first object
        // two comments wont have the same sawUniqueId so we should awlays make it here
        // unique id is gen by mouse down letter index  and mouse up letter index
        this.floatingDivsSplit.set(rawUniqueId, [newObj]);
      }

      this.#positionHighlightedText(newObj, rawUniqueId);
      document.body.appendChild(commentHighlight);
      this.#repositionItems()
    }
    this.#positionCommentContent(this.floatingComments.get(rawUniqueId));
    this.#repositionItems()
  }

  printOutWordStats() {
    let printString = ""
    for (let i = 0; i < this.wordStats.length - 1; i++) {
      const start = this.wordStats[i][1];
      const end = this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)} ${this.#getWidthFromRange(start, end)}\n`;
    }
    // Print last line
    const lastIndex = this.wordStats[this.wordStats.length - 1];
    printString += `${this.wordStats.length - 1} ${this.contentTextCleaned.slice(lastIndex[1])}`;
    console.log(printString)
  }

  #getColor(id) {
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

  #removeHighlights(id) {
    this.floatingDivsSplit.get(id).map((item) => {
      let element = item["elem"]
      element.remove()
    })
    this.floatingDivsSplit.delete(id)
  }

  // Binary search for letter index based on width
  #getLetterIndexByWidth(start, end, targetWidth) {
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
        sum += this.#getCharacterWidth(this.contentTextCleaned[i]);
      }
      this.#widthSums.set(key, sum);
    }
    return this.#widthSums.get(key);
  }

  #removeForm() {
    let form = this.formElement
    if (form) {
      window.getSelection().removeAllRanges();
      form.remove()
      this.formIsActive = false;
      this.formElement = null
    }
  }

  #closeForm() {
    if (this.formElement) {
      let x = this.formElement.getAttribute("start")
      let y = this.formElement.getAttribute("end")
      this.#removeHighlights(`${x}-${y}`)
      this.#removeForm()
    }
  }

  #updateHighlightColorsId(rawId, colorId) {
    let items = this.floatingDivsSplit.get(rawId)
    if (items) {
      const selectedId = parseInt(colorId);
      const color = this.#getColor(selectedId);
      items.map((item) => {
        item["elem"].style.backgroundColor = color
        if (item["head"] == true) {
          item["colorId"] = selectedId
        }
      })
    }
  }

  #getCurrentMouseIndex() {
    return this.#getLetterIndexByWidth(this.wordStats[this.mouseColSafe][1], this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1], this.relativeX)
  }

  #getMaxWidth() {
    return this.divRect.width
  }

  #getTextYSections() {
    return this.divRect.height / (this.wordStats.length);
  }

  #getLeftPadding() {
    return this.divRect.left
  }

  #getWordColCount() {
    return this.wordStats.length - 1
  }

  #getTopWordPadding() {
    return this.divRect.top
  }

  #isMouseLastIndex() {
    return this.wordStats
      .slice(1)
      .some(stat => (stat[1] - 1) === this.#getCurrentMouseIndex());
  }
  // #endregion
}
