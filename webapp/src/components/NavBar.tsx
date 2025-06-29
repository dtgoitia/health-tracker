import { useApp } from "..";
import { assertNever } from "../exhaustive-match";
import { SyncStatus } from "../lib/adapters/remoteStorage";
import Paths from "../routes";
import { Button, Icon, IconName, IconSize } from "@blueprintjs/core";
import { useEffect, useState } from "react";
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
  display: flex;
  align-items: stretch;
  margin-bottom: 1rem;
`;

function NavBar() {
  const app = useApp();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.onlineAndSynced);

  useEffect(() => {
    const subscription = app.remoteStorage.syncStatus$.subscribe((status) => {
      setSyncStatus(status);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [app]);

  const { icon, grayedOut, text } = getSyncStatusIcon({ status: syncStatus });

  return (
    <Container>
      <ButtonsContainer>
        <NavBarButton text="Home" path={Paths.root} />
        <NavBarButton text="History" path={Paths.history} />
        <NavBarButton text="Symptoms" path={Paths.symptoms} />
        <NavBarButton text="Settings" path={Paths.settings} />
      </ButtonsContainer>
      <IconParentContainer style={{ opacity: grayedOut ? 0.4 : 1 }}>
        <IconText>{text}</IconText>
        <IconContainer>
          <Icon
            title={`syncing status: ${syncStatus}`}
            icon={icon}
            size={IconSize.LARGE}
          />
        </IconContainer>
      </IconParentContainer>
    </Container>
  );
}

export default NavBar;

function getSyncStatusIcon({ status }: { status: SyncStatus }): {
  icon: IconName;
  grayedOut: boolean;
  text: string;
} {
  switch (status) {
    case SyncStatus.offline:
      return { icon: "airplane", grayedOut: false, text: "offline" };
    case SyncStatus.offlinePendingPush:
      return { icon: "airplane", grayedOut: false, text: "offline, and pending changes" };
    case SyncStatus.onlineButSyncFailed:
      return {
        icon: "warning-sign",
        grayedOut: false,
        text: "online, but sync failed",
      };
    case SyncStatus.onlineAndSynced:
      return { icon: "tick", grayedOut: true, text: "synced" };
    case SyncStatus.waitingToSync:
      return { icon: "floppy-disk", grayedOut: false, text: "unsynced" };
    case SyncStatus.pulling:
      return { icon: "cloud-download", grayedOut: false, text: "downloading" };
    case SyncStatus.pushing:
      return { icon: "cloud-upload", grayedOut: false, text: "uploading" };
    default:
      assertNever(status, `unsupported SyncStatus variant: ${status}`);
  }
}

const ButtonsContainer = styled.div`
  flex-basis: auto;
  flex-shrink: 0;
  flex-grow: 0;
`;

const IconParentContainer = styled.div`
  display: flex;
  flex-basis: 0.5rem;
  flex-shrink: 0;
  flex-grow: 1;
  justify-content: flex-end;
  align-items: center;
  flex: row nowrap;
`;

const IconContainer = styled.span`
  flex-basis: 1rem;
  flex-shrink: 0;
  flex-grow: 0;
`;

const IconText = styled.div`
  flex-basis: 1rem;
  flex-shrink: 0;
  flex-grow: 1;
  padding: 0 1rem;
  text-align: right;
`;
