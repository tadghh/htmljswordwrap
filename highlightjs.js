// TODO function to enable ids on highlight elements
// Or just return array of elements for "search"
// TODO set text color for background

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
  #widthSums = new Map();
  constructor(highlightedDiv,
    outputHoverId,
    submissionAPI = null,
    mouseUpFunction = null,
    highlightColors = null) {
    this.MIN_FORM_OPACITY = 0.10
    this.DISTANCE_FORM_POWER = 0.8
    this.MAX_DISTANCE_FORM_DIVISOR = 6
    this.HOVER_TRANSITION_DURATION = 150;
    this.UNFOCUSED_OPACITY = 0.2;

    this.mouseUpFunction = mouseUpFunction || this.defaultFormAction.bind(this);
    this.highlightSubmissionAPI = submissionAPI ? submissionAPI : null
    this.highlightColors = highlightColors ? highlightColors : {
      1: 'white',     // Misc comments
      2: 'pink',      // Incorrect info
      3: 'lightblue', // Sources?
      4: 'skyblue',   // Question
      default: 'lightgreen' // Default color
    }

    document.styleSheets[0].insertRule(`::selection {
      background: ${this.#getColor(1)};
      color: black;
    }`, 0);

    this.defaultFormHTML = TextHighlighter.FORM_HTML
    this.formTransparency = false
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
    this.exactTextAreaWidth = this.#getTotalAreaWidth()


    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontSizeRaw = Number.parseFloat(this.fontSize)

    this.fontFamily = computedStyle.fontFamily;
    // 1.2 is 'default' line height
    this.lineHeight = parseFloat(computedStyle.fontSize) * 1.2;

    this.divRect = this.highlightedDiv.getBoundingClientRect();
    console.log(this.fontSize)
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
    // this.createTextHighlight(739, 752, this.contentTextCleaned, "Woah this is going somewhere woo hoo", 2)




    this.formElement = null;
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
  setFormHTML(htmlContent) {
    // TODO verify elements

    this.defaultFormHTML = htmlContent
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

  // Highlights

  // Updates the highlight elements, adjusting for screen size
  #updateHighlightElements(key, startId, endId) {
    this.#updateOffsetsAndBounds()
    const spanningColCount = this.#calcColsInRange(startId, endId);
    const elementsRawUniqueId = key;
    let yCol1 = this.#getColumnForIndex(startId);
    let yCol2 = this.#getColumnForIndex(endId);
    let highlightSplits = this.floatingDivsSplit.get(key).splits
    let colorId = this.floatingDivsSplit.get(key).colorId

    if (spanningColCount >= 1) {
      let backgroundColor = this.#getColor(Number.parseInt(colorId))
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

        if (this.formIsActive && this.formElement) {
          let formId = `${this.formElement.start}-${this.formElement.end}`
          if (formId == key) {
            floatingDiv.style.opacity = 1
          }
        }

        floatingDiv.style.backgroundColor = backgroundColor

        let firstColStartIndex = this.wordStats[c][1];
        let firstColEndIndex = 0
        if (this.wordStats[yCol1 + 1] == undefined) {
          firstColEndIndex = this.wordStats[yCol1][1] - 1;
        } else {
          firstColEndIndex = this.wordStats[yCol1 + 1][1] - 1;
        }

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
          colorId: colorId,
          start: startId,
          end: endId
        }
      );
    }
  }

  // Updates the color of the highlights for the given ID and color ID
  #updateHighlightColorsId(rawId, colorId) {
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
  #createHighlight() {
    let [startIndex, endIndex] = this.#cleanSelectionIndexes()

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
      this.#repositionItems()
    }
  }


  // #region Utility
  // Events

  // Gets the index of the character the mouse is hovering over
  #getCurrentMouseIndex() {
    return this.#getLetterIndexByWidth(this.wordStats[this.mouseColSafe][1], this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1], this.relativeX)
  }

  // Get the current letter the mouse is hovering over
  #getCurrentHoveredLetter() {
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    // Use binary search to find letter index
    return this.#getLetterIndexByWidth(startIndex, endIndex, this.relativeX);
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
        }
      }
    });
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

  // handles mouse up, behaviour depends on the current form being inactive
  #handleMouseUp = (event) => {
    // need the mouse to be over the whole char so consider it selected
    let relativeX = event.clientX - this.#getHighlightAreaLeftPadding();

    // deals with fussy highlight behavior on word bounds
    if (relativeX % this.charHoverPadding != 0) {
      relativeX -= this.charHoverPaddingMouse
    }

    // Determine start and end indices once
    const startIndex = this.wordStats[this.mouseColSafe][1];
    const endIndex = this.mouseColSafe === this.#getWordColCount()
      ? this.contentTextCleaned.length
      : this.wordStats[this.mouseColSafe + 1][1];

    if (!this.formIsActive) {
      this.endLetterIndex = this.#getLetterIndexByWidth(startIndex, endIndex, relativeX);

      [this.startLetterIndex, this.endLetterIndex] = this.#cleanSelectionIndexes()
      let totalLength = this.endLetterIndex - this.startLetterIndex;

      if (totalLength > 1) {
        this.mouseUpFunction()
      }
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

  #addEventListeners() {
    window.addEventListener("resize", this.#handleResizeOrScroll);
    window.addEventListener("scroll", this.#handleResizeOrScroll);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'g') {
        this.#printOutWordStats()
      }
    });
    document.addEventListener("mousemove", this.#handleMouseMove);
    this.highlightedDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.highlightedDiv.addEventListener("mouseup", this.#handleMouseUp);
  }

  #liveItems() {
    this.#handleMouseHoveringComment()
    this.#updateFormTransparency()
  }

  // Positioning

  // Updates offsets and other positioning values
  #handleResizeOrScroll = () => {
    this.#updateOffsetsAndBounds();
    this.#repositionItems();

    if (this.formElement) {
      this.#positionCommentForm()
    }
  };

  // Updates offsets, along with the current word data structure
  #updateOffsetsAndBounds() {
    this.mouseTopOffset = window.scrollY;
    // 🤓 Horizontal scroll 👆
    this.mouseLeftOffset = window.scrollX;
    this.divRect = this.highlightedDiv.getBoundingClientRect();
    this.wordStats = this.#calcWordPositions();
  }

  // Updates items that depend on window size or related
  #repositionItems() {
    this.floatingDivsSplit.forEach((divArray, key) => {
      const highlightSplits = divArray["splits"]
      this.#updateHighlightElements(key, divArray.start, divArray.end);

      if (highlightSplits) {
        highlightSplits.forEach((split) => {
          this.#positionHighlight(split)
        })
      }

      this.#positionCommentContent(divArray["comment"])
    });
  }

  // Gets the vertical sections based on the length of the word data structure
  #getTextContentVerticalSectionCount() {
    return this.divRect.height / (this.wordStats.length);
  }

  // Gets the word col count
  #getWordColCount() {
    return this.wordStats.length - 1
  }

  // there will always be at least one column
  #calcColsInRange(startIndex, endIndex) {
    return (this.#getColumnForIndex(endIndex) - this.#getColumnForIndex(startIndex)) + 1
  }

  // Creates an array that corresponds to the text on screen
  #calcWordPositions() {
    const widthCache = [[0, 0]];
    const maxWidth = Math.ceil(this.#getHighlightAreaMaxWidth());
    const bufferWidth = maxWidth + this.spaceSize

    let wordColumnIndex = 1;
    let currentStringIndex = 0;
    let currentWidth = 0;

    // Remember the text content is just one long string
    this.wordArray.forEach((word) => {
      const currentWordWidth = this.#getWordWidth(word);
      const testWidth = currentWidth + currentWordWidth;
      const extra = word.endsWith(" ") ? 0 : this.spaceSize * -1;

      // The last word can be found by assuming it doesnt end with a space
      // a non issue if it doesnt as the browser will display correct behavior
      // assumed behav = that the last word ends with a space
      // First test: does word fit on current line with space?
      if (testWidth <= bufferWidth + extra) {
        currentWidth = testWidth;
      } else {
        if (testWidth <= maxWidth) {
          currentWidth = testWidth;
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

  // gets the max width of the highlight area
  #getHighlightAreaMaxWidth() {
    return this.#getTotalAreaWidth()
  }

  // gets the value of the padding to the left of the highlight area
  #getHighlightAreaLeftPadding() {

    return this.divRect.left
  }
  getHighlightAreaLeftPadding() {

    return this.divRect.left
  }

  // gets the value of the distance of the highlight area
  #getHighlightAreaTopPadding() {
    return this.divRect.top
  }

  // positions the given comment object for the highlight
  // makes sure the comment doesn't go offscreen
  // TODO handle long comments
  #positionCommentContent(commentObj) {
    const element = commentObj.elem
    if (element) {
      const startId = commentObj.start;
      const endId = commentObj.end
      const startIndex = this.#getStartIndexForIndex(startId)
      const wordWidth = this.#getWordWidth(element.textContent);
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const isOutOfBounds = this.#getPaddingForIndex(startId) + wordWidth > maxWidth;
      const endLineStartIndex = this.#getStartIndexForIndex(endId)
      const isMultiLine = this.#getColumnForIndex(endId) - this.#getColumnForIndex(startId) >= 1
      const top = this.#getTopPaddingForIndex(isMultiLine ? endId : startId);
      const yOffset = top + Number.parseFloat(this.fontSize) + this.mouseTopOffset

      let xOffset = this.#getCumulativeWidthForIndexRange(startIndex, startId)

      // make sure comment doesn't go off screen
      if (isOutOfBounds || isMultiLine) {
        xOffset = this.#getCumulativeWidthForIndexRange(endLineStartIndex, endId - (element.textContent.length - 1));
      }

      // make sure its not offscreen on the left
      if (xOffset < 0) {
        xOffset = 0
      }
      xOffset += this.#getHighlightAreaLeftPadding()
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }

  // positions the highlight based on its start and end id, along with updating the width
  #positionHighlight(highlight) {
    const element = highlight.elem
    const startId = highlight.start
    const endId = highlight.end
    if (element != null) {
      const selectedText = this.contentTextCleaned.substring(startId, endId + 1).trim();
      const yOffset = this.#getTopPaddingForIndex(startId) - this.charHoverPaddingMouse + this.mouseTopOffset
      const startIndex = this.#getStartIndexForIndex(startId)
      const xOffset = this.#getCumulativeWidthForIndexRange(startIndex, startId) + this.#getHighlightAreaLeftPadding()
      element.style.width = `${Math.ceil(this.#getWordWidth(selectedText))}px`;
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    } else {
      console.log("bad element")
    }
  }

  // gets the total width between two indexes, this value is inline (so you could add the values across multiple rows)
  #getCumulativeWidthInsideIndexRange(startIndex, endIndex) {
    if (startIndex < 0 || endIndex < 0) return null
    let cumulativeWidth = 0;
    for (let i = startIndex; i < this.contentTextCleaned.length; i++) {
      if (i == endIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  // Gets the padding from the left for the given index
  // TODO we should make sure to only check the row the includes the index
  #getPaddingForIndex(index) {
    if (index < 0) return null

    let colStartIndex = this.#getStartIndexForIndex(index);

    if (colStartIndex < 0) return null

    let cumulativeWidth = 0;
    for (let i = colStartIndex; i < this.contentTextCleaned.length; i++) {
      if (i == index) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
    }
  }

  // Gets the width of a single character. this can cause positioning issues if its incorrect
  #getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = Number.parseFloat(Number.parseFloat(this.context.measureText(char).width).toFixed(0));
    }
    return this.widthCache[char];
  }

  // Gets the cumulative width of the given word
  #getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.#getCharacterWidth(char), 0);
  }

  // Gets the start index of the row that includes the provided index
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

  // Gets the column for the given index
  #getColumnForIndex(index) {
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

  // gets the padding for the top of and index, this would technically be index -1 since we don't include the font size here
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

  // Binary search for letter index based on width
  #getLetterIndexByWidth(startIndex, endIndex, targetWidth) {
    let low = startIndex;
    let high = endIndex;
    let cumulativeWidth = 0;

    // First check if we're beyond the total width
    const totalWidth = this.#getCumulativeWidthForIndexRange(startIndex, endIndex);
    if (targetWidth >= totalWidth) {
      return endIndex - 1;
    }

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      cumulativeWidth = this.#getCumulativeWidthForIndexRange(startIndex, mid + 1);

      if (cumulativeWidth === targetWidth) {
        return mid;
      }

      if (cumulativeWidth < targetWidth) {
        if (mid + 1 <= high &&
          this.#getCumulativeWidthForIndexRange(startIndex, mid + 2) > targetWidth) {
          return mid + 1;
        }
        low = mid + 1;
      } else {
        if (mid - 1 >= low &&
          this.#getCumulativeWidthForIndexRange(startIndex, mid) < targetWidth) {
          return mid;
        }
        high = mid - 1;
      }
    }

    return low;
  }

  // gets the width between two indexes
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


  // gets the color for the given id
  #getColor(colorId) {
    return this.highlightColors[parseInt(colorId)] || this.highlightColors.default;
  }

  #printOutWordStats() {
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
    console.log(this.wordStats)
    console.log(this.floatingDivsSplit)
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
    floatingComment.style.width = `${this.#getWordWidth(content)}px`;
    floatingComment.style.backgroundColor = color;
    document.body.appendChild(floatingComment);

    return floatingComment
  }

  // positions the location of the comment form
  #positionCommentForm() {
    if (this.formElement["elem"]) {
      const startId = this.formElement["start"]
      const endId = this.formElement["end"]
      const elem = this.formElement["elem"]
      const maxWidth = this.#getHighlightAreaMaxWidth();
      const yColStartIndex = this.#getPaddingForIndex(endId);
      const formWidth = this.formElement["elem"].getBoundingClientRect().width
      const isOutOfBounds = yColStartIndex + formWidth > maxWidth
      const endLineStartIndex = this.#getStartIndexForIndex(endId)
      const isMultiLine = this.#getColumnForIndex(endId) - this.#getColumnForIndex(startId) >= 1
      const top = this.#getTopPaddingForIndex(isMultiLine ? endId : startId);

      let endIndex = this.#getStartIndexForIndex(endId)
      let xOffset = this.#getCumulativeWidthForIndexRange(endIndex, endId)
      let yOffset = top + this.mouseTopOffset

      if (isOutOfBounds) {
        // make sure form doesn't go off screen
        yOffset += Number.parseFloat(this.fontSize)
        xOffset = this.#getCumulativeWidthForIndexRange(endLineStartIndex, endId - (formWidth));
      }
      xOffset += this.#getHighlightAreaLeftPadding()
      elem.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }



  // Handles form/comment submission
  #formCommentSubmission(submission) {
    const form = submission.target;
    const startIndex = this.formElement["start"];
    const endIndex = this.formElement["end"];
    const comment = form.comment.value;

    // Get the value from the hidden input instead of radio
    const commentTypeInput = form.querySelector('input[name="commentType"]');
    if (!commentTypeInput) {
      console.error('No comment type input found');
      return;
    }
    const commentTypeId = parseInt(commentTypeInput.value);

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
      formElement.appendChild(hiddenInput);
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
              this.#updateHighlightColorsId(rawId, value);
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
    } catch {

      console.log("its null, issue creating comment form")
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



  defaultFormAction() {
    this.#createHighlight();
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
