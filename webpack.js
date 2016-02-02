/* jshint esnext: true, node: true, strict: false, quotmark: false */

var webpackMiddleware = require("webpack-dev-middleware");
var webpack = require("webpack");

module.exports = function(webpackConfig) {
    return webpackMiddleware(webpack(webpackConfig), {
        publicPath: webpackConfig.output.publicPath,
        noInfo: true,
        stats: {
            colors: true
        }
    });
};