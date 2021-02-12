import { resolve } from "path";

import { asType } from "@soul-codes-dev/typetools/lib";
import { Configuration } from "webpack";
import { Configuration as DevServerConfig } from "webpack-dev-server";

import { baseDir, publicDir } from "./baseDir";

const PORT = 8080;
const HOST = "localhost";

export default asType<Configuration>({
  entry: [resolve(baseDir, "demo/main")],
  target: "web",
  output: {
    path: resolve(baseDir, "web"),
    filename: "app.js",
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ["source-map-loader"],
      },
    ],
  },
  resolve: {
    alias: {
      lodash: "lodash-es",
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
  devServer: asType<DevServerConfig>({
    contentBase: publicDir,
    port: PORT,
    host: HOST,
    disableHostCheck: true,
    historyApiFallback: true,
    stats: { errorDetails: true },
    compress: true,
  }),
});
