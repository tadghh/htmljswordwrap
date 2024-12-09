import { TextHighlighter } from "./wordWorker.js";

document.addEventListener("DOMContentLoaded", () => {
  new TextHighlighter("highlightedDiv", "outputHover");
});