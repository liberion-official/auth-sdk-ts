import styled, { css } from "styled-components";
import { AUTH_STATUSES } from "@/common/constants";
import SuccessIcon from "@/assets/svg/success.svg";
import ErrorIcon from "@/assets/svg/error.svg";
import AlarmIcon from "@/assets/svg/alarm.svg";
import TimerIcon from "@/assets/svg/timer.svg";

const SResultWrap = styled.div`
  all: initial;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 264px;
  height: 264px;
  margin: 0 auto;
`;

const SResult = styled.div`
  all: initial;
  box-sizing: border-box;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  width: 234px;
  height: 234px;

  border-width: 3px;
  border-style: solid;
  border-radius: 50%;

  animation: showResultIcon 0.8s linear;

  ${(p) =>
    p.$status === AUTH_STATUSES.success &&
    css`
      border-color: ${({ theme }) => theme.colors.success};
    `}

  ${(p) =>
    p.$status === AUTH_STATUSES.error &&
    css`
      border-color: ${({ theme }) => theme.colors.error};
    `}

  ${(p) =>
    p.$status === AUTH_STATUSES.timeout &&
    css`
      border-color: ${({ theme }) => theme.colors.warning};
    `}

  ${(p) =>
    p.$status === AUTH_STATUSES.cancel &&
    css`
      border-color: ${({ theme }) => theme.colors.warning};
    `}

  svg {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 96px;
    height: 96px;
    transform: translate(-50%, -50%);
    animation: showIcon 0.8s linear;

    @keyframes showIcon {
      0% {
        width: 0;
        height: 0;
      }
      100% {
        width: 96px;
        height: 96px;
      }
    }
  }

  @keyframes showResultIcon {
    0% {
      width: 234px;
      height: 234px;
      border-width: 1px;
    }
    50% {
      width: 264px;
      height: 264px;
      border-width: 9px;
    }
    100% {
      width: 234px;
      height: 234px;
      border-width: 3px;
    }
  }
`;

const SCircle = styled.div`
  all: initial;
  width: 200px;
  height: 200px;

  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.backgroundSecondary};
`;

export default function ResultIcon({ status }) {
  let icon;

  switch (status) {
  case AUTH_STATUSES.success:
    icon = <SuccessIcon />;
    break;
  case AUTH_STATUSES.error:
    icon = <ErrorIcon />;
    break;
  case AUTH_STATUSES.cancel:
    icon = <AlarmIcon />;
    break;
  case AUTH_STATUSES.timeout:
    icon = <TimerIcon />;
    break;
  default:
    icon = <ErrorIcon />;
  }
  return (
    <SResultWrap>
      <SResult $status={status}>
        <SCircle />
        {icon}
      </SResult>
    </SResultWrap>
  );
}
