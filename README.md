# react-tss

`react-tss` is a simple alternative exposure of JSS in React to the official
`react-jss`. It is not a drop-in replacement, as it aims for simpler and more
TypeScript-first usage.

- Styles are injected using hooks only.
- Themes are injected using consumers only, thereby allow a more composited
  hook.
- All stylesheets are static, theme/prop-induced variants are memoized by
  object hashing (in a similar manner to StyledComponents).
- Keyframes, globals, and pseudoselectors get their own TypeScript keys, resulting
  in more predictable typing.
- Style definitions are function-evaluable at any level.

## Installation

```
npm install react-tss
```

## Usage

Hooks are created with `createUseStyles`. Stylesheet produced are inserted in
the order of invocation order of `createUseStyles` (same idea as in `react-jss`).

Default JSS presets are automatically included.

```ts
import { createUseStyles } from 'react-tss'
```

### Static styles

```ts
const useStyles = createUseStyles({
  // note the top-level "classes" declaration
  classes: {
    red: {
      color: "red"
      animation: "$fadeOut 1s" // prefix keyframes with `$`
    },
    blue: {
      color: "blue",
      animation: "$fadeIn 1s",
      pseudos: { // pseudoselectors are  wrapped in a key
        "&:hover": {
          color: "darkblue"
        }
      }
    }
  },

  // keyframes are defined here
  keyframes: {
    fadeIn {
      from: { opacity: 0 },
      to: { opacity: 1 }
    },
    fadeOut: {
      // numeric keys denote percentage.
      [0]: { opacity :1 },
      [100]: { opacity: 0 }
    }
  },

  // global styles are defined here
  global: {
    body: {
      fontSize: 20
    }
  }
});
```

Then later

```tsx
// in a component
const classes = useStyles();
return <div className={classes.red} />;
```

### Prop-dependent styles

Declarations can take function form as long as the resulting class names remain
stable. `createUseStyles` can be invoked with just a single type
parameter just to declare the prop type (so there are _two_ invocations for this
declaration).

```ts
const useStyles = createUseStyles<{ red: string, blue: string, deepBlue: string }>()({
  // note the top-level "classes" declaration
  classes: {
    red: props => ({
      color: props.red
    }),
    blue: {
      color: props => props.blue,
      pseudos: props => ({
        "&:hover": {
          color: props.deepBlue
        }
      })
    }
  },

  // ...
});
```

Then later the props are to be provided in the hook directly.

```tsx
// in a component
const classes = useStyles({ red: "red", blue: "blue", darkBlue: "darkblue" });
return <div className={classes.red} />;
```

### Context-dependent ("themed") styles

Use `createUseStyles.themed()` to inject a theme provider into the style hook.
You can pass either a React context or a hook that in some manner supplies the
theme values. Providing a context is simply shortcut for providing the hook
`() => useContext(context)`.

The style declaration can then take a two-argument function form, where the
second argument is the injected theme value.

```ts
import { createContext } from 'react';
interface Theme { red: string, blue: string, deepBlue: string }
const themeContext = createContext<Theme>({
  red: "red",
  blue: "blue",
  deepBlue: "deepBlue"
});


// Expands to `createUseStyles.theme(() => useContext(themeContext))( ...`
// So you could pass any function that acts as a context injection hook,
// for instance, transforming the context value so that the provider interface
// is different from the consumer interface.
const useStyles = createUseStyles.theme(themeContext)({
  // note the top-level "classes" declaration
  classes: {
    red: (_, theme) => ({
      color: theme.red
    }),
    blue: {
      color: (_, theme) => theme.blue,
      pseudos: (_, theme) => ({
        "&:hover": {
          color: theme.deepBlue
        }
      })
    }
  },

  // ...
});
```

Then later the props are to be provided in the hook directly.

```tsx
// in a component
const classes = useStyles({ red: "red", blue: "blue", darkBlue: "darkblue" });
return <div className={classes.red} />;
```

### Mixing props and themes

Just combine the two declaration patterns.

```ts
createUseStyles.themed(themeContext)<PropType>({
  /* ... */
})
```

### Function at any level

Note that the function form can take place at _any_ level. All of
the declarations below are valid and can be mixed and mached at will. Nested
functions are also OK, they will always receive `(props, theme)` as arguments.

```tsx
createUseStyles<PropType>()(props => ({
  classes: /* ... */,
  keyframes: /* ... */,
  // ...
}));
```

```tsx
createUseStyles<PropType>()({
  classes: props => ({ /* ... */ }),
  keyframes: props => ({ /* ... */ }),
  global: props => ({ /* ... */ })
});
```

```tsx
createUseStyles<PropType>()({
  classes: {
    classA: props => ({
      color: /* ... */,
      backgroundColor: /* ... */,
      border: props => /* ... */ // nested functions are OK
    }),
    classB: {
      color: props => /* ... */
    }
  },
  keyframes: {
    keyframes1: props => ({ /* ... */ }),
    keyframes2: {
      [0]: props => ({ /* ... */ }),
      [50]: {
        opacity: props => /* ... */
      }
    }
  },
  globals: {
    body: props => ({ /* ... */ }),
    a: {
      pseudos: props => ({ /* ... */ })
    }
  }
})
```

## Notes on stylesheet management

`react-tss`'s stylesheet management is very simple: every styling _variant_
receives a new stylesheet which is unmounted when that variant is no longer
used. There is a caching mechanism in place that allows a certain number of
variants to be retained before it is disposed, reducing the number of times
styles are mounted and remounted in some cases.

A styling _variant_ is identified by a hash sum of the evaluated styling object.
