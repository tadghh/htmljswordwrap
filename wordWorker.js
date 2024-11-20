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

    this.contentTextCleaned = this.hoverableDiv.textContent.trim().replace(/\t/g, "").replace(/\n/g, " ");

    this.wordStats = this.#calcWords(this.contentTextCleaned);
    this.textAreaYSections = this.divRect.height / this.wordStats.length;

    this.#addEventListeners();
  }
  #getCharacterWidth(char) {
    if (this.widthCache[char] === undefined) {
      this.widthCache[char] = this.context.measureText(char).width;
    }
    return this.widthCache[char];
  }

  #getWordWidth(word) {
    return [...word].reduce((total, char) => total + this.#getCharacterWidth(char), 0);
  }

  #calcWords(words) {
    const spaceSize = this.#getWordWidth(" ");
    const wordArray = words.split(" ").map((word, i, arr) =>
      i < arr.length - 1 ? word + " " : word
    );

    const widthCache = [[0, 0]];
    let wordCols = 1;
    let currentStringIndex = 0;
    let tempWidth = 0;

    wordArray.forEach((word, iter) => {
      let testWidth = tempWidth + this.#getWordWidth(word);
      if (testWidth <= this.divWidth) {
        tempWidth = testWidth;
      } else {
        const endTest = iter === wordArray.length - 1 ? testWidth : testWidth - spaceSize;
        if (endTest <= this.divWidth) {
          tempWidth = testWidth;
        } else {
          tempWidth = this.#getWordWidth(word);
          widthCache.push([wordCols, currentStringIndex]);
          wordCols++;
        }
      }
      currentStringIndex += word.length;
    });

    return widthCache;
  }

  #updateDivValues() {
    this.divRect = this.hoverableDiv.getBoundingClientRect();
    this.divWidth = this.divRect.width;
    this.divStartY = this.divRect.top;

    this.wordStats = this.#calcWords(this.contentTextCleaned);
    this.textAreaYSections = this.divRect.height / this.wordStats.length;
  }

  #handleResizeOrScroll = () => {
    this.#updateDivValues();
    this.#repositionItems();
  };

  #positionFloatingComment(element) {

    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")
    let yColIndex = this.#findStartIndexFromIndex(this.wordStats, startId);
    // console.log(`ycol index ${yColIndex}`)
    let xCol = this.#findXValueFromIndex(
      yColIndex,
      this.contentTextCleaned,
      startId
    );
    let top = this.#findYValueFromIndex(startId);
    // let yColStart = findYValueFromIndex(wordStats, startId)
    // let yColEnd = findYValueFromIndex(wordStats, endId)
    let yCol1 = this.#findColFromIndex(startId)
    let yCol2 = this.#findColFromIndex(endId)
    // let hoverItem = document.getElementById(`floating-highlighted-${startId}-${endId}`);
    //console.log(`Line one ${endId} ${startId} `)

    // if the end and start col !=
    if (element.id.includes("floating-highlighted")) {
      if (yCol1 != yCol2) {

        element.style.display = "none"
        const rowId = element.getAttribute("rawId")


        const uniqueId = `split-${startId}-${this.wordStats[yCol1][1] - 1}`;
        const splitId = `split-${this.wordStats[yCol1][1]}-${endId}`
        //     console.log(`Line one ${endId} ${wordStats[yCol1][1] - 1} Line two ${wordStats[yCol1][1]}-${startId}`)
        if (!this.floatingDivsSplit.has(uniqueId)) {

          const selectedText = this.contentTextCleaned.substring(
            startId, this.wordStats[yCol1 + 1][1] - 1

          );

          console.log(selectedText)
          console.log("gay")
          const floatingDiv = document.createElement("div");
          floatingDiv.id = uniqueId;
          floatingDiv.className = "floatingControls";
          floatingDiv.style.width = `${this.#getWordWidth(selectedText)}px`;
          floatingDiv.setAttribute("rawId", rowId)
          floatingDiv.setAttribute("end", this.wordStats[yCol1 + 1][1] - 1)
          floatingDiv.setAttribute("start", startId)
          document.body.appendChild(floatingDiv);
          this.floatingDivsSplit.set(uniqueId, floatingDiv);
        }
        if (!this.floatingDivsSplit.has(splitId)) {
          const selectedText = this.contentTextCleaned.substring(
            this.wordStats[yCol1 + 1][1],
            endId
          );
          let testStartIndex = this.wordStats[yCol1 + 1][1]
          let gaycat = this.findStartIndexFromIndex(this.wordStats, testStartIndex + 1);

          console.log(selectedText)
          console.log(this.wordStats)
          console.log(`yColIndex ${this.findStartIndexFromIndex(this.wordStats, testStartIndex)} xcol ${this.findXValueFromIndex(
            gaycat,
            this.contentTextCleaned,
            testStartIndex
          )} top${this.findYValueFromIndex(testStartIndex)} startIndex${testStartIndex} `)
          const floatingDiv = document.createElement("div");
          floatingDiv.id = splitId;
          floatingDiv.className = "floatingControls";
          floatingDiv.style.width = `${this.#getWordWidth(selectedText)}px`;
          floatingDiv.setAttribute("rawId", rowId)
          floatingDiv.setAttribute("start", this.wordStats[yCol1 + 1][1] + 1)
          floatingDiv.setAttribute("start2", this.wordStats[yCol1 + 1][1])
          floatingDiv.setAttribute("end", endId)
          document.body.appendChild(floatingDiv);
          this.floatingDivsSplit.set(splitId, floatingDiv);
        }

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
    // check end col <-- start index for other
    // check highlighted text, add previous. find what words wraps on
    // could just use index instead from wordStats
    // method to get col based on index
    element.style.top = `${top - 5 + this.mouseTopOffset}px`;
    element.style.left = `${xCol + this.divRect.left + 2}px`;
  }

  #findStartIndexFromIndex(updatedWordStats, startLetterIndex) {
    let previousValue = null;
    let lastSize = updatedWordStats[updatedWordStats.length - 1][1]
    if (lastSize < startLetterIndex) {
      return lastSize
    }
    for (const value of Object.values(updatedWordStats)) {
      if (startLetterIndex <= value[1]) {

        return previousValue ? previousValue[1] : null;
      }
      previousValue = value;
    }

    return null;
  }

  #findColFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastSize = this.wordStats[this.wordStats.length - 1][1]
    if (lastSize < startLetterIndex) {
      return lastSize
    }
    for (const value of Object.values(this.wordStats)) {
      if (startLetterIndex <= value[1]) {

        return previousValue ? previousValue[0] : null;
      }
      previousValue = value;
    }

    return null;
  }

  #findYValueFromIndex(startLetterIndex) {
    let previousValue = null;
    let lastSize = this.wordStats[this.wordStats.length - 1][1]
    if (lastSize < startLetterIndex) {
      return ((this.wordStats.length - 1) * this.textAreaYSections) + this.divStartY;
    }
    for (const value of Object.values(this.wordStats)) {
      let yPx = (value[0] * this.textAreaYSections) + this.divStartY;

      if (startLetterIndex <= value[1]) {
        return previousValue !== null ? previousValue : yPx;
      }
      previousValue = yPx;
    }

    return null;
  }

  #findXValueFromIndex(yColIndex, mainText, startIndex) {
    let cumulativeWidth = 0;
    for (let i = yColIndex; i < mainText.length; i++) {
      if (i == startIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += this.#getCharacterWidth(mainText[i]);
    }
  }

  #handleMouseMove = (event) => {
    const relativeX = event.clientX - this.divRect.left;
    this.relativeY = event.clientY - this.divStartY;
    this.mouseCol = Math.floor(this.relativeY / this.textAreaYSections);
    this.mouseColSafe = Math.max(0, Math.min(this.mouseCol, this.wordStats.length - 1));

    let cumulativeWidth = 0;
    let letterIndex = -1;

    for (let i = this.wordStats[this.mouseColSafe][1]; i < this.contentTextCleaned.length; i++) {
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
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
      cumulativeWidth += this.#getCharacterWidth(this.contentTextCleaned[i]);
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

    this.hoverableDiv.innerHTML = `${this.contentTextCleaned.slice(
      0,
      this.startLetterIndex
    )}<span style="background-color: yellow">${selectedText}</span>${this.contentTextCleaned.slice(
      this.endLetterIndex + 1
    )}`;

    if (!this.floatingDivsMap.has(uniqueId)) {
      const floatingDiv = document.createElement("div");
      floatingDiv.id = uniqueId;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${this.#getWordWidth(selectedText)}px`;
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
    this.repositionItems()

  }

  #positionFloatingCommentContent(element) {
    const startId = element.getAttribute("start")
    const endId = element.getAttribute("end")
    let yColIndex = this.#findStartIndexFromIndex(this.wordStats, startId);
    let xCol = this.#findXValueFromIndex(
      yColIndex,
      this.contentTextCleaned,
      endId
    );
    let top = this.#findYValueFromIndex(startId);

    element.style.top = `${top + 25}px`;
    element.style.left = `${xCol + this.divRect.left + 2}px`;
  }

  #addEventListeners() {
    window.addEventListener("resize", this.#handleResizeOrScroll);
    window.addEventListener("scroll", () => {
      this.mouseTopOffset = window.scrollY;
      this.#handleResizeOrScroll();
    });

    this.hoverableDiv.addEventListener("mousemove", this.#handleMouseMove);
    this.hoverableDiv.addEventListener("mousedown", this.#handleMouseDown);
    this.hoverableDiv.addEventListener("mouseup", this.#handleMouseUp);
  }

  #repositionItems() {
    this.floatingDivsMapTwo.forEach((div, key) => {
      let hoverItem = document.getElementById(`${key}`);
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
