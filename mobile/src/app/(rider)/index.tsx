import type { MobileRiderParcelPageDto, MobileRiderParcelTab } from "@parcel-flow/contract";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useRiderParcels, useStartDelivery } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { ParcelCard } from "@/components/parcel-card";
import { formatMmk } from "@/format";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const tabs: { key: MobileRiderParcelTab; label: string; emptyMessage: string }[] = [
  { key: "to_deliver", label: "To deliver", emptyMessage: "No parcels to deliver right now." },
  { key: "delivered", label: "Delivered", emptyMessage: "No delivered parcels yet." },
  { key: "returned", label: "Returned", emptyMessage: "No returned parcels." },
];

type StartResult = { tone: "success" | "danger"; message: string };

export default function ParcelListScreen() {
  const [tab, setTab] = useState<MobileRiderParcelTab>("to_deliver");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startResult, setStartResult] = useState<StartResult | null>(null);
  const parcels = useRiderParcels(tab);
  const startDelivery = useStartDelivery();
  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  // Counts come with every page; the first page is enough and is always loaded.
  const tabCounts: MobileRiderParcelPageDto["tabCounts"] | undefined =
    parcels.data?.pages[0]?.tabCounts;
  const items = parcels.data?.pages.flatMap((page) => page.parcels) ?? [];
  const canStart = tab === "to_deliver";
  // Only parcels still loaded and at the office count, so a refetch that moves
  // a parcel on drops it from the selection.
  const selectedParcels = items.filter(
    (parcel) => parcel.status === "at_office" && selectedIds.includes(parcel.id),
  );
  const selectedAmount = selectedParcels.reduce((sum, parcel) => sum + parcel.amountToCollect, 0);
  const startingIds = startDelivery.isPending ? (startDelivery.variables ?? []) : [];

  function selectTab(nextTab: MobileRiderParcelTab) {
    setTab(nextTab);
    setSelectedIds([]);
    setStartResult(null);
  }

  function toggleSelected(parcelId: string) {
    setSelectedIds((current) =>
      current.includes(parcelId) ? current.filter((id) => id !== parcelId) : [...current, parcelId],
    );
  }

  function runStart(parcelIds: string[]) {
    setStartResult(null);
    startDelivery.mutate(parcelIds, {
      onSuccess: (data) => {
        setSelectedIds((current) => current.filter((id) => !data.parcelIds.includes(id)));
        setStartResult({
          tone: "success",
          message:
            parcelIds.length === 1
              ? "Parcel moved to on the way."
              : "Selected parcels moved to on the way.",
        });
      },
      onError: (error) => setStartResult({ tone: "danger", message: error.message }),
    });
  }

  function startSelected() {
    const parcelIds = selectedParcels.map((parcel) => parcel.id);

    if (parcelIds.length === 1) {
      runStart(parcelIds);
      return;
    }

    Alert.alert(
      `Start delivery for ${parcelIds.length} parcels?`,
      `${formatMmk(selectedAmount)} to collect.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start", onPress: () => runStart(parcelIds) },
      ],
    );
  }

  async function handleRefresh() {
    setRefreshing(true);
    setStartResult(null);
    await parcels.refetch();
    setRefreshing(false);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerRight: ProfileHeaderButton }} />

      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((item) => {
          const selected = item.key === tab;
          const count = tabCounts?.[item.key];

          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={item.key}
              onPress={() => selectTab(item.key)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                {count === undefined ? item.label : `${item.label} (${count})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {startResult ? (
        <View style={styles.result}>
          <Notice message={startResult.message} tone={startResult.tone} />
        </View>
      ) : null}

      {parcels.isPending ? <LoadingScreen /> : null}

      {parcels.isError ? (
        <View style={styles.message}>
          <Notice message={parcels.error.message} />
          <Button label="Try again" onPress={() => void parcels.refetch()} variant="secondary" />
        </View>
      ) : null}

      {parcels.isSuccess ? (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(parcel) => parcel.id}
          ListEmptyComponent={<Text style={styles.empty}>{activeTab.emptyMessage}</Text>}
          ListFooterComponent={
            <ListFooter
              failed={parcels.isFetchNextPageError}
              loading={parcels.isFetchingNextPage}
              onRetry={() => void parcels.fetchNextPage()}
            />
          }
          onEndReached={() => {
            if (
              parcels.hasNextPage &&
              !parcels.isFetchingNextPage &&
              !parcels.isFetchNextPageError
            ) {
              void parcels.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          }
          renderItem={({ item }) => {
            const startable = canStart && item.status === "at_office";
            const deliverable =
              canStart && item.status === "on_the_way" && !item.hasActiveFailureNote;

            return (
              <ParcelCard
                onPress={() =>
                  router.push({ pathname: "/parcels/[parcelId]", params: { parcelId: item.id } })
                }
                parcel={item}
                selection={
                  startable
                    ? {
                        checked: selectedIds.includes(item.id),
                        disabled: startDelivery.isPending,
                        onToggle: () => toggleSelected(item.id),
                      }
                    : undefined
                }
                startDelivery={
                  startable
                    ? {
                        starting: startingIds.length === 1 && startingIds[0] === item.id,
                        disabled: startDelivery.isPending,
                        onPress: () => runStart([item.id]),
                      }
                    : undefined
                }
                onMarkDelivered={
                  deliverable
                    ? () =>
                        router.push({
                          pathname: "/deliver/[parcelId]",
                          params: { parcelId: item.id },
                        })
                    : undefined
                }
              />
            );
          }}
        />
      ) : null}

      {canStart && selectedParcels.length > 0 ? (
        <View style={styles.selectionBar}>
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionCount}>
              {selectedParcels.length} selected · {formatMmk(selectedAmount)} to collect
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={startDelivery.isPending}
              hitSlop={spacing.sm}
              onPress={() => setSelectedIds([])}
            >
              <Text style={styles.headerLink}>Clear</Text>
            </Pressable>
          </View>
          <Button
            busy={startingIds.length > 1}
            disabled={startDelivery.isPending}
            label={`Start delivery (${selectedParcels.length})`}
            onPress={startSelected}
          />
        </View>
      ) : null}
    </View>
  );
}

function ProfileHeaderButton() {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={spacing.sm}
      onPress={() => router.push("/profile")}
    >
      <Text style={styles.headerLink}>Profile</Text>
    </Pressable>
  );
}

function ListFooter({
  failed,
  loading,
  onRetry,
}: {
  failed: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  if (failed) {
    return <Button label="Couldn't load more. Try again" onPress={onRetry} variant="secondary" />;
  }

  return loading ? <Text style={styles.footer}>Loading more…</Text> : null;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvasSoft,
  },
  headerLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.canvas,
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
  },
  tabSelected: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    ...typography.micro,
    color: colors.inkMute,
  },
  tabLabelSelected: {
    color: colors.onPrimary,
  },
  list: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  message: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  empty: {
    ...typography.bodyMd,
    color: colors.inkMute,
    marginTop: spacing.xxl,
    textAlign: "center",
  },
  result: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  selectionBar: {
    gap: spacing.sm,
    backgroundColor: colors.canvas,
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    padding: spacing.lg,
  },
  selectionSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  selectionCount: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: "600",
  },
  footer: {
    ...typography.caption,
    color: colors.inkMute,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
});
