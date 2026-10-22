"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Pure black on an opaque white plate, with a quiet zone, so any phone camera reads it. */
export function PersonalQr({ value, size = 214 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setSrc)
      .catch(() => setSrc(""));
  }, [value]);

  return (
    <div
      className="mx-auto grid place-items-center rounded-[20px] bg-white p-2 shadow-[0_0_0_0.75px_var(--line)]"
      style={{ width: size, height: size }}
    >
      {src ? (
        // Generated in the browser from this person's own link.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR code for your Afterflow card" className="block h-full w-full [image-rendering:pixelated]" />
      ) : (
        <div aria-hidden="true" className="skeleton h-full w-full" />
      )}
    </div>
  );
}
