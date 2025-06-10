export class RainbowText {
  rainbow(elementId, customColors = null, className = null) {
    className = className ? className : "rainbow"
    let startColor1 = null
    let startColor2 = null
    let targetColor1 = null
    let targetColor2 = null
    let currentIndex = 0;
    let progress = 0;
    let animateFunctionAction = null
    let updateElementBackground = null

    const element = document.getElementById(elementId);
    if (!element) return;

    element.classList.add(className)

    const styleSheet = [...document.styleSheets].find(sheet =>
      [...sheet.rules].some(rule => rule.selectorText === className)
    );

    let rule;
    if (styleSheet) {
      // Try to find the rule within the found stylesheet
      rule = [...styleSheet.rules].find(rule => rule.selectorText === className);
    }

    // If the rule is not found, insert it
    if (!rule) {
      let targetStyleSheet = styleSheet;
      if (!targetStyleSheet) {
        let styleTag = document.createElement("style");
        document.head.appendChild(styleTag);
        targetStyleSheet = styleTag.sheet;
      }

      // Add the blank '.rainbow' class to the stylesheet
      targetStyleSheet.insertRule(`.${className} {}`, targetStyleSheet.cssRules.length);

      // Retrieve the newly added rule
      rule = [...targetStyleSheet.cssRules].find(rule => rule.selectorText === `.${className}`);
    }

    if (rule) {
      rule.style.backgroundSize = "200% 200%";
      rule.style.backgroundClip = "text";
      rule.style.webkitTextStroke = "4px transparent";
      rule.style.transition = "background 1s ease";
    }
    if (customColors == null) {
      startColor1 = this.getRandomRGB();
      startColor2 = this.getRandomRGB();
      targetColor1 = this.getRandomRGB();
      targetColor2 = this.getRandomRGB();

      animateFunctionAction = () => {
        startColor1 = targetColor1;
        startColor2 = targetColor2;
        targetColor1 = this.getRandomRGB();
        targetColor2 = this.getRandomRGB();
      }

      updateElementBackground = () => {
        const color1 = this.interpolateColor(startColor1, targetColor1, progress);
        const color2 = this.interpolateColor(startColor2, targetColor2, progress);
        rule.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
      }
    } else {
      const createGradients = (colors) => {
        return Object.entries(colors).reduce((acc, [key, color]) => {
          if (key === 'default') return acc;
          const darkerColor = this.adjustColor(color, -10);
          acc[key] = [color, darkerColor];
          return acc;
        }, {});
      };
      const gradients = createGradients(customColors || {
        1: '#eeaa52',
        2: '#e73c6f',
        3: '#2394d5',
        4: '#2af3b7'
      });

      const rgbGradients = Object.values(gradients).map(([color1, color2]) => [
        this.hexToRGB(color1),
        this.hexToRGB(color2)
      ]);

      animateFunctionAction = () => {
        currentIndex = (currentIndex + 1) % rgbGradients.length;
      }

      updateElementBackground = () => {
        const currentGradient = rgbGradients[currentIndex];
        const nextGradient = rgbGradients[(currentIndex + 1) % rgbGradients.length];

        const color1 = this.interpolateColor(currentGradient[0], nextGradient[0], progress);
        const color2 = this.interpolateColor(currentGradient[1], nextGradient[1], progress);

        rule.style.background = `linear-gradient(to right, ${color1}, ${color2})`;
      }
    }

    const animate = () => {
      if (!element.isConnected) return;
      progress += 0.0055;

      if (progress >= 1) {
        progress = 0;
        animateFunctionAction()
      }

      updateElementBackground()
      rule.style.backgroundClip = "text";

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  adjustColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }

  hexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  interpolateColor(startColor, endColor, factor) {
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * factor);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * factor);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
  getRandomRGB() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return { r, g, b };
  }
}