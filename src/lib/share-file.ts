/**
 * Hands a file to the user: the native share sheet (AirDrop, Save to Files,
 * Messages…) when available, since that's the actual transport the spec's
 * weekly routine assumes ("AirDrop, iCloud Drive, etc."); a plain download
 * link otherwise, for desktop browsers where file sharing isn't supported.
 *
 * Must be called synchronously from a user-gesture handler — both APIs
 * require that, same as speechSynthesis.
 */
export async function shareOrDownloadFile(file: File, shareTitle: string): Promise<'shared' | 'downloaded'> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return 'shared';
    } catch (err) {
      // AbortError means the user dismissed the share sheet — not a failure,
      // just don't also fall through to a download they didn't ask for.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
      // Any other failure (e.g. a share target rejecting the file): fall
      // through to the download link below.
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before the object URL
  // disappears out from under it.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
