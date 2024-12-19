import { TextHighlighter } from "./highlightjs.js";
import { RainbowText } from "./rainbow.js";

document.addEventListener("DOMContentLoaded", () => {
  const rainbowTitle = new RainbowText()
  rainbowTitle.rainbow("ex3")

  // // This is the default highlighter
  const highlighter1 = new TextHighlighter("highlightedDiv1", "outputHover1").initialize();
  highlighter1.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  highlighter1.setCalibratorWidthSensitivity(2)

  // This one will showcase custom function/behavior and using a custom form
  customHighlight();

  // This one will demo dynamic/moving content
  movingHighlight();
});


function customHighlight() {
  const formContainer = document.getElementById("customForm")

  function textFunction() {
    const startIndex = highlighter2.getStartLetterIndex()
    const endIndex = highlighter2.getEndLetterIndex()
    highlighter2.createHighlight()

    const rawId = highlighter2.getRawId()
    const parser = new DOMParser();

    const doc = parser.parseFromString(customForm, 'text/html');
    const floatingDivForm = doc.body.firstElementChild;
    floatingDivForm.style.height = "200px"
    floatingDivForm.style.position = "relative"
    formContainer.appendChild(floatingDivForm)
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'commentType';
    hiddenInput.value = '1';
    floatingDivForm.firstElementChild.appendChild(hiddenInput);
    const colorSquaresContainer = document.createElement('div');
    colorSquaresContainer.className = 'color-squares';

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

          if (this.floatingDivsSplit.has(rawId)) {
            highlighter2.updateHighlightColorsId(rawId, value);
          }
        });

        colorSquaresContainer.appendChild(square);
      }
    });
    floatingDivForm.appendChild(colorSquaresContainer);

    floatingDivForm.addEventListener('submit', (event) => {
      const form = event.target;
      const commentContent = form.comment.value
      const commentType = form.commentType.value

      event.preventDefault();
      highlighter2.setHighlightComment(commentContent, commentType)
    });

    console.log(startIndex)
    console.log(endIndex)

  };
  const highlighter2 = new TextHighlighter("highlightedDiv2", "outputHover2")
    .setFormHTML(customForm)
    .setMouseUpFunction(textFunction)
    .setHighlightColors(customHighlightColors)
    .initialize();
  highlighter2.setCalibratorWidthSensitivity(2)
  highlighter2.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
}

function movingHighlight() {
  const radius = 20; // Size of the circle
  const speed = 0.05; // Speed of rotation
  let angle = 0;
  const highlighter3 = new TextHighlighter("highlightedDivMoving", "outputHover3").initialize();
  highlighter3.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  const movingDiv = document.getElementById("highlightedDivMoving");

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
}

const customHighlightColors = {
  1: '#FFB5E8',  // Soft pink
  2: '#B28DFF',  // Lavender
  3: '#BFFCC6',  // Mint
  4: '#FFC9DE',  // Salmon pink
  default: '#C5A3FF'  // Light purple
}

const customForm = `
<div class="floatingForm">
    <form action="">
        <div id="commentFormHeader">
            <label for="text">Custom Form Content</label>
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