const path = require("path");
module.exports = {
  rootDir: __dirname,
  globals: {
    "ts-jest": {
      tsConfig: path.resolve(__dirname, "tsconfig.json")
    }
  },
  preset: "ts-jest",
  testMatch: ["<rootDir>/**/__test__/**/*.test.ts"]
};
