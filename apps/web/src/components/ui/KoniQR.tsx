import { QRCodeSVG } from "qrcode.react";

interface KoniQRProps {
  value: string;
  size: number;
}

/**
 * QR code with the KONI Batam logo centred inside.
 * Uses error-correction level H (30%) so the ~22% logo overlay
 * does not break scannability.
 */
export function KoniQR({ value, size }: KoniQRProps) {
  const logoSize = Math.round(size * 0.22);

  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="H"
      imageSettings={{
        src: "/logo-koni-batam.png",
        width: logoSize,
        height: logoSize,
        excavate: true,
      }}
    />
  );
}
