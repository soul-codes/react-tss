import { Properties as CSSProperties } from "csstype";
import jss, { StyleSheet, StyleSheetFactoryOptions } from "jss";
import jssPresetDefault from "jss-preset-default";
import LRU from "lru-cache";
import { Context, useContext, useLayoutEffect } from "react";
import { Disposer, reffx } from "reffx";

const objectHash = require("object-hash").sha1;
let globalCounter = 0;

jss.setup(jssPresetDefault());

export function createUseStyles<P = void>(): <T, K extends ClassHash<P, T>>(
  styles: Evaluable<StyleDefs<T, P, K>, P, T>,
  options?: CreateUseStylesOptions<T>
) => (props: P) => { [key in keyof K]: string };
export function createUseStyles<P = void, T = void>(): <
  K extends ClassHash<P, T>
>(
  styles: Evaluable<StyleDefs<T, P, K>, P, T>,
  options?: CreateUseStylesOptions<T>
) => (props: P) => { [key in keyof K]: string };
export function createUseStyles<K extends ClassHash<void, void>>(
  styles: StyleDefs<void, void, K>,
  options?: CreateUseStylesOptions<void>
): () => { [key in keyof K]: string };

export function createUseStyles(...args: any): any {
  if (args[0]) {
    return innerCreateUseStyles(args[0], args[1]);
  }
  return innerCreateUseStyles;
}

export type NullLike = null | undefined;

createUseStyles.themed = <T>(useThemeProvider: ThemeProvider<T>) => {
  function createUseStyles<P = void>(): <L extends ClassHash<P, T>>(
    styles: Evaluable<StyleDefs<T, P, L>, P, T>,
    options?: CreateUseStylesOptions<T>
  ) => (props: P) => { [key in keyof L]: string };

  function createUseStyles<K extends ClassHash<void, T>>(
    styles: Evaluable<StyleDefs<T, void, K>, void, T>,
    options?: CreateUseStylesOptions<T>
  ): (props: void) => { [key in keyof K]: string };

  function createUseStyles(...args: any): any {
    if (args[0]) {
      return innerCreateUseStyles(args[0], {
        theme: useThemeProvider,
        ...args[1],
      });
    }
    return (styles: any, options: any) =>
      innerCreateUseStyles(styles, { theme: useThemeProvider, ...options });
  }

  return createUseStyles;
};

const innerCreateUseStyles = <P, K extends ClassHash<P, T>, T>(
  styles: Evaluable<StyleDefs<T, P, K>, P, T>,
  options?: CreateUseStylesOptions<T>
) => {
  const cacheSize = options?.variantCacheSize ?? 20;
  const hookCounter = globalCounter++;

  interface Manager {
    addRef: () => Disposer;
    classNames: Record<keyof K, string>;
    sheet: StyleSheet;
  }

  const hashes = new Map<string, Manager>();
  const cache = new LRU<string, Manager>({
    max: cacheSize,
    dispose: (hash, manager) => {
      if (!hashes.has(hash)) {
        manager.sheet.detach();
        jss.removeStyleSheet(manager.sheet);
      }
    },
  });

  const themeDef = options?.theme;
  const themeContextHook =
    typeof themeDef === "function"
      ? themeDef
      : themeDef
      ? () => useContext(themeDef)
      : null;

  return (props: P): { [key in keyof K]: string } => {
    const theme = themeContextHook?.() as T;
    const styleObject = createStyleObject(styles, props, theme);
    const hash = objectHash(styleObject);
    const manager =
      hashes.get(hash) ||
      ((): Manager => {
        const cached = cache.get(hash);
        if (cached) return cached;

        const sheet = jss.createStyleSheet(styleObject, {
          media: options?.media,
          meta: options?.meta,
          index: hookCounter,
          classNamePrefix: options?.prefix,
        });
        const classNames = sheet.classes as Record<keyof K, string>;
        const addRef = reffx(() => {
          cache.del(hash);
          sheet.attach();
          return () => {
            hashes.delete(hash);
            cache.set(hash, manager);
          };
        });
        return { addRef, classNames, sheet };
      })();
    hashes.set(hash, manager);
    useLayoutEffect(() => manager.addRef(), [manager]);
    return manager.classNames;
  };
};

