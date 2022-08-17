import { StyleToken, createUseStyles as c, getStyleTokens } from "@lib";
import clsx from "clsx";
import jss from "jss";
import jssPresetDefault from "jss-preset-default";
import React, { createContext, useEffect, useRef, useState } from "react";
import { render } from "react-dom";

import { randomColor } from "./randomColor";

const fontSizeTheme = createContext(20);

const createUseStyles = c.withJssInstance(() => jss.setup(jssPresetDefault()));

const useGlobalStyles = createUseStyles.themed(fontSizeTheme)({
  global: {
    body: {
      fontSize: (_, fontSize) => fontSize,
    },
  },
});

const useOverrideStyles = createUseStyles()({
  classes: {
    override: () => ({ padding: 40 }),
  },
});

function App() {
  useGlobalStyles();
  const styleTokens = getStyleTokens(useOverrideStyles());
  const [, useRefresh] = useState({});
  useEffect(() => {
    const int = setInterval(() => useRefresh({}), 1000);
    return () => clearInterval(int);
  });

  return (
    <div>
      <TestStyles override={styleTokens.override} />
      <TestStyles />
      <TestStyles />
      <TestStyles />
    </div>
  );
}

const usePropStyles = createUseStyles<{
  foreground: string;
  background: string;
  override?: StyleToken;
}>()(
  {
    classes: (props) => ({
      container: {
        ...props.override?.style,
        backgroundColor: props.background,
        color: props.foreground,
        transition: "background-color 0.2s, color 0.2s",
        animation: "$froofty 3s",
      },
    }),
    keyframes: {
      froofty: {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
    },
  },
  {
    variantCacheSize: 10,
    prefix: "propStyles",
  }
);

const useStaticStyles = createUseStyles(
  {
    classes: {
      container: {
        border: "1px solid black",
      },
    },
  },
  { prefix: "staticStyles" }
);

function TestStyles(props: { override?: StyleToken }) {
  const [color, setColor] = useState("red");
  const [color2, setColor2] = useState("white");
  const currentColor = useRef(color);
  currentColor.current = color;
  useEffect(() => {
    const int = setInterval(
      () => setColor(randomColor()),
      (Math.random() + 1) * 3000
    );
    return () => clearInterval(int);
  }, []);
  useEffect(() => {
    const int = setInterval(
      () => setColor2(randomColor()),
      (Math.random() + 1) * 3000
    );
    return () => clearInterval(int);
  }, []);

  const staticClasses = useStaticStyles();
  const propClasses = usePropStyles({
    foreground: color,
    background: color2,
    override: props.override,
  });
  return (
    <div className={clsx(staticClasses.container, propClasses.container)}>
      hello
    </div>
  );
}

const el = document.createElement("div");
document.body.appendChild(el);
render(<App />, el);
