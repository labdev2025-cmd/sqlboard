import * as React from "react"

/** The value, updated only after it stops changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
