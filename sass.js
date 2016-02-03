/* jshint esnext: true, node: true, strict: false, quotmark: false */

var path = require("path");
var sassMiddleware = require("node-sass-middleware");

module.exports = function(app, config) {

    var publicRoot = path.join(config.basePath, config.appPublicPath);

    app.get(/\.scss$/i, function(req, res) {
        res.redirect(301, req.path.replace(/\.scss$/i, ".css"));
    });

    app.use(sassMiddleware({
        src: publicRoot,
        response: true,
        debug: true,
        error: function(err) {
            console.log("Sass ERROR");
            console.log(err.message);
        }
    }));
};