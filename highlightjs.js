// TODO function to enable ids on highlight elements
// Or just return array of elements for "search"
// TODO set text color for background

import { TextCalibrator } from "./text_calibrator.js";

export class TextHighlighter {
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

            </div>

            <button type="submit">Comment</button>
        </form>
        <button type="button" class="close-btn">X</button>
    </div>
`;

  // Cache cumulative widths
  constructor(highlightedDiv, outputHoverId) {
    if (!highlightedDiv || !outputHoverId) {
      throw new Error('highlightedDiv and outputHoverId are required');
    }

    this.highlightedDivId = highlightedDiv;
    this.outputHoverId = outputHoverId;
    this.TC = new TextCalibrator(highlightedDiv)
    // Set default values
    this._mouseUpFunction = this.defaultFormAction.bind(this);
    this._highlightSubmissionAPI = null;
    this._highlightColors = {
      1: 'black',     // Misc comments
      2: 'pink',      // Incorrect info
      3: 'lightblue', // Sources?
      4: 'skyblue',   // Question
      default: 'lightgreen' // Default color
    };
  }

  setSubmissionAPI(api) {
    this._highlightSubmissionAPI = api;
    return this;
  }

  setMouseUpFunction(fn) {
    this._mouseUpFunction = fn || this.defaultFormAction.bind(this);
    return this;
  }

  setHighlightColors(colors) {
    this._highlightColors = colors;
    return this;
  }

  setFormHTML(html) {
    this._defaultFormHTML = html;
    return this;
  }

  setFormTransparency(isTransparent) {
    this._formTransparency = isTransparent;
    return this;
  }

  #initializeConstants() {
    this.MIN_FORM_OPACITY = 0.10;
    this.DISTANCE_FORM_POWER = 0.8;
    this.MAX_DISTANCE_FORM_DIVISOR = 6;
    this.HOVER_TRANSITION_DURATION = 150;
    this.UNFOCUSED_OPACITY = 0.2;
    return this;
  }

  #initializeStyleSheet() {
    document.styleSheets[0].insertRule(`::selection {
        background: ${this.#getColor(1)};
        color: white;
    }`, 0);
    return this;
  }

  #initializeState() {
    this.mouseUpFunction = this._mouseUpFunction;
    this.highlightSubmissionAPI = this._highlightSubmissionAPI;
    this.highlightColors = this._highlightColors;
    this.defaultFormHTML = this._defaultFormHTML || TextHighlighter.FORM_HTML;
    this.formTransparency = this._formTransparency || false;
    this.widthCache = {};
    this.startLetterIndex = -1;
    this.endLetterIndex = -1;
    this.mouseCol = 0;
    this.mouseColSafe = 0;
    this.relativeY = 0;
    this.relativeX = 0;
    this.relativeYRaw = 0;
    this.relativeXRaw = 0;
    this.floatingDivsSplit = new Map();
    this.formIsActive = false;
    this.formElement = null;
    this.lastHoveredId = null
    return this;
  }

  #initializeDOMElements() {
    this.highlightedDiv = document.getElementById(this.highlightedDivId);
    this.outputHover = document.getElementById(this.outputHoverId);

    if (!this.highlightedDiv || !this.outputHover) {
      throw new Error('Could not find required DOM elements');
    }

    this.mouseTopOffset = window.scrollY;
    this.mouseLeftOffset = window.scrollX;
    this.context = document.createElement("canvas").getContext("2d");
    return this;
  }

  #initializeTextProcessing() {
    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontSizeRaw = Number.parseFloat(this.fontSize);
    this.fontFamily = computedStyle.fontFamily;
    this.lineHeight = parseFloat(computedStyle.fontSize) * 1.2;
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.context.font = `${this.fontSize} ${this.fontFamily}`;

    this.exactTextAreaWidth = this.TC.getTotalAreaWidth();
    this.contentTextCleaned = this.highlightedDiv.textContent
      .trim()
      .replace(/\t/g, "")
      .replace(/\n/g, " ");

    this.wordArray = this.contentTextCleaned
      .split(" ")
      .map((word, i, arr) => i < arr.length - 1 ? word + " " : word);

    this.characterWidth = this.TC.getCharacterWidth(" ");
    const offsetSpace = (this.characterWidth / (this.fontSizeRaw / 10));
    this.SELECTION_OFFSET = this.characterWidth + offsetSpace;
    this.SELECTION_OFFSET_NEGATIVE = this.characterWidth - offsetSpace;
    this.wordStats = this.TC.calcWordPositions();
    return this;
  }

  initialize() {
    try {
      this.#initializeConstants()
        .#initializeState()
        .#initializeDOMElements()
        .#initializeTextProcessing()
        .#initializeStyleSheet();

      this.#addEventListeners();
      return this;
    } catch (error) {
      throw new Error(`Initialization failed: ${error.message}`);
    }
  }

  // enables the submission form transparency
  toggleFormTransparency() {
    this.formTransparency = this.formTransparency ? true : false
  }

  // gets the index when the mouse was pressed
  getStartLetterIndex() {
    const startIndex = this.#cleanSelectionIndexes()[0]
    return startIndex
  }

  // gets the index when the mouse cursor was released
  getEndLetterIndex() {
    const endIndex = this.#cleanSelectionIndexes()[1]
    return endIndex
  }

  // gets the start and end indexes of 'word'
  getWordIndexes(word) {
    const startIndex = this.contentTextCleaned.indexOf(word)
    const endIndex = startIndex + word.length - 1

    return [startIndex, endIndex]
  }

  // Returns the highlight objects containing 'word'
  getWordHighlights(word) {
    let items = []
    this.floatingDivsSplit.forEach(highlightObj => {
      let section = this.contentTextCleaned.slice(highlightObj.start, highlightObj.end)
      if (section.includes(word)) {
        items.push(highlightObj)
      }
    })
    return items
  }

  setHighlightComment(comment, typeId) {
    console.log(typeId)
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
    const builtComment = {
      elem: this.#buildComment(comment, typeId),
      start: startIndex,
      end: endIndex
    }
    this.floatingDivsSplit.get(this.getRawId()).comment = builtComment
  }

  // Highlights
  // TODO fix comment not appearing unless scrolled
  // Updates the highlight elements, adjusting for screen size
  #updateHighlightElements(key) {
    this.#updateOffsetsAndBounds();
    const splitData = this.floatingDivsSplit.get(key);
    const { splits: highlightSplits, colorId, start: startId, end: endId } = splitData;
    const spanningColCount = this.TC.calcColsInRange(startId, endId);

    if (spanningColCount < 1) return;

    const backgroundColor = this.#getColor(Number.parseInt(colorId));

    // Create a map for faster lookup of existing highlights
    const existingHighlights = new Map(
      highlightSplits.map(entry => [entry.col, entry])
    );

    const yCol1 = this.TC.getColumnForIndex(startId);
    const yCol2 = this.TC.getColumnForIndex(endId);

    // Pre-calculate form opacity
    const opacity = this.formIsActive &&
      this.formElement &&
      `${this.formElement.start}-${this.formElement.end}` === key ? 1 : undefined;

    // Prepare new splits array
    const newSplits = [];

    // Process each column
    for (let c = yCol1; c <= yCol2; c++) {
      let currentHighlight = existingHighlights.get(c);
      let floatingDiv;

      // Calculate column bounds once
      const colStartIndex = c === yCol1 ? startId : this.wordStats[c][1];
      const colEndIndex = c === yCol2 ? endId :
        (this.wordStats[c + 1] ? this.wordStats[c + 1][1] - 1 : this.wordStats[c][1] - 1);

      if (currentHighlight && currentHighlight.elem && !currentHighlight.head) {
        // Update existing highlight
        let cleanedEndIndex = colEndIndex
        if (this.contentTextCleaned[colEndIndex] === " ") {
          cleanedEndIndex--
        }
        floatingDiv = currentHighlight.elem;
        currentHighlight.start = colStartIndex;
        currentHighlight.end = cleanedEndIndex;
        currentHighlight.col = c;
      } else {
        // Create new highlight
        floatingDiv = document.createElement("div");
        floatingDiv.className = "highlightedText split";
        document.body.appendChild(floatingDiv);
        let cleanedEndIndex = colEndIndex
        if (this.contentTextCleaned[colEndIndex] === " ") {
          cleanedEndIndex--
        }
        currentHighlight = {
          col: c,
          elem: floatingDiv,
          start: colStartIndex,
          end: cleanedEndIndex
        };
      }

      // Apply styles
      floatingDiv.style.backgroundColor = backgroundColor;
      if (opacity !== undefined) {
        floatingDiv.style.opacity = opacity;
      }
      this.#positionHighlight(currentHighlight)
      newSplits.push(currentHighlight);
    }

    // Clean up old highlights outside the current range
    for (const [col, highlight] of existingHighlights) {
      if (col < yCol1 || col > yCol2) {
        highlight.elem.remove();
      }
    }

    // Update the stored data
    this.floatingDivsSplit.set(key, {
      ...splitData,
      splits: newSplits,
      start: startId,
      end: endId
    });
  }

  // Updates the color of the highlights for the given ID and color ID
  updateHighlightColorsId(rawId, colorId) {
    let items = this.floatingDivsSplit.get(rawId).splits

    if (items) {
      const selectedId = parseInt(colorId);
      this.floatingDivsSplit.get(rawId).comment.type = selectedId;
      this.floatingDivsSplit.get(rawId).colorId = selectedId;
      const color = this.#getColor(selectedId);

      items.map((item) => {
        item["elem"].style.backgroundColor = color
      })
    }
  }

  // Returns a tuple of the start and end indexes. Corrects the indexes during a 'reverse selection' additionally adjusts to not include trailing spaces
  #cleanSelectionIndexes() {
    let startIndex = Number.parseInt(this.startLetterIndex)
    let endIndex = Number.parseInt(this.endLetterIndex)
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }

    if (this.contentTextCleaned[startIndex] === " ") startIndex++;
    if (this.contentTextCleaned[endIndex] === " ") endIndex--;
    return [startIndex, endIndex]
  }

  // Creates a highlight
  createHighlight() {
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
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
          type: 1
        },
        splits: [],
        start: startIndex,
        end: endIndex,
        colorId: 1
      });

      this.#repositionItems()
    }
  }

  // Creates a highlight and comment based on the below params
  createTextHighlight(startIndex, endIndex, comment, colorId) {
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      startIndex++
    }

    if (this.contentTextCleaned[startIndex] === " ") startIndex++;
    if (this.contentTextCleaned[endIndex] === " ") endIndex--;

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
          end: endIndex,
          colorId: colorId
        });
      }

    }

    this.#repositionItems();
  }


  // #region Utility
  // Events

  // Gets the index of the character the mouse is hovering over
  #getCurrentMouseIndex() {
    return this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe)
  }

  // Get the current letter the mouse is hovering over
  #getCurrentHoveredLetter() {
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.TC.getEndIndex(this.mouseColSafe)

    // Use binary search to find letter index
    return this.TC.getLetterIndexByWidth(startIndex, endIndex, this.relativeX);
  }

  // Check if the mouse is over the last index of a row.
  #isMouseLastIndex() {
    return this.wordStats
      .slice(1)
      .some(stat => (stat[1] - 1) === this.#getCurrentMouseIndex());
  }

  // Changes the opacity of the given highlight and comment depending on if the mouse is within the indexes a highlight
  #handleMouseHoveringComment() {
    this.floatingDivsSplit.forEach((div) => {
      const startId = div.start;
      const endId = div.end;
      const currentMouseIndex = this.#getCurrentMouseIndex();
      const isInside = (currentMouseIndex >= startId && currentMouseIndex <= endId) && !this.#isMouseLastIndex()
      const comment = div.comment.elem
      let timeoutId;

      if (comment) {
        const splits = div.splits

        if (isInside) {
          clearTimeout(timeoutId);
          comment.style.opacity = 1
          comment.style.zIndex = 25
          splits.forEach(item => {
            item["elem"].style.opacity = 1;
          });
          this.lastHoveredId = `${startId}-${endId}`
        } else {
          splits.forEach(item => {
            item["elem"].style.opacity = this.UNFOCUSED_OPACITY;
          });
          if (comment.style.opacity == 1) {
            comment.style.opacity = 0
          }
          if (comment.style.opacity == 0) {
            timeoutId = setTimeout(() => {
              if (comment.style.opacity == 0) {
                comment.style.zIndex = 15;
              }
            }, this.HOVER_TRANSITION_DURATION);
          }
          this.lastHoveredId = null
        }
      }
    });
  }

  #handleMouseMove = (event) => {
    // make other vars to store last unmodified version
    // updated by recalling padding methdos
    this.relativeX = event.clientX - this.#getHighlightAreaLeftPadding() + this.SELECTION_OFFSET
    this.relativeY = event.clientY - this.#getHighlightAreaTopPadding();
    this.relativeXRaw = event.clientX
    this.relativeYRaw = event.clientY

    // Single division operation
    this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];

    // Use binary search to find letter index
    const letterIndex = this.#getCurrentHoveredLetter()

    if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.TC.getCharacterWidth(char);

      // Create the output string only if needed
      this.outputHover.textContent =
        `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
        `cumWidth: ${this.TC.getCumulativeWidthForIndexRange(startIndex, letterIndex).toFixed(2)}px, ` +
        `relX: ${this.relativeX.toFixed(2)}px) ${this.mouseCol} ${this.mouseColSafe}  ${event.clientX}  ${this.#getHighlightAreaLeftPadding()}`;

      this.#liveItems()
    }
  };

  // handles mouse up, behavior depends on the current form being inactive
  #handleMouseUp = () => {
    // Determine start and end indices once
    this.relativeX = event.clientX - this.#getHighlightAreaLeftPadding() + this.SELECTION_OFFSET_NEGATIVE
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.TC.getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1] - 1;

    if (!this.formIsActive) {
      this.endLetterIndex = this.TC.getLetterIndexByWidth(startIndex, endIndex, this.relativeX);

      [this.startLetterIndex, this.endLetterIndex] = this.#cleanSelectionIndexes()
      let totalLength = this.endLetterIndex - this.startLetterIndex;

      if (totalLength > 1) {
        this.mouseUpFunction()
      }
    }
  };

  #handleMouseDown = () => {
    this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));

    if (!this.formIsActive) {
      const startIndex = this.wordStats[this.mouseColSafe][1];
      const endIndex = this.mouseColSafe === this.TC.getWordColCount()
        ? this.contentTextCleaned.length
        : this.wordStats[this.mouseColSafe + 1][1] - 1;

      this.startLetterIndex = this.TC.getLetterIndexByWidth(startIndex, endIndex, this.relativeX);
    }
  };


  #handleMouseOutOpacity = () => {
    if (this.lastHoveredId) {
      const hoverSplitObject = this.floatingDivsSplit.get(this.lastHoveredId)
      const comment = hoverSplitObject.comment.elem

      if (comment) {
        hoverSplitObject.splits.forEach(item => {
          item["elem"].style.opacity = this.UNFOCUSED_OPACITY;
        });

        comment.style.opacity = 0

        setTimeout(() => {
          if (comment.style.opacity == 0) {
            comment.style.zIndex = 15;
          }
        }, this.HOVER_TRANSITION_DURATION);

      }
      this.lastHoveredId = null
    }
  }

  #addEventListeners() {
    window.addEventListener("resize", () => {
      this.TC.recalibrate();
      this.wordStats = this.TC.calcWordPositions();

      this.#handleResizeOrScroll()
    });
    window.addEventListener("scroll", this.#handleResizeOrScroll);

    this.highlightedDiv.addEventListener("mouseout", this.#handleMouseOutOpacity);
    this.highlightedDiv.addEventListener("mousemove", this.#handleMouseMove);
    this.highlightedDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.highlightedDiv.addEventListener("mouseup", this.#handleMouseUp);

    // Debug function
    document.addEventListener('keydown', (event) => {
      if (event.key === 'g') {
        this.printOutWordStats()
      }
    });
  }

  #liveItems() {
    this.#handleMouseHoveringComment()
    this.#updateFormTransparency()
  }

  // Positioning

  // Updates offsets and other positioning values
  #handleResizeOrScroll = () => {
    this.#repositionItems();
  };

  // Updates offsets, along with the current word data structure
  #updateOffsetsAndBounds() {
    this.mouseTopOffset = window.scrollY;
    // 🤓 Horizontal scroll 👆
    this.mouseLeftOffset = window.scrollX;
    this.divRect = this.highlightedDiv.getBoundingClientRect();
  }

  // Updates items that depend on window size or related
  #repositionItems() {
    this.floatingDivsSplit.forEach((divArray, key) => {
      this.#updateHighlightElements(key);
      this.#positionCommentContent(divArray["comment"])
    });
    if (this.formElement) {
      this.#positionCommentForm()
    }
  }

  // Used to force update positioning even if the mouse or other events haven't triggered
  repositionItems() {
    // Use the last mouse x and y as the mouse may not be moving
    this.relativeX = this.relativeXRaw - this.#getHighlightAreaLeftPadding() + this.SELECTION_OFFSET
    this.relativeY = this.relativeYRaw - this.#getHighlightAreaTopPadding();

    this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));

    this.#liveItems()
    this.#repositionItems()
  }

  // gets the max width of the highlight area
  #getHighlightAreaMaxWidth() {
    return this.TC.getTotalAreaWidth()
  }

  // gets the value of the padding to the left of the highlight area
  #getHighlightAreaLeftPadding() {
    return this.divRect.left
  }

  // gets the value of the distance of the highlight area
  #getHighlightAreaTopPadding() {
    return this.divRect.top;
  }

  // positions the given comment object for the highlight
  // makes sure the comment doesn't go offscreen
  // TODO handle long comments
  #positionCommentContent(commentObj) {
    const { start: startIndexComment, end: endIndexComment, elem: element } = commentObj;
    if (element) {
      const wordWidth = this.TC.getWordWidth(element.textContent);
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const isOutOfBounds = this.TC.getPaddingForIndex(startIndexComment) + wordWidth > maxWidth;
      const endLineStartIndex = this.TC.getStartIndexForIndex(endIndexComment)
      const isMultiLine = this.TC.calcColsInRange(startIndexComment, endIndexComment) > 1
      const top = this.#getTopPaddingForIndex(isMultiLine ? endIndexComment : startIndexComment);
      const yOffset = top + Number.parseFloat(this.fontSize) + this.mouseTopOffset

      let xOffset = this.TC.getPaddingForIndex(startIndexComment)

      // make sure comment doesn't go off screen
      if (isOutOfBounds || isMultiLine) {
        xOffset = this.TC.getCumulativeWidthForIndexRange(endLineStartIndex, endIndexComment - (element.textContent.length));
      }

      // make sure its not offscreen on the left
      if (xOffset < 0) {
        xOffset = 0
      }
      xOffset += this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }

  // positions the highlight based on its start and end id, along with updating the width
  #positionHighlight(highlight) {
    const { elem: element, start: startIndexHighlight, end: endIndexHighlight } = highlight
    if (element) {
      const yOffset = this.#getTopPaddingForIndex(startIndexHighlight) + this.mouseTopOffset
      const xOffset = this.TC.getPaddingForIndex(startIndexHighlight) + this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset
      element.style.width = `${this.TC.getCumulativeWidthForIndexRange(startIndexHighlight, endIndexHighlight)}px`;
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    } else {
      console.log("bad element")
    }
  }

  // gets the padding for the top of and index, this would technically be index -1 since we don't include the font size here
  #getTopPaddingForIndex(index) {
    // First check if index is beyond the last column
    let lastColIndex = this.wordStats[this.TC.getWordColCount()][1];
    if (lastColIndex <= index) {
      return (this.TC.getWordColCount() * this.TC.getTextContentVerticalSectionCount()) +
        this.#getHighlightAreaTopPadding();
    }

    // Binary search to find the correct column
    let left = 0;
    let right = this.TC.getWordColCount();

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
    return (left - 1) * this.TC.getTextContentVerticalSectionCount() +
      this.#getHighlightAreaTopPadding();
  }

  // gets the color for the given id
  #getColor(colorId) {
    return this.highlightColors[parseInt(colorId)] || this.highlightColors.default;
  }

  printOutWordStats() {
    let printString = ""
    for (let i = 0; i < this.TC.getWordColCount(); i++) {
      const start = this.wordStats[i][1];
      const end = this.wordStats[i + 1][1];
      printString += `${this.wordStats[i][0]} ${this.contentTextCleaned.slice(start, end)} ${this.TC.getCumulativeWidthInsideIndexRange(start, end)}\n`;
    }
    // Print last line
    const lastIndex = this.wordStats[this.TC.getWordColCount()];
    printString += `${this.TC.getWordColCount()} ${this.contentTextCleaned.slice(lastIndex[1])}`;
    console.log(printString)
    console.log(this.wordStats)
    console.log(this.floatingDivsSplit)
  }

  // #endregion

  // Dubious

  // removes the highlights for the given uniqueId
  #removeFormHighlights(uniqueId) {
    // This also removes the related comment, hmmm
    this.floatingDivsSplit.get(uniqueId)["splits"].map((item) => {
      let element = item["elem"]
      element.remove()
    })
    this.floatingDivsSplit.delete(uniqueId)
  }

  // Creates a comment element with the provided text content and colorId
  #buildComment(content, colorId) {
    const selectedId = parseInt(colorId);
    const color = this.#getColor(selectedId);
    const floatingComment = document.createElement("div");

    floatingComment.className = "highlightComment";
    floatingComment.textContent = content
    floatingComment.style.width = `${this.TC.getWordWidth(content)}px`;
    floatingComment.style.backgroundColor = color;
    document.body.appendChild(floatingComment);

    return floatingComment
  }

  // positions the location of the comment form
  #positionCommentForm() {
    const { elem: element, start: formStartIndex, end: formEndIndex } = this.formElement
    if (element) {
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const yColStartIndex = this.TC.getPaddingForIndex(formEndIndex);
      const formWidth = element.getBoundingClientRect().width
      const isOutOfBounds = yColStartIndex + formWidth > maxWidth
      const endStartIndex = this.TC.getStartIndexForIndex(formStartIndex)
      const isMultiLine = this.TC.calcColsInRange(formStartIndex, formEndIndex) >= 1

      const top = this.#getTopPaddingForIndex(isMultiLine ? formEndIndex : formStartIndex);

      let xOffset = this.TC.getPaddingForIndex(formEndIndex + 1)
      let yOffset = top + this.mouseTopOffset

      if (isOutOfBounds) {
        // make sure form doesn't go off screen
        yOffset += this.fontSizeRaw
        xOffset = this.TC.getPaddingForIndex(endStartIndex)
      }
      xOffset += this.#getHighlightAreaLeftPadding() + this.mouseLeftOffset
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }

  // Handles form/comment submission
  #formCommentSubmission(submission) {
    const form = submission.target;
    const startIndex = this.formElement["start"];
    const endIndex = this.formElement["end"];
    const comment = form.comment.value;
    const commentType = form.commentType.value;

    // Get the value from the hidden input instead of radio

    const commentTypeId = parseInt(commentType);

    // Add some debugging
    console.log('Form values:', {
      startIndex,
      endIndex,
      comment,
      commentTypeId,
      formElements: form.elements // see all form elements
    });

    submission.preventDefault();

    const builtComment = {
      elem: this.#buildComment(comment, commentTypeId),
      start: startIndex,
      end: endIndex
    }

    if (this.highlightSubmissionAPI != null) {
      this.postDataFetch(this.highlightSubmissionAPI,
        {
          ...builtComment,
          // TODO user ids? is this our problem, or should the end user be handling this themselves?
          id: crypto.randomUUID()
        }
      )
    }
    this.floatingDivsSplit.get(`${startIndex}-${endIndex}`)["comment"] = builtComment
    this.#positionCommentContent(builtComment)

    // Remove the form after submission
    this.#removeForm(this.formElement["elem"].id);
  }

  // creates a form element based on the start and end index of the highlight being created
  // these are used for positioning it
  #createForm(startIndex, endIndex) {
    const rawId = `${startIndex}-${endIndex}`;
    const id = rawId;
    const elementString = this.defaultFormHTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(elementString, 'text/html');
    const floatingDivForm = doc.body.firstElementChild;
    try {
      const formElement = floatingDivForm.querySelector('form');
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

      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'commentType';
      hiddenInput.value = '1';
      formElement.firstElementChild.appendChild(hiddenInput);
      const colorSquaresContainer = document.createElement('div');
      colorSquaresContainer.className = 'color-squares';

      // Create squares dynamically from the colors object
      Object.entries(this.highlightColors).forEach(([value, color]) => {
        // Skip the default color
        if (value !== 'default') {
          const square = document.createElement('button');
          square.type = 'button';
          square.className = 'color-square';
          square.dataset.value = value;
          square.style.backgroundColor = color;

          square.addEventListener('click', () => {
            // Remove selected class from all squares
            hiddenInput.value = value;

            colorSquaresContainer.querySelectorAll('.color-square')
              .forEach(s => s.classList.remove('selected'));
            square.classList.add('selected');
            window.getSelection().removeAllRanges();

            if (this.floatingDivsSplit.has(rawId)) {
              this.updateHighlightColorsId(rawId, value);
            }
          });

          colorSquaresContainer.appendChild(square);
        }
      });

      formElement.addEventListener('submit', (event) => this.#formCommentSubmission(event));

      const commentType = floatingDivForm.querySelector('#commentType');
      commentType.appendChild(colorSquaresContainer);
      this.formIsActive = true;

      document.body.appendChild(floatingDivForm);
      this.#positionCommentForm();
    } catch (e) {

      console.log(`its null, issue creating comment form
          The following classes need to be included
        ${e}`)
    }
  }

  // Sets the forms opacity based on its distance from the mouse
  #updateFormTransparency() {
    if (this.formElement && this.formTransparency) {
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

  // removes the form element and resets it
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

  // resets the form and clears the current highlights
  // this path is used when closing instead of submitting a comment
  #closeForm() {
    if (this.formElement && this.formIsActive) {
      let x = this.formElement["start"]
      let y = this.formElement["end"]
      this.#removeFormHighlights(`${x}-${y}`)
      this.#removeForm()
    }
  }

  getRawId() {
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
    return `${startIndex}-${endIndex}`
  }

  defaultFormAction() {
    this.createHighlight();
    this.#createForm(this.startLetterIndex, this.endLetterIndex)
    this.#repositionItems()
  }

  async postDataFetch(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any other headers like authorization
          'Authorization': 'Bearer your-token-here'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}
