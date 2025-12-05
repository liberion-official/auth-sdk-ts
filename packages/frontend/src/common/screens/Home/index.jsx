import styled from "styled-components";
import { useTranslation } from "react-i18next";
import LogoIcon from "@/assets/svg/logo.svg";

const SPage = styled.div`
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 100%;

  padding: 120px 40px 32px;
  background: ${({ theme }) => theme.gradients.homePage};

  overflow-y: auto;
  overflow-x: hidden;
  -ms-overflow-style: none;

  * {
    box-sizing: border-box;
    font-family: "Roboto", Arial, sans-serif;
    font-size: 16px;
    color: ${({ theme }) => theme.colors.text};
  }

  @media (max-width: 767.98px) {
    padding: 80px 20px 14px;
  }

  @media (max-width: 480px) {
    padding-top: 40px;
  }
`;

const SInner = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  width: 100%;
  max-width: 1200px;
  height: 100%;
`;

const SLogoWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 64px;
  padding-top: 32px;

  svg {
    max-width: 480px;

    path {
      fill: ${({ theme }) => theme.colors.text};
    }
  }

  @media (max-width: 767.9px) {
    gap: 42px;
    padding-top: 140px;

    svg {
      max-width: 360px;
    }
  }

  @media (max-width: 480px) {
    gap: 24px;
    padding-top: 0;

    svg {
      max-width: 300px;
    }
  }
`;

const STitle = styled.h1`
  margin: 0;
  max-width: 560px;
  font-size: 40px;
  font-weight: 500;
  text-align: center;
  line-height: 1.1;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: ${({ theme }) => theme.colors.text};

  @media (max-width: 767.99px) {
    font-size: 32px;
  }

  @media (max-width: 480px) {
    font-size: 28px;
  }
`;

const STitleHighlight = styled.span`
  font-size: inherit;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;

const SFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 16px;
`;

const SFooterText = styled.p`
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.2;
  white-space: pre-wrap;
  word-wrap: break-word;
  opacity: 0.8;
`;

export default function HomePage() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <SPage>
      <SInner>
        <SLogoWrap>
          <LogoIcon />
          <STitle>
            {t("home.title")}{" "}
            <STitleHighlight>{t("home.title_highlight")}</STitleHighlight>
          </STitle>
        </SLogoWrap>
        <SFooter>
          <SFooterText>
            {t("home.copyright")} © {currentYear}
          </SFooterText>
        </SFooter>
      </SInner>
    </SPage>
  );
}
