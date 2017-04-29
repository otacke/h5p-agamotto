(function (Agamotto) {

  /**
   * Images object
   *
   * @class H5P.Agamotto.Images
   * @param {Object} images - Array containing the images.
   * @param {number} id - ID of this H5P content.
   * @param {string} selector - Class name of parent node.
   */
   Agamotto.Images = function (paths, id, selector) {
     this.paths = paths;
     this.id = id;
     this.selector = selector;

     this.images = [];
     this.imagesLoaded = 0;

     this.imageTop = document.createElement('img');
     this.imageTop.className = 'h5p-agamotto-image-top';
     this.imageTop.src = '#';
     this.imageTop.setAttribute('draggable', 'false');
     this.imageTop.setAttribute('tabindex', 0);

     this.imageBottom = document.createElement('img');
     this.imageBottom.className = 'h5p-agamotto-image-bottom';
     this.imageBottom.src = '#';
     this.imageBottom.setAttribute('draggable', 'false');

     this.container = document.createElement('div');
     this.container.className = 'h5p-agamotto-images-container';
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
       this.container.style.height = window.getComputedStyle(this.imageTop).height;
     },
     loadImages: function loadImages() {
       var that = this;

       // Wait for images to be loaded before triggering some stuff
       var loadImagesDispatcher = function () {
         that.imagesLoaded++;
         if (that.imagesLoaded === 1) {
           // We can now determine the render height
           that.imageTop.src = that.images[0].src;
           that.container.style.height = window.getComputedStyle(that.imageTop).height;
           document.querySelector(that.selector).dispatchEvent(new CustomEvent('loaded first'));
         }
         else if (that.imagesLoaded === 2) {
           // We can now set the bottom image
           that.imageBottom.src = that.images[1].src;
         }
         if (that.imagesLoaded === that.paths.length) {
           // We can now activate the slider
           document.querySelector(that.selector).dispatchEvent(new CustomEvent('loaded all'));
         }
       };

       for (var i = 0; i < this.paths.length; i++) {
         this.images[i] = new Image();
         this.images[i].onload = loadImagesDispatcher;
         this.images[i].src = H5P.getPath(this.paths[i], this.id);
       }
     },
     setMargin: function setMargin (margin) {
       this.container.style.margin = margin;
     }
   };

})(H5P.Agamotto);
