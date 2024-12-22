
import { TextCalibrator } from "./text_calibrator.js";

export class TextHighlighter {
  constructor(highlightedDiv, outputHoverId) {
    if (!highlightedDiv) {
      throw new Error('highlightedDiv and outputHoverId are required');
    }
    this.isOnComment = false
    this.highlightedDivId = highlightedDiv;
    this.outputHoverId = outputHoverId ? outputHoverId : null;
    this.TC = new TextCalibrator(highlightedDiv)
    this.listeners = new WeakMap();

    // Set default values
    this._mouseUpFunction = this.defaultFormAction.bind(this);
    this._highlightSubmissionAPI = null;
    this._highlightColors = {
      1: 'gray',     // Misc comments
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

  setFormId(id) {
    this._formId = id;
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
    this.MOUSE_OUT_OFFSET = 5;
    return this;
  }

  #initializeStyleSheet() {
    return this;
  }

  #initializeState() {
    this.mouseUpFunction = this._mouseUpFunction;
    this.highlightSubmissionAPI = this._highlightSubmissionAPI;
    this.highlightColors = this._highlightColors;
    this.defaultFormHTML = this._defaultFormHTML || TextHighlighter.FORM_HTML;
    this.formId = this._formId || null;

    this.formTransparency = this._formTransparency || false;
    this.startLetterIndex = -1;
    this.endLetterIndex = -1;
    this.mouseCol = 0;
    this.mouseColSafe = 0;
    this.relativeY = 0;
    this.relativeX = 0;
    this.relativeYRaw = 0;
    this.relativeXRaw = 0;
    this.highlightElements = new Map();
    this.formIsActive = false;
    this.formElement = null;
    this.lastHoveredId = null
    return this;
  }

  #initializeDOMElements() {
    this.highlightedDiv = document.getElementById(this.highlightedDivId);

