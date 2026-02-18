import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import { apiService } from "../../services/apiService";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { useTheme } from "../../theme/ThemeContext";

const getBillMeta = (c) => ({
  rent: { icon: "home", color: c.success, bg: c.successBg, label: "Rent" },
  electricity: {
    icon: "flash",
    color: c.electricityColor,
    bg: c.accentSurface,
    label: "Electricity",
  },
  water: { icon: "water", color: c.waterColor, bg: c.infoBg, label: "Water" },
  internet: {
    icon: "wifi",
    color: c.internetColor,
    bg: c.purpleBg,
    label: "Internet",
  },
});

const AdminBillingDetailsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const BILL_META = getBillMeta(colors);

  const route = useRoute();
  const { room, cycleId } = route.params || {};

  const [breakdown, setBreakdown] = useState(null);
  const [collectionStatus, setCollectionStatus] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedMember, setExpandedMember] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [actualCycleId, setActualCycleId] = useState(cycleId);

  const fetchBillingDetails = useCallback(async () => {
    try {
      setLoading(true);

      // If cycleId not provided, try to get active cycle from the room
      let idToUse = actualCycleId;
      if (!idToUse && room) {
        try {
          const cycleResponse = await apiService.get(
            `/api/v2/billing-cycles/room/${room.id || room._id}/active`,
          );
          const cycleObj = cycleResponse.billingCycle || cycleResponse.data;
          if (cycleObj?.id || cycleObj?._id) {
            idToUse = cycleObj.id || cycleObj._id;
            setActualCycleId(idToUse);
          }
        } catch (error) {
          console.error("Error fetching active cycle:", error);
        }
      }

      if (!idToUse) {
        Alert.alert("Error", "No active billing cycle found");
        setLoading(false);
        return;
      }

      // Fetch breakdown
      const response = await apiService.get(
        `/api/v2/admin/billing/breakdown/${idToUse}`,
      );

      setBreakdown(response.breakdown);

      // Fetch collection status
      const statusResponse = await apiService.get(
        `/api/v2/admin/billing/collection-status/${idToUse}`,
      );

      setCollectionStatus(statusResponse);

      // Fetch export data
      const exportResponse = await apiService.get(
        `/api/v2/admin/billing/export/${idToUse}`,
      );

      setExportData(exportResponse.exportData || {});
    } catch (error) {
      console.error("Error fetching billing details:", error);
      Alert.alert("Error", "Failed to load billing details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actualCycleId, cycleId, room?.id || room?._id]);

  const mountedRef = useRef(false);

  useEffect(() => {
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  // Refetch data when screen comes into focus (handles new cycle creation)
  // Skip initial mount — useEffect above handles first load
  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      // Reset actualCycleId so it fetches the active cycle fresh
      setActualCycleId(null);
      // Small delay to ensure backend is updated
      const timer = setTimeout(() => {
        fetchBillingDetails();
      }, 500);
      return () => clearTimeout(timer);
    }, [room?.id || room?._id]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBillingDetails();
  }, [fetchBillingDetails]);

  const handleExportData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const date = new Date().toLocaleDateString();
      const roomName = breakdown?.roomName || "Room";
      const cycleNumber = breakdown?.cycleNumber || "N/A";

      const memberChargesHtml =
        breakdown?.memberBreakdown?.length > 0
          ? breakdown.memberBreakdown
              .filter((member) => member.isPayer !== false)
              .map(
                (member) => `
              <div class="member-item">
                <div class="member-name">${member.memberName} <span class="badge-payer">PAYER</span></div>
                <table class="detail-table">
                  <tr><td>Presence Days</td><td class="amt">${member.presenceDays || 0}</td></tr>
                  <tr><td>Rent Share</td><td class="amt">₱${(member.rentShare || 0).toFixed(2)}</td></tr>
                  <tr><td>Electricity Share</td><td class="amt">₱${(member.electricityShare || 0).toFixed(2)}</td></tr>
                  <tr><td>Water Share</td><td class="amt">₱${(member.waterShare || 0).toFixed(2)}</td></tr>
                  <tr><td>Internet Share</td><td class="amt">₱${(member.internetShare || 0).toFixed(2)}</td></tr>
                </table>
                <div class="member-total">
                  <span>Total Due</span>
                  <span>₱${(member.totalDue || 0).toFixed(2)}</span>
                </div>
              </div>`,
              )
              .join("")
          : '<p class="empty-note">No members in this room yet.</p>';

      const paymentStatusHtml =
        collectionStatus?.memberStatus?.length > 0
          ? `<table class="status-table">
              <tr>
                <th>Member</th>
                <th>Rent</th>
                <th>Electricity</th>
                <th>Water</th>
                <th>Internet</th>
                <th>Total Due</th>
              </tr>
              ${collectionStatus.memberStatus
                .map(
                  (member) => `
                <tr>
                  <td>${member.memberName}</td>
                  <td class="status-${member.rentStatus}">${(member.rentStatus || "pending").toUpperCase()}</td>
                  <td class="status-${member.electricityStatus}">${(member.electricityStatus || "pending").toUpperCase()}</td>
                  <td class="status-${member.waterStatus}">${(member.waterStatus || "pending").toUpperCase()}</td>
                  <td class="status-${member.internetStatus}">${(member.internetStatus || "pending").toUpperCase()}</td>
                  <td class="amt">₱${(member.totalDue || 0).toFixed(2)}</td>
                </tr>`,
                )
                .join("")}
            </table>
            <div class="collection-summary">
              <div class="collection-row">
                <span>Total Due</span>
                <span>₱${(collectionStatus?.summary?.totalDue || 0).toFixed(2)}</span>
              </div>
              <div class="collection-row collected">
                <span>Total Collected</span>
                <span>₱${(collectionStatus?.summary?.totalPaid || 0).toFixed(2)}</span>
              </div>
              <div class="collection-row pending">
                <span>Pending</span>
                <span>₱${(collectionStatus?.summary?.totalPending || 0).toFixed(2)}</span>
              </div>
              <div class="collection-row rate">
                <span>Collection Rate</span>
                <span>${collectionStatus?.summary?.collectionPercentage || 0}%</span>
              </div>
            </div>`
          : '<p class="empty-note">No payment data available yet.</p>';

      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; padding: 0; }
              .page { padding: 32px; }
              .header { text-align: center; border-bottom: 3px solid #2E86AB; padding-bottom: 16px; margin-bottom: 24px; }
              .header h1 { color: #2E86AB; font-size: 22px; margin-bottom: 6px; }
              .header p { color: #666; font-size: 12px; margin: 2px 0; }
              .section { margin-bottom: 22px; }
              .section-title { background-color: #2E86AB; color: white; padding: 8px 12px; font-size: 13px; font-weight: bold; margin-bottom: 10px; }
              .summary-table { width: 100%; border-collapse: collapse; }
              .summary-table td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
              .summary-table td:last-child { text-align: right; font-weight: 600; }
              .summary-table tr.total-row { background-color: #E3F2FD; }
              .summary-table tr.total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #2E86AB; }
              .member-item { border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 10px; background: #fafafa; }
              .member-name { font-weight: bold; font-size: 13px; color: #2E86AB; margin-bottom: 6px; }
              .badge-payer { background: #E8F5E9; color: #2E7D32; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
              .badge-nonpayer { background: #FFF3E0; color: #EF6C00; font-size: 9px; padding: 2px 6px; border-radius: 4px; margin-left: 6px; }
              .detail-table { width: 100%; border-collapse: collapse; }
              .detail-table td { padding: 3px 0; font-size: 11px; border: none; }
              .detail-table td.amt { text-align: right; font-weight: 500; }
              .member-total { display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; }
              .status-table { width: 100%; border-collapse: collapse; font-size: 11px; }
              .status-table th { background: #f0f0f0; padding: 7px 6px; text-align: left; border: 1px solid #ddd; font-size: 10px; }
              .status-table td { padding: 7px 6px; border: 1px solid #ddd; }
              .status-table td.amt { text-align: right; font-weight: 600; }
              .status-paid { color: #4CAF50; font-weight: bold; }
              .status-pending { color: #FF9800; font-weight: bold; }
              .collection-summary { background: #f9f9f9; padding: 10px 12px; margin-top: 12px; border-left: 4px solid #2E86AB; }
              .collection-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
              .collection-row.collected span:last-child { color: #4CAF50; font-weight: bold; }
              .collection-row.pending span:last-child { color: #FF9800; font-weight: bold; }
              .collection-row.rate span:last-child { color: #2E86AB; font-weight: bold; }
              .empty-note { color: #999; font-style: italic; font-size: 12px; text-align: center; padding: 16px 0; }
              .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #aaa; }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="header">
                <h1>Billing Statement</h1>
                <p><strong>${roomName}</strong></p>
                <p>Billing Cycle #${cycleNumber}</p>
                <p>${new Date(breakdown?.startDate).toLocaleDateString()} — ${new Date(breakdown?.endDate).toLocaleDateString()}</p>
                <p>Generated: ${date}</p>
              </div>

              <div class="section">
                <div class="section-title">Billing Summary</div>
                <table class="summary-table">
                  <tr><td>Rent</td><td>₱${(breakdown?.billBreakdown?.rent?.total || 0).toFixed(2)}</td></tr>
                  <tr><td>Electricity</td><td>₱${(breakdown?.billBreakdown?.electricity?.total || 0).toFixed(2)}</td></tr>
                  <tr><td>Water</td><td>₱${(breakdown?.billBreakdown?.water?.total || 0).toFixed(2)}</td></tr>
                  <tr><td>Internet</td><td>₱${(breakdown?.billBreakdown?.internet?.total || 0).toFixed(2)}</td></tr>
                  <tr class="total-row"><td>Total Billed</td><td>₱${(breakdown?.totalBilled || 0).toFixed(2)}</td></tr>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Member Charges</div>
                ${memberChargesHtml}
              </div>

              <div class="section">
                <div class="section-title">Payment Status</div>
                ${paymentStatusHtml}
              </div>

              <div class="footer">
                <p>This is an automatically generated billing statement.</p>
                <p>Apartment Bill Tracker</p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Generate PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Billing Statement - Cycle ${cycleNumber}`,
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Error", "Failed to export billing statement as PDF");
    } finally {
      setExporting(false);
    }
  };

  const renderMemberBreakdown = ({ item }) => {
    const isExpanded = expandedMember === item.userId;

    return (
      <TouchableOpacity
        style={styles.memberCard}
        activeOpacity={0.7}
        onPress={() => setExpandedMember(isExpanded ? null : item.userId)}
      >
        <View style={styles.memberHeader}>
          <View style={styles.memberLeft}>
            <View
              style={[
                styles.memberAvatar,
                {
                  backgroundColor: colors.successBg,
                },
              ]}
            >
              <Ionicons name="person" size={16} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.memberName}
              </Text>
              <View
                style={[
                  styles.payerBadge,
                  {
                    backgroundColor: colors.successBg,
                  },
                ]}
              >
                <Text
                  style={[styles.payerBadgeText, { color: colors.success }]}
                >
                  Payer
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.memberRight}>
            <Text style={styles.memberTotal}>
              ₱{(item.totalDue || 0).toFixed(2)}
            </Text>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </View>

        {isExpanded && (
          <View style={styles.memberDetails}>
            {[
              {
                label: "Presence Days",
                value: `${item.presenceDays || 0} days`,
                icon: "calendar",
                color: colors.textSecondary,
              },
              {
                label: "Rent Share",
                value: `₱${(item.rentShare || 0).toFixed(2)}`,
                ...BILL_META.rent,
              },
              {
                label: "Electricity Share",
                value: `₱${(item.electricityShare || 0).toFixed(2)}`,
                ...BILL_META.electricity,
              },
              {
                label: "Water Share",
                value: `₱${(item.waterShare || 0).toFixed(2)}`,
                ...BILL_META.water,
              },
              {
                label: "Internet Share",
                value: `₱${(item.internetShare || 0).toFixed(2)}`,
                ...BILL_META.internet,
              },
            ].map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Ionicons name={row.icon} size={14} color={row.color} />
                  <Text style={styles.detailLabel}>{row.label}</Text>
                </View>
                <Text style={styles.detailValue}>{row.value}</Text>
              </View>
            ))}
            <View style={styles.detailTotalRow}>
              <Text style={styles.detailTotalLabel}>Total Due</Text>
              <Text style={styles.detailTotalValue}>
                ₱{(item.totalDue || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPaymentStatus = ({ item }) => {
    const allPaid =
      item.rentStatus === "paid" &&
      item.electricityStatus === "paid" &&
      item.waterStatus === "paid" &&
      item.internetStatus === "paid";

    const statusEntries = [
      {
        key: "rent",
        status: item.rentStatus,
        amount: item.rentAmount,
        ...BILL_META.rent,
      },
      {
        key: "electricity",
        status: item.electricityStatus,
        amount: item.electricityAmount,
        ...BILL_META.electricity,
      },
      {
        key: "water",
        status: item.waterStatus,
        amount: item.waterAmount,
        ...BILL_META.water,
      },
      {
        key: "internet",
        status: item.internetStatus,
        amount: item.internetAmount,
        ...BILL_META.internet,
      },
    ];

    return (
      <View style={styles.paymentStatusCard}>
        <View style={styles.statusCardHeader}>
          <View style={styles.statusCardLeft}>
            <View
              style={[
                styles.statusAvatar,
                {
                  backgroundColor: allPaid
                    ? colors.successBg
                    : colors.accentSurface,
                },
              ]}
            >
              <Ionicons
                name={allPaid ? "checkmark-done" : "time"}
                size={16}
                color={allPaid ? colors.success : colors.electricityColor}
              />
            </View>
            <Text style={styles.statusMemberName} numberOfLines={1}>
              {item.memberName}
            </Text>
          </View>
          <View
            style={[
              styles.paidBadge,
              {
                backgroundColor: allPaid
                  ? colors.successBg
                  : colors.accentSurface,
              },
            ]}
          >
            <Ionicons
              name={allPaid ? "checkmark-circle" : "ellipsis-horizontal-circle"}
              size={12}
              color={allPaid ? colors.success : colors.electricityColor}
            />
            <Text
              style={[
                styles.paidBadgeText,
                { color: allPaid ? colors.success : colors.electricityColor },
              ]}
            >
              {allPaid ? "All Paid" : "Partial"}
            </Text>
          </View>
        </View>

        <View style={styles.statusGrid}>
          {statusEntries.map((entry) => {
            const isPaid = entry.status === "paid";
            return (
              <View
                key={entry.key}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: isPaid ? entry.bg : colors.cardAlt,
                    borderColor: isPaid ? entry.color + "30" : "#eee",
                  },
                ]}
              >
                <Ionicons
                  name={entry.icon}
                  size={12}
                  color={isPaid ? entry.color : "#bbb"}
                />
                <Text
                  style={[
                    styles.statusChipLabel,
                    { color: isPaid ? entry.color : colors.textSecondary },
                  ]}
                >
                  {entry.label}
                </Text>
                <Text
                  style={[
                    styles.statusChipAmount,
                    { color: isPaid ? entry.color : colors.textSecondary },
                  ]}
                >
                  ₱{(entry.amount || 0).toFixed(0)}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isPaid
                        ? colors.success
                        : colors.electricityColor,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading billing details...</Text>
      </View>
    );
  }

  const collectionPct = collectionStatus?.summary?.collectionPercentage || 0;
  const pctColor =
    collectionPct >= 80
      ? colors.success
      : collectionPct >= 50
        ? colors.electricityColor
        : "#c62828";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintcolor={colors.accent}
          colors={["#b38604"]}
        />
      }
    >
      {/* ── Summary Strip ── */}
      <View style={styles.summaryStrip}>
        <View
          style={[
            styles.stripIconWrap,
            { backgroundColor: colors.accentSurface },
          ]}
        >
          <Ionicons name="document-text" size={16} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.stripTitle} numberOfLines={1}>
            {breakdown?.roomName || room?.name || "Room"}
          </Text>
          <Text style={styles.stripSubtitle}>
            Cycle #{breakdown?.cycleNumber || "—"}
          </Text>
        </View>
        <View style={[styles.rateBadge, { backgroundColor: pctColor + "18" }]}>
          <Text style={[styles.rateBadgeText, { color: pctColor }]}>
            {collectionPct}%
          </Text>
        </View>
      </View>

      {/* ── Billing Summary ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="receipt" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Billing Summary</Text>
        </View>

        <View style={styles.summaryCard}>
          {/* Period */}
          <View style={styles.periodRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textTertiary}
            />
            <Text style={styles.periodText}>
              {breakdown?.startDate
                ? new Date(breakdown.startDate).toLocaleDateString()
                : "—"}{" "}
              –{" "}
              {breakdown?.endDate
                ? new Date(breakdown.endDate).toLocaleDateString()
                : "—"}
            </Text>
          </View>

          {/* Bill Breakdown Grid */}
          <View style={styles.breakdownGrid}>
            {Object.entries(BILL_META).map(([key, meta]) => {
              const total = breakdown?.billBreakdown?.[key]?.total || 0;
              return (
                <View key={key} style={styles.breakdownChip}>
                  <View
                    style={[
                      styles.breakdownChipIcon,
                      { backgroundColor: meta.bg },
                    ]}
                  >
                    <Ionicons name={meta.icon} size={14} color={meta.color} />
                  </View>
                  <View>
                    <Text style={styles.breakdownChipLabel}>{meta.label}</Text>
                    <Text style={styles.breakdownChipValue}>
                      ₱{total.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Total */}
          <View style={styles.totalBilledRow}>
            <Text style={styles.totalLabel}>Total Billed</Text>
            <Text style={styles.totalAmount}>
              ₱{(breakdown?.totalBilled || 0).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Member Charges ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="people" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Member Charges</Text>
        </View>
        {breakdown?.memberBreakdown?.length > 0 ? (
          <FlatList
            data={breakdown.memberBreakdown.filter((m) => m.isPayer !== false)}
            renderItem={renderMemberBreakdown}
            keyExtractor={(item) => item.userId}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No Members Yet</Text>
            <Text style={styles.emptySubtitle}>
              Members will appear here once they join the room and a billing
              cycle is active.
            </Text>
          </View>
        )}
      </View>

      {/* ── Payment Status ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="card" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Payment Status</Text>
        </View>
        {collectionStatus?.memberStatus?.length > 0 ? (
          <>
            {/* Collection KPIs */}
            <View style={styles.collectionRow}>
              {[
                {
                  label: "Total Due",
                  value: collectionStatus?.summary?.totalDue,
                  color: colors.text,
                  icon: "receipt-outline",
                  bg: colors.cardAlt,
                },
                {
                  label: "Collected",
                  value: collectionStatus?.summary?.totalPaid,
                  color: colors.success,
                  icon: "checkmark-circle-outline",
                  bg: colors.successBg,
                },
                {
                  label: "Pending",
                  value: collectionStatus?.summary?.totalPending,
                  color: colors.electricityColor,
                  icon: "time-outline",
                  bg: colors.accentSurface,
                },
              ].map((kpi) => (
                <View key={kpi.label} style={styles.collectionKpi}>
                  <View
                    style={[
                      styles.collectionKpiIcon,
                      { backgroundColor: kpi.bg },
                    ]}
                  >
                    <Ionicons name={kpi.icon} size={14} color={kpi.color} />
                  </View>
                  <Text style={styles.collectionKpiLabel}>{kpi.label}</Text>
                  <Text
                    style={[styles.collectionKpiValue, { color: kpi.color }]}
                  >
                    ₱{(kpi.value || 0).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <FlatList
              data={collectionStatus?.memberStatus}
              renderItem={renderPaymentStatus}
              keyExtractor={(item) => item.userId}
              scrollEnabled={false}
            />
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="card-outline" size={32} color={colors.accent} />
            </View>
            <Text style={styles.emptyTitle}>No Payment Data</Text>
            <Text style={styles.emptySubtitle}>
              Payment status will appear here once members join the room and are
              marked as payers.
            </Text>
            {breakdown?.totalBilled > 0 && (
              <View style={styles.billedBadge}>
                <Ionicons name="receipt" size={12} color={colors.accent} />
                <Text style={styles.billedBadgeText}>
                  Total Billed: ₱{breakdown.totalBilled.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.actionsSection}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flash" size={16} color={colors.accent} />
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionCard, exporting && styles.btnDisabled]}
          activeOpacity={0.7}
          onPress={handleExportData}
          disabled={exporting}
        >
          <View
            style={[styles.actionIconWrap, { backgroundColor: colors.infoBg }]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.info} />
            ) : (
              <Ionicons name="download" size={20} color={colors.info} />
            )}
          </View>
          <Text style={styles.actionLabel}>
            {exporting ? "Generating PDF..." : "Download PDF Statement"}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate("Adjustments", {
              room,
              cycleId: actualCycleId,
            })
          }
        >
          <View
            style={[
              styles.actionIconWrap,
              { backgroundColor: colors.accentSurface },
            ]}
          >
            <Ionicons name="construct" size={20} color={colors.accent} />
          </View>
          <Text style={styles.actionLabel}>Adjust Charges</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    /* ── Layout ── */
    container: { flex: 1, backgroundColor: colors.background },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: { fontSize: 13, color: colors.textTertiary, marginTop: 10 },

    /* ── Summary Strip ── */
    summaryStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      marginHorizontal: 14,
      marginTop: 14,
      borderRadius: 14,
      padding: 14,
      gap: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 2 },
      }),
    },
    stripIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    stripTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    stripSubtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
    rateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    rateBadgeText: { fontSize: 13, fontWeight: "700" },

    /* ── Sections ── */
    section: { paddingHorizontal: 14, marginTop: 18 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
    },
    sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },

    /* ── Summary Card ── */
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 2 },
      }),
    },
    periodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 14,
    },
    periodText: { fontSize: 13, color: colors.textTertiary },
    breakdownGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    breakdownChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      gap: 8,
      width: "47%",
    },
    breakdownChipIcon: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
    },
    breakdownChipLabel: { fontSize: 11, color: colors.textTertiary },
    breakdownChipValue: { fontSize: 14, fontWeight: "700", color: colors.text },
    totalBilledRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: "#e8e8e8",
    },
    totalLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
    totalAmount: { fontSize: 18, fontWeight: "800", color: colors.accent },

    /* ── Member Cards ── */
    memberCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginBottom: 10,
      overflow: "hidden",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    memberHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
    },
    memberLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },
    memberRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    memberAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
    },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 14, fontWeight: "600", color: colors.text },
    payerBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 3,
      backgroundColor: colors.successBg,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 3,
    },
    payerBadgeText: { fontSize: 10, fontWeight: "600", color: colors.success },
    memberTotal: { fontSize: 15, fontWeight: "700", color: colors.accent },
    memberDetails: {
      backgroundColor: colors.cardAlt,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      gap: 8,
    },
    detailLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    detailLabel: { fontSize: 12, color: colors.textSecondary },
    detailValue: { fontSize: 13, fontWeight: "600", color: colors.text },
    detailTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 6,
      paddingTop: 8,
    },
    detailTotalLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
    detailTotalValue: { fontSize: 14, fontWeight: "700", color: colors.accent },

    /* ── Payment Status Cards ── */
    paymentStatusCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    statusCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    statusCardLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 10,
    },
    statusAvatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
    },
    statusMemberName: { fontSize: 14, fontWeight: "600", color: colors.text },
    paidBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    paidBadgeText: { fontSize: 11, fontWeight: "700" },
    statusGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    statusChip: {
      width: "47%",
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 10,
      alignItems: "center",
      gap: 4,
    },
    statusChipLabel: { fontSize: 11, fontWeight: "600" },
    statusChipAmount: { fontSize: 13, fontWeight: "700" },
    statusDot: { width: 6, height: 6, borderRadius: 3 },

    /* ── Collection KPIs ── */
    collectionRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    collectionKpi: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 10,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.04,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    collectionKpiIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    collectionKpiLabel: {
      fontSize: 10,
      color: colors.textTertiary,
      marginBottom: 2,
    },
    collectionKpiValue: { fontSize: 14, fontWeight: "700" },

    /* ── Empty States ── */
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 28,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentSurface,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
    },
    billedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 14,
      backgroundColor: colors.accentSurface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    billedBadgeText: { fontSize: 12, fontWeight: "600", color: colors.accent },

    /* ── Action Cards ── */
    actionsSection: { paddingHorizontal: 14, marginTop: 18 },
    actionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      gap: 12,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
        },
        android: { elevation: 1 },
      }),
    },
    actionIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    actionLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    btnDisabled: { opacity: 0.55 },
  });

export default AdminBillingDetailsScreen;
