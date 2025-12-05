import styled from "styled-components";
import LogoIcon from "@/assets/svg/logo.svg";

const SWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  svg {
    width: 300px;
    path {
      fill: ${({ theme }) => theme.colors.primary};
    }
  }
`;

const SLoader = styled.div`
  display: inline-block;
  width: 70px;
  height: 70px;
  margin: 0 auto;
  border-radius: 50%;

  border-top: 5px solid ${({ theme }) => theme.colors.primary};
  border-right: 5px solid transparent;
  box-sizing: border-box;
  animation: rotation 1s linear infinite;

  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default function GlobalPreloader() {
  return (
    <SWrap>
      <LogoIcon />
      <SLoader />
    </SWrap>
  );
}