    const mouseDefault = (event) => {
      this.relativeX = event.clientX - this.TC.getHighlightAreaLeftPadding()
      this.relativeY = event.clientY - this.TC.getHighlightAreaTopPadding();
      this.relativeXRaw = event.clientX
      this.relativeYRaw = event.clientY

      // Single division operation
      this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
      this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));

      this.#handleMouseHoveringHighlight()
      this.#updateFormTransparency()
    }

    let mouseMove = mouseDefault
    if (this.outputHoverId != null) {
      this.outputHover = document.getElementById(this.outputHoverId);

      mouseMove = (event) => {
        mouseDefault(event);
        // Determine start and end indices once
        const startIndex = this.TC.getStartIndex(this.mouseColSafe);

        // Use binary search to find letter index
        const letterIndex = this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe)
        if (letterIndex >= 0 && letterIndex < this.contentTextCleaned.length) {
          const char = this.contentTextCleaned[letterIndex];
          const charWidth = this.TC.getCharacterWidth(char);
          // Create the output string only if needed
          this.outputHover.textContent =
            `Letter: '${char}' (index: ${letterIndex}, width: ${charWidth.toFixed(2)}px, ` +
            `cumWidth: ${this.TC.getCumulativeWidthForIndexRange(startIndex, letterIndex).toFixed(2)}px, ` +
            `relX: ${this.relativeX.toFixed(2)}px) ` +
            `mouseCol: ${this.mouseCol} ` +
            `mouseColSafe: ${this.mouseColSafe} ` +
            `mouseX: ${event.clientX} ` +
            `highlight left padding: ${this.TC.getHighlightAreaLeftPadding()}`;
        }
      }
    }


    if (!this.highlightedDiv) {
      throw new Error('Could not find required DOM elements');
    }
    this.mouseMoveMethod = mouseMove
    return this;
  }

  #initializeTextProcessing() {
    const computedStyle = getComputedStyle(this.highlightedDiv);
    this.fontSize = computedStyle.fontSize;
    this.fontFamily = computedStyle.fontFamily;
    this.fontSizeRaw = Number.parseFloat(this.fontSize);

    this.contentTextCleaned = this.highlightedDiv.textContent
      .trim()
      .replace(/\t/g, "")
      .replace(/\n/g, " ");

    this.characterWidth = this.TC.getCharacterWidth(" ");

    // Makes the cursor click in the 'correct' spot visually
    const offsetSpace = (this.characterWidth / (this.fontSizeRaw / 10));
    this.SELECTION_OFFSET = this.characterWidth + offsetSpace;
    this.SELECTION_OFFSET_NEGATIVE = this.characterWidth - offsetSpace;

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

  setCalibratorWidthSensitivity(newInt) {
    this.TC.setTextWidthSensitivity(newInt);
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
    this.highlightElements.forEach(highlightObj => {
      let section = this.contentTextCleaned.slice(highlightObj.start, highlightObj.end + 1)
      if (section.includes(word)) {
        items.push(highlightObj)
      }
    })
    return items
  }

  setHighlightComment(comment, typeId) {
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
    const builtComment = {
      elem: this.#buildComment(comment, typeId),
      start: startIndex,
      end: endIndex
    }
    this.highlightElements.get(this.getRawId()).comment = builtComment
  }

  // Highlights
  // Updates the highlight elements, adjusting for screen size
  #updateHighlightElements(key) {
    const splitData = this.highlightElements.get(key);
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
      `${this.formElement.start}-${this.formElement.end}` === key ? 1 : undefined;

    // Prepare new splits array
    const newSplits = [];

    // Process each column
    for (let c = yCol1; c <= yCol2; c++) {
      let currentHighlight = existingHighlights.get(c);
      let floatingDiv;

      // Calculate column bounds once
      const colStartIndex = c === yCol1 ? startId : this.TC.getStartIndex(c);
      const colEndIndex = c === yCol2 ? endId :
        this.TC.getIndexOnBounds(c);

      if (currentHighlight && currentHighlight.elem && !currentHighlight.head) {
        // Update existing highlight
        let cleanedEndIndex = colEndIndex
        if (this.contentTextCleaned[cleanedEndIndex] === " ") {
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
        // position: absolute;
        // z-index: 10;
        // border-radius: 2px;
        floatingDiv.style.position = "absolute"
        floatingDiv.style.zIndex = 10
        floatingDiv.style.borderRadius = "2px"
        floatingDiv.style.height = this.fontSize
        document.body.appendChild(floatingDiv);

        // Don't need to include trailing spaces in the selection
        let cleanedEndIndex = colEndIndex
        if (this.contentTextCleaned[cleanedEndIndex] === " ") {
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
    this.highlightElements.set(key, {
      ...splitData,
      splits: newSplits,
      start: startId,
      end: endId
    });
  }

  // Updates the color of the highlights for the given ID and color ID
  updateHighlightColorsId(rawId, colorId) {
    let items = this.highlightElements.get(rawId).splits

    if (items) {
      const selectedId = parseInt(colorId);
      const color = this.#getColor(selectedId);
      this.highlightElements.get(rawId).comment.type = selectedId;
      this.highlightElements.get(rawId).colorId = selectedId;
      requestAnimationFrame(() => {
        items.map((item) => {
          item.elem.style.backgroundColor = color
        })
      });
    }
  }

  // Returns a tuple of the start and end indexes. Corrects the indexes during a 'reverse selection' additionally adjusts to not include trailing spaces
  #cleanSelectionIndexes() {
    let startIndex = Number.parseInt(this.startLetterIndex)
    let endIndex = Number.parseInt(this.endLetterIndex)
    if (startIndex > endIndex) {
      [startIndex, endIndex] = [endIndex, startIndex];
      // startIndex++
    }

    if (this.contentTextCleaned[startIndex] === " ") startIndex++;
    if (this.contentTextCleaned[endIndex] === " ") endIndex--;
    return [startIndex, endIndex]
  }

  // Creates a highlight
  createHighlight() {
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
    const rawUniqueId = `${startIndex}-${endIndex}`;

    if (!this.highlightElements.has(rawUniqueId)) {
      // Initialize with an array containing the first object
      // two comments wont have the same UniqueId, so we should always make it here
      // unique id is gen by mouse down letter index  and mouse up letter index
      this.highlightElements.set(rawUniqueId, {
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
      // startIndex++
    }

    if (this.contentTextCleaned[startIndex] === " ") startIndex++;
    if (this.contentTextCleaned[endIndex] === " ") endIndex--;

    const rawUniqueId = `${startIndex}-${endIndex}`;
    const selectedId = parseInt(colorId);

    if (!this.highlightElements.has(rawUniqueId)) {
      const floatingComment = this.#buildComment(comment, selectedId)
      document.body.appendChild(floatingComment);
      let floatingDivSplit = this.highlightElements.get(rawUniqueId);

      if (!floatingDivSplit) {
        // Initialize with an array containing the first object
        // two comments wont have the same sawUniqueId so we should awlays make it here
        // unique id is gen by mouse down letter index  and mouse up letter index
        this.highlightElements.set(rawUniqueId, {
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

  // Changes the opacity of the given hovered highlight and comment depending on if the mouse is within the indexes a highlight
  #handleMouseHoveringHighlight() {
    const currentMouseIndex = this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe);
    const isLastIndex = this.TC.isRangeLastIndex(this.relativeX, this.mouseColSafe);

    // Store timeouts in a Map keyed by comment element
    const timeouts = new Map();

    this.highlightElements.forEach((div) => {
      const { start: startId, end: endId, comment } = div;

      if (!comment?.elem) return;

      const isInside = (currentMouseIndex >= startId && currentMouseIndex <= endId) && !isLastIndex;
      const { splits } = div;

      if (this.isOnComment && !isInside) {
        this.isOnComment = false
      }

      const commentElem = comment.elem;

      const handleCommentHover = () => {
        if (!this.isOnComment && isInside) {
          this.isOnComment = true;
          this.#positionCommentContent(comment);
          // Only add listener if not already added
          if (!this.listeners.has(commentElem)) {
            const mouseoutListener = (event) => {
              this.isOnComment = false;
              this.#handleMouseOutOpacity(event.clientX)
            };
            commentElem.addEventListener("mouseleave", mouseoutListener);
            this.listeners.set(commentElem, mouseoutListener);
          }

          // Clear any existing timeout
          const existingTimeout = timeouts.get(commentElem);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            timeouts.delete(commentElem);
          }

          commentElem.style.opacity = '1';
          commentElem.style.zIndex = '25';

          // Use batch updates for splits
          requestAnimationFrame(() => {
            splits.forEach(item => {
              item.elem.style.opacity = '1';
            });
          });

          this.lastHoveredId = `${startId}-${endId}`;
        } else if (!this.isOnComment) {
          // Batch update splits opacity
          requestAnimationFrame(() => {
            splits.forEach(item => {
              item.elem.style.opacity = this.UNFOCUSED_OPACITY;
            });
          });

          commentElem.style.opacity = '0';

          // Set timeout for z-index change
          const timeoutId = setTimeout(() => {
            if (commentElem.style.opacity === '0') {
              commentElem.style.zIndex = '15';
            }
          }, this.HOVER_TRANSITION_DURATION);

          timeouts.set(commentElem, timeoutId);

          this.lastHoveredId = null;
        }
      };

      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(handleCommentHover);
    });
  }


  #handleMouseMove = (event) => {
    // make other vars to store last unmodified version
    // updated by recalling padding methdos
    this.mouseMoveMethod(event)
  };

  // handles mouse up, behavior depends on the current form being inactive
  #handleMouseUp = () => {
    // Determine start and end indices once
    this.relativeX = event.clientX - this.TC.getHighlightAreaLeftPadding() + this.SELECTION_OFFSET_NEGATIVE
    if (!this.formIsActive) {
      const letterIndex = this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe)
      const char = this.contentTextCleaned[letterIndex];
      const charWidth = this.TC.getCharacterWidth(char);
      // offset to mimic actual text selection
      this.endLetterIndex = this.TC.getIndexFromMouse(this.relativeX - (charWidth), this.mouseColSafe);

      [this.startLetterIndex, this.endLetterIndex] = this.#cleanSelectionIndexes()
      let totalLength = this.endLetterIndex - this.startLetterIndex;

      if (totalLength > 1) {
        this.mouseUpFunction()
      }
    }
  };

  #handleMouseDown = () => {
    document.styleSheets[0].deleteRule(0);
    document.styleSheets[0].insertRule(`::selection {
      background: ${this.#getColor(1)};
      color: white;
  }`, 0);
    this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));
    const letterIndex = this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe)
    const char = this.contentTextCleaned[letterIndex];
    const charWidth = this.TC.getCharacterWidth(char);
    // Create the output string only if needed
    // need to add offset to handle end of char clicking, mimics actual os selection
    if (!this.formIsActive) {
      this.startLetterIndex = this.TC.getIndexFromMouse(this.relativeX + (charWidth / 2), this.mouseColSafe)
    }
  };


  #handleMouseOutOpacity = (mouseX = null) => {
    if (this.lastHoveredId) {
      const hoverSplitObject = this.highlightElements.get(this.lastHoveredId);
      const { end: endId, comment, splits } = hoverSplitObject;
      console.log(this.MOUSE_OUT_OFFSET)
      if ((mouseX - this.MOUSE_OUT_OFFSET) < this.TC.getHighlightAreaLeftPadding() ||
        mouseX > this.TC.getPaddingForIndex(endId) + this.TC.getHighlightAreaLeftPadding()) {

        const commentElement = comment.elem;
        if (commentElement) {
          // Batch style updates
          requestAnimationFrame(() => {
            splits.forEach(item => {
              item.elem.style.opacity = this.UNFOCUSED_OPACITY;
            });
            commentElement.style.opacity = 0;
          });

          setTimeout(() => {
            if (commentElement.style.opacity == 0) {
              commentElement.style.zIndex = 15;
            }
          }, this.HOVER_TRANSITION_DURATION);
        }

        this.lastHoveredId = null;
        this.isOnComment = false;
      }
    }
  }

  #addEventListeners() {
    window.addEventListener("resize", () => {
      this.TC.updateWordCalc();
      this.#repositionItems()
    });

    window.addEventListener("scroll", () => {
      this.#repositionItems();
    });

    this.highlightedDiv.addEventListener("mouseleave", (event) => {
      this.#handleMouseOutOpacity(event.clientX)
    });
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


  // Positioning

  // Updates items that depend on window size or related
  #repositionItems() {
    this.TC.recalibrate();
    this.highlightElements.forEach((_, key) => {
      this.#updateHighlightElements(key);
    });
    if (this.formElement && this.formId === null) {

      this.#positionCommentForm()
    }
  }

  // Used to force update positioning even if the mouse or other events haven't triggered
  repositionItems() {
    // Use the last mouse x and y as the mouse may not be moving
    this.relativeX = this.relativeXRaw - this.TC.getHighlightAreaLeftPadding() + this.SELECTION_OFFSET
    this.relativeY = this.relativeYRaw - this.TC.getHighlightAreaTopPadding();

    this.mouseCol = Math.floor(this.relativeY / this.TC.getTextContentVerticalSectionCount());
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.TC.getWordColCount()));

    // Update item positions
    this.#repositionItems()

    this.highlightElements.forEach((div) => {
      const { comment } = div;
      this.#positionCommentContent(comment);
    })
    this.#handleMouseHoveringHighlight()
  }

  // positions the given comment object for the highlight
  // makes sure the comment doesn't go offscreen
  // TODO handle long comments
  #positionCommentContent(commentObj) {
    if (commentObj.elem) {
      const [xOffset, yOffset] = this.TC.getCommentOffsets(commentObj)
      commentObj.elem.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    }
  }

  // positions the highlight based on its start and end id, along with updating the width
  #positionHighlight(highlight) {
    const { elem: element, start: startIndexHighlight, end: endIndexHighlight } = highlight
    if (element) {
      const [xOffset, yOffset] = this.TC.getHighlighOffsets(startIndexHighlight)

      element.style.width = `${this.TC.getCumulativeWidthForIndexRange(startIndexHighlight, endIndexHighlight)}px`;
      element.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
    } else {
      console.log("bad element")
    }
  }

  // gets the color for the given id
  #getColor(colorId) {
    return this.highlightColors[parseInt(colorId)] || this.highlightColors.default;
  }

  printOutWordStats() {
    this.TC.printOutWordStats()
    console.log(this.highlightElements)
  }

  // #endregion

  // Dubious

  // removes the highlights for the given uniqueId
  #removeFormHighlights(uniqueId) {
    // This also removes the related comment, hmmm
    this.highlightElements.get(uniqueId).splits.map((item) => {
      item.elem.remove()
    })
    this.highlightElements.delete(uniqueId)
  }

  // Creates a comment element with the provided text content and colorId
  #buildComment(content, colorId) {
    const selectedId = parseInt(colorId);
    const color = this.#getColor(selectedId);
    const floatingComment = document.createElement("div");
    floatingComment.className = "highlightComment";
    floatingComment.textContent = content
    floatingComment.style.fontFamily = this.fontFamily
    floatingComment.style.fontSize = this.fontSize
    floatingComment.style.width = `${this.TC.getWordWidth(content)}px`;
    floatingComment.style.backgroundColor = color;
    document.body.appendChild(floatingComment);

    return floatingComment
  }

  // positions the location of the comment form
  #positionCommentForm() {
    const { elem: element, start: formStartIndex, end: formEndIndex } = this.formElement
    if (element) {
      const maxWidth = this.TC.getTotalAreaWidth();
      const yColStartIndex = this.TC.getPaddingForIndex(formEndIndex);
      const formWidth = element.getBoundingClientRect().width
      const isOutOfBounds = yColStartIndex + formWidth > maxWidth
      const endStartIndex = this.TC.getStartIndexForIndex(formStartIndex)
      const isMultiLine = this.TC.calcColsInRange(formStartIndex, formEndIndex) > 1

      const top = this.TC.getTopPaddingForIndex(isMultiLine ? formEndIndex : formStartIndex);

      let xOffset = this.TC.getPaddingForIndex(formEndIndex + 1)
      let yOffset = top + window.scrollY;

      if (isOutOfBounds) {
        // make sure form doesn't go off screen
        yOffset += this.fontSizeRaw
        xOffset = this.TC.getPaddingForIndex(endStartIndex)
      }
      xOffset += this.TC.getHighlightAreaLeftPadding() + window.scrollX;
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
    this.highlightElements.get(`${startIndex}-${endIndex}`)["comment"] = builtComment
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

      closeButton.addEventListener('click', () => this.closeForm());

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

            if (this.highlightElements.has(rawId)) {
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

      let letterIndex = this.TC.getIndexFromMouse(this.relativeX, this.mouseColSafe)
      if (indicator) {
        indicator.textContent = `Last Hovered: (${this.contentTextCleaned[letterIndex]},${this.mouseColSafe}) - ${letterIndex}`
      }
    }
  }

  // removes the form element and resets it
  #removeForm() {
    let form = this.formElement

    if (form) {
      let x = this.formElement["start"]
      let y = this.formElement["end"]

      // TODO highlight removal shouldnt be here
      let highlights = this.highlightElements.get(`${x}-${y}`)
      if (highlights) {
        const splits = highlights["splits"]
        splits.forEach(item => {
          item["elem"].style.opacity = this.UNFOCUSED_OPACITY;
        });
      }

      window.getSelection().removeAllRanges();
      form.elem.remove()
      this.formIsActive = false;
      this.formElement = null
    }
  }
  setFormState(active, startIndex, endIndex) {
    this.formElement = {}
    this.formElement["start"] = startIndex
    this.formElement["end"] = endIndex

    this.formIsActive = active
  }
  // resets the form and clears the current highlights
  // this path is used when closing instead of submitting a comment
  closeForm() {
    if (this.formElement && this.formIsActive) {
      let x = this.formElement["start"]
      let y = this.formElement["end"]
      this.#removeFormHighlights(`${x}-${y}`)
      this.#removeForm()
    }
  }

  closeFormId(id) {
    window.getSelection().removeAllRanges();
    if (this.highlightElements.get(id)) {
      this.#removeFormHighlights(`${id}`)
    }
    this.formIsActive = false;
    this.formElement = null
  }

  getRawId() {
    const [startIndex, endIndex] = this.#cleanSelectionIndexes()
    return `${startIndex}-${endIndex}`
  }

  defaultFormAction() {
    this.createHighlight();
    if (this.formId === null) {
      this.#createForm(this.startLetterIndex, this.endLetterIndex)
    }
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
}
