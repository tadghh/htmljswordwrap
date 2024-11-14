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

    for (let i = 0; i < wordArray.length - 1; i++) {
      wordArray[i] += " ";
    }

    for (const word of wordArray) {
      let testWidth = tempWidth + getWordWidth(word);

      if (testWidth <= divWidth) {
        tempWidth = testWidth;
      } else {
        let endTest = testWidth - spaceSize;
        if (endTest <= divWidth) {
          tempWidth = testWidth;
        } else {
          tempWidth = getWordWidth(word);
          widthCache.push([wordCols, currentStringIndex]);
          wordCols += 1;
        }
      }
      currentStringIndex += word.length;
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
    relativeY = event.clientY - divRect.top; // Relative Y position within the container

    let cumulativeWidth = 0;
    let letterIndex = -1;
    mouseCol = Math.floor((relativeY) / textAreaYSections);

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
  function hoveringComment(relativeX, newTopPadding) {
    console.log("loo")
    floatingDivsMap.forEach((div, key) => {
      let hoverItem = document.getElementById(`floating-${key}`);

      // console.log(`floating-${key}  ${key}`);
      if (hoverItem) {
        let ids = hoverItem.id
          .replace("floating-highlighted-", "")
          .split("-");
        let yColIndex = findColIndexY(wordStats, parseInt(ids[1]));
        let xCol = findValueX(
          yColIndex,
          contentTextCleaned,
          parseInt(ids[0])
        );

        let top = findValueY(wordStats, parseInt(ids[1]));
        let highLightedWord = contentTextCleaned.substring(parseInt(ids[1]), parseInt(ids[0]))
        let topBorder = top - 25;
        let minXBorder = xCol - 25;
        let bottomBorder = top;
        let maxXBorder = xCol + getWordWidth(highLightedWord)
        const isInsideX = relativeX >= minXBorder && relativeX <= maxXBorder;
        const isInsideY = relativeY >= topBorder && relativeY <= bottomBorder;
        const isInside = isInsideX && isInsideY;
        let newRelY = relativeY + newTopPadding
        console.log(`MinX: ${minXBorder} | MaxX: ${maxXBorder} | MouseX: ${relativeX} MinY: ${topBorder} | MaxY: ${bottomBorder} | MouseY: ${newRelY}`);

        if (relativeX >= minXBorder && relativeX <= maxXBorder) {
          // console.log("yooooXX")
          if (newRelY >= topBorder && newRelY <= bottomBorder) {
            console.log("yooooYYY")
          }
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

    for (const value of Object.values(updatedWordStats)) {
      if (startLetterIndex <= value[1]) {

        return previousValue ? previousValue[1] : null;
      }
      previousValue = value;
    }

    return null;
  }

  function findValueY(wordStats, startLetterIndex) {
    for (const value of Object.values(wordStats)) {
      if (startLetterIndex <= value[1]) {
        return value[0] * textAreaYSections + divStartY;
      }
    }

    return null;
  }

  function findValueX(yCol, mainText, startIndex) {
    let cumulativeWidth = 0;

    for (let i = yCol; i < mainText.length; i++) {
      cumulativeWidth += getCharacterWidth(mainText[i]);
      if (i == startIndex) {
        return cumulativeWidth;
      }
    }
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
    const spanElement = document.getElementById(uniqueId);
    const floatingDiv = floatingDivsMap.get(uniqueId);

    // Position the div relative to the span
    function positionFloatingDiv() {
      const spanRect = spanElement.getBoundingClientRect();
      floatingDiv.style.top = `${(spanRect.bottom + window.scrollY) - 25}px`;
      floatingDiv.style.left = `${spanRect.left + window.scrollX}px`;
    }
    function positionFloatingComment(element, startId, endId) {
      let yColIndex = findColIndexY(wordStats, startId);
      let xCol = findValueX(
        yColIndex,
        contentTextCleaned,
        endId
      );
      let top = findValueY(wordStats, startId);
      element.style.top = `${top - 25}px`;
      element.style.left = `${xCol}px`;
    }

    // Initially position the div
    positionFloatingDiv();
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

          console.log(`floating-${key}  ${key}`);
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