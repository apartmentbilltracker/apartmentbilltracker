import React, { useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import {
  ScrollViewWithDetection,
  FlatListWithDetection,
} from "../../components/ScrollDetectionWrappers";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";

const WATER_BILL_PER_DAY = 5;

const BillingHistoryScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { roomId, roomName } = route.params;

  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchBillingCycles();
      return undefined;
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

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatCurrency = (amount) =>
    "\u20B1" +
    (parseFloat(amount) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getCustomCharges = (cycle) => {
    if (!cycle?.customCharges) return [];
    try {
      if (Array.isArray(cycle.customCharges)) return cycle.customCharges;
      if (typeof cycle.customCharges === "string") {
        return JSON.parse(cycle.customCharges);
      }
    } catch (_) {
      return [];
    }
    return [];
  };

  const getCycleTotal = (cycle) => {
    const customChargesTotal = getCustomCharges(cycle).reduce(
      (sum, charge) => sum + parseFloat(charge.amount || 0),
      0,
    );

    if (
      cycle?.totalBilledAmount !== undefined &&
      cycle?.totalBilledAmount !== null
    ) {
      return parseFloat(cycle.totalBilledAmount) || 0;
    }

    return (
      (parseFloat(cycle?.rent) || 0) +
      (parseFloat(cycle?.electricity) || 0) +
      (parseFloat(cycle?.waterBillAmount) || 0) +
      (parseFloat(cycle?.internet) || 0) +
      customChargesTotal
    );
  };

  const getMemberWaterBreakdown = (member) => {
    if (!member?.isPayer || !member?.presenceDays) return null;
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
        return colors.success;
      case "completed":
        return colors.warning;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusSurface = (status) => {
    switch (status) {
      case "active":
        return colors.successBg;
      case "completed":
        return colors.warningBg;
      default:
        return colors.cardAlt;
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

  const getBillTypeColors = (type) => {
    switch (type) {
      case "rent":
        return { bg: colors.accentSurface, color: colors.accent };
      case "electricity":
        return { bg: colors.warningBg, color: colors.electricityColor };
      case "water":
        return { bg: colors.infoBg, color: colors.waterColor };
      case "internet":
        return { bg: colors.accentLight, color: colors.internetColor };
      default:
        return { bg: colors.cardAlt, color: colors.textSecondary };
    }
  };

  const getCycleLengthDays = (cycle) => {
    if (!cycle?.startDate || !cycle?.endDate) return 0;
    return Math.max(
      1,
      Math.floor(
        (new Date(cycle.endDate) - new Date(cycle.startDate)) /
          (1000 * 60 * 60 * 24),
      ) + 1,
    );
  };

  const totalBilledAcrossCycles = cycles.reduce(
    (sum, cycle) => sum + getCycleTotal(cycle),
    0,
  );
  const activeCyclesCount = cycles.filter((cycle) => cycle.status === "active")
    .length;
  const completedCyclesCount = cycles.filter(
    (cycle) => cycle.status === "completed",
  ).length;
  const selectedCycleCustomCharges = getCustomCharges(selectedCycle);
  const selectedCycleTotal = selectedCycle ? getCycleTotal(selectedCycle) : 0;
  const selectedCycleMemberCharges = selectedCycle?.memberCharges?.filter(
    (member) => member.isPayer,
  ) || [];
  const selectedCycleBreakdown = selectedCycle
    ? [
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
        ...(selectedCycleCustomCharges.length > 0
          ? [
              {
                type: "custom_charges",
                label: "Additional Charges",
                value: selectedCycleCustomCharges.reduce(
                  (sum, charge) => sum + parseFloat(charge.amount || 0),
                  0,
                ),
              },
            ]
          : []),
      ]
    : [];

  if (loading && cycles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading billing history...</Text>
      </View>
    );
  }

  const renderCycleCard = ({ item: cycle }) => {
    const total = getCycleTotal(cycle);
    const statusColor = getStatusColor(cycle.status);
    const statusSurface = getStatusSurface(cycle.status);
    const customCharges = getCustomCharges(cycle);

    return (
      <TouchableOpacity
        style={styles.cycleCard}
        onPress={() => handleSelectCycle(cycle)}
        activeOpacity={0.7}
      >
        <View style={styles.cycleCardAccent} />

        <View style={styles.cycleCardTop}>
          <View style={styles.cycleMeta}>
            <View style={styles.cycleEyebrowRow}>
              <Text style={styles.cycleIdLabel}>
                Cycle #
                {(cycle.cycleNumber || (cycle.id || "").slice(-4))
                  .toString()
                  .toUpperCase()}
              </Text>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusSurface },
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
            <Text style={styles.cyclePeriod}>
              {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
            </Text>
            <Text style={styles.cycleSubtext}>
              Tap to see the full bill mix, payor shares, and readings.
            </Text>
          </View>

          <View style={styles.cycleTotalWrap}>
            <Text style={styles.cycleTotalLabel}>Total billed</Text>
            <Text style={styles.cycleTotalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        <View style={styles.cycleCardDivider} />

        <View style={styles.cycleMiniStatsRow}>
          {[
            { label: "Days", value: getCycleLengthDays(cycle) || "--" },
            {
              label: "Payors",
              value:
                cycle.memberCharges?.filter((member) => member.isPayer).length ||
                0,
            },
            { label: "Extras", value: customCharges.length },
          ].map((item) => (
            <View key={item.label} style={styles.cycleMiniStat}>
              <Text style={styles.cycleMiniStatValue}>{item.value}</Text>
              <Text style={styles.cycleMiniStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cycleCardBottom}>
          <View style={styles.cycleMiniAmounts}>
            {[
              { label: "Rent", value: cycle.rent, type: "rent" },
              {
                label: "Elec",
                value: cycle.electricity,
                type: "electricity",
              },
              { label: "Water", value: cycle.waterBillAmount, type: "water" },
              { label: "Net", value: cycle.internet, type: "internet" },
            ].map((bill) => {
              const billColors = getBillTypeColors(bill.type);
              return (
                <View key={bill.label} style={styles.miniAmountItem}>
                  <View
                    style={[
                      styles.miniAmountIconWrap,
                      { backgroundColor: billColors.bg },
                    ]}
                  >
                    <Ionicons
                      name={getBillIcon(bill.type)}
                      size={12}
                      color={billColors.color}
                    />
                  </View>
                  <Text style={styles.miniAmountLabel}>{bill.label}</Text>
                  <Text style={styles.miniAmountValue}>
                    {formatCurrency(bill.value)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.chevronHint}>
            <Ionicons
              name="chevron-forward-circle"
              size={22}
              color={colors.accent}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerShell}>
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

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>History overview</Text>
              <Text style={styles.heroTitle}>{roomName}</Text>
              <Text style={styles.heroSubtitleText}>
                Review past billing periods and open each cycle for detailed
                charge information.
              </Text>
            </View>
            <View style={styles.heroTotalCard}>
              <Text style={styles.heroTotalLabel}>All cycles</Text>
              <Text style={styles.heroTotalValue}>
                {formatCurrency(totalBilledAcrossCycles)}
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            {[
              { label: "Total cycles", value: cycles.length },
              { label: "Active", value: activeCyclesCount },
              { label: "Completed", value: completedCyclesCount },
            ].map((stat) => (
              <View key={stat.label} style={styles.heroStatCard}>
                <Text style={styles.heroStatValue}>{stat.value}</Text>
                <Text style={styles.heroStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {cycles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="receipt-outline"
              size={42}
              color={colors.textSecondary}
            />
          </View>
          <Text style={styles.emptyTitle}>No Billing Cycles Yet</Text>
          <Text style={styles.emptyText}>
            History will appear here once your admin creates and closes billing
            periods for this room.
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
        <FlatListWithDetection
          data={cycles}
          renderItem={renderCycleCard}
          keyExtractor={(item, index) =>
            String(item.id || item._id || item.cycleNumber || index)
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
              tintColor={colors.accent}
            />
          }
        />
      )}

      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Billing Details</Text>
                {selectedCycle && (
                  <Text style={styles.modalSubtitle}>
                    {formatDate(selectedCycle.startDate)} to{" "}
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
              <ScrollViewWithDetection
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 4 }}
              >
                <View
                  style={[
                    styles.statusBanner,
                    {
                      backgroundColor: getStatusSurface(selectedCycle.status),
                      borderColor: getStatusColor(selectedCycle.status),
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
                      Closed {formatDate(selectedCycle.closedAt)}
                    </Text>
                  )}
                </View>

                <View style={styles.totalCard}>
                  <Text style={styles.totalCardLabel}>Total billed</Text>
                  <Text style={styles.totalCardAmount}>
                    {formatCurrency(selectedCycleTotal)}
                  </Text>
                  <View style={styles.totalCardMetaRow}>
                    <View style={styles.totalCardMetaPill}>
                      <Text style={styles.totalCardMetaText}>
                        {selectedCycleMemberCharges.length} payor(s)
                      </Text>
                    </View>
                    <View style={styles.totalCardMetaPill}>
                      <Text style={styles.totalCardMetaText}>
                        {selectedCycleCustomCharges.length} extra charge(s)
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Ionicons
                      name="receipt-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.sectionTitle}>Bills Breakdown</Text>
                  </View>
                  {selectedCycleBreakdown.map((bill, index, arr) => {
                    const billColors = getBillTypeColors(bill.type);
                    return (
                      <View
                        key={bill.type}
                        style={[
                          styles.billRow,
                          index < arr.length - 1 && styles.billRowBorder,
                        ]}
                      >
                        <View style={styles.billRowLeft}>
                          <View
                            style={[
                              styles.billIconWrap,
                              { backgroundColor: billColors.bg },
                            ]}
                          >
                            <Ionicons
                              name={getBillIcon(bill.type)}
                              size={16}
                              color={billColors.color}
                            />
                          </View>
                          <Text style={styles.billLabel}>{bill.label}</Text>
                        </View>
                        <Text style={styles.billAmount}>
                          {formatCurrency(bill.value)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {selectedCycleMemberCharges.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={colors.accent}
                      />
                      <Text style={styles.sectionTitle}>Member Charges</Text>
                    </View>
                    {selectedCycleMemberCharges.map((member, index, arr) => (
                      <View
                        key={`${member.name}-${index}`}
                        style={[
                          styles.memberCard,
                          index < arr.length - 1 && styles.memberCardBorder,
                        ]}
                      >
                        <View style={styles.memberTopRow}>
                          <View style={styles.memberAvatar}>
                            <Ionicons
                              name="person-outline"
                              size={16}
                              color={colors.accent}
                            />
                          </View>

                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{member.name}</Text>
                            <View style={styles.memberBadgeRow}>
                              <View style={styles.payerBadge}>
                                <Ionicons
                                  name="checkmark-circle"
                                  size={12}
                                  color={colors.success}
                                />
                                <Text style={styles.payerBadgeText}>Payor</Text>
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
                                    Own{" "}
                                    {formatCurrency(
                                      getMemberWaterBreakdown(member).ownWater,
                                    )}{" "}
                                    and shared{" "}
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
                          {member.custom_charges_share > 0 && (
                            <View style={styles.breakdownRow}>
                              <Text style={styles.breakdownLabel}>
                                Additional Charges Share
                              </Text>
                              <Text style={styles.breakdownValue}>
                                {formatCurrency(member.custom_charges_share)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {(selectedCycle.previousMeterReading != null ||
                  selectedCycle.currentMeterReading != null) && (
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
                          {selectedCycle.previousMeterReading ?? "--"}
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
                          {selectedCycle.currentMeterReading ?? "--"}
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

                <ModalBottomSpacer />
              </ScrollViewWithDetection>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
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
    headerShell: {
      backgroundColor: colors.headerBg,
      paddingBottom: 26,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 18,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: "rgba(255,255,255,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerCenter: {
      flex: 1,
      paddingHorizontal: 14,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.72)",
      marginTop: 2,
    },
    headerRight: {
      minWidth: 70,
      alignItems: "flex-end",
    },
    cycleCount: {
      fontSize: 11,
      color: colors.textOnAccent,
      fontWeight: "700",
    },
    heroCard: {
      marginHorizontal: 16,
      marginTop: 2,
      padding: 18,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    heroTopRow: {
      flexDirection: "row",
      gap: 14,
    },
    heroCopy: {
      flex: 1,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    heroTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.headerText,
      letterSpacing: -0.3,
    },
    heroSubtitleText: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      lineHeight: 19,
      marginTop: 8,
    },
    heroTotalCard: {
      minWidth: 110,
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 14,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    heroTotalLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    heroTotalValue: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.headerText,
      letterSpacing: -0.4,
      marginTop: 8,
    },
    heroStatsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    heroStatCard: {
      flex: 1,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    heroStatValue: {
      fontSize: 19,
      fontWeight: "900",
      color: colors.headerText,
    },
    heroStatLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: "rgba(255,255,255,0.72)",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 5,
      textAlign: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
    },
    emptyIconWrap: {
      width: 82,
      height: 82,
      borderRadius: 28,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
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
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: colors.accentLight,
      gap: 6,
    },
    emptyRefreshText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.accent,
    },
    listContent: {
      padding: 16,
      paddingTop: 18,
      paddingBottom: 28,
    },
    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
      overflow: "hidden",
    },
    cycleCardAccent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: colors.accent,
    },
    cycleCardTop: {
      flexDirection: "row",
      gap: 14,
    },
    cycleMeta: {
      flex: 1,
    },
    cycleEyebrowRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    cycleIdLabel: {
      fontSize: 11,
      color: colors.textTertiary,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      gap: 6,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "800",
    },
    cyclePeriod: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
      marginTop: 10,
      letterSpacing: -0.2,
    },
    cycleSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 6,
    },
    cycleCardDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderLight,
      marginVertical: 16,
    },
    cycleMiniStatsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    cycleMiniStat: {
      flex: 1,
      backgroundColor: colors.cardAlt,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: "center",
    },
    cycleMiniStatValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    cycleMiniStatLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 4,
    },
    cycleCardBottom: {
      flexDirection: "row",
      alignItems: "center",
    },
    cycleMiniAmounts: {
      flexDirection: "row",
      gap: 10,
      flex: 1,
    },
    miniAmountItem: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 6,
    },
    miniAmountIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 7,
    },
    miniAmountLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    miniAmountValue: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
      textAlign: "center",
    },
    cycleTotalWrap: {
      minWidth: 112,
      alignItems: "flex-end",
    },
    cycleTotalLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    cycleTotalValue: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.accent,
      letterSpacing: -0.5,
      textAlign: "right",
    },
    chevronHint: {
      marginLeft: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      maxHeight: "92%",
    },
    dragHandleWrap: {
      alignItems: "center",
      paddingTop: 10,
      paddingBottom: 4,
    },
    dragHandle: {
      width: 38,
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
      fontSize: 19,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalBody: {
      paddingHorizontal: 18,
      paddingTop: 16,
    },
    statusBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 14,
      gap: 8,
    },
    statusBannerText: {
      fontSize: 13,
      fontWeight: "800",
    },
    statusBannerDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: "auto",
    },
    totalCard: {
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 22,
      paddingHorizontal: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.accentSurface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    totalCardLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    totalCardAmount: {
      fontSize: 30,
      fontWeight: "900",
      color: colors.accent,
      letterSpacing: -0.7,
    },
    totalCardMetaRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    totalCardMetaPill: {
      backgroundColor: colors.accentLight,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    totalCardMetaText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },
    sectionCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.text,
    },
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
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    billLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    billAmount: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
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
      width: 40,
      height: 40,
      borderRadius: 15,
      backgroundColor: colors.accentLight,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.text,
    },
    memberBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 8,
      flexWrap: "wrap",
    },
    payerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.successBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    payerBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.success,
    },
    presenceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.cardAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    presenceBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    memberTotal: {
      fontSize: 15,
      fontWeight: "900",
      color: colors.accent,
      marginLeft: 12,
    },
    memberBreakdown: {
      marginTop: 12,
      marginLeft: 50,
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      padding: 12,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 4,
      gap: 12,
    },
    breakdownLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      flex: 1,
    },
    breakdownValue: {
      fontSize: 12,
      fontWeight: "700",
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
      lineHeight: 15,
    },
    meterRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    meterItem: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.cardAlt,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    meterArrow: {
      marginHorizontal: 2,
    },
    meterLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    meterValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.text,
    },
    meterUsage: {
      flex: 1,
      alignItems: "center",
      backgroundColor: colors.accentLight,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    meterUsageLabel: {
      fontSize: 10,
      color: colors.accent,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    meterUsageValue: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.accent,
    },
    meterUnit: {
      fontSize: 11,
      fontWeight: "600",
    },
  });

export default BillingHistoryScreen;
