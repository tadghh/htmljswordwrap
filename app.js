import { TextHighlighter } from "./highlightjs.js";

document.addEventListener("DOMContentLoaded", () => {
  let exampleForm = `
  <div class="floatingForm">
      <form action="">
          <div id="commentFormHeader">
              <label for="text">ConteWEEEEEEEEEEnt</label>
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
      <button type="button" class="n">X</button>
  </div>
`;
  // const highlighter1 = new TextHighlighter("highlightedDiv1", "outputHover");
  const highlighter1 = new TextHighlighter("highlightedDiv1", "outputHover");
  const highlighter2 = new TextHighlighter("highlightedDiv2", "outputHover");
  const highlighter3 = new TextHighlighter("highlightedDivMoving", "outputHover");

  highlighter1.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  highlighter2.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  highlighter3.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  const movingDiv = document.getElementById("moving-test");
  let angle = 0;
  const radius = 20; // Size of the circle
  const speed = 0.05; // Speed of rotation

  function animate() {
    // Calculate x and y position using trigonometry
    const xOffset = Math.cos(angle) * radius;
    const yOffset = Math.sin(angle) * radius;

    // Apply the transform
    movingDiv.style.transform = `translate(${xOffset}px, ${yOffset}px)`;

    // Increment the angle
    angle += speed;

    // Request the next frame
    requestAnimationFrame(animate);
    highlighter3.repositionItems()
  }

  // Start the animation
  animate();

});
