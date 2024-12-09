
// TODO public function to create highlight
// TODO public function to check if word is highlighted
// TODO better function names
// TODO function to set highlight colors
// TODO function to enable ids on highlight elements
// Or just return array of elements for "search"
// TODO submission api
export class TextHighlighter {
  static TEXT_RENDER_BUFFER = 3;
  static FORM_HTML = `
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

  // Cache cumulative widths
  #widthSums = new Map();
  constructor(highlightedDiv, outputHoverId) {
    this.MIN_FORM_OPACITY = 0.10
    this.DISTANCE_FORM_POWER = 0.8
    this.MAX_DISTANCE_FORM_DIVISOR = 6
    this.HOVER_TRANSITION_DURATION = 150;
    this.UNFOCUSED_OPACITY = 0.2;
    this.widthCache = {};
    this.startLetterIndex = -1;
    this.endLetterIndex = -1;
    this.mouseCol = 0;
    this.mouseColSafe = 0;
    this.relativeY = 0;
    this.relativeX = 0;

    this.floatingDivsSplit = new Map();

    this.mouseTopOffset = window.scrollY;
    this.mouseLeftOffset = window.scrollX;
    this.context = document.createElement("canvas").getContext("2d");

    this.highlightedDiv = document.getElementById(highlightedDiv);
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
    this.charHoverPaddingMouse = this.charHoverPadding / (parseFloat(this.fontSize) / 10);
    this.formIsActive = false
    this.#addEventListeners();
    this.createTextHighlight(739, 752, this.contentTextCleaned, "Woah this is going somewhere woo hoo", 2)

    this.formElement = null;
  }

  #positionCommentContent(commentObj) {
    const element = commentObj.elem
    if (element) {
      const startId = commentObj.start;
      const endId = commentObj.end
      let xOffset = this.#getPaddingForIndex(startId) + Math.floor(this.charHoverPaddingMouse) + this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 5)
      const wordWidth = this.#getWordWidth(element.textContent);
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const startCol = this.#getIndexColumnNumber(startId)
      const endCol = this.#getIndexColumnNumber(endId)

      let yColStartIndex = this.#getPaddingForIndex(startId);
      let top = this.#getTopPaddingForIndex(endId);

      // make sure comment doesnt go off screen
      if (yColStartIndex + wordWidth > maxWidth) {
        xOffset = this.#getPaddingForIndex(endId);
        xOffset -= wordWidth - this.charHoverPadding;
      } else if (endCol - startCol >= 1) {
        top = this.#getTopPaddingForIndex(endId);
        xOffset = this.#getPaddingForIndex(endId) + Math.round(this.charHoverPadding) + this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset - Math.floor(wordWidth);
      } else {
        top = this.#getTopPaddingForIndex(startId);
      }

      const yOffset = top + Number.parseFloat(this.fontSize) + this.mouseTopOffset

      element.style.transform = `translate(${Math.ceil(xOffset) - 1}px, ${yOffset}px)`;
    }
  }


  #positionHighlight(element, startId, endId) {
    if (element != null) {
      // console.log(element)
      const selectedText = this.contentTextCleaned.substring(startId, endId + 1).trim();
      const yOffset = this.#getTopPaddingForIndex(startId) - this.charHoverPaddingMouse + this.mouseTopOffset
      const xOffset = this.#getPaddingForIndex(startId) + Math.floor(this.charHoverPaddingMouse) + this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset - (Number.parseInt(this.fontSize) / 5)

      // Seems that some browsers discard the real width of elements
      const elementBodyWidth = document.body.getBoundingClientRect().width;
      const window_size_remainder = Math.round(elementBodyWidth) - elementBodyWidth
      const window_size_odd = Math.round(elementBodyWidth) - Math.floor(elementBodyWidth)
      const window_ratio_offset = window_size_odd + window_size_remainder

      element.style.width = `${Math.ceil(this.#getWordWidth(selectedText))}px`;
      element.style.transform = `translate(${Math.ceil(xOffset + window_ratio_offset) - 1}px, ${yOffset}px)`;
    } else {
      console.log("bad element")
    }
  }

