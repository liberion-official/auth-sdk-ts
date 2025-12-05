import { useState, useCallback } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/common/context";
import QrCode from "@/common/components/QrCode";
import { isAndroid, isIOS, logWarn, isValidUrl } from "@/common/utils";
import { PLATFORMS } from "@/common/constants";

const Subtitle = styled.p`
  all: initial;
  box-sizing: border-box;

  text-align: center;
  font-weight: 500;
  font-size: 16px;
  line-height: 24px;
  max-width: 90%;
  margin: 0 auto 16px;
  color: ${({ theme }) => theme.colors.textSecondary};
  opacity: 0.85;
`;

const Stage = styled.div`
  all: initial;
  box-sizing: border-box;

  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 6px 30px ${({ theme }) => theme.colors.shadowStrong};
  background: ${({ theme }) => theme.gradients.surface};
`;

const ManualWrap = styled.div`
  all: initial;
  box-sizing: border-box;

  margin-top: 16px;
  padding: 12px;
  border-radius: 16px;
  background: ${({ theme }) => theme.colors.surfaceOverlay};
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(4px);
  border: 1px solid ${({ theme }) => theme.colors.border};

  * {
    font-family: "Roboto", Arial, sans-serif;
    box-sizing: border-box;
  }
`;

const ManualText = styled.div`
  all: initial;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  line-height: 1.4;
  padding: 8px;

  strong {
    font-size: 14px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    text-align: center;
  }

  span {
    margin-top: 4px;
    font-size: 14px;
    font-weight: 400;
    color: ${({ theme }) => theme.colors.textSecondary};
    text-align: center;
  }
`;

const PrimaryButton = styled.button`
  all: initial;
  box-sizing: border-box;

  appearance: none;
  cursor: pointer;
  border: 0;
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;

  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.textInverse};
  box-shadow: 0 4px 12px ${({ theme }) => theme.colors.shadow};

  white-space: nowrap;
  width: 100%;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
    box-shadow: 0 6px 16px ${({ theme }) => theme.colors.shadowMedium};
    color: ${({ theme }) => theme.colors.textInverse};
  }

  &:active {
    transform: scale(0.98);
  }
`;

const AltButton = styled.button`
  all: initial;
  box-sizing: border-box;

  appearance: none;
  cursor: pointer;
  border-radius: 12px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  border: 1px solid ${({ theme }) => theme.colors.border};

  background-color: ${({ theme }) => theme.colors.surfaceOverlay};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};

  white-space: nowrap;
  width: 100%;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.colors.backgroundSecondary};
    box-shadow: 0 4px 12px ${({ theme }) => theme.colors.shadowMedium};
  }

  &:active {
    transform: scale(0.98);
  }
`;

const SInstallLink = styled.a`
  all: initial;
  box-sizing: border-box;

  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;

  padding: 12px;
  font-family: "Roboto", Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }

  &:active {
    transform: scale(0.98);
  }
`;

export default function AuthManual() {
  const [platform] = useState(() => {
    if (isAndroid()) return PLATFORMS.ANDROID;
    if (isIOS()) return PLATFORMS.IOS;
    return PLATFORMS.DESKTOP;
  });

  const [copied, setCopied] = useState(false);

  const { t } = useTranslation();
  const { link } = useAuthContext();

  const installHref = (() => {
    try {
      if (link && isValidUrl(link)) {
        const urlObj = new URL(link);
        return `${urlObj.origin}/install`;
      }
    } catch (error) {
      logWarn("[AuthManual] Failed to parse link URL", error);
    }
    return "/install";
  })();

  const safeLink = isValidUrl(link) ? link : "#";

  const handleCopy = useCallback(async () => {
    try {
      if (link) {
        await navigator.clipboard.writeText(link);
        setCopied(true);
      }
    } catch (error) {
      logWarn("[AuthManual] Failed to copy to clipboard", error);
    }
  }, [link]);

  const renderContent = () => {
    switch (platform) {
    case PLATFORMS.DESKTOP:
      return (
        <>
          <Subtitle>{t("auth.about")}</Subtitle>
          <Stage>
            <QrCode link={link} />
          </Stage>
          <ManualWrap>
            <ManualText>
              <span>{t("auth.scan_qr_desc")}</span>
            </ManualText>
            <PrimaryButton
              as="a"
              href={installHref}
              target="_blank"
              rel="noopener noreferrer"
              role="button"
              aria-label={t("auth.install_app")}
            >
              {t("auth.install_app")}
            </PrimaryButton>
          </ManualWrap>
        </>
      );

    case PLATFORMS.ANDROID:
      return (
        <>
          <Subtitle>{t("auth.about")}</Subtitle>
          <ManualWrap>
            <ManualText>
              <strong>{t("auth.install_required_android")}</strong>
            </ManualText>
            <AltButton
              as="a"
              href={safeLink}
              target="_blank"
              rel="noopener noreferrer"
              role="button"
              aria-label={t("auth.open_app")}
            >
              {t("auth.open_app")}
            </AltButton>
          </ManualWrap>
          <SInstallLink
            as="a"
            href={installHref}
            target="_blank"
            rel="noopener noreferrer"
            role="button"
            aria-label={t("auth.install_app")}
          >
            {t("auth.install_app")}
          </SInstallLink>
        </>
      );

    case PLATFORMS.IOS:
      return (
        <>
          <Subtitle>{t("auth.about")}</Subtitle>
          <ManualWrap>
            <ManualText>
              <strong>{t("auth.install_required_ios")}</strong>
            </ManualText>
            <AltButton
              onClick={handleCopy}
              role="button"
              aria-label={
                copied ? t("auth.open_app_continue") : t("auth.continue_auth")
              }
            >
              {copied ? t("auth.open_app_continue") : t("auth.continue_auth")}
            </AltButton>
          </ManualWrap>
          <SInstallLink
            as="a"
            href={installHref}
            target="_blank"
            rel="noopener noreferrer"
            role="button"
            aria-label={t("auth.install_app")}
          >
            {t("auth.install_app")}
          </SInstallLink>
        </>
      );

    default:
      return null;
    }
  };

  return renderContent();
}
