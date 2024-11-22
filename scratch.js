const rowId = element.getAttribute("rawId")
const uniqueId = `split-${startId}-${this.wordStats[yCol1][1] - 1}`;
const splitId = `split-${this.wordStats[yCol1][1]}-${endId}`

// if (!this.floatingDivsSplit.has(uniqueId)) {
//   const selectedText = this.contentTextCleaned.substring(
//     startId, this.wordStats[yCol1 + 1][1] - 1
//   );

//   console.log(selectedText)

//   const floatingDiv = document.createElement("div");
//   floatingDiv.id = uniqueId;
//   floatingDiv.className = "floatingControls";
//   floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
//   floatingDiv.setAttribute("rawId", rowId)
//   floatingDiv.setAttribute("end", this.wordStats[yCol1 - 1][1] - 1)
//   floatingDiv.setAttribute("start", startId)
//   document.body.appendChild(floatingDiv);
//   this.floatingDivsSplit.set(uniqueId, floatingDiv);
// }
if (!this.floatingDivsSplit.has(splitId)) {
  let testStartIndex = this.wordStats[yCol1 + 1][1]
  let gaycat = this.findStartIndexFromIndex(testStartIndex + 1);

  const selectedText = this.contentTextCleaned.substring(
    testStartIndex,
    endId
  );

  // console.log(selectedText)
  // console.log(this.wordStats)
  console.log(`yColIndex ${gaycat} xcol ${this.getWidthFromRange(
    gaycat, testStartIndex
  )} top${this.findYValueFromIndex(testStartIndex)} startIndex${testStartIndex} endid ${endId} selected ${selectedText}`)
  const floatingDiv = document.createElement("div");
  floatingDiv.id = "yo";
  floatingDiv.className = "floatingControls";
  floatingDiv.style.width = `${this.getWordWidth(selectedText)}px`;
  floatingDiv.setAttribute("rawId", rowId)
  floatingDiv.setAttribute("start", this.wordStats[yCol1 + 1][1])
  floatingDiv.setAttribute("start2", this.wordStats[yCol1 + 1][1])
  floatingDiv.setAttribute("end", endId)
  document.body.appendChild(floatingDiv);
  this.floatingDivsSplit.set("yo", floatingDiv);
}
// this.#repositionItems()
// return;