  #positionCommentForm() {
    if (this.formElement["elem"]) {
      const startId = this.formElement["start"]
      const endId = this.formElement["end"]
      const elem = this.formElement["elem"]
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const yColStartIndex = this.#getPaddingForIndex(startId);
      const formWidth = this.formElement["elem"].getBoundingClientRect().width
      const paddingOffset = Number.parseFloat(window.getComputedStyle(elem).getPropertyValue('border-left-width'))
      const yOffset = this.#getTopPaddingForIndex(endId) + this.fontSizeRaw + Math.ceil(this.charHoverPaddingMouse) - paddingOffset - (this.fontSizeRaw / 10)

      let xOffset = Math.ceil(this.#getPaddingForIndex(startId)) + this.#getHighlightAreaLeftPadding()

      if (yColStartIndex + formWidth > maxWidth) {
        xOffset = this.#getPaddingForIndex(endId);
        xOffset -= formWidth - this.charHoverPadding;
      }

      elem.style.transform = `translate(${Math.ceil(xOffset) - 1}px, ${yOffset}px)`;
    }
  }

  #updateHighlightElements(key, startId, endId) {
    this.#updateDivValues()

    const spanningColCount = this.#calcCols(startId, endId);
    const elementsRawUniqueId = key;

    let yCol1 = this.#getIndexColumnNumber(startId);
    let yCol2 = this.#getIndexColumnNumber(endId);

    let highlightSplits = this.floatingDivsSplit.get(key).splits
    let commentType = this.floatingDivsSplit.get(key).comment.type

