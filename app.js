import { TextHighlighter } from "./wordWorker.js";

document.addEventListener("DOMContentLoaded", () => {
  new TextHighlighter("hoverableDiv", "output", "outputHover");
});