function createStyleObject<P, T, K extends ClassHash<P, T>>(
  styles: Evaluable<StyleDefs<T, P, K>, P, T>,
  props: P,
  theme: T
) {
  const { classes, global, keyframes } = evaluate(styles, props, theme);
  const result: any = {};

  {
    const computedKeyframes = keyframes
      ? evaluate(keyframes, props, theme)
      : ({} as never);
    for (const key in computedKeyframes) {
      const stopHash = evaluate(computedKeyframes[key], props, theme);
      const resultStopHash: any = {};
      for (const stopId in stopHash) {
        resultStopHash[
          stopId === "from" || stopId === "to" ? stopId : stopId + "%"
        ] = evaluateStyleHash(stopHash[stopId], false);
      }
      result["@keyframes " + key] = resultStopHash;
    }
  }

  {
    const computedGlobals = global ? evaluate(global, props, theme) : {};
    const resultGlobalHash: any = {};
    for (const selector in computedGlobals) {
      resultGlobalHash[selector] = evaluateStyleHash(
        computedGlobals[selector],
        true
      );
    }
    if (Object.keys(resultGlobalHash).length > 0) {
      result["@global"] = resultGlobalHash;
    }
  }

  {
    const computedClasses = classes
      ? evaluate(classes, props, theme)
      : ({} as never);
    for (const className in computedClasses) {
      result[className] = evaluateStyleHash(computedClasses[className], true);
    }
  }

  function evaluateStyleHash(
    hash: Evaluable<JssStyle<P, T>, P, T>,
    allowPseudos: boolean
  ): any {
    const computedHash = evaluate(hash, props, theme);
    const result: any = {};
    for (const attr in computedHash) {
      if (attr === "pseudos") {
        const pseudoHash = computedHash[attr];
        if (!allowPseudos || !pseudoHash) continue;
        const pseudoHashes = evaluateStyleHash(pseudoHash, false);
        for (const pseudoSelector in pseudoHashes) {
          result[pseudoSelector] = pseudoHashes[pseudoSelector];
        }
      } else {
        const attrDef = computedHash[attr as keyof CSSProperties];
        result[attr] = evaluate(attrDef, props, theme);
      }
    }
    return result;
  }

  return result;
}

function evaluate<A, P, T>(evaluable: Evaluable<A, P, T>, props: P, theme: T) {
  while (typeof evaluable === "function") {
    evaluable = (evaluable as EvaluableFn<A, P, T>)(props, theme) as Evaluable<
      A,
      P,
      T
    >;
  }
  return evaluable as A;
}

export interface CreateUseStylesOptions<T>
  extends Pick<StyleSheetFactoryOptions, "media" | "meta"> {
  prefix?: string;
  variantCacheSize?: number;
  theme?: ThemeProvider<T>;
}

export type ThemeProvider<T> = Context<T> | (() => T);

export interface Keyframes<P, T>
  extends Record<string, Evaluable<KeyframeStopHash<P, T>, P, T>> {}

export interface KeyframeStopHash<P, T>
  extends Record<"from" | "to" | number, Evaluable<JssStyle<P, T>, P, T>> {}

export interface StyleDefs<T, P, K extends ClassHash<P, T>> {
  classes?: Evaluable<K, P, T>;
  keyframes?: Evaluable<Keyframes<P, T>, P, T>;
  global?: Evaluable<ClassHash<P, T>, P, T>;
}

export interface ClassHash<P, T>
  extends Record<string, Evaluable<JssStyle<P, T>, P, T>> {}

export type Evaluable<A, P, T> =
  | Exclude<A, (...args: any) => any>
  | EvaluableFn<A, P, T>;

type EvaluableFn<A, P, T> = (props: P, theme: T) => A | Evaluable<A, P, T>;

export interface JssStyle<P, T> extends JSSProperties<P, T> {
  pseudos?: Evaluable<
    Record<string, Evaluable<JSSProperties<P, T>, P, T>>,
    P,
    T
  >;
}

export type JSSProperties<P, T> = {
  [K in keyof CSSProperties]?: Evaluable<
    CSSProperties<string | number>[K] | NullLike,
    P,
    T
  >;
};
