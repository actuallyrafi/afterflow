"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function PersonalQr({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#14160b", light: "#f4f1e6" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value]);

  return (
    <div className="w-[min(70vw,220px)] bg-ink p-3">
      {src ? (
        // Generated in the browser from this person's share link.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR code for your Afterflow card" className="h-auto w-full" />
      ) : (
        <div className="aspect-square w-full animate-pulse bg-line" />
      )}
    </div>
  );
}
