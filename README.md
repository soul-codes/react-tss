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

### Custom JSS initialization

By default, `react-tss` will use [JSS's default presets](https://www.npmjs.com/package/jss-preset-default).
If you need to customize JSS in other ways, you can create a customized version
of `createUseStyles()` by calling `createUseStyles.withJssInstance`, passing
a function that _initializes and returns_ the JSS instance that should be used.
This initialization function will be called only once and only when the
resulting `createUseStyles()` is called for the first time. Consult
[JSS documentation](https://cssinjs.org/setup) on how to configure JSS instances.

```ts
import { createUseStyles as protoCreateUseStyles } from 'react-tss';
import { create as createJss } from 'jss';

// Use this instead of react-tss's createUseStyles()
export const createUseStyles = protoCreateUseStyles(() =>
  createJss().setup({
    // ...
  })
)
```

### Style tokens (experimental)

Style tokens are wrappers of raw JSS styles that you can pass from a parent
component to a child component. Style tokens can be passed as a prop to the
style hook, where its property `style` can provide styles to be combined with
the component's own styles. This allows you to control how parent-provided
styles and child styles blend together in a more predictable/more granular manner
than depending on CSS's precedence rules.

#### Example

```tsx
import { StyleToken, getStyleTokens, createUseStyles } from 'react-tss';

function Child(props: ChildProps){
  const classes = useChildClasses(props);
  return <div className={classes.container} />
}

interface ChildProps {
  containerStyle?: StyleToken
}

const useChildClasses = createUseStyles<ChildProps>()({
  classes: {
    container: props => ({
      ...props.containerStyle?.style,
      display: "flex",
      // ... more child styles
    })
  }
})

function Parent() {
  const classes = useParentClasses();
  return <Child containerStyle={getStyleTokens(classes).childContainer}/>
}

const useParentClasses = createUseStyles({
  classes : {
    childContainer: {
      border: "1px solid red"
    }
  }
});
```

#### Referential stability

The practical difference between the style tokens and a simple dictionary of
CSS properties is that style tokens are _referentially stable_ as long as the
set of styles going into the `createUseStyles()` producing the tokens do not
change.

If you create a CSS property literal like `{ border: "1px solid black" }`
within a component/component's `render()` function, the resulting object is a
referentially different object each time (even if its value is the "same").
When you pass a referentially different representation of the same value as a
React prop, it forces that component to re-render even if nothing else changes,
thanks to the heuristics of shallow prop equality enforced by React. These
referentially stable style tokens will not cause such an issue.

## Notes on stylesheet management

`react-tss`'s stylesheet management is very simple: every styling _variant_
receives a new stylesheet which is unmounted when that variant is no longer
used. There is a caching mechanism in place that allows a certain number of
variants to be retained before it is disposed, reducing the number of times
styles are mounted and remounted in some cases.

A styling _variant_ is identified by a hash sum of the evaluated styling object.
