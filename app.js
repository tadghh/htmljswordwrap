import { TextHighlighter } from "./highlightjs.js";
import { RainbowText } from "./rainbow.js";

document.addEventListener("DOMContentLoaded", () => {
  const rainbowTitle = new RainbowText()
  rainbowTitle.rainbow("prjTitle")

  // This is the default highlighter
  defaultExample()

  // This one will showcase custom function/behavior and using a custom form
  customHighlight();

  // This one will demo dynamic/moving content
  movingHighlight();
});

function defaultExample() {
  const highlighter1 = new TextHighlighter("highlightedDiv1")
    .setFormTransparency(true)
    .initialize();

  highlighter1.createTextHighlight(747, 760, "Woah this is going somewhere woo hoo", 2)
  highlighter1.setCalibratorWidthSensitivity(2)
}

function customHighlight() {
  const formContainer = document.getElementById("customForm")
  let colorSquaresContainer = formContainer.querySelector('.color-squares');

  // Remove the existing container if it exists
  if (colorSquaresContainer) {
    colorSquaresContainer.remove();
  }

  // Create a new color-squares container
  colorSquaresContainer = document.createElement('div');
  colorSquaresContainer.className = 'color-squares';
  Object.entries(customHighlightColors).forEach(([value, color]) => {
    // Skip the default color
    if (value !== 'default') {
      const square = document.createElement('button');
      square.type = 'button';
      square.className = 'color-square';
      square.dataset.value = value;
      square.style.backgroundColor = color;

      square.addEventListener('click', () => {
        colorSquaresContainer.querySelectorAll('.color-square')
          .forEach(s => s.classList.remove('selected'));
        square.classList.add('selected');
      });
      colorSquaresContainer.appendChild(square);
    }
  });
  formContainer.appendChild(colorSquaresContainer);

  function textFunction() {
    highlighter2.createHighlight();

    let rawId = highlighter2.getRawId();

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'commentType';
    hiddenInput.value = '1';

    formContainer.firstElementChild.appendChild(hiddenInput);

    let colorSquaresContainer = formContainer.querySelector('.color-squares');

    // Remove the existing container if it exists
    if (colorSquaresContainer) {
      colorSquaresContainer.remove();
    }

    // Create a new color-squares container
    colorSquaresContainer = document.createElement('div');
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
          // Update the selected color
          hiddenInput.value = value;

          colorSquaresContainer.querySelectorAll('.color-square')
            .forEach(s => s.classList.remove('selected'));
          square.classList.add('selected');
          window.getSelection().removeAllRanges();
          if (rawId != null) {
            highlighter2.updateHighlightColorsId(rawId, value);
          }
        });
        colorSquaresContainer.appendChild(square);
      }
    });

    formContainer.appendChild(colorSquaresContainer);

    const closeButton = formContainer.querySelector('.close-btn');
    closeButton.addEventListener('click', () => highlighter2.closeFormId(rawId));

    formContainer.addEventListener('submit', (event) => {
      const form = event.target;
      const commentContent = form.comment.value;
      const commentType = form.commentType.value;

      event.preventDefault();
      highlighter2.setHighlightComment(commentContent, commentType);
      rawId = null
    });
  }

  const highlighter2 = new TextHighlighter("highlightedDiv2", "outputHover2")
    .setFormId("customForm")
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
