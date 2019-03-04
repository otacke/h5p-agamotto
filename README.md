H5P Image Blender (Agamotto)
============================
Present a sequence of images and explanations in an interactive way

A free HTML5-based content type that allows users to compare and explore a sequence of images interactively. Authors can decide to add a short explanatory text for each image. Tell your image stories with H5P and Image Blender (Agamotto) on WordPress, Moodle or Drupal.

## Support me at patreon!
If you like what I do, please consider to become my supporter at patreon: https://www.patreon.com/otacke

## Example
!["Agamotto for H5P"](https://ibin.co/w800/3s38Wcrata19.png "Agamotto for H5P")

## Building the distribution files
Pull or download this archive files and go into the main folder. There run

```bash
npm install
```

to get the required modules. Then build the project using

```bash
npm run build
```

or

```bash
npm run watch
```

if you want to modify the code and want to get a fresh build built in the background.

## About this repository
If you want to download the sourcecode, you can choose from three main branches:

- __release:__ Will contain the latest official release.
- __stable:__ Will contain features that have not yet been released, but that should work. Use at your own risk in a production environment.
- __master:__ Will contain the latest progress, but may not have been fully tested. Should definitely not be used in a production environment!
