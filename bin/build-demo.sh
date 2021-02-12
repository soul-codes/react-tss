cross-env \
  TS_NODE_PROJECT=src/demo/webpack/tsconfig.json \
  TS_NODE_COMPILER=ttypescript \
  node -r esm -r ts-node/register \
  node_modules/.bin/webpack \
  --config src/demo/webpack/webpack.config.ts \
