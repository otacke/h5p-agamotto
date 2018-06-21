var H5P = H5P || {};

(function (Agamotto) {
  'use strict';

  var TAGS_FOR_PROPAGATION_STOPPING = ['A', 'EM', 'STRONG', 'SUB', 'SUP', 'SPAN'];

  /**
   * Descriptions object.
   *
   * @param {Object} texts - Array containing the texts for the images.
   * @param {string} selector - CSS class name of parent node.
   * @param {string} parent - Parent class Agamotto.
   */
  Agamotto.Descriptions = function (texts, selector, parent) {
    this.texts = texts;
    this.selector = selector;

    this.descriptionTop = document.createElement('div');
    this.descriptionTop.classList.add('h5p-agamotto-description-top');
    this.descriptionTop.style.opacity = 1;
    this.descriptionTop.setAttribute('tabindex', 0);
    this.descriptionTop.innerHTML = texts[0];

    this.descriptionBottom = document.createElement('div');
    this.descriptionBottom.classList.add('h5p-agamotto-description-bottom');
    this.descriptionBottom.style.opacity = 0;
    this.descriptionBottom.innerHTML = texts[1];

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.classList.add('h5p-agamotto-descriptions-container');
    this.descriptionsContainer.appendChild(this.descriptionTop);
    this.descriptionsContainer.appendChild(this.descriptionBottom);

    // Necessary to override the EventListener on document
    this.descriptionsContainer.addEventListener('mouseup', function(e) {
      // Needed for allowing links to work (may contain markup such as strong)
      if (TAGS_FOR_PROPAGATION_STOPPING.indexOf(e.target.tagName) !== -1) {
        e.stopPropagation();
        // Won't pass object and context if invoked by Agamotto.prototype.xAPIInteracted()
        parent.xAPIInteracted();
      }
    });
  };

  Agamotto.Descriptions.prototype = {
    /**
     * Get DOM elements.
     * @return {object} DOM elements.
     */
    getDOM: function getDOM () {
      return this.descriptionsContainer;
    },

    /**
     * Set the description text.
     * @param {number} index - Description (image) index.
     * @param {number} opacity - Description (image) opacity, [0..1].
     */
    setText: function setText (index, opacity) {

      // Switch position to make selecting links possible, threshold is 0.5 opacity
      if (opacity > 0.5) {
        this.descriptionTop.innerHTML = this.texts[index];
        this.descriptionBottom.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length - 1)];
        this.descriptionTop.style.opacity = opacity;
        this.descriptionBottom.style.opacity = 1 - opacity;
      }
      else {
        this.descriptionTop.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length - 1)];
        this.descriptionBottom.innerHTML = this.texts[index];
        this.descriptionTop.style.opacity = 1 - opacity;
        this.descriptionBottom.style.opacity = opacity;
      }
    },
    /**
     * Adjust the height of the description area.
     */
    adjustHeight: function adjustHeight () {
      var that = this;
      // We need to determine the highest of all description texts for resizing
      var height = 0;
      this.texts.forEach(function (text) {
        that.descriptionBottom.innerHTML = text;
        height = Math.max(height, that.descriptionBottom.offsetHeight);
      });
      this.descriptionsContainer.style.height = height + 'px';
    }
  };

})(H5P.Agamotto);
