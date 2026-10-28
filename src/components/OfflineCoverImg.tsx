import React, { useEffect, useState } from 'react';
import { getOfflineCoverUrl } from '../utils/offlineStorage';

const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#1c1917"/><text x="50%" y="52%" font-family="serif" font-style="italic" font-size="42" fill="#C5A059" text-anchor="middle">LibreAudio</text></svg>`
  );

interface OfflineCoverImgProps {
  bookId: string;
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Cover image that prefers the offline-cached blob (no internet needed),
 * falls back to remote, then to a built-in placeholder.
 */
export const OfflineCoverImg: React.FC<OfflineCoverImgProps> = ({
  bookId,
  src,
  alt,
  className,
  loading,
}) => {
  const [current, setCurrent] = useState<string>(src || PLACEHOLDER);
  const [triedRemote, setTriedRemote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setTriedRemote(false);
    (async () => {
      try {
        const cached = await getOfflineCoverUrl(bookId);
        if (cancelled) {
          if (cached) URL.revokeObjectURL(cached);
          return;
        }
        if (cached) {
          objectUrl = cached;
          setCurrent(cached);
        } else {
          setCurrent(src || PLACEHOLDER);
        }
      } catch {
        if (!cancelled) setCurrent(src || PLACEHOLDER);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, src]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading={loading}
      onError={() => {
        if (!triedRemote && current !== src && src) {
          setTriedRemote(true);
          setCurrent(src);
        } else if (current !== PLACEHOLDER) {
          setCurrent(PLACEHOLDER);
        }
      }}
    />
  );
};
