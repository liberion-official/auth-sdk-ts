const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = () => {
  return {
    mode: "production",
    entry: path.join(__dirname, "src/index-pkg.js"),
    output: {
      path: path.resolve(__dirname, "lib"),
      filename: "liberion-auth.js",
      globalObject: "this",
      library: "LiberionAuth",
      libraryTarget: "umd",
    },
    resolve: {
      extensions: [".js", ".jsx", ".json"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
        react: path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
            },
          },
          exclude: /node_modules/,
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
    },
  };
};
