import Paths from "../routes";
import { Button } from "@blueprintjs/core";
import { Link } from "react-router-dom";
import styled from "styled-components";

interface NavBarButtonProps {
  text: string;
  path: string;
}
function NavBarButton({ text, path }: NavBarButtonProps) {
  return (
    <Link to={path}>
      <Button text={text} large={true} />
    </Link>
  );
}

const Container = styled.div`
  margin-bottom: 1rem;
`;

function NavBar() {
  return (
    <Container>
      <NavBarButton text="History" path={Paths.root} />
      <NavBarButton text="Symptoms" path={Paths.symptoms} />
    </Container>
  );
}

export default NavBar;
