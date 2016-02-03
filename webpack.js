/* jshint esnext: true, node: true, strict: false, quotmark: false */

var path = require("path");
var webpackMiddleware = require("webpack-dev-middleware");
var webpack = require("webpack");

module.exports = function(app, config) {

    var webpackConfig = require(path.join(config.basePath, "gulpfile.js"));

    app.use(webpackMiddleware(webpack(webpackConfig), {
        publicPath: webpackConfig.output.publicPath,
        noInfo: true,
        stats: {
            colors: true
        }
    }));
};