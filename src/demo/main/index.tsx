import { createUseStyles as c } from "@lib";
import clsx from "clsx";
import jss from "jss";
import React, { createContext, useEffect, useRef, useState } from "react";
import { render } from "react-dom";

import { randomColor } from "./randomColor";

const fontSizeTheme = createContext(20);

const createUseStyles = c.withJssInstance(() => jss.setup());

const useGlobalStyles = createUseStyles.themed(fontSizeTheme)({
  global: {
    body: {
      fontSize: (_, fontSize) => fontSize,
    },
  },
});

function App() {
  useGlobalStyles();
  return (
    <div>
      <TestStyles />
      <TestStyles />
      <TestStyles />
      <TestStyles />
    </div>
  );
}

const usePropStyles = createUseStyles<{
  foreground: string;
  background: string;
}>()(
  {
    classes: (props) => ({
      container: {
        backgroundColor: props.background,
        color: props.foreground,
        transition: "background-color 0.2s, color 0.2s",
        animation: "$froofty 3s",
      },
    }),
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

function TestStyles() {
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
  });
  useEffect(() => {
    const int = setInterval(
      () => setColor2(randomColor()),
      (Math.random() + 1) * 3000
    );
    return () => clearInterval(int);
  });

  const staticClasses = useStaticStyles();
  const propClasses = usePropStyles({ foreground: color, background: color2 });
  return (
    <div className={clsx(staticClasses.container, propClasses.container)}>
      hello
    </div>
  );
}

const el = document.createElement("div");
document.body.appendChild(el);
render(<App />, el);
