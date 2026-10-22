"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function EventQr() {
  const [src, setSrc] = useState<string>("");
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const origin = window.location.origin;
    setUrl(origin);
    QRCode.toDataURL(origin, {
      width: 640,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#14160b", light: "#f4f1e6" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, []);

  return (
    // The frame: a dark mat with a hairline, a light tile inside it, and the QR inside the tile.
    // The tile is a fixed square, so the placeholder and the loaded image occupy the same slot
    // and the QR can never grow past the frame.
    <figure className="mx-auto w-full max-w-[18rem] border border-line bg-panel p-4 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] sm:max-w-[20rem] lg:max-w-[24rem]">
      <div className="relative aspect-square w-full overflow-hidden bg-ink p-3">
        {src ? (
          // Data URLs are generated in the browser from this host, not a remote image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`QR code for ${url}`}
            width={640}
            height={640}
            className="block h-full w-full object-contain [image-rendering:pixelated]"
          />
        ) : (
          <div aria-hidden="true" className="h-full w-full animate-pulse bg-muted/30" />
        )}
      </div>
      <figcaption className="mt-3 truncate text-center font-mono text-sm text-muted">
        {url ? url.replace(/^https?:\/\//, "") : "This page"}
      </figcaption>
    </figure>
  );
}
