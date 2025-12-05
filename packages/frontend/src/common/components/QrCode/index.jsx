import { useCallback, useEffect, useRef } from "react";
import styled, { useTheme } from "styled-components";
import QRCodeStyling from "qr-code-styling";
import { logWarn } from "@/common/utils";

const SCode = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const SIZE = 320;

export default function QrCode({ link }) {
  const qrRef = useRef(null);
  const qrCode = useRef(null);
  const theme = useTheme();

  const handleCopy = useCallback(async () => {
    try {
      if (link) {
        await navigator.clipboard.writeText(link);
      }
    } catch (error) {
      logWarn("[QrCode] Failed to copy to clipboard", error);
    }
  }, [link]);

  useEffect(() => {
    if (!link) return;

    const qrOptions = {
      width: SIZE,
      height: SIZE,
      type: "svg",
      data: link,
      dotsOptions: { color: theme.qrCode.dotsColor, type: "rounded" },
      cornersSquareOptions: {
        color: theme.qrCode.cornersColor,
        type: "extra-rounded",
      },
      cornersDotOptions: { color: theme.qrCode.cornerDotsColor, type: "dot" },
      backgroundOptions: { color: theme.qrCode.backgroundColor },
    };

    const currentQrRef = qrRef.current;

    if (currentQrRef) {
      currentQrRef.innerHTML = "";
      qrCode.current = new QRCodeStyling(qrOptions);
      qrCode.current.append(currentQrRef);

      currentQrRef.style.width = `${SIZE}px`;
      currentQrRef.style.height = `${SIZE}px`;
    }

    return () => {
      if (currentQrRef) {
        currentQrRef.innerHTML = "";
      }
    };
  }, [link, theme]);

  return (
    <SCode
      style={{ width: `${SIZE}px`, height: `${SIZE}px` }}
      onClick={handleCopy}
    >
      <div ref={qrRef} />
    </SCode>
  );
}
