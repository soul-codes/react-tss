import { resolve } from "path";

import { sync } from "pkg-dir";

export const baseDir = resolve(sync() || "", "target");
export const publicDir = resolve(__dirname, "public");
