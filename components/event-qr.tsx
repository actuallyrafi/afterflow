"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function EventQr() {
  const [src, setSrc] = useState<string>("");
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    const origin = window.location.origin;
    setUrl(origin);
    QRCode.toDataURL(origin, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, []);

  return (
    <figure className="mx-auto w-full max-w-[16rem]">
      <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-white p-2 shadow-[0_0_0_0.75px_var(--line)]">
        {src ? (
          // Generated in the browser from this host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code for ${url}`} width={640} height={640} className="block h-full w-full object-contain [image-rendering:pixelated]" />
        ) : (
          <div aria-hidden="true" className="skeleton h-full w-full" />
        )}
      </div>
      <figcaption className="mt-3 truncate text-center text-[13px] text-muted">{url ? url.replace(/^https?:\/\//, "") : "This page"}</figcaption>
    </figure>
  );
}
