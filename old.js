// const uniqueId = `hover-comment-${xIndex}-${yIndex}`;

// if (!this.floatingDivsMapTwo.has(uniqueId)) {
//   const hoverComment = document.createElement("div");
//   hoverComment.id = uniqueId
//   hoverComment.textContent = "test comment here"
//   hoverComment.className = "floatingControlsTwo"
//   hoverComment.style.position = "absolute"
//   hoverComment.style.fontSize = "20px"
//   hoverComment.style.color = "white"
//   hoverComment.style.background = "green"
//   hoverComment.style.zIndex = 10

//   document.body.appendChild(hoverComment);
//   this.floatingDivsMapTwo.set(uniqueId, hoverComment);
// }
// const hoverComment = this.floatingDivsMapTwo.get(uniqueId);
// this.positionFloatingCommentContent(hoverComment, yIndex, xIndex);


// TODO this helper methods in this depend on the classes content, cant use this 'cleanly'
// createTextHighlight(startIndex, endIndex, textContent) {
//   if (startIndex > endIndex) {
//     [startIndex, endIndex] = [endIndex, startIndex];
//     startIndex++
//   }

//   if (this.contentTextCleaned[startIndex] === " ") startIndex++;
//   if (this.contentTextCleaned[endIndex] === " ") endIndex--;
//   // add example spans below
//   const uniqueId = `floating-highlighted-${startIndex}-${endIndex}`;
//   const rawUniqueId = `${startIndex}-${endIndex}`;
//   const selectedText = textContent.slice(startIndex, endIndex + 1);

//   if (!this.floatingDivsMap.has(rawUniqueId)) {
//     const floatingDiv = document.createElement("div");
//     const floatingDivContent = document.createElement("div");
//     floatingDiv.id = uniqueId;
//     floatingDivContent.id = uniqueId;
//     floatingDiv.className = "floatingControls";
//     floatingDivContent.className = "floatingContent";

//     let width = this.getNextLowestDivisibleByNinePointSix(this.getWordWidth(selectedText))

//     floatingDiv.style.width = `${width}px`;
//     floatingDiv.setAttribute("start", startIndex)
//     floatingDiv.setAttribute("end", endIndex)
//     floatingDiv.setAttribute("rawId", rawUniqueId)
//     floatingDivContent.style.width = `${width}px`;

//     floatingDivContent.setAttribute("start", startIndex)
//     floatingDivContent.setAttribute("end", endIndex)
//     floatingDivContent.setAttribute("rawId", rawUniqueId)

//     this.floatingDivsMap.set(rawUniqueId, floatingDiv);
//     this.floatingDivsMapTwo.set(rawUniqueId, floatingDivContent);
//     document.body.appendChild(floatingDiv);
//     document.body.appendChild(floatingDivContent);
//   }
//   // Add the div element relative to the span
//   this.#positionFloatingComment(this.floatingDivsMap.get(rawUniqueId));
//   this.#positionFloatingCommentContent(this.floatingDivsMapTwo.get(rawUniqueId));
//   // Initially position the div
//   this.#repositionItems()
// }
