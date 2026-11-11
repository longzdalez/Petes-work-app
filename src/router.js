import { useEffect, useState } from 'react'
export const nav = path => { location.hash = '#' + path }
export const back = fallback => { if (history.length > 1) history.back(); else nav(fallback || '/') }
export function useRoute() {
  const get = () => (location.hash.replace(/^#/, '') || '/').split('?')[0]
  const [r, setR] = useState(get)
  useEffect(() => {
    const f = () => { setR(get()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r.split('/').filter(Boolean)
}
