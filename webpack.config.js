const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = (nodeEnv !== 'production');

const config = {
  mode: nodeEnv,
  optimization: {
    minimizer: [
      new OptimizeCSSAssetsPlugin({})
    ]
  },
  plugins: [
    new MinifyPlugin({}, {
      sourceMap: isDev
    }),    
    new MiniCssExtractPlugin({
      filename: 'h5p-agamotto.css'
    })
  ],
  entry: {
    dist: './src/entries/h5p-agamotto.js'
  },
  output: {
    filename: 'h5p-agamotto.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        query: {
          presets: ['@babel/env']
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ],
      },
      {
        test: /\.svg$/,
        include: path.join(__dirname, 'src/images'),
        loader: 'file-loader?name=images/[name].[ext]'
      },
      {
        test: /\.woff$/,
        include: path.join(__dirname, 'src/fonts'),
        loader: 'file-loader?name=fonts/[name].[ext]'
      }
    ]
  },
  stats: {
    colors: true
  }
};

if (isDev) {
  config.devtool = 'inline-source-map';
}

module.exports = config;