    if (spanningColCount >= 1) {
      let backgroundColor = this.#getColor(Number.parseInt(commentType))
      let lowerCol = yCol1;
      let upperCol = yCol2;

      for (let c = lowerCol; c <= upperCol; c++) {
        let floatingDiv = null
        let isNewDiv = false;
        let currentHead = false
        let current_highlight_data = undefined
        let current_highlight = highlightSplits.find((entry) => entry.col == c)

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

        if (this.formIsActive) {
          let formId = `${this.formElement.start}-${this.formElement.end}`
          if (formId == key) {
            floatingDiv.style.opacity = 1
          }
        }

        floatingDiv.style.backgroundColor = backgroundColor

        let firstColStartIndex = this.wordStats[c][1];
        let firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;

        if (c == lowerCol && c == upperCol) {
          firstColEndIndex = endId
          firstColStartIndex = startId;
        } else if (c === lowerCol) {
          // First column
          firstColStartIndex = startId;
        } else if (c === upperCol) {
          // Last column
          firstColStartIndex = this.wordStats[c][1];
          firstColEndIndex = endId
        } else {
          // Middle columns
          firstColStartIndex = this.wordStats[c][1];
          firstColEndIndex = this.wordStats[c + 1][1] - 1;
        }

        if (isNewDiv) {
          document.body.appendChild(floatingDiv);
          this.floatingDivsSplit.get(elementsRawUniqueId)["splits"].push({
            col: c,
            elem: floatingDiv,
            start: firstColStartIndex,
            end: firstColEndIndex
          });
        } else if (!currentHead) {
          current_highlight_data["col"] = c
          current_highlight_data["elem"] = floatingDiv
          current_highlight_data["start"] = firstColStartIndex
          current_highlight_data["end"] = firstColEndIndex
        }
      }

      this.floatingDivsSplit.set(
        elementsRawUniqueId,
        {
          comment: this.floatingDivsSplit
            .get(elementsRawUniqueId)["comment"],
          splits: highlightSplits.filter((item) => {
            if (item.col > upperCol || item.col < lowerCol) {
              item["elem"].remove();
              return false;
            }
            return true;
          }),
          start: startId,
          end: endId
        }
      );
    }
  }

  #hoveringComment() {


    this.floatingDivsSplit.forEach((div) => {
      const startId = div.start;
      const endId = div.end;
      let timeoutId;
      const currentMouseIndex = this.#getCurrentMouseIndex();

      const isInside = (currentMouseIndex >= startId && currentMouseIndex <= endId) && !this.#isMouseLastIndex()

      const comment = div.comment.elem
      if (comment) {
        const splits = div.splits

        if (isInside) {
          clearTimeout(timeoutId);  // Clear any pending z-index changes
          comment.style.opacity = 1
          comment.style.zIndex = 50
          splits.forEach(item => {
            item["elem"].style.opacity = 1;
          });
        } else {
          console.log("other")

          splits.forEach(item => {
            item["elem"].style.opacity = this.UNFOCUSED_OPACITY;
          });
          if (comment.style.opacity == 1) {
            comment.style.opacity = 0
          }
          if (comment.style.opacity == 0) {
            timeoutId = setTimeout(() => {
              // Double-check opacity is still 0 before changing z-index
              if (comment.style.opacity == 0) {
                comment.style.zIndex = 5;
              }
            }, this.HOVER_TRANSITION_DURATION);
          }

        }
      }
    });
  }

  #getCurrentHoveredLetter() {
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    return this.#getLetterIndexByWidth(startIndex, endIndex, this.relativeX);
  }

  #handleMouseMove = (event) => {
    this.relativeX = event.clientX - this.#getHighlightAreaLeftPadding();
    this.relativeY = event.clientY - this.#getHighlightAreaTopPadding();

    // Single division operation
    this.mouseCol = Math.floor(this.relativeY / this.#getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.#getWordColCount()));

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];

    // Use binary search to find letter index
    const letterIndex = this.#getCurrentHoveredLetter()

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.#getCharacterWidth(char);

      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.#getCumulativeWidthForIndexRange(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}`;

      this.#liveItems()
    }
  };

  #handleMouseDown = (event) => {
    let relativeX = event.clientX - this.#getHighlightAreaLeftPadding() + this.charHoverPaddingMouse;

    this.mouseCol = Math.floor(this.relativeY / this.#getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.#getWordColCount()));

    if (!this.formIsActive) {
      const startIndex = this.wordStats[this.mouseColSafe][1];
      const endIndex = this.mouseColSafe === this.#getWordColCount()
        ? this.contentTextCleaned.length
        : this.wordStats[this.mouseColSafe + 1][1];

      this.startLetterIndex = this.#getLetterIndexByWidth(startIndex, endIndex, relativeX);
    }
  };

  #handleMouseUp = (event) => {
    // need the mouse to be over the whole char so consider it selected
    let relativeX = event.clientX - this.#getHighlightAreaLeftPadding();

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
      if (this.contentTextCleaned[this.startLetterIndex] === " ") this.startLetterIndex++;
      if (this.contentTextCleaned[this.endLetterIndex] === " ") this.endLetterIndex--;
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
    const startIndex = this.formElement["start"];
    const endIndex = this.formElement["end"];
    const comment = form.comment.value;
    const selectedRadio = form.querySelector('input[name="commentType"]:checked');
    const commentTypeId = parseInt(selectedRadio.value);

    // Prevent default form submission
    submission.preventDefault();
    // TODO Api call

    // TODO swap out client side
    // Create the highlight with the comment
    const builtComment = {
      elem: this.#buildComment(comment, commentTypeId),
      start: startIndex,
      end: endIndex
    }

    this.floatingDivsSplit.get(`${startIndex}-${endIndex}`)["comment"] = builtComment
    this.#positionCommentContent(builtComment)

    // Remove the form after submission
    this.#removeForm(this.formElement["elem"].id);
  }

  #createForm(startIndex, endIndex) {
    this.formIsActive = true;
    const rawId = `${startIndex}-${endIndex}`;
    const id = `form-${rawId}`;
    const elementString = TextHighlighter.FORM_HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(elementString, 'text/html');
    const floatingDivForm = doc.body.firstElementChild;
    const radioButtons = floatingDivForm.querySelectorAll('input[name="commentType"]');

    const formElement = floatingDivForm.querySelector('form');
    formElement.addEventListener('submit', (event) => this.#formCommentSubmission(event));

    const closeButton = floatingDivForm.querySelector('.close-btn');
    closeButton.addEventListener('click', () => this.#closeForm());

    floatingDivForm.id = id;
    floatingDivForm.className = "floatingForm";

    // Add event listener for form submission
    const formHoveringIndicator = formElement.querySelector('small');

    this.formElement = {
      elem: floatingDivForm,
      start: startIndex,
      end: endIndex,
      mouseInfo: formHoveringIndicator
    }

    radioButtons.forEach(radio => {
      radio.addEventListener('change', (event) => {
        const selectedId = parseInt(event.target.value, 10);

        // Update the highlight in commentHighlights if applicable
        if (this.floatingDivsSplit.has(rawId)) {
          this.#updateHighlightColorsId(rawId, selectedId)
        }
      });
    });

    document.body.appendChild(floatingDivForm);
    this.#positionCommentForm();
  }

  #createHighlight() {
    let startIndex = Number.parseInt(this.startLetterIndex)
    let endIndex = Number.parseInt(this.endLetterIndex)

    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }

    if (this.contentTextCleaned[startIndex] === " ") startIndex++;
    if (this.contentTextCleaned[endIndex] === " ") endIndex--;
    // add example spans below

    const rawUniqueId = `${startIndex}-${endIndex}`;

    if (!this.floatingDivsSplit.has(rawUniqueId)) {
      // Initialize with an array containing the first object
      // two comments wont have the same UniqueId, so we should always make it here
      // unique id is gen by mouse down letter index  and mouse up letter index
      this.floatingDivsSplit.set(rawUniqueId, {
        comment: {
          elem: null,
          start: null,
          end: null,
          // TODO set default type id
          type: 2
        },
        splits: [],
        start: startIndex,
        end: endIndex
      });

      this.#repositionItems()
    }
  }


  // #region Utility


  #addEventListeners() {
    window.addEventListener("resize", this.#handleResizeOrScroll);
    window.addEventListener("scroll", () => {
      this.mouseTopOffset = window.scrollY;
      // 🤓 Horizontal scroll 👆
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


  // Sets the forms opacity based on the distance from the mouse
  #updateFormTransparency() {
    if (this.formElement) {
      const indicator = this.formElement["mouseInfo"]
      const formRect = this.formElement["elem"].getBoundingClientRect()
      const leftBound = formRect.left
      const rightBound = formRect.right
      const topBound = formRect.top
      const bottomBound = formRect.bottom

      // Check if inside bounds
      const isInsideForm = event.clientX <= rightBound && event.clientX >= leftBound
        && event.clientY >= topBound && event.clientY <= bottomBound

      if (isInsideForm) {
        this.formElement["elem"].style.opacity = 1
      } else {
        // Calculate horizontal and vertical distances
        let dx = 0
        let dy = 0

        // Horizontal distance
        if (event.clientX < leftBound) dx = leftBound - event.clientX
        else if (event.clientX > rightBound) dx = event.clientX - rightBound

        // Vertical distance
        if (event.clientY < topBound) dy = topBound - event.clientY
        else if (event.clientY > bottomBound) dy = event.clientY - bottomBound

        // Calculate actual distance using Pythagorean theorem
        const distance = Math.sqrt(dx * dx + dy * dy)

        const maxDistance = Math.sqrt(
          window.innerWidth * window.innerWidth +
          window.innerHeight * window.innerHeight
        ) / this.MAX_DISTANCE_FORM_DIVISOR

        const opacity = Math.max(this.MIN_FORM_OPACITY, 1 - Math.pow(distance / maxDistance, this.DISTANCE_FORM_POWER))
        this.formElement["elem"].style.opacity = opacity
      }

      let letterIndex = this.#getCurrentHoveredLetter()
      if (indicator) {
        indicator.textContent = `Last Hovered: (${this.contentTextCleaned[letterIndex]},${this.mouseColSafe}) - ${letterIndex}`
      }
    }
  }

  #liveItems() {
    this.#hoveringComment()
    this.#updateFormTransparency()
  }

  // Updates items that depend on window size or related
  #repositionItems() {
    this.floatingDivsSplit.forEach((divArray, key) => {
      const highlightSplits = divArray["splits"]
      this.#updateHighlightElements(key, divArray.start, divArray.end);

      if (highlightSplits) {
        highlightSplits.forEach((split) => {
          this.#positionHighlight(split.elem, split.start, split.end)
        })
      }

      this.#positionCommentContent(divArray["comment"])
    });
  }

  // Creates an array that corresponds to the text on screen
  #calcWordPositions() {
    const widthCache = [[0, 0]];
    let maxWidth = Math.ceil(this.#getHighlightAreaMaxWidth());
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

    // Remember the text content is just one long string
    this.wordArray.forEach((word) => {
      const currentWordWidth = this.#getWordWidth(word);
      const testWidth = currentWidth + currentWordWidth;

      // The last word can be found by assuming it doesnt end with a space
      // a non issue if it doesnt as the browser will display correct behavior
      // assumed behav = that the last word ends with a space
      let extra = word.endsWith(" ") ? 0 : this.spaceSize * -1;
      // First test: does word fit on current line with space?
      if (testWidth <= maxWidth + this.spaceSize + extra) {
        currentWidth = testWidth;
      } else {
        // If it doesn't fit, test without trailing space
        // Only subtract space if not last word and word has a space
        const endTest = Math.ceil(testWidth);

        if (endTest <= maxWidth + otherOff) {
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

  #getCumulativeWidthInsideIndexRange(startIndex, yColIndex) {
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

    let colStartIndex = this.#getStartIndexForIndex(startIndex);

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

  #getStartIndexForIndex(index) {
    let previousValue = null;
    let lastSize = this.wordStats[this.#getWordColCount()][1]
    if (index == 0) {
      return 0
    }
    if (lastSize <= index) {
      return lastSize
    }
    for (const value of Object.values(this.wordStats)) {
      if (index === value[1]) {
        return value[1];  // Exact match on boundary
      }
      if (index < value[1]) {
        return previousValue ? previousValue[1] : 0;  // Return previous boundary
      }
      previousValue = value;
    }

    return null;
  }

  #getIndexColumnNumber(index) {
    let previousValue = null;
    let lastSize = this.wordStats[this.#getWordColCount()][1]

    if (lastSize <= index) {
      return this.wordStats[this.#getWordColCount()][0]
    }
    for (const value of Object.values(this.wordStats)) {
      if (index < value[1]) {

        return previousValue ? previousValue[0] : null;
      }
      previousValue = value;
    }

    return null;
  }

  #getTopPaddingForIndex(index) {
    let previousValue = null;
    let lastColIndex = this.wordStats[this.#getWordColCount()][1]

    if (lastColIndex <= index) {
      return (this.#getWordColCount() * this.#getTextContentVerticalSectionCount()) + this.#getHighlightAreaTopPadding();
    }

    for (const value of Object.values(this.wordStats)) {
      let yPx = (value[0] * this.#getTextContentVerticalSectionCount()) + this.#getHighlightAreaTopPadding();

      if (index < value[1]) {
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
    if (this.formElement) {
      this.#positionCommentForm()
    }
  };

  #calcCols(startIndex, endIndex) {
    // there is always one col
    return (this.#getIndexColumnNumber(endIndex) - this.#getIndexColumnNumber(startIndex)) + 1
  }

  #buildComment(content, colorId) {
    const selectedId = parseInt(colorId);
    const color = this.#getColor(selectedId);
    const floatingComment = document.createElement("div");

    floatingComment.className = "highlightComment";
    floatingComment.textContent = content
    floatingComment.style.width = `${this.#getWordWidth(content)}px`;
    floatingComment.style.backgroundColor = color;
    document.body.appendChild(floatingComment);

    return floatingComment
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

    if (!this.floatingDivsSplit.has(rawUniqueId)) {
      const floatingComment = this.#buildComment(comment, selectedId)
      document.body.appendChild(floatingComment);
      let floatingDivSplit = this.floatingDivsSplit.get(rawUniqueId);

      if (!floatingDivSplit) {
        // Initialize with an array containing the first object
        // two comments wont have the same sawUniqueId so we should awlays make it here
        // unique id is gen by mouse down letter index  and mouse up letter index
        this.floatingDivsSplit.set(rawUniqueId, {
          comment: {
            elem: floatingComment,
            start: startIndex,
            end: endIndex
          },
          splits: [],
          start: startIndex,
          end: endIndex
        });
      }
      this.#repositionItems()
    }
  }

  printOutWordStats() {
    let printString = ""
    for (let i = 0; i < this.#getWordColCount(); i++) {
      const start = this.wordStats[i][1];
      const end = this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)} ${this.#getCumulativeWidthInsideIndexRange(start, end)}\n`;
    }
    // Print last line
    const lastIndex = this.wordStats[this.#getWordColCount()];
    printString += `${this.#getWordColCount()} ${this.contentTextCleaned.slice(lastIndex[1])}`;
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

  #removeFormHighlights(formId) {
    // This also removes the relevant comment, hmmm
    this.floatingDivsSplit.get(formId)["splits"].map((item) => {
      let element = item["elem"]
      element.remove()
    })
    this.floatingDivsSplit.delete(formId)
  }

  // Binary search for letter index based on width
  #getLetterIndexByWidth(start, end, targetWidth) {
    let low = start;
    let high = end;
    let cumulativeWidth = 0;

    // First check if we're beyond the total width
    const totalWidth = this.#getCumulativeWidthForIndexRange(start, end);
    if (targetWidth >= totalWidth) {
      return end - 1;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      cumulativeWidth = this.#getCumulativeWidthForIndexRange(start, mid + 1);

      if (cumulativeWidth === targetWidth) {
        return mid;
      }

      if (cumulativeWidth < targetWidth) {
        if (mid + 1 <= high &&
          this.#getCumulativeWidthForIndexRange(start, mid + 2) > targetWidth) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        if (mid - 1 >= low &&
          this.#getCumulativeWidthForIndexRange(start, mid) < targetWidth) {
          return mid;
        }
        high = mid - 1;
      }
    }

    return low;
  }

  #getCumulativeWidthForIndexRange(startIndex, endIndex) {
    const key = `${startIndex}-${endIndex}`;
    if (!this.#widthSums.has(key)) {
      let sum = 0;
      for (let i = startIndex; i < endIndex; i++) {
        sum += this.#getCharacterWidth(this.contentTextCleaned[i]);
      }
      this.#widthSums.set(key, sum);
    }
    return this.#widthSums.get(key);
  }

  #removeForm() {
    let form = this.formElement["elem"]

    if (form) {
      let x = this.formElement["start"]
      let y = this.formElement["end"]

      let highlights = this.floatingDivsSplit.get(`${x}-${y}`)
      if (highlights) {
        const splits = highlights["splits"]
        splits.forEach(item => {
          item["elem"].style.opacity = this.UNFOCUSED_OPACITY;
        });
      }

      window.getSelection().removeAllRanges();
      form.remove()
      this.formIsActive = false;
      this.formElement = null
    }
  }

  #closeForm() {
    if (this.formElement) {
      let x = this.formElement["start"]
      let y = this.formElement["end"]
      this.#removeFormHighlights(`${x}-${y}`)
      this.#removeForm()
    }
  }

  #updateHighlightColorsId(rawId, colorId) {
    this.floatingDivsSplit.get(rawId).comment.type = parseInt(colorId);
    let items = this.floatingDivsSplit.get(rawId).splits

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

  #getHighlightAreaMaxWidth() {
    return this.divRect.width
  }

  #getTextContentVerticalSectionCount() {
    return this.divRect.height / (this.wordStats.length);
  }

  #getHighlightAreaLeftPadding() {
    return this.divRect.left
  }

  #getWordColCount() {
    return this.wordStats.length - 1
  }

  #getHighlightAreaTopPadding() {
    return this.divRect.top
  }

  // Check if the mouse is over the last index of a row.
  #isMouseLastIndex() {
    return this.wordStats
      .slice(1)
      .some(stat => (stat[1] - 1) === this.#getCurrentMouseIndex());
  }
  // #endregion
}
