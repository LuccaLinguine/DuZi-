/**
 * Opens the native file picker and resolves with the chosen files' text
 * content. Must be called synchronously from a click handler, same rule as
 * the share sheet and speechSynthesis.
 */
export function pickFiles(options: { accept: string; multiple?: boolean }): Promise<{ name: string; text: string }[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = options.accept;
    input.multiple = options.multiple ?? false;
    input.style.display = 'none';

    input.onchange = () => {
      const files = [...(input.files ?? [])];
      void Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))).then((results) => {
        input.remove();
        resolve(results);
      });
    };
    // No change event fires if the user dismisses the picker; resolve empty
    // after it's had a reasonable chance to fire so callers aren't left hanging.
    input.oncancel = () => {
      input.remove();
      resolve([]);
    };

    document.body.appendChild(input);
    input.click();
  });
}
