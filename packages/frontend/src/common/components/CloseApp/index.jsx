import styled from "styled-components";
import { useRootContext } from "@/common/context";
import { CALLBACKS } from "@/common/constants";
import CloseIcon from "@/assets/svg/close.svg";

const SClose = styled.button`
  all: initial;
  position: absolute;
  top: 12px;
  right: 8px;

  display: flex;
  align-items: center;
  justify-content: center;

  width: 24px;
  height: 24px;
  padding: 0;

  background: transparent;
  border: none;
  cursor: pointer;

  svg {
    width: 24px;
    height: 24px;

    path {
      fill: ${({ theme }) => theme.colors.text};
    }

    &:hover path {
      fill: ${({ theme }) => theme.colors.primary};
    }
  }
`;

export default function CloseApp() {
  const { callbacks } = useRootContext();

  const closeAppHandler = () => {
    callbacks[CALLBACKS.close]();
  };

  return (
    <SClose onClick={closeAppHandler}>
      <CloseIcon />
    </SClose>
  );
}
