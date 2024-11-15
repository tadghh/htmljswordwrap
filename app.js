const widthCache = {};
let startLetterIndex = -1; // Start of selection
let endLetterIndex = -1; // End of selection
const floatingDivsMap = new Map();
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
      const isLastWord = iter === wordArray.length - 1;
      if (testWidth <= divWidth) {
        tempWidth = testWidth;
      } else {
        let endTest = testWidth - spaceSize;
        if (isLastWord) {
          endTest = testWidth;
        }

        if (endTest <= divWidth) {
          tempWidth = testWidth;
          console.log(word)
        } else {
          tempWidth = getWordWidth(word);
          // console.log(word)
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
    console.log(wordStats)
    console.log(getWordWidth(contentTextCleaned.substring(820)))
    console.log(divWidth)
    divStartY = divRect.top;
    textAreaYSections = divRect.height / wordStats.length;

    console.log(`sections ${textAreaYSections} len ${wordStats.length} `)
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

    relativeY = event.clientY - divRect.top; // Relative Y position within the container
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
    hoveringComment(relativeX, divRect.top)
  });
  function hoveringComment(relativeX) {
    console.log("loo")
    floatingDivsMap.forEach((div, key) => {
      let hoverItem = document.getElementById(`floating-${key}`);

      // console.log(`floating-${key}  ${key}`);
      if (hoverItem) {
        let ids = hoverItem.id
          .replace("floating-highlighted-", "")
          .split("-");
        let yColIndex = findColIndexY(wordStats, parseInt(ids[0]));
        let xCol = findValueX(
          yColIndex,
          contentTextCleaned,
          parseInt(ids[0])
        );

        let top = findValueY(wordStats, parseInt(ids[1]));
        let highLightedWord = contentTextCleaned.substring(parseInt(ids[0]), parseInt(ids[1]) + 1)
        let topBorder = top;
        let minXBorder = xCol;
        let bottomBorder = top + 25;
        let maxXBorder = xCol + getWordWidth(highLightedWord)
        let newRelY = event.clientY
        const isInsideX = relativeX >= minXBorder && relativeX <= maxXBorder;
        const isInsideY = newRelY >= topBorder && newRelY <= bottomBorder;
        const isInside = isInsideX && isInsideY;
        console.log(highLightedWord)
        console.log(`MinX: ${minXBorder} | MaxX: ${maxXBorder} | MouseX: ${relativeX} MinY: ${topBorder} | MaxY: ${bottomBorder} | MouseY: ${newRelY}`);

        if (isInside) {
          console.log("yooooYYY")
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


  function findColIndexY(updatedWordStats, startLetterIndex) {
    let previousValue = null;
    // console.log(startLetterIndex)
    // console.log(updatedWordStats)
    let lastSize = updatedWordStats[updatedWordStats.length - 1][1]
    // console.log(lastSize)
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

  function findValueY(wordStats, startLetterIndex) {
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

  function findValueX(yCol, mainText, startIndex) {
    let cumulativeWidth = 0;
    console.log(`y col ${yCol} startI ${startIndex}`)
    for (let i = yCol; i < mainText.length; i++) {
      if (i == startIndex) {
        return cumulativeWidth;
      }
      cumulativeWidth += getCharacterWidth(mainText[i]);

    }
  }

  function positionFloatingComment(element, startId, endId) {
    let yColIndex = findColIndexY(wordStats, startId);
    let xCol = findValueX(
      yColIndex,
      contentTextCleaned,
      endId
    );
    let top = findValueY(wordStats, startId);
    console.log(divRect.left)
    element.style.top = `${top}px`;
    element.style.left = `${xCol + divRect.left}px`;
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
      const floatingCommentContent = document.createElement("p");
      floatingDiv.id = `floating-${uniqueId}`;
      floatingCommentContent.id = `comment-${uniqueId}`;
      floatingCommentContent.textContent = "this is a test comment"
      floatingCommentContent.style.display = "none"
      floatingDiv.className = "floatingControls";

      floatingDiv.style.width = `${getWordWidth(selectedText)}px`;
      console.log(getWordWidth(selectedText))
      floatingDiv.appendChild(floatingCommentContent)
      document.body.appendChild(floatingDiv);
      floatingDivsMap.set(uniqueId, floatingDiv);

    }
    // Add the div element relative to the span
    const floatingDiv = floatingDivsMap.get(uniqueId);
    positionFloatingComment(floatingDiv, endLetterIndex, startLetterIndex);
    // Initially position the div

    if (!floatingDivsMap.has("listenersAdded")) {
      // window.addEventListener("scroll", () => {
      // 	floatingDivsMap.forEach((div, key) => {
      // 		const span = document.getElementById(
      // 			key.replace("floating-", "")
      // 		);
      // 		if (span) {
      // 			const spanRect = span.getBoundingClientRect();
      // 			div.style.top = `${spanRect.bottom + window.scrollY}px`;
      // 			div.style.left = `${spanRect.left + window.scrollX}px`;
      // 		}
      // 	});
      // });

      window.addEventListener("resize", () => {

        floatingDivsMap.forEach((div, key) => {
          let hoverItem = document.getElementById(`floating-${key}`);

          if (hoverItem) {
            let ids = hoverItem.id
              .replace("floating-highlighted-", "")
              .split("-");
            positionFloatingComment(hoverItem, parseInt(ids[1]), parseInt(ids[0]))
          }
        });
      });
    }
  }
});