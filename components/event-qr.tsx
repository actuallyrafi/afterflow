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
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#14160b", light: "#f4f1e6" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, []);

  return (
    <div className="mx-auto w-[min(72vw,280px)] bg-ink p-3 lg:w-[min(36vw,460px)]">
      {src ? (
        // Data URLs are generated in the browser from this host, not a remote image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`QR code for ${url}`} className="h-auto w-full" />
      ) : (
        <div className="aspect-square w-full animate-pulse bg-line" />
      )}
      <p className="mt-2 break-all text-center font-mono text-sm text-accent-ink">{url || "This page"}</p>
    </div>
  );
}
