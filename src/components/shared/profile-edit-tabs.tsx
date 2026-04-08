"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

export type ProfileEditTab = {
  id: string;
  label: string;
  content: ReactNode;
};

type ProfileEditTabsProps = {
  primaryTab: ProfileEditTab;
  secondaryTab?: ProfileEditTab | null;
};

export function ProfileEditTabs({
  primaryTab,
  secondaryTab = null,
}: Readonly<ProfileEditTabsProps>) {
  const tabs = useMemo(
    () => (secondaryTab ? [primaryTab, secondaryTab] : [primaryTab]),
    [primaryTab, secondaryTab],
  );
  const [activeTabId, setActiveTabId] = useState(primaryTab.id);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  if (tabs.length === 1) {
    return <section className="rounded-xl border bg-card p-6">{tabs[0].content}</section>;
  }

  return (
    <section className="space-y-4">
      <div
        className="flex items-center gap-1 border-b"
        role="tablist"
        aria-label="Profile edit tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;

          return (
            <button
              key={tab.id}
              id={`profile-edit-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`profile-edit-tab-panel-${tab.id}`}
              onClick={() => {
                setActiveTabId(tab.id);
              }}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`profile-edit-tab-panel-${activeTab.id}`}
        role="tabpanel"
        aria-labelledby={`profile-edit-tab-${activeTab.id}`}
        className="rounded-xl border bg-card p-6"
      >
        {activeTab.content}
      </div>
    </section>
  );
}
