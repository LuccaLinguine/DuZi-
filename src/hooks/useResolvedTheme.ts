import { useEffect, useState } from 'react';

/**
 * The theme actually painted right now — applyTheme() always stamps a
 * concrete 'light'/'dark'/'sepia' onto <html>, even when the user's setting
 * is "system", so this reads that attribute rather than the raw setting.
 * Needed anywhere a literal hex colour has to match the theme in JS (the POS
 * colour palette); CSS itself never needs this, it reacts to the attribute
 * directly.
 */
export function useResolvedTheme(): 'light' | 'dark' | 'sepia' {
  const read = () => (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'sepia' | null) ?? 'light';
  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
