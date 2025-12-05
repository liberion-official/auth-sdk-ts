import { useTranslation } from "react-i18next";
import styled, { keyframes } from "styled-components";
import { useAuthContext } from "@/common/context";
import { AUTH_STATUSES } from "@/common/constants";
import ResultIcon from "@/common/components/ResultIcon";
import AuthManual from "@/common/components/AuthManual";

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Title = styled.h1`
  all: initial;
  box-sizing: border-box;
  margin: 0 0 12px;
  font-family: "Roboto", Arial, sans-serif;
  font-style: normal;
  font-size: 30px;
  font-weight: 700;
  text-align: center;
  color: ${({ theme }) => theme.colors.text};
`;

const LoaderWrap = styled.div`
  position: relative;
  width: 100%;
  height: 264px;
`;

const Preloader = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 150px;
  height: 150px;
  margin: -75px 0 0 -75px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: ${({ theme }) => theme.colors.primary};
  animation: ${rotate} 2s linear infinite;

  &:before {
    content: "";
    position: absolute;
    top: 5px;
    left: 5px;
    right: 5px;
    bottom: 5px;
    border-radius: 50%;
    border: 3px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.secondary};
    animation: ${rotate} 3s linear infinite;
  }

  &:after {
    content: "";
    position: absolute;
    top: 15px;
    left: 15px;
    right: 15px;
    bottom: 15px;
    border-radius: 50%;
    border: 3px solid transparent;
    border-top-color: ${({ theme }) => theme.colors.accent};
    animation: ${rotate} 1.5s linear infinite;
  }
`;

const ResultTitle = styled.p`
  all: initial;
  box-sizing: border-box;

  font-family: "Roboto", Arial, sans-serif;
  font-weight: 600;
  font-size: 22px;
  line-height: 36px;
  text-align: center;
  color: ${({ theme }) => theme.colors.text};
`;

const ResultWrap = styled.div`
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 12px 0;
`;

export default function AuthPage() {
  const { t } = useTranslation();
  const { authStatus } = useAuthContext();

  const labels = {
    title: t("Liberion ID"),
    inProgress: t("app.auth_in_progress"),
    success: t("app.auth_success"),
    error: t("app.auth_failed"),
    cancelled: t("app.auth_cancelled"),
    timeout: t("app.auth_timeout"),
    reconnectFailed: t("app.reconnect_failed"),
  };

  const statusConfig = {
    [AUTH_STATUSES.success]: {
      text: labels.success,
      icon: AUTH_STATUSES.success,
    },
    [AUTH_STATUSES.awaiting]: {
      text: labels.inProgress,
      loader: true,
    },
    [AUTH_STATUSES.error]: {
      text: labels.error,
      icon: AUTH_STATUSES.error,
    },
    [AUTH_STATUSES.cancel]: {
      text: labels.cancelled,
      icon: AUTH_STATUSES.cancel,
    },
    [AUTH_STATUSES.timeout]: {
      text: labels.timeout,
      icon: AUTH_STATUSES.timeout,
    },
    [AUTH_STATUSES.reconnect_failed]: {
      text: labels.reconnectFailed,
      icon: AUTH_STATUSES.error,
    },
  };

  const cfg = statusConfig[authStatus];

  return (
    <>
      <Title aria-live="polite">{labels.title}</Title>
      {cfg ? (
        <ResultWrap role="status" aria-live="polite">
          {cfg.loader ? (
            <LoaderWrap>
              <Preloader />
            </LoaderWrap>
          ) : (
            cfg.icon && <ResultIcon status={cfg.icon} />
          )}
          <ResultTitle>{cfg.text}</ResultTitle>
        </ResultWrap>
      ) : (
        <AuthManual />
      )}
    </>
  );
}
