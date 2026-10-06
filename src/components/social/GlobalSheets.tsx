"use client";

import { useSocialUi } from "@/lib/social/ui-store";
import { ShareSheet } from "./ShareSheet";
import { InstallSheet } from "./InstallSheet";
import { TransferSheet } from "./TransferSheet";

export function GlobalSheets() {
  const share = useSocialUi((s) => s.share);
  const closeShare = useSocialUi((s) => s.closeShare);
  const install = useSocialUi((s) => s.install);
  const closeInstall = useSocialUi((s) => s.closeInstall);
  const transfer = useSocialUi((s) => s.transfer);
  const closeTransfer = useSocialUi((s) => s.closeTransfer);
  return (
    <>
      <ShareSheet target={share} onClose={closeShare} />
      <InstallSheet open={install.open} onClose={closeInstall} link={install.link} ids={install.ids} />
      <TransferSheet open={transfer} onClose={closeTransfer} />
    </>
  );
}
