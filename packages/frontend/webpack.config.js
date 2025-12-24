const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const webConfig = (_env, argv) => {
  const isDev = argv.mode === "development";

  return {
    mode: argv.mode,
    entry: path.join(__dirname, "src/index.js"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].[contenthash:6].js",
      publicPath: "/",
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.svg$/i,
          use: ["@svgr/webpack"],
        },
      ],
    },
    resolve: {
      extensions: [".js", ".jsx", ".json"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    devServer: {
      compress: true,
      historyApiFallback: {
        rewrites: [{ from: /^\/.+/, to: "/index.html" }],
      },
      open: true,
      port: 3001,
    },
    devtool: isDev ? "cheap-module-source-map" : "source-map",
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: !isDev,
              drop_debugger: true,
              pure_funcs: isDev
                ? []
                : ["console.info", "console.debug", "console.warn"],
              passes: 2,
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
          parallel: true,
        }),
      ],
      usedExports: true,
      sideEffects: false,
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: ["**/*", "!lib/**"],
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "src", "index.html"),
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, "./favicon.svg"),
            to: path.resolve(__dirname, "./dist/favicon.svg"),
          },
        ],
      }),
    ],
  };
};

// NPM package build - React component for use in React projects
// Usage: import { LiberionAuth } from '@trust-proto/auth-react'
// React is a peer dependency (not bundled)
const libConfig = () => {
  return {
    mode: "production",
    target: "web",
    entry: path.join(__dirname, "src/index-pkg.js"),
    output: {
      path: path.resolve(__dirname, "build"),
      filename: "index.js",
      globalObject: "this",
      library: {
        name: "LiberionAuth",
        type: "umd",
      },
      clean: true,
    },
    resolve: {
      extensions: [".js", ".jsx", ".json"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
        {
          test: /\.svg$/i,
          use: ["@svgr/webpack"],
        },
      ],
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ["console.info", "console.debug", "console.warn"],
              passes: 2,
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
          parallel: true,
        }),
      ],
      usedExports: true,
      sideEffects: false,
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],

    // React as external dependency for npm package
    externals: {
      react: {
        commonjs: "react",
        commonjs2: "react",
        amd: "React",
        root: "React",
      },
      "react-dom": {
        commonjs: "react-dom",
        commonjs2: "react-dom",
        amd: "ReactDOM",
        root: "ReactDOM",
      },
    },

    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};

module.exports = (env, argv) => {
  if (env && env.target === "web") {
    return webConfig(env, argv);
  }
  if (env && env.target === "lib") {
    return libConfig();
  }
  return [webConfig(env, argv), libConfig()];
};
