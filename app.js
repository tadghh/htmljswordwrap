const widthCache = {};
let startLetterIndex = -1; // Start of selection
let endLetterIndex = -1; // End of selection
const floatingDivsMap = new Map();
const floatingDivsMapTwo = new Map();
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");

document.addEventListener("DOMContentLoaded", () => {
  const hoverableDiv = document.getElementById("hoverableDiv");
  const fontSize = getComputedStyle(hoverableDiv).fontSize;
  const fontFamily = getComputedStyle(hoverableDiv).fontFamily;

  let divRect = hoverableDiv.getBoundingClientRect();
  let divWidth = divRect.width;
  let divStartY = divRect.top;

  const output = document.getElementById("output");
  const outputHover = document.getElementById("outputHover");

  const text = hoverableDiv.textContent.trim();

  context.font = `${fontSize} ${fontFamily}`;
  let mouseCol = 0;
  let mouseColSafe = 0;
  let relativeY = 0;

  let contentTextCleaned = text.replace(/\t/g, "").replace(/\n/g, " ");

  function getWordWidth(word) {
    let totalLength = 0;
    for (const char of word) {
      totalLength += getCharacterWidth(char);
    }
    return totalLength;
  }

  function getCharacterWidth(char) {
    if (widthCache[char] === undefined) {
      widthCache[char] = context.measureText(char).width;
    }
    return widthCache[char];
  };

  for (const char of text) {
    getCharacterWidth(char);
  }

  function calcWords(words) {
    const spaceSize = getWordWidth(" ");
    const widthCache = [[0, 0]];
    const wordArray = words.split(" ");

    let wordCols = 1;
    let currentStringIndex = 0;
    let tempWidth = 0;
    let iter = 0;

    for (let i = 0; i < wordArray.length - 1; i++) {
      wordArray[i] += " ";
    }

    for (const word of wordArray) {
      let testWidth = tempWidth + getWordWidth(word);
      if (testWidth <= divWidth) {
        tempWidth = testWidth;
      } else {
        let endTest = testWidth - spaceSize;
        if (iter === wordArray.length - 1) {
          endTest = testWidth;
        }

        if (endTest <= divWidth) {
          tempWidth = testWidth;
        } else {
          tempWidth = getWordWidth(word);
          widthCache.push([wordCols, currentStringIndex]);
          wordCols += 1;
        }
      }
      currentStringIndex += word.length;
      iter++;
    }

    return widthCache;
  }

  let wordStats = calcWords(contentTextCleaned);

  let textAreaYSections = divRect.height / wordStats.length; // Calculate section height

  function updateDivValues() {
    divRect = hoverableDiv.getBoundingClientRect();
    divWidth = divRect.width;
    wordStats = calcWords(contentTextCleaned);
    divStartY = divRect.top;
    textAreaYSections = divRect.height / wordStats.length;
  }

  window.addEventListener("resize", () => {
    updateDivValues();
  });

  window.addEventListener("scroll", () => {
    updateDivValues();
  });

  hoverableDiv.addEventListener("mousemove", (event) => {
    const relativeX = event.clientX - divRect.left;
    let cumulativeWidth = 0;
    let letterIndex = -1;

    relativeY = event.clientY - divStartY; // Relative Y position within the container
    mouseCol = Math.floor(relativeY / textAreaYSections);
    mouseColSafe = Math.max(0, Math.min(mouseCol, wordStats.length - 1));

    for (
      let i = wordStats[mouseColSafe][1];
      i < contentTextCleaned.length;
      i++
    ) {
      cumulativeWidth += getCharacterWidth(contentTextCleaned[i]);
      if (cumulativeWidth >= relativeX) {
        letterIndex = i;
        endLetterIndex = i;
        break;
      }
    }
    if (letterIndex >= 0 && letterIndex < contentTextCleaned.length) {
      outputHover.textContent = `Letter under mouse: ${contentTextCleaned[letterIndex]}`;
    }
    hoveringComment(relativeX)
  });
  function hoveringComment(relativeX) {
    floatingDivsMap.forEach((div, key) => {
      let hoverItem = document.getElementById(`floating-${key}`);

      if (hoverItem) {
        const ids = hoverItem.id
          .replace("floating-highlighted-", "")
          .split("-");
        const xIndex = parseInt(ids[0])
        const yIndex = parseInt(ids[1])

        const yColIndex = findStartIndexFromIndex(wordStats, xIndex);
        const xCol = findXValueFromIndex(
          yColIndex,
          contentTextCleaned,
          xIndex
        );

        const top = findYValueFromIndex(wordStats, yIndex);
        const highLightedWord = contentTextCleaned.substring(xIndex, yIndex + 1)
        const topBorder = top;
        const minXBorder = xCol;
        const bottomBorder = top + 20;
        const maxXBorder = xCol + getWordWidth(highLightedWord)
        const newRelY = event.clientY
        const isInsideX = relativeX >= minXBorder && relativeX <= maxXBorder;
        const isInsideY = newRelY >= topBorder && newRelY <= bottomBorder;
        const isInside = isInsideX && isInsideY;

        if (isInside) {
          const uniqueId = `hover-comment-${xIndex}-${yIndex}`;

          if (!floatingDivsMapTwo.has(uniqueId)) {
            const hoverComment = document.createElement("div");
            hoverComment.id = uniqueId
            hoverComment.textContent = "test comment here"
            hoverComment.className = "floatingControlsTwo"
            hoverComment.style.position = "absolute"
            hoverComment.style.fontSize = "20px"
            hoverComment.style.color = "white"
            hoverComment.style.background = "green"
            hoverComment.style.zIndex = 10

            document.body.appendChild(hoverComment);
            floatingDivsMapTwo.set(uniqueId, hoverComment);
          }
          const hoverComment = floatingDivsMapTwo.get(uniqueId);
          positionFloatingCommentContent(hoverComment, yIndex, xIndex);

        }
      }
    });
  }

  hoverableDiv.addEventListener("mousedown", (event) => {
    const relativeX = event.clientX - divRect.left;
    let cumulativeWidth = 0;

    for (
      let i = wordStats[mouseColSafe][1];
      i < contentTextCleaned.length;
      i++
    ) {
      cumulativeWidth += getCharacterWidth(contentTextCleaned[i]);

      if (cumulativeWidth >= relativeX) {
        startLetterIndex = i; // Start selection
        endLetterIndex = i; // Initially the end is the same as the start
        break;
      }
    }
    if (
      endLetterIndex >= 0 &&
      endLetterIndex < contentTextCleaned.length
    ) {
      output.textContent = `Selected text: ${contentTextCleaned.slice(
        startLetterIndex,
        endLetterIndex + 1
      )}`;
    }
    // liveHighlight()
  });

  hoverableDiv.addEventListener("mouseup", () => {
    // Finalize the selection
    if (startLetterIndex !== -1 && endLetterIndex !== -1) {
      updateHighlightedText();
    }
    output.textContent = `Selected text: ${contentTextCleaned.slice(
      startLetterIndex,
      endLetterIndex + 1
    )}`;
  });


  function findStartIndexFromIndex(updatedWordStats, startLetterIndex) {
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
  function findIndexFromCol(updatedWordStats, col) {

    return updatedWordStats[col][1]
  }
  function findColFromIndex(updatedWordStats, startLetterIndex) {
    let previousValue = null;
    let lastSize = updatedWordStats[updatedWordStats.length - 1][1]
    if (lastSize < startLetterIndex) {
      return lastSize
    }
    for (const value of Object.values(updatedWordStats)) {
      if (startLetterIndex <= value[1]) {

        return previousValue ? previousValue[0] : null;
      }
      previousValue = value;
    }

    return null;
  }

  function findYValueFromIndex(wordStats, startLetterIndex) {
    let previousValue = null;
    let lastSize = wordStats[wordStats.length - 1][1]
    if (lastSize < startLetterIndex) {
      return ((wordStats.length - 1) * textAreaYSections) + divStartY;
    }
    for (const value of Object.values(wordStats)) {
      let yPx = (value[0] * textAreaYSections) + divStartY;

      if (startLetterIndex <= value[1]) {
        return previousValue !== null ? previousValue : yPx;
      }
      previousValue = yPx;
    }

    return null;
  }

  function findXValueFromIndex(yCol, mainText, startIndex) {
    let cumulativeWidth = 0;
    for (let i = yCol; i < mainText.length; i++) {
      if (i == startIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += getCharacterWidth(mainText[i]);
    }
  }

  function positionFloatingComment(element, startId, endId) {
    let yColIndex = findStartIndexFromIndex(wordStats, startId);
    let xCol = findXValueFromIndex(
      yColIndex,
      contentTextCleaned,
      endId
    );
    let top = findYValueFromIndex(wordStats, startId);
    let yColStart = findYValueFromIndex(wordStats, startId)
    let yColEnd = findYValueFromIndex(wordStats, endId)
    let yCol1 = findColFromIndex(wordStats, startId)
    let yCol2 = findColFromIndex(wordStats, endId)
    console.log(`split text ${yCol1} ${yCol2}  ${startId} ${endId}`)
    console.log(wordStats)
    if (yCol1 != yCol2) {
      console.log("split")
      console.log(`split text ${yColEnd}`)
      const selectedText = contentTextCleaned.substring(
        startId,
        wordStats[yColEnd][1] - 1
      );
      console.log(`split text ${selectedText}`)
      const uniqueId = `highlighted2-${startId}-${endId}`;

      // const floatingDiv = document.createElement("div");
      // floatingDiv.id = `floating-${uniqueId}`;
      // floatingDiv.className = "floatingControls";
      // floatingDiv.style.width = `${getWordWidth(selectedText)}px`;

      // document.body.appendChild(floatingDiv);
    }
    // if the end and start col !=
    // check end col <-- start index for other
    // check highlighted text, add previous. find what words wraps on
    // could just use index instead from wordStats
    // method to get col based on index
    element.style.top = `${top - 5}px`;
    element.style.left = `${xCol + divRect.left + 2}px`;
  }
  function positionFloatingCommentContent(element, startId, endId) {
    let yColIndex = findStartIndexFromIndex(wordStats, startId);
    let xCol = findXValueFromIndex(
      yColIndex,
      contentTextCleaned,
      endId
    );
    let top = findYValueFromIndex(wordStats, startId);

    element.style.top = `${top + 25}px`;
    element.style.left = `${xCol + divRect.left + 2}px`;
  }
  function repositionItems() {
    floatingDivsMapTwo.forEach((div, key) => {
      console.log(key)
      let hoverItem = document.getElementById(`${key}`);
      console.log("floating resized")
      if (hoverItem) {
        console.log("got item")
        const ids = hoverItem.id
          .replace("hover-comment-", "")
          .split("-");
        const xIndex = parseInt(ids[0])
        const yIndex = parseInt(ids[1])

        positionFloatingCommentContent(hoverItem, yIndex, xIndex);
      }
    });

    floatingDivsMap.forEach((div, key) => {
      let hoverItem = document.getElementById(`floating-${key}`);
      if (hoverItem) {
        let ids = hoverItem.id
          .replace("floating-highlighted-", "")
          .split("-");
        positionFloatingComment(hoverItem, parseInt(ids[1]), parseInt(ids[0]))
      }
    });
  }
  function updateHighlightedText() {
    if (contentTextCleaned[startLetterIndex] == " ") startLetterIndex++;
    if (contentTextCleaned[endLetterIndex] == " ") endLetterIndex--;
    if (startLetterIndex > endLetterIndex) {
      let temp = startLetterIndex
      startLetterIndex = endLetterIndex
      endLetterIndex = temp
    }
    const uniqueId = `highlighted-${startLetterIndex}-${endLetterIndex}`;

    const selectedText = contentTextCleaned.substring(
      startLetterIndex,
      endLetterIndex + 1
    );
    const highlightedText = `${contentTextCleaned.substring(
      0,
      startLetterIndex
    )}<span id="${uniqueId}" style="background-color: yellow">${selectedText}</span>${contentTextCleaned.substring(endLetterIndex + 1)}`;

    hoverableDiv.innerHTML = highlightedText;

    if (!floatingDivsMap.has(uniqueId)) {
      const floatingDiv = document.createElement("div");
      floatingDiv.id = `floating-${uniqueId}`;
      floatingDiv.className = "floatingControls";
      floatingDiv.style.width = `${getWordWidth(selectedText)}px`;

      document.body.appendChild(floatingDiv);
      floatingDivsMap.set(uniqueId, floatingDiv);
    }
    // Add the div element relative to the span
    const floatingDiv = floatingDivsMap.get(uniqueId);
    positionFloatingComment(floatingDiv, endLetterIndex, startLetterIndex);
    // Initially position the div

    if (!floatingDivsMap.has("listenersAdded")) {
      window.addEventListener("scroll", () => {
        repositionItems()
      });

      window.addEventListener("resize", () => {
        repositionItems()
      });
    }
  }
});