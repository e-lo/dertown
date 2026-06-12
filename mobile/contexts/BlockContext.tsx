import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { loadBlockedOrgs, saveBlockedOrgs, submitReport } from '../lib/moderation';
import type { BlockedOrg } from '../lib/moderation';

interface BlockContextValue {
  /** Organizers whose content is hidden from this device. */
  blockedOrgs: BlockedOrg[];
  /** O(1) lookup for filtering feeds. */
  blockedOrgIds: Set<string>;
  /** Hide all content from an organizer and notify the developer. */
  blockOrg: (org: BlockedOrg) => void;
  /** Restore an organizer's content. */
  unblockOrg: (id: string) => void;
}

const BlockContext = createContext<BlockContextValue | undefined>(undefined);

export function BlockProvider({ children }: { children: React.ReactNode }) {
  const hydratedRef = useRef(false);
  const [blockedOrgs, setBlockedOrgs] = useState<BlockedOrg[]>([]);

  useEffect(() => {
    loadBlockedOrgs().then((orgs) => {
      setBlockedOrgs(orgs);
      hydratedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    saveBlockedOrgs(blockedOrgs);
  }, [blockedOrgs]);

  const blockOrg = useCallback((org: BlockedOrg) => {
    setBlockedOrgs((prev) =>
      prev.some((o) => o.id === org.id) ? prev : [...prev, org]
    );
    // Guideline 1.2: blocking must notify the developer so the abusive
    // submitter's content can be reviewed and removed. Fire-and-forget —
    // the local block applies instantly either way.
    submitReport({
      action: 'block',
      contentType: 'organization',
      contentId: org.id,
      contentTitle: org.name,
      reason: 'User blocked this organizer',
    });
  }, []);

  const unblockOrg = useCallback((id: string) => {
    setBlockedOrgs((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const blockedOrgIds = useMemo(
    () => new Set(blockedOrgs.map((o) => o.id)),
    [blockedOrgs]
  );

  const value: BlockContextValue = { blockedOrgs, blockedOrgIds, blockOrg, unblockOrg };

  return <BlockContext.Provider value={value}>{children}</BlockContext.Provider>;
}

/** Access the blocked-organizer state from any screen or component. */
export function useBlocked() {
  const ctx = useContext(BlockContext);
  if (ctx === undefined) {
    throw new Error('useBlocked must be used within a BlockProvider');
  }
  return ctx;
}
