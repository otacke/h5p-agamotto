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
    this.selector = selector;

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.classList.add('h5p-agamotto-descriptions-container');

    // Add wrappers
    this.descriptionWrappers = this.buildDescriptionWrappers(texts);
    this.descriptionWrappers.forEach((wrapper) => {
      this.descriptionsContainer.appendChild(wrapper);
    });

    this.descriptionWrappers[0].classList.remove('h5p-agamotto-hidden');
    this.currentDescriptionText = this.descriptionWrappers[0].textContent;

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
   * Build wrappers for descriptions.
   * @param {string[]} texts Description texts.
   * @return {HTMLElement[]} Wrappers.
   */
  buildDescriptionWrappers(texts) {
    const wrappers = [];

    if (!Array.isArray(texts)) {
      return wrappers;
    }

    texts.forEach((text) => {
      const wrapper = document.createElement('div');
      wrapper.classList.add('h5p-agamotto-description-bottom');
      wrapper.classList.add('h5p-agamotto-hidden');
      wrapper.setAttribute('aria-hidden', 'true');
      if (text) {
        wrapper.innerHTML = text;
      }
      wrappers.push(wrapper);
    });

    return wrappers;
  }

  /**
   * Get current description text.
   * @return {string} Current description text.
   */
  getCurrentDescriptionText() {
    return this.currentDescriptionText;
  }

  /**
   * Set the description text.
   * @param {number} index Description (image) index.
   * @param {number} opacity Description (image) opacity, [0..1].
   */
  setText(index, opacity) {
    this.descriptionWrappers.forEach((wrapper) => {
      wrapper.classList.add('h5p-agamotto-hidden');
    });

    const wrapperTop = this.descriptionWrappers[index];
    const wrapperBottom = this.descriptionWrappers[Util.constrain(index + 1, 0, this.descriptionWrappers.length - 1)];

    wrapperTop.classList.remove('h5p-agamotto-hidden');
    wrapperBottom.classList.remove('h5p-agamotto-hidden');

    wrapperTop.style.opacity = opacity;
    if (wrapperTop !== wrapperBottom) {
      wrapperBottom.style.opacity = 1 - opacity;
    }

    this.currentDescriptionText = (opacity > 0.5) ? wrapperTop.textContent : wrapperBottom.textContent;
  }

  /**
   * Adjust the height of the description area.
   */
  resize() {
    // We need to determine the highest of all description texts for resizing
    let height = 0;

    setTimeout(() => {
      this.descriptionWrappers.forEach((wrapper) => {
        height = Math.max(height, wrapper.offsetHeight);
      });

      this.descriptionsContainer.style.height = `${height}px`;
    }, 0);
  }
}

Descriptions.TAGS_FOR_PROPAGATION_STOPPING = ['A', 'EM', 'STRONG', 'SUB', 'SUP', 'SPAN'];

export default Descriptions;
