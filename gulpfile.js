/* jshint esnext: true, node: true, strict: false, quotmark: false */

var $ = require("gulp-load-plugins")();

var path = require("path");
var fs = require("fs");
var del = require("del");
var vinylPaths = require("vinyl-paths");
var webpack = require("webpack");
var StringReplacePlugin = require("string-replace-webpack-plugin");

var factory = function(basePath, options) {

    options = options || {};

    if (typeof options === "function") {
        options = { webpackHook: options };
    }

    if (Array.isArray(options) || typeof options === "string") {
        options = { ignoredFiles: options };
    }

    options.ignoredFiles = options.ignoredFiles || [];
    if (typeof options.ignoredFiles === "string")
        options.ignoredFiles = [options.ignoredFiles];

    var gulp = factory.gulp || require("gulp");

    var config = require("app-up").setup(basePath);

    var publicRoot = path.join(config.basePath, config.appPublicPath);
    var buildRoot = path.join(config.basePath, "build");
    var buildPublicRoot = path.join(buildRoot, config.appPublicPath);
    var buildViewsRoot = path.join(buildRoot, config.appViewsPath);

    gulp.task("default", ["clean", "copy", "usemin", "usemin-views", "package", "webpack"]);

    // cleanup

    gulp.task("clean", function() {
        del.sync(buildRoot + "/**");
    });

    // packaging/organizing

    gulp.task("copy", function() {
        return gulp.src(["./" + config.appPublicPath + "/**/*.*", "!./" + config.appPublicPath + "/**/*.+(js|css|html|map)"])
            .pipe(gulp.dest(buildPublicRoot));
    });

    gulp.task("package-prepare", function() {
        return gulp.src(["./*.*", "!./.*", "!./gulpfile.js", "!./config.json", "!./webpack.config.js", "!./*.md", "!./*.sln", "!./*.suo"].concat(options.ignoredFiles))
            .pipe(gulp.dest(buildRoot));
    });

    gulp.task("package", ["package-prepare"], function() {
        return gulp.src(["./+(" + config.appSharedPath + "|" + config.appPath + "|locales)/**/*.*"])
            .pipe($.convertEncoding({ to: "utf8" }))
            .pipe(gulp.dest(buildRoot));
    });

    // minifying

    gulp.task("usemin", function() {
        return gulp.src("./" + config.appPublicPath + "/**/*.html")
            .pipe($.usemin({
                relativeTo: publicRoot,
                css: [
                    function() { return $.generateCssImport(publicRoot); },
                    function() { return $.minifyCss(); },
                    "concat",
                    function() { return $.rev(); }
                ]
                //html: [ minifyHtml({ empty: true }) ],
                //js: [ uglify(), $.rev() ],
                //inlinejs: [ uglify() ]
            }))
            .pipe(gulp.dest(buildPublicRoot));
    });

    gulp.task("usemin-views-prepare", function() {
        return gulp.src("./" + config.appViewsPath + "/**/*.html")
            .pipe($.usemin({
                relativeTo: publicRoot,
                path: publicRoot,
                css: [
                    function() { return $.generateCssImport(publicRoot); },
                    function() { return $.minifyCss(); },
                    "concat",
                    function() { return $.rev(); }
                ]
            }))
            .pipe(gulp.dest("build/" + config.appViewsPath));
    });

    gulp.task("usemin-views", ["usemin-views-prepare"], function() {
        return gulp.src(path.join(buildViewsRoot, "*.css"))
            .pipe(vinylPaths(del))
            .pipe(gulp.dest(buildPublicRoot));
    });

    // webpack handling

    gulp.task("webpack", function(callback) {
        var webpackConfig = buildWebpackConfig();

        webpackConfig.plugins = (webpackConfig.plugins || []).slice(1);
        webpackConfig.plugins.unshift(new webpack.DefinePlugin({
            "process.env": { NODE_ENV: '"production"' },
            "appConfig" : {
                version: '"' + config.version + '"'
            }
        }));
        webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin());
        /*
        webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
            sourceMap: true
        }));
        webpackConfig.plugins.push(new webpack.SourceMapDevToolPlugin());
        */

        runWebpack(webpackConfig, callback);
    });

    // helper functions for webpack

    function runWebpack(webpackConfig, callback) {
        webpack(webpackConfig, function(err, stats) {
            if (err)
                throw new $.util.PluginError("webpack", err);
            callback();
        });
    }

    function buildWebpackConfig() {

        var mainPath = path.join(publicRoot, "entry");
        var entryPoints = {};
        var entryPointFiles;

        try {
            entryPointFiles = fs.readdirSync(mainPath);
        } catch(err) {
            entryPointFiles = [];
        }

        entryPointFiles
        .filter(function(fileName) {
            return [".DS_Store", "desktop.ini", "Desktop.ini"].indexOf(fileName) === -1;
        })
        .forEach(function(fileName) {
            var entryPointName = path.basename(fileName, path.extname(fileName));
            entryPoints[entryPointName] = path.join(mainPath, fileName);
        });

        var opts = {
            entry: entryPoints,
            output: {
                path: path.join(buildPublicRoot, "entry"),
                publicPath: "/entry/",
                filename: "[name].js"
            },
            module: {
                loaders: [
                    {
                        test: /\.json$/i,
                        loader: "json"
                    },
                    { 
                        test: /\.js$/i,
                        exclude: /node_modules/,
                        loader: "babel-loader",
                        query: {
                            cacheDirectory: true,
                            presets: ["es2015"]
                        }
                    },
                    {
                        // providing appRequire() functionality for public folder
                        test: /\.js$/i,
                        exclude: /node_modules/,
                        loader: StringReplacePlugin.replace({
                            replacements: [{
                                pattern: /appRequire\(('|")[-a-z\/\.]+('|")\)/ig,
                                replacement: function (match) {
                                    var requiredPath = match.replace(/^appRequire\(('|")/i, "").replace(/('|")\)$/i, "");
                                    return 'require("' + path.join(publicRoot, requiredPath).replace(/\\/g, "\\\\") + '")';
                                }
                            }]
                        })
                    }
                ]
            },
            resolve: {
                modulesDirectories: [config.appSharedPath, "web_modules", "node_modules"]
            },
            resolveLoader: {
                modulesDirectories: ["web_loaders", "web_modules", "node_loaders", "node_modules", path.join(__dirname, "node_modules")]
            },
            plugins: [
                new webpack.DefinePlugin({
                    "process.env": { NODE_ENV: '"development"' },
                    "appConfig" : {
                        version: '"' + config.version + '"'
                    }
                }),
                new webpack.optimize.CommonsChunkPlugin("common.all.js"),
                new StringReplacePlugin(),
                new webpack.ProvidePlugin({
                    "$": "jquery",
                    "jQuery": "jquery",
                    "window.jQuery": "jquery"
                })
            ]
        };

        if (typeof options.webpackHook === "function") {
            options.webpackHook(opts, publicRoot, {
                webpack: webpack,
                StringReplacePlugin: StringReplacePlugin
            });
        }

        // workaround to resolve babel presets
        opts.module.loaders[1].query.presets = opts.module.loaders[1].query.presets.map(o => require.resolve("babel-preset-" + o));

        return opts;
    }

    return buildWebpackConfig();
};

module.exports = factory;