/* eslint-disable */
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const SymlinkWebpackPlugin = require("symlink-webpack-plugin");
const globImporter = require("node-sass-glob-importer");
const path = require("path");
const glob = require("glob");

const allTemplates = () => {
  return glob
    .sync("**/*.html", { cwd: path.join(__dirname, "static/templates") })
    .map((file) => `"modules/template/templates/${file}"`)
    .join(", ");
};

module.exports = (env) => {
  const defaults = {
    watch: false,
    mode: "development",
  };

  const environment = { ...defaults, ...env };
  const isDevelopment = environment.mode === "development";

  const config = {
    entry: {
      module: "./src/markdown-editor-extras.ts",
      style: "./src/markdown-editor-extras.scss",
    },
    watch: environment.watch,
    devtool: "inline-source-map",
    stats: "minimal",
    mode: environment.mode,
    resolve: {
      extensions: [".wasm", ".mjs", ".ts", ".js", ".json", ".scss"],
    },
    output: {
      filename: "[name].js",
      path: __dirname + "/dist",
    },
    devServer: {
      hot: true,
      writeToDisk: true,
      proxy: [
        {
          context: (pathname) => {
            return !pathname.match("^/sockjs");
          },
          target: "http://localhost:30000",
          ws: true,
        },
      ],
    },
    module: {
      rules: [
        isDevelopment
          ? {
              test: /\.html$/,
              loader: "raw-loader",
            }
          : {
              test: /\.html$/,
              loader: "null-loader",
            },
        {
          test: /\.ts$/,
          use: [
            "ts-loader",
            "webpack-import-glob-loader",
            "source-map-loader",
            {
              loader: "string-replace-loader",
              options: {
                search: '"__ALL_TEMPLATES__"',
                replace: allTemplates,
              },
            },
          ],
        },
        // {
        //   test: /\.scss$/,
        //   use: [
        //     MiniCssExtractPlugin.loader,
        //     // "style-loader",
        //     {
        //       loader: "css-loader",
        //       options: {
        //         sourceMap: isDevelopment,
        //         url: false,
        //       },
        //     },
        //     {
        //       loader: "sass-loader",
        //       options: {
        //         sourceMap: isDevelopment,
        //         sassOptions: {
        //           importer: globImporter(),
        //         },
        //       },
        //     },
        //   ],
        // },
        {
          test: /\.s[ac]ss$/i,
          use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new ESLintPlugin({
        extensions: ["ts"],
      }),
      new CopyPlugin({
        patterns: [
          {
            from: "static",
            noErrorOnMissing: true,
          },
        ],
      }),
      new SymlinkWebpackPlugin([
        { origin: "../packs", symlink: "packs", force: true },
      ]),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: "styles/[name].css",
        chunkFilename: "styles/[id].css",
      }),
    ],
  };

  if (!isDevelopment) {
    delete config.devtool;
  }

  return config;
};
