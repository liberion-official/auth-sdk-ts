import { useEffect, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import CloseApp from "@/common/components/CloseApp";
import { useRootContext } from "@/common/context";
import { ZIDX_APP, CALLBACKS, CLOSING_TIMER } from "@/common/constants";

const fadeEdge = keyframes`
  0%   { transform: rotateY(0deg);   opacity: 1; }
  100% { transform: rotateY(90deg);  opacity: 0; }
`;

const SAppBackdrop = styled.div`
  all: initial;
  box-sizing: border-box;
  position: fixed;
  top: -10000px;
  left: -10000px;
  right: -10000px;
  bottom: -10000px;
  z-index: ${() => ZIDX_APP};
  backdrop-filter: blur(8px);
`;

const SApp = styled.div`
  all: initial;
  box-sizing: border-box;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  z-index: ${() => ZIDX_APP};
  p,
  span,
  button,
  a,
  h1,
  h2 {
    font-family: "Roboto", Arial, sans-serif;
  }
  a {
    text-decoration: none;
  }
`;

const SPlate = styled.div`
  all: initial;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 375px;
  margin: 0 auto;
  padding: 40px 24px;
  min-height: 500px;
  user-select: none;
  background-color: ${({ theme }) => theme.colors.background};
  box-shadow: 0 0 0 9999px ${({ theme }) => theme.colors.backdrop};
  border-radius: 12px;

  transform-style: preserve-3d;
  backface-visibility: hidden;
  transform-origin: center;

  ${({ $isClosing }) =>
    $isClosing &&
    css`
      animation: ${fadeEdge} 500ms linear;
    `}

  @media (max-width: 480px) {
    width: 100%;
    height: 100dvh;
    border-radius: 0;
    padding: 24px 16px;
  }
`;

export const Layout = ({ children }) => {
  const { callbacks, closing } = useRootContext();
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setIsClosing(true), CLOSING_TIMER);
    return () => clearTimeout(t);
  }, [closing]);

  const handleAnimationEnd = () => {
    if (isClosing) {
      callbacks[CALLBACKS.close]();
    }
  };

  return (
    <>
      <SAppBackdrop />
      <SApp>
        <SPlate $isClosing={isClosing} onAnimationEnd={handleAnimationEnd}>
          <CloseApp />
          {children}
        </SPlate>
      </SApp>
    </>
  );
};
