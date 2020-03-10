import Util from './h5p-agamotto-util';

/** Class representing Descriptions */
class Descriptions {
  /**
   * Descriptions object.
   * @param {object[]} texts Array containing the texts for the images.
   * @param {string} selector CSS class name of parent node.
   * @param {string} parent Parent class Agamotto.
   */
  constructor(texts, selector, parent) {
    this.texts = texts;
    this.selector = selector;

    this.descriptionTop = document.createElement('div');
    this.descriptionTop.classList.add('h5p-agamotto-description-top');
    this.descriptionTop.style.opacity = 1;
    this.descriptionTop.innerHTML = texts[0];
    // For ARIA, description is part of image alt text
    this.descriptionTop.setAttribute('aria-hidden', 'true');

    this.descriptionBottom = document.createElement('div');
    this.descriptionBottom.classList.add('h5p-agamotto-description-bottom');
    this.descriptionBottom.style.opacity = 0;
    this.descriptionBottom.innerHTML = texts[1];

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.classList.add('h5p-agamotto-descriptions-container');
    this.descriptionsContainer.appendChild(this.descriptionTop);
    this.descriptionsContainer.appendChild(this.descriptionBottom);

    // Necessary to override the EventListener on document
    this.descriptionsContainer.addEventListener('mouseup', event => {
      // Needed for allowing links to work (may contain markup such as strong)
      if (Descriptions.TAGS_FOR_PROPAGATION_STOPPING.indexOf(event.target.tagName) !== -1) {
        event.stopPropagation();
        // Won't pass object and context if invoked by Agamotto.prototype.xAPIInteracted()
        parent.xAPIInteracted();
      }
    });
  }

  /**
   * Get DOM elements.
   * @return {HTMLElement} DOM elements.
   */
  getDOM() {
    return this.descriptionsContainer;
  }

  /**
   * Get current description text.
   * @return {string} Current description text.
   */
  getCurrentDescriptionText() {
    return this.descriptionTop.textContent;
  }

  /**
   * Set the description text.
   * @param {number} index Description (image) index.
   * @param {number} opacity Description (image) opacity, [0..1].
   */
  setText(index, opacity) {

    // Switch position to make selecting links possible, threshold is 0.5 opacity
    if (opacity > 0.5) {
      this.descriptionTop.innerHTML = this.texts[index];
      this.descriptionBottom.innerHTML = this.texts[Util.constrain(index + 1, 0, this.texts.length - 1)];
      this.descriptionTop.style.opacity = opacity;
      this.descriptionBottom.style.opacity = 1 - opacity;
    }
    else {
      this.descriptionTop.innerHTML = this.texts[Util.constrain(index + 1, 0, this.texts.length - 1)];
      this.descriptionBottom.innerHTML = this.texts[index];
      this.descriptionTop.style.opacity = 1 - opacity;
      this.descriptionBottom.style.opacity = opacity;
    }
  }

  /**
   * Adjust the height of the description area.
   */
  resize() {
    // We need to determine the highest of all description texts for resizing
    let height = 0;
    this.texts.forEach(text => {
      this.descriptionBottom.innerHTML = text;
      height = Math.max(height, this.descriptionBottom.offsetHeight);
    });
    this.descriptionsContainer.style.height = height + 'px';
  }
}

Descriptions.TAGS_FOR_PROPAGATION_STOPPING = ['A', 'EM', 'STRONG', 'SUB', 'SUP', 'SPAN'];

export default Descriptions;
