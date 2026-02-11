import React, { useState, useEffect, useMemo} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const BillingHistoryScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName } = route.params;
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchBillingCycles();
  }, [roomId]);

  useFocusEffect(
    React.useCallback(() => {
      fetchBillingCycles();
      return () => {};
    }, [roomId]),
  );

  const fetchBillingCycles = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/billing-cycles/room/${roomId}`,
      );
      if (response.success) {
        setCycles(response.billingCycles || []);
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
      Alert.alert("Error", "Failed to load billing history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBillingCycles();
  };

  const handleSelectCycle = (cycle) => {
    setSelectedCycle(cycle);
    setShowDetailsModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return "\u20B1" + (parseFloat(amount) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getCycleTotal = (cycle) => {
    if (
      cycle.totalBilledAmount !== undefined &&
      cycle.totalBilledAmount !== null
    ) {
      return parseFloat(cycle.totalBilledAmount) || 0;
    }
    return (
      (parseFloat(cycle.rent) || 0) +
      (parseFloat(cycle.electricity) || 0) +
      (parseFloat(cycle.waterBillAmount) || 0) +
      (parseFloat(cycle.internet) || 0)
    );
  };

  const WATER_BILL_PER_DAY = 5;

  const getMemberWaterBreakdown = (member) => {
    if (!member.isPayer || !member.presenceDays) return null;
    const ownWater = member.presenceDays * WATER_BILL_PER_DAY;
    const waterShare = member.waterBillShare || 0;
    const sharedNonPayorWater = waterShare - ownWater;
    if (sharedNonPayorWater > 0) {
      return { ownWater, sharedNonPayorWater, waterShare };
    }
    return null;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "#22c55e";
      case "completed":
        return "#f59e0b";
      default:
        return "#94a3b8";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active":
        return "pulse-outline";
      case "completed":
        return "checkmark-circle-outline";
      default:
        return "archive-outline";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return "Closed";
    }
  };

  /* ───── Bill icon helper ───── */
  const getBillIcon = (type) => {
    switch (type) {
      case "rent":
        return "home-outline";
      case "electricity":
        return "flash-outline";
      case "water":
        return "water-outline";
      case "internet":
        return "wifi-outline";
      default:
        return "receipt-outline";
    }
  };

  /* ───── Loading ───── */
  if (loading && cycles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading billing history…</Text>
      </View>
    );
  }

  /* ───── Cycle Card ───── */
  const renderCycleCard = ({ item: cycle, index }) => {
    const total = getCycleTotal(cycle);
    const statusColor = getStatusColor(cycle.status);

    return (
      <TouchableOpacity
        style={styles.cycleCard}
        onPress={() => handleSelectCycle(cycle)}
        activeOpacity={0.65}
      >
        {/* Top Row */}
        <View style={styles.cycleCardTop}>
          <View style={styles.cycleIconWrap}>
            <View
              style={[
                styles.cycleIconCircle,
                { backgroundColor: statusColor + "18" },
              ]}
            >
              <Ionicons
                name={getStatusIcon(cycle.status)}
                size={20}
                color={statusColor}
              />
            </View>
          </View>
          <View style={styles.cycleMeta}>
            <Text style={styles.cyclePeriod}>
              {formatDate(cycle.startDate)} — {formatDate(cycle.endDate)}
            </Text>
            <View style={styles.cycleIdRow}>
              <Text style={styles.cycleIdLabel}>
                Cycle #
                {(cycle.cycleNumber || (cycle.id || "").slice(-4))
                  .toString()
                  .toUpperCase()}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColor + "18" },
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: statusColor }]}
                />
                <Text style={[styles.statusPillText, { color: statusColor }]}>
                  {getStatusLabel(cycle.status)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Separator */}
        <View style={styles.cycleCardDivider} />

        {/* Bottom Row – amounts */}
        <View style={styles.cycleCardBottom}>
          <View style={styles.cycleMiniAmounts}>
            {[
              { label: "Rent", value: cycle.rent },
              { label: "Elec", value: cycle.electricity },
              { label: "Water", value: cycle.waterBillAmount },
              { label: "Net", value: cycle.internet },
            ].map((b, i) => (
              <View key={i} style={styles.miniAmountItem}>
                <Text style={styles.miniAmountLabel}>{b.label}</Text>
                <Text style={styles.miniAmountValue}>
                  {formatCurrency(b.value)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.cycleTotalWrap}>
            <Text style={styles.cycleTotalLabel}>Total</Text>
            <Text style={styles.cycleTotalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Chevron indicator */}
        <View style={styles.chevronHint}>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  /* ───── Main Render ───── */
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Billing History</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.cycleCount}>
            {cycles.length} {cycles.length === 1 ? "cycle" : "cycles"}
          </Text>
        </View>
      </View>

      {/* List */}
      {cycles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No Billing Cycles</Text>
          <Text style={styles.emptyText}>
            Billing history will appear here once your admin creates a cycle.
          </Text>
          <TouchableOpacity
            style={styles.emptyRefresh}
            onPress={fetchBillingCycles}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.accent} />
            <Text style={styles.emptyRefreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={cycles}
          renderItem={renderCycleCard}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#b38604"]}
              tintcolor={colors.accent}
            />
          }
        />
      )}

      {/* ───── Details Modal ───── */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Drag handle */}
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Billing Details</Text>
                {selectedCycle && (
                  <Text style={styles.modalSubtitle}>
                    {formatDate(selectedCycle.startDate)} —{" "}
                    {formatDate(selectedCycle.endDate)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowDetailsModal(false)}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedCycle && (
              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 32 }}
              >
                {/* Status Banner */}
                <View
                  style={[
                    styles.statusBanner,
                    {
                      backgroundColor:
                        getStatusColor(selectedCycle.status) + "12",
                      borderColor: getStatusColor(selectedCycle.status) + "30",
                    },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(selectedCycle.status)}
                    size={18}
                    color={getStatusColor(selectedCycle.status)}
                  />
                  <Text
                    style={[
                      styles.statusBannerText,
                      { color: getStatusColor(selectedCycle.status) },
                    ]}
                  >
                    {getStatusLabel(selectedCycle.status)}
                  </Text>
                  {selectedCycle.closedAt && (
                    <Text style={styles.statusBannerDate}>
                      · Closed {formatDate(selectedCycle.closedAt)}
                    </Text>
                  )}
                </View>

                {/* Total Card */}
                <View style={styles.totalCard}>
                  <Text style={styles.totalCardLabel}>Total Billed</Text>
                  <Text style={styles.totalCardAmount}>
                    {formatCurrency(getCycleTotal(selectedCycle))}
                  </Text>
                </View>

                {/* Bills Breakdown */}
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.sectionTitle}>Bills Breakdown</Text>
                  </View>
                  {[
                    { type: "rent", label: "Rent", value: selectedCycle.rent },
                    {
                      type: "electricity",
                      label: "Electricity",
                      value: selectedCycle.electricity,
                    },
                    {
                      type: "water",
                      label: "Water",
                      value: selectedCycle.waterBillAmount,
                    },
                    {
                      type: "internet",
                      label: "Internet",
                      value: selectedCycle.internet,
                    },
                  ].map((bill, i, arr) => (
                    <View
                      key={bill.type}
                      style={[
                        styles.billRow,
                        i < arr.length - 1 && styles.billRowBorder,
                      ]}
                    >
                      <View style={styles.billRowLeft}>
                        <View style={styles.billIconWrap}>
                          <Ionicons
                            name={getBillIcon(bill.type)}
                            size={16}
                            color={colors.accent}
                          />
                        </View>
                        <Text style={styles.billLabel}>{bill.label}</Text>
                      </View>
                      <Text style={styles.billAmount}>
                        {formatCurrency(bill.value)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Member Charges */}
                {selectedCycle.memberCharges &&
                  selectedCycle.memberCharges.filter((m) => m.isPayer).length >
                    0 && (
                    <View style={styles.sectionCard}>
                      <View style={styles.sectionHeader}>
                        <Ionicons
                          name="people-outline"
                          size={16}
                          color={colors.accent}
                        />
                        <Text style={styles.sectionTitle}>Member Charges</Text>
                      </View>
                      {selectedCycle.memberCharges
                        .filter((m) => m.isPayer)
                        .map((member, idx, arr) => (
                          <View
                            key={idx}
                            style={[
                              styles.memberCard,
                              idx < arr.length - 1 && styles.memberCardBorder,
                            ]}
                          >
                            {/* Member Top Row */}
                            <View style={styles.memberTopRow}>
                              <View style={styles.memberAvatar}>
                                <Ionicons
                                  name="person-outline"
                                  size={16}
                                  color={colors.accent}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.memberName}>
                                  {member.name}
                                </Text>
                                <View style={styles.memberBadgeRow}>
                                  <View style={styles.payerBadge}>
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={12}
                                      color="#22c55e"
                                    />
                                    <Text style={styles.payerBadgeText}>
                                      Payor
                                    </Text>
                                  </View>
                                  {member.presenceDays > 0 && (
                                    <View style={styles.presenceBadge}>
                                      <Ionicons
                                        name="calendar-outline"
                                        size={11}
                                        color={colors.textSecondary}
                                      />
                                      <Text style={styles.presenceBadgeText}>
                                        {member.presenceDays}d
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <Text style={styles.memberTotal}>
                                {formatCurrency(member.totalDue || 0)}
                              </Text>
                            </View>

                            {/* Breakdown rows */}
                            <View style={styles.memberBreakdown}>
                              {member.rentShare > 0 && (
                                <View style={styles.breakdownRow}>
                                  <Text style={styles.breakdownLabel}>
                                    Rent Share
                                  </Text>
                                  <Text style={styles.breakdownValue}>
                                    {formatCurrency(member.rentShare)}
                                  </Text>
                                </View>
                              )}
                              {member.electricityShare > 0 && (
                                <View style={styles.breakdownRow}>
                                  <Text style={styles.breakdownLabel}>
                                    Electricity Share
                                  </Text>
                                  <Text style={styles.breakdownValue}>
                                    {formatCurrency(member.electricityShare)}
                                  </Text>
                                </View>
                              )}
                              {member.waterBillShare > 0 && (
                                <>
                                  <View style={styles.breakdownRow}>
                                    <Text style={styles.breakdownLabel}>
                                      Water Share
                                    </Text>
                                    <Text style={styles.breakdownValue}>
                                      {formatCurrency(member.waterBillShare)}
                                    </Text>
                                  </View>
                                  {getMemberWaterBreakdown(member) && (
                                    <View style={styles.waterDetail}>
                                      <Text style={styles.waterDetailText}>
                                        Own:{" "}
                                        {formatCurrency(
                                          getMemberWaterBreakdown(member)
                                            .ownWater,
                                        )}
                                        {"  "}·{"  "}
                                        Shared:{" "}
                                        {formatCurrency(
                                          getMemberWaterBreakdown(member)
                                            .sharedNonPayorWater,
                                        )}
                                      </Text>
                                    </View>
                                  )}
                                </>
                              )}
                              {member.internetShare > 0 && (
                                <View style={styles.breakdownRow}>
                                  <Text style={styles.breakdownLabel}>
                                    Internet Share
                                  </Text>
                                  <Text style={styles.breakdownValue}>
                                    {formatCurrency(member.internetShare)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        ))}
                    </View>
                  )}

                {/* Meter Readings */}
                {(selectedCycle.previousMeterReading ||
                  selectedCycle.currentMeterReading) && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Ionicons
                        name="speedometer-outline"
                        size={16}
                        color={colors.accent}
                      />
                      <Text style={styles.sectionTitle}>Meter Readings</Text>
                    </View>
                    <View style={styles.meterRow}>
                      <View style={styles.meterItem}>
                        <Text style={styles.meterLabel}>Previous</Text>
                        <Text style={styles.meterValue}>
                          {selectedCycle.previousMeterReading ?? "—"}
                        </Text>
                      </View>
                      <View style={styles.meterArrow}>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={colors.accent}
                        />
                      </View>
                      <View style={styles.meterItem}>
                        <Text style={styles.meterLabel}>Current</Text>
                        <Text style={styles.meterValue}>
                          {selectedCycle.currentMeterReading ?? "—"}
                        </Text>
                      </View>
                      {selectedCycle.previousMeterReading != null &&
                        selectedCycle.currentMeterReading != null && (
                          <View style={styles.meterUsage}>
                            <Text style={styles.meterUsageLabel}>Usage</Text>
                            <Text style={styles.meterUsageValue}>
                              {selectedCycle.currentMeterReading -
                                selectedCycle.previousMeterReading}{" "}
                              <Text style={styles.meterUnit}>units</Text>
                            </Text>
                          </View>
                        )}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const createStyles = (colors) => StyleSheet.create({
  /* ─── Layout ─── */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textTertiary,
  },

  /* ─── Header ─── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  headerRight: {
    width: 60,
    alignItems: "flex-end",
  },
  cycleCount: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: "600",
  },

  /* ─── Empty State ─── */
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 19,
  },
  emptyRefresh: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#b38604",
    gap: 6,
  },
  emptyRefreshText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },

  /* ─── List ─── */
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },

  /* ─── Cycle Card ─── */
  cycleCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cycleCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  cycleIconWrap: {
    marginRight: 12,
  },
  cycleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cycleMeta: {
    flex: 1,
  },
  cyclePeriod: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  cycleIdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
  },
  cycleIdLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: "500",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },

  cycleCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.skeleton,
    marginVertical: 12,
  },

  cycleCardBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cycleMiniAmounts: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  miniAmountItem: {
    alignItems: "center",
  },
  miniAmountLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  miniAmountValue: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  cycleTotalWrap: {
    alignItems: "flex-end",
  },
  cycleTotalLabel: {
    fontSize: 9,
    color: colors.textTertiary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  cycleTotalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.accent,
  },
  chevronHint: {
    position: "absolute",
    right: 14,
    top: 18,
  },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "92%",
  },
  dragHandleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.skeleton,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },

  /* ─── Status Banner ─── */
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusBannerDate: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  /* ─── Total Card ─── */
  totalCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: "#b38604",
    shadowColor: "#b38604",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  totalCardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalCardAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
  },

  /* ─── Section Cards ─── */
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  /* ─── Bill Rows ─── */
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  billRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  billRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  billIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.warningBg,
    justifyContent: "center",
    alignItems: "center",
  },
  billLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  billAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  /* ─── Member Cards ─── */
  memberCard: {
    paddingVertical: 12,
  },
  memberCardBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  memberTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.warningBg,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  memberBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 8,
  },
  payerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  payerBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#22c55e",
  },
  presenceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  presenceBadgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  memberTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.accent,
  },
  memberBreakdown: {
    marginTop: 10,
    marginLeft: 46,
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    padding: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text,
  },
  waterDetail: {
    paddingTop: 4,
    paddingBottom: 2,
  },
  waterDetailText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontStyle: "italic",
  },

  /* ─── Meter Readings ─── */
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  meterItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 12,
  },
  meterArrow: {
    marginHorizontal: 2,
  },
  meterLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  meterValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  meterUsage: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.warningBg,
    borderRadius: 10,
    paddingVertical: 12,
  },
  meterUsageLabel: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  meterUsageValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.accent,
  },
  meterUnit: {
    fontSize: 11,
    fontWeight: "500",
  },
});

export default BillingHistoryScreen;
