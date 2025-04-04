const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');

module.exports = merge(common, {
  devtool: 'source-map',
  mode: 'development',
  devServer: {
    static: './build',
    port: 9001,
    historyApiFallback: true,
    host: '0.0.0.0',
    hot: false,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});