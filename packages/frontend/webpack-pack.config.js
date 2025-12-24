const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

// Standalone bundle for CDN usage (React bundled inside)
// Usage: <script src="https://cdn.jsdelivr.net/npm/@trust-proto/auth-react/lib/liberion-auth.js"></script>
// API: LiberionAuth.open({ backendUrl, successCb, closeCb, failedCb, theme })
module.exports = () => {
  return {
    mode: "production",
    target: "web",
    entry: path.join(__dirname, "src/index-lib.js"),
    output: {
      path: path.resolve(__dirname, "lib"),
      filename: "liberion-auth.js",
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

    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: 1,
      }),
    ],

    // No externals - React is bundled for standalone CDN usage
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};
