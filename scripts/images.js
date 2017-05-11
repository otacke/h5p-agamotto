(function (Agamotto) {
  'use strict';

  /**
   * Images object
   *
   * @class H5P.Agamotto.Images
   * @param {Object} images - Array containing the images.
   */
   Agamotto.Images = function (images) {
     this.images = images;

     this.ratio = this.images[0].naturalWidth / this.images[0].naturalHeight;
     // Users might use images with different aspect ratios -- I learned that the hard way ;-)
     for (var i = 1; i < this.images.length; i++) {
       if (this.images[i].naturalWidth / this.images[i].naturalHeight !== this.ratio) {
         console.log('I am doing my best, but please make sure that all your images have the same aspect ratio.');
         break;
       }
     }

     this.imageTop = document.createElement('img');
     this.imageTop.classList.add('h5p-agamotto-image-top');
     this.imageTop.src = images[0].src;
     this.imageTop.setAttribute('draggable', 'false');
     this.imageTop.setAttribute('tabindex', 0);

     this.imageBottom = document.createElement('img');
     this.imageBottom.classList.add('h5p-agamotto-image-bottom');
     this.imageBottom.src = images[1].src;
     this.imageBottom.setAttribute('draggable', 'false');

     this.container = document.createElement('div');
     this.container.classList.add('h5p-agamotto-images-container');
     this.container.appendChild(this.imageTop);
     this.container.appendChild(this.imageBottom);
   };

   Agamotto.Images.prototype = {
     getDOM: function getDOM () {
       return this.container;
     },
     setImage: function setImage (index, opacity) {
       this.imageTop.src = this.images[index].src;
       this.imageBottom.src = this.images[Agamotto.constrain(index + 1, 0, this.images.length - 1)].src;
       this.imageTop.style.opacity = opacity;
     },
     resize: function resize () {
       this.container.style.height = this.container.offsetWidth / this.ratio + 'px';
     },
     getRatio: function getRatio() {
       return this.ratio;
     }
   };

})(H5P.Agamotto);
