import { Properties as _CSSProperties } from "csstype";
import hashSum from "hash-sum";
import jss, { Jss, StyleSheet, StyleSheetFactoryOptions } from "jss";
import jssPresetDefault from "jss-preset-default";
import LRU from "lru-cache";
import { Context, useContext, useLayoutEffect, useRef } from "react";
import { Disposer, reffx } from "reffx";

const objectHash = (obj: any) => hashSum(obj);
let globalCounter = 0;

const defaultInterop = <T>(value: T): T => {
  const maybeWrappedInDefault = (value as unknown) as T & { default?: T };
  return maybeWrappedInDefault.default ?? value;
};

export interface CreateUseStylesFunction {
  <P = void>(): <T, K extends ClassHash<P, T>>(
    styles: Evaluable<StyleDefs<T, P, K>, P, T>,
    options?: CreateUseStylesOptions<T>
  ) => StyleHook<P, K>;
  <P = void, T = void>(): <K extends ClassHash<P, T>>(
    styles: Evaluable<StyleDefs<T, P, K>, P, T>,
    options?: CreateUseStylesOptions<T>
  ) => StyleHook<P, K>;
  <K extends ClassHash<void, void>>(
    styles: StyleDefs<void, void, K>,
    options?: CreateUseStylesOptions<void>
  ): StyleHook<void, K>;

  themed: <T>(
    useThemeProvider: ThemeProvider<T>
  ) => {
    <P = void>(): <L extends ClassHash<P, T>>(
      styles: Evaluable<StyleDefs<T, P, L>, P, T>,
      options?: CreateUseStylesOptions<T>
    ) => StyleHook<P, L>;

    <K extends ClassHash<void, T>>(
      styles: Evaluable<StyleDefs<T, void, K>, void, T>,
      options?: CreateUseStylesOptions<T>
    ): StyleHook<void, K>;
  };

  withJssInstance(initJss: () => Jss): CreateUseStylesFunction;
}

export type StyleHook<P, K> = (props: P) => StyleHookResult<K>;

export const StyleTokens = Symbol("StyleTokens");

export type StyleHookResult<K> = { [key in keyof K]: string } & {
  [StyleTokens]: StyleTokenResult<K>;
};

export type StyleTokenResult<K> = {
  [key in keyof K]: StyleToken;
};

export interface StyleToken {
  $$styleToken: true;
  style: CSSProperties;
  className: string;
  toString(): string;
}

const factory = (initJss: () => Jss): CreateUseStylesFunction => {
  let jssResult: Jss | null = null;
  const jssBoundInnerCreateUseStyles = innerCreateUseStyles(
    () => (jssResult = jssResult || initJss())
  );

  return Object.assign(
    (...args: any): any => {
      if (args[0]) {
        return jssBoundInnerCreateUseStyles(args[0], args[1]);
      }
      return jssBoundInnerCreateUseStyles;
    },
    {
      themed: <T>(useThemeProvider: ThemeProvider<T>) =>
        function createUseStyles(...args: any): any {
          if (args[0]) {
            return jssBoundInnerCreateUseStyles(args[0], {
              theme: useThemeProvider,
              ...args[1],
            });
          }
          return (styles: any, options: any) =>
            jssBoundInnerCreateUseStyles(styles, {
              theme: useThemeProvider,
              ...options,
            });
        },

      withJssInstance: (initJss: () => Jss) => factory(initJss),
    }
  );
};

const innerCreateUseStyles = <P, K extends ClassHash<P, T>, T>(
  ensureJssInit: () => Jss
) => (
  styles: Evaluable<StyleDefs<T, P, K>, P, T>,
  options?: CreateUseStylesOptions<T>
) => {
  const jss = ensureJssInit();
  const cacheSize = options?.variantCacheSize ?? 20;
  const hookCounter = globalCounter++;

  interface Manager {
    addRef: () => Disposer;
    result: StyleHookResult<K>;
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

  return (props: P): StyleHookResult<K> => {
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
        const result = { ...sheet.classes } as StyleHookResult<K>;
        const tokens = (result[StyleTokens] = {} as StyleTokenResult<K>);
        for (const className in result) {
          tokens[className as keyof K] = {
            $$styleToken: true,
            style: styleObject[className],
            className,
            toString: () => className,
          };
        }

        const addRef = reffx(() => {
          cache.del(hash);
          sheet.attach();
          return () => {
            hashes.delete(hash);
            cache.set(hash, manager);
          };
        });
        return { addRef, result, sheet };
      })();
    hashes.set(hash, manager);

    const lastManager = useRef<readonly [Manager, Disposer] | null>(null);

    // Styles are attached and old styles are detached before the DOM nodes are
    // rendered, so this is pre-render side-effect rather than a post-render
    // layout effect. We do this so that transition doesn't happen between a
    // DOM element without the styles applied and with the styles applied.
    // The layout effect is used to dispose the style the one time the component
    // is unmounted.
    lastManager.current =
      !lastManager.current || lastManager.current[0] !== manager
        ? (lastManager.current?.[1](), [manager, manager.addRef()])
        : lastManager.current;
    useLayoutEffect(() => lastManager.current?.[1](), []);

    return manager.result;
  };
};

/**
 * Turns a dictionary of classes into a dictionary of style tokens.
 * @param classes
 * @returns
 */
export function getStyleTokens<K>(
  classes: StyleHookResult<K>
): StyleTokenResult<K> {
  return classes[StyleTokens];
}

export const createUseStyles: CreateUseStylesFunction = factory(() =>
  defaultInterop(jss).setup(defaultInterop(jssPresetDefault)())
);

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
  [K in keyof CSSProperties]?: Evaluable<CSSProperties[K] | NullLike, P, T>;
};

export interface CSSProperties extends _CSSProperties<string | number> {}

export type NullLike = null | undefined;
