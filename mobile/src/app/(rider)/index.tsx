import type { MobileRiderParcelPageDto, MobileRiderParcelTab } from "@parcel-flow/contract";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { useRiderParcels } from "@/api/parcels";
import { Button } from "@/components/button";
import { LoadingScreen } from "@/components/loading-screen";
import { Notice } from "@/components/notice";
import { ParcelCard } from "@/components/parcel-card";
import { colors, radii, spacing, typography } from "@/theme/tokens";

const tabs: { key: MobileRiderParcelTab; label: string; emptyMessage: string }[] = [
  { key: "to_deliver", label: "To deliver", emptyMessage: "No parcels to deliver right now." },
  { key: "delivered", label: "Delivered", emptyMessage: "No delivered parcels yet." },
  { key: "returned", label: "Returned", emptyMessage: "No returned parcels." },
];

export default function ParcelListScreen() {
  const [tab, setTab] = useState<MobileRiderParcelTab>("to_deliver");
  const [refreshing, setRefreshing] = useState(false);
  const parcels = useRiderParcels(tab);
  const activeTab = tabs.find((item) => item.key === tab) ?? tabs[0];
  // Counts come with every page; the first page is enough and is always loaded.
  const tabCounts: MobileRiderParcelPageDto["tabCounts"] | undefined =
    parcels.data?.pages[0]?.tabCounts;
  const items = parcels.data?.pages.flatMap((page) => page.parcels) ?? [];

  async function handleRefresh() {
    setRefreshing(true);
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
              onPress={() => setTab(item.key)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                {count === undefined ? item.label : `${item.label} (${count})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {parcels.isPending ? (
        <LoadingScreen />
      ) : parcels.isError ? (
        <View style={styles.message}>
          <Notice message={parcels.error.message} />
          <Button label="Try again" onPress={() => void parcels.refetch()} variant="secondary" />
        </View>
      ) : (
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
          renderItem={({ item }) => (
            <ParcelCard
              onPress={() =>
                router.push({ pathname: "/parcels/[parcelId]", params: { parcelId: item.id } })
              }
              parcel={item}
            />
          )}
        />
      )}
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
  footer: {
    ...typography.caption,
    color: colors.inkMute,
    paddingVertical: spacing.md,
    textAlign: "center",
  },
});
