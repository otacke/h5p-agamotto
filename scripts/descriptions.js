(function (Agamotto) {
  'use strict';

  /**
   * Descriptions object.
   *
   * @param {Object} texts - Array containing the texts for the images.
   * @param {string} selector - Class name of parent node
   */
  Agamotto.Descriptions = function (texts, selector) {
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
      if (e.target.tagName === 'A') {
        e.stopPropagation();
      }
    });
  };

  Agamotto.Descriptions.prototype = {
    getDOM: function getDOM () {
      return this.descriptionsContainer;
    },
    setText: function setText (index, opacity) {
      // Switch position to make selecting links possible
      if (opacity > 0.5) {
        this.descriptionTop.innerHTML = this.texts[index];
        this.descriptionBottom.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length)];
        this.descriptionTop.style.opacity = opacity;
        this.descriptionBottom.style.opacity = 1 - opacity;
      }
      else {
        this.descriptionTop.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length)];
        this.descriptionBottom.innerHTML = this.texts[index];
        this.descriptionTop.style.opacity = 1 - opacity;
        this.descriptionBottom.style.opacity = opacity;
      }
    },
    setHeight: function setHeight () {
      // We need to determine the highest description text for resizing
      var height = 0;
      for (var i = 0; i <= this.texts.length; i++) {
        this.descriptionBottom.innerHTML = this.texts[i];
        height = Math.max(height, this.descriptionBottom.offsetHeight);
      }
      this.descriptionsContainer.style.height = height + 'px';
    }
  };

})(H5P.Agamotto);
