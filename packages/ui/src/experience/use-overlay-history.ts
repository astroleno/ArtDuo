"use client";

import { useCallback, useEffect, useRef } from "react";
import { overlayHistory } from "./overlay-history";

export function useOverlayHistory(open: boolean, onDismiss: (sameView: boolean) => void) {
  const current = useRef({ open, onDismiss });
  current.current = { open, onDismiss };
  const lease = useRef<ReturnType<ReturnType<typeof overlayHistory>["open"]> | undefined>(undefined);
  useEffect(() => {
    const history = overlayHistory();
    if (open && !lease.current) {
      lease.current = history.open(sameView => { if (current.current.open) current.current.onDismiss(sameView); });
    } else if (!open && lease.current) {
      lease.current.close();
      lease.current = undefined;
    }
  }, [open]);
  useEffect(() => () => { lease.current?.dispose(); lease.current = undefined; }, []);
  return useCallback(() => {
    if (lease.current) lease.current.close();
    else if (current.current.open) current.current.onDismiss(true);
  }, []);
}
