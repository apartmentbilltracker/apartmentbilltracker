import React, { useState, useEffect, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import ModalBottomSpacer from "../../components/ModalBottomSpacer";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { apiService, announcementService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AdminBillingCycleScreen = ({ route }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { roomId, roomName } = route.params;
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    rent: "",
    electricity: "",
    waterBillAmount: "",
    internet: "",
    previousMeterReading: "",
    currentMeterReading: "",
  });

  const [startDateStr, setStartDateStr] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDateStr, setEndDateStr] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );

  useFocusEffect(
    React.useCallback(() => {
      fetchCycles();
      return () => {};
    }, [roomId]),
  );

  const fetchCycles = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/api/v2/billing-cycles/room/${roomId}`,
      );
      if (response.success) {
        setCycles(response.billingCycles || response.data || []);
      }
    } catch (error) {
      console.error("Error fetching cycles:", error);
      Alert.alert("Error", "Failed to fetch billing cycles");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCycles();
  };

  const handleDateChange = (text, field) => {
    if (field === "startDate") {
      setStartDateStr(text);
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        setFormData((prev) => ({ ...prev, startDate: new Date(text) }));
      }
    } else if (field === "endDate") {
      setEndDateStr(text);
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(text)) {
        setFormData((prev) => ({ ...prev, endDate: new Date(text) }));
      }
    }
  };

  const handleCreateCycle = async () => {
    try {
      if (
        !formData.rent ||
        !formData.electricity ||
        !formData.waterBillAmount
      ) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }
      if (formData.startDate >= formData.endDate) {
        Alert.alert("Error", "Start date must be before end date");
        return;
      }
      setLoading(true);
      const payload = {
        roomId,
        startDate: formData.startDate.toISOString(),
        endDate: formData.endDate.toISOString(),
        rent: parseFloat(formData.rent),
        electricity: parseFloat(formData.electricity),
        waterBillAmount: parseFloat(formData.waterBillAmount),
        previousMeterReading: formData.previousMeterReading
          ? parseFloat(formData.previousMeterReading)
          : null,
        currentMeterReading: formData.currentMeterReading
          ? parseFloat(formData.currentMeterReading)
          : null,
      };
      if (formData.internet) {
        payload.internet = parseFloat(formData.internet);
      }
      const response = await apiService.post("/api/v2/billing-cycles", payload);
      if (response.success) {
        // Auto-post a pinned banner so clients see the new cycle immediately
        try {
          const fmtDate = (iso) =>
            new Date(iso).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          const bannerTitle = `📅 New Billing Cycle Started`;
          const bannerContent =
            `A new billing cycle has been created for ${roomName}.\n\n` +
            `Period: ${fmtDate(payload.startDate)} – ${fmtDate(payload.endDate)}\n` +
            `Rent: ₱${parseFloat(payload.rent).toLocaleString()}\n` +
            `Electricity: ₱${parseFloat(payload.electricity).toLocaleString()}\n` +
            `Water: ₱${parseFloat(payload.waterBillAmount).toLocaleString()}` +
            (payload.internet
              ? `\nInternet: ₱${parseFloat(payload.internet).toLocaleString()}`
              : "");
          await announcementService.createAnnouncement(
            roomId,
            bannerTitle,
            bannerContent,
            true,
          );
        } catch (_) {
          // Banner creation is non-critical; don't block the user
        }
        Alert.alert("Success", "Billing cycle created successfully");
        setShowCreateModal(false);
        resetForm();
        fetchCycles();
      }
    } catch (error) {
      console.error("Error creating cycle:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create billing cycle",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCycle = async (cycleId) => {
    Alert.alert(
      "Close Billing Cycle",
      "This cycle will be marked as completed and cannot be modified afterward. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Cycle",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const response = await apiService.put(
                `/api/v2/billing-cycles/${cycleId}/close`,
                {},
              );
              if (response.success) {
                Alert.alert("Success", "Billing cycle closed successfully");
                fetchCycles();
              }
            } catch (error) {
              console.error("Error closing cycle:", error);
              Alert.alert("Error", "Failed to close billing cycle");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleBackfillStats = () => {
    Alert.alert(
      "Recalculate Existing Data",
      "This will fix members_count and water_bill_amount for ALL billing cycles that were created before the fix. Run once to sync old records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Recalculate",
          onPress: async () => {
            try {
              setLoading(true);
              const response = await apiService.post(
                "/api/v2/billing-cycles/backfill-stats",
                {},
              );
              if (response.success) {
                Alert.alert("Done", `${response.message}`);
                fetchCycles();
              }
            } catch (error) {
              console.error("Backfill error:", error);
              Alert.alert("Error", "Failed to recalculate stats");
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const resetForm = () => {
    const newStart = new Date();
    const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setFormData({
      startDate: newStart,
      endDate: newEnd,
      rent: "",
      electricity: "",
      internet: "",
      waterBillAmount: "",
      previousMeterReading: "",
      currentMeterReading: "",
    });
    setStartDateStr(newStart.toISOString().split("T")[0]);
    setEndDateStr(newEnd.toISOString().split("T")[0]);
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatShortDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const fmt = (v) =>
    String.fromCharCode(8369) +
    (parseFloat(v) || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getStatusConfig = (status) => {
    switch (status) {
      case "active":
        return {
          bg: colors.successBg,
          color: colors.success,
          icon: "radio-button-on",
          label: "Active",
        };
      case "completed":
        return {
          bg: colors.warningBg,
          color: "#e65100",
          icon: "checkmark-circle",
          label: "Completed",
        };
      case "archived":
        return {
          bg: colors.cardAlt,
          color: colors.textTertiary,
          icon: "archive",
          label: "Archived",
        };
      default:
        return {
          bg: colors.cardAlt,
          color: colors.textSecondary,
          icon: "ellipse",
          label: status,
        };
    }
  };

  const activeCycles = cycles.filter((c) => c.status === "active").length;
  const completedCycles = cycles.filter((c) => c.status === "completed").length;

  if (loading && cycles.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconBg}>
              <Ionicons name="calendar" size={20} color={colors.textOnAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Billing Cycles</Text>
              <Text style={styles.headerSubtitle}>{roomName}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.recalcFab}
            onPress={handleBackfillStats}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color={colors.textOnAccent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.createFab}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* STATS BAR */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{cycles.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.success }]}>
            {activeCycles}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: "#e65100" }]}>
            {completedCycles}
          </Text>
          <Text style={styles.statLabel}>Closed</Text>
        </View>
      </View>

      {/* CYCLES LIST */}
      <ScrollView
        style={styles.cyclesList}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#b38604"]}
          />
        }
      >
        {cycles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="calendar-outline"
                size={40}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.emptyTitle}>No Billing Cycles</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to create your first billing cycle
            </Text>
          </View>
        ) : (
          cycles.map((cycle) => {
            const status = getStatusConfig(cycle.status);
            const total = parseFloat(
              cycle.total_billed_amount || cycle.totalBilledAmount || 0,
            );
            const prevReading =
              cycle.previous_meter_reading ??
              cycle.previousMeterReading ??
              null;
            const currReading =
              cycle.current_meter_reading ?? cycle.currentMeterReading ?? null;
            const usage =
              prevReading != null && currReading != null
                ? currReading - prevReading
                : null;

            return (
              <View key={cycle.id || cycle._id} style={styles.cycleCard}>
                <View
                  style={[styles.cardAccent, { backgroundColor: status.color }]}
                />

                {/* Cycle Header */}
                <View style={styles.cycleHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cycleTitleRow}>
                      <Text style={styles.cycleId}>
                        #{(cycle.id || cycle._id || "").slice(-6).toUpperCase()}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: status.bg },
                        ]}
                      >
                        <Ionicons
                          name={status.icon}
                          size={12}
                          color={status.color}
                        />
                        <Text
                          style={[styles.statusText, { color: status.color }]}
                        >
                          {status.label}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.dateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={colors.textTertiary}
                      />
                      <Text style={styles.cycleDate}>
                        {formatShortDate(cycle.start_date || cycle.startDate)}{" "}
                        {"\u2014"}{" "}
                        {formatShortDate(cycle.end_date || cycle.endDate)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Bills Grid */}
                <View style={styles.billsGrid}>
                  <View style={styles.billCell}>
                    <View
                      style={[styles.billDot, { backgroundColor: "#e65100" }]}
                    />
                    <Text style={styles.billCellLabel}>Rent</Text>
                    <Text style={styles.billCellAmount}>{fmt(cycle.rent)}</Text>
                  </View>
                  <View style={styles.billCell}>
                    <View
                      style={[
                        styles.billDot,
                        { backgroundColor: colors.electricityColor },
                      ]}
                    />
                    <Text style={styles.billCellLabel}>Electricity</Text>
                    <Text style={styles.billCellAmount}>
                      {fmt(cycle.electricity)}
                    </Text>
                  </View>
                  <View style={styles.billCell}>
                    <View
                      style={[
                        styles.billDot,
                        { backgroundColor: colors.waterColor },
                      ]}
                    />
                    <Text style={styles.billCellLabel}>Water</Text>
                    <Text style={styles.billCellAmount}>
                      {fmt(
                        cycle.water_bill_amount || cycle.waterBillAmount || 0,
                      )}
                    </Text>
                  </View>
                  <View style={styles.billCell}>
                    <View
                      style={[
                        styles.billDot,
                        { backgroundColor: colors.internetColor },
                      ]}
                    />
                    <Text style={styles.billCellLabel}>Internet</Text>
                    <Text style={styles.billCellAmount}>
                      {fmt(cycle.internet)}
                    </Text>
                  </View>
                </View>

                {/* Meter Readings */}
                {(prevReading != null || currReading != null) && (
                  <View style={styles.meterSection}>
                    <View style={styles.meterItem}>
                      <Text style={styles.meterLabel}>Prev</Text>
                      <Text style={styles.meterValue}>
                        {prevReading != null ? prevReading : "\u2014"}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.textSecondary}
                    />
                    <View style={styles.meterItem}>
                      <Text style={styles.meterLabel}>Curr</Text>
                      <Text style={styles.meterValue}>
                        {currReading != null ? currReading : "\u2014"}
                      </Text>
                    </View>
                    {usage != null && (
                      <>
                        <View style={styles.meterEquals}>
                          <Text style={styles.meterEqualsText}>=</Text>
                        </View>
                        <View style={styles.meterItem}>
                          <Text style={styles.meterLabel}>Usage</Text>
                          <Text
                            style={[styles.meterValue, { color: "#e65100" }]}
                          >
                            {usage} kWh
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* Total */}
                <View style={styles.totalStrip}>
                  <Text style={styles.totalStripLabel}>Total Billed</Text>
                  <Text style={styles.totalStripAmount}>{fmt(total)}</Text>
                </View>

                {/* Actions */}
                {cycle.status === "active" && (
                  <TouchableOpacity
                    style={styles.closeCycleBtn}
                    onPress={() => handleCloseCycle(cycle.id || cycle._id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={colors.electricityColor}
                    />
                    <Text style={styles.closeCycleBtnText}>Close Cycle</Text>
                  </TouchableOpacity>
                )}

                {cycle.status === "completed" && (
                  <View style={styles.completedStrip}>
                    <Ionicons name="checkmark-done" size={16} color="#e65100" />
                    <Text style={styles.completedStripText}>
                      Closed{" "}
                      {formatDate(
                        cycle.closed_at || cycle.closedAt || cycle.updated_at,
                      )}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBg}>
                  <Ionicons
                    name="add-circle"
                    size={20}
                    color={colors.textOnAccent}
                  />
                </View>
                <Text style={styles.modalTitle}>New Billing Cycle</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Date Section */}
              <Text style={styles.formSectionLabel}>Billing Period</Text>
              <View style={styles.dateInputRow}>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <View style={styles.dateInputWrapper}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.dateInput}
                      placeholder="YYYY-MM-DD"
                      value={startDateStr}
                      onChangeText={(text) =>
                        handleDateChange(text, "startDate")
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.dateSeparator}>
                  <MaterialIcons
                    name="arrow-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.dateInputGroup}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  <View style={styles.dateInputWrapper}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <TextInput
                      style={styles.dateInput}
                      placeholder="YYYY-MM-DD"
                      value={endDateStr}
                      onChangeText={(text) => handleDateChange(text, "endDate")}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* Bills Section */}
              <Text style={styles.formSectionLabel}>Bill Amounts</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Rent *</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>
                      {String.fromCharCode(8369)}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={formData.rent}
                      onChangeText={(text) =>
                        setFormData((prev) => ({ ...prev, rent: text }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Electricity *</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>
                      {String.fromCharCode(8369)}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={formData.electricity}
                      onChangeText={(text) =>
                        setFormData((prev) => ({ ...prev, electricity: text }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Water *</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>
                      {String.fromCharCode(8369)}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={formData.waterBillAmount}
                      onChangeText={(text) =>
                        setFormData((prev) => ({
                          ...prev,
                          waterBillAmount: text,
                        }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
                <View style={styles.inputHalf}>
                  <Text style={styles.inputLabel}>Internet</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputPrefix}>
                      {String.fromCharCode(8369)}
                    </Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      value={formData.internet}
                      onChangeText={(text) =>
                        setFormData((prev) => ({ ...prev, internet: text }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>
              </View>

              {/* Meter Readings Section */}
              <Text style={styles.formSectionLabel}>
                Meter Readings (Optional)
              </Text>
              <View style={styles.meterInputRow}>
                <View style={styles.meterInputGroup}>
                  <Text style={styles.inputLabel}>Previous</Text>
                  <View style={styles.meterInputWrapper}>
                    <MaterialIcons
                      name="speed"
                      size={16}
                      color={colors.textTertiary}
                    />
                    <TextInput
                      style={styles.meterInput}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={formData.previousMeterReading}
                      onChangeText={(text) =>
                        setFormData((prev) => ({
                          ...prev,
                          previousMeterReading: text,
                        }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.meterUnit}>kWh</Text>
                  </View>
                </View>
                <View style={styles.meterInputArrow}>
                  <MaterialIcons
                    name="arrow-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.meterInputGroup}>
                  <Text style={styles.inputLabel}>Current</Text>
                  <View style={styles.meterInputWrapper}>
                    <MaterialIcons
                      name="speed"
                      size={16}
                      color={colors.textTertiary}
                    />
                    <TextInput
                      style={styles.meterInput}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={formData.currentMeterReading}
                      onChangeText={(text) =>
                        setFormData((prev) => ({
                          ...prev,
                          currentMeterReading: text,
                        }))
                      }
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.meterUnit}>kWh</Text>
                  </View>
                </View>
              </View>

              {/* Usage preview */}
              {formData.previousMeterReading &&
                formData.currentMeterReading && (
                  <View style={styles.usagePreview}>
                    <MaterialIcons
                      name="trending-up"
                      size={16}
                      color="#e65100"
                    />
                    <Text style={styles.usagePreviewText}>
                      Usage:{" "}
                      {(
                        parseFloat(formData.currentMeterReading) -
                        parseFloat(formData.previousMeterReading)
                      ).toFixed(0)}{" "}
                      kWh
                    </Text>
                  </View>
                )}

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleCreateCycle}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator
                      color={colors.textOnAccent}
                      size="small"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.textOnAccent}
                      />
                      <Text style={styles.submitBtnText}>Create Cycle</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <ModalBottomSpacer />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },

    // HEADER
    header: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerContent: { flex: 1 },
    headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerIconBg: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
    recalcFab: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary || "#4a90d9",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    createFab: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },

    // STATS BAR
    statsBar: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    statItem: { flex: 1, alignItems: "center" },
    statNumber: { fontSize: 20, fontWeight: "800", color: colors.text },
    statLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.divider,
      marginVertical: 2,
    },

    // CYCLES LIST
    cyclesList: { flex: 1, paddingTop: 14 },
    emptyState: { alignItems: "center", paddingVertical: 50 },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptySubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
      textAlign: "center",
    },

    // CYCLE CARD
    cycleCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginBottom: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardAccent: { height: 3, backgroundColor: colors.accent },
    cycleHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    cycleTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cycleId: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: 0.3,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 5,
    },
    statusText: { fontSize: 11, fontWeight: "700" },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 6,
    },
    cycleDate: { fontSize: 12, color: colors.textTertiary, fontWeight: "500" },

    // BILLS GRID
    billsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      gap: 8,
      paddingBottom: 10,
    },
    billCell: {
      width: (SCREEN_WIDTH - 72) / 2,
      backgroundColor: colors.cardAlt,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    billDot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
    billCellLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 2,
    },
    billCellAmount: { fontSize: 14, fontWeight: "700", color: colors.text },

    // METER SECTION
    meterSection: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.cardAlt,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    meterItem: { alignItems: "center" },
    meterLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.textTertiary,
      marginBottom: 2,
    },
    meterValue: { fontSize: 13, fontWeight: "700", color: colors.text },
    meterEquals: { marginHorizontal: 2 },
    meterEqualsText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textTertiary,
    },

    // TOTAL STRIP
    totalStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.successBg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalStripLabel: { fontSize: 13, fontWeight: "600", color: colors.success },
    totalStripAmount: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.success,
    },

    // CARD ACTIONS
    closeCycleBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    closeCycleBtnText: { fontSize: 13, fontWeight: "700", color: "#ef6c00" },
    completedStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      backgroundColor: colors.accentSurface,
    },
    completedStripText: { fontSize: 12, fontWeight: "600", color: "#e65100" },

    // MODAL
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "92%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    modalIconBg: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    modalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },

    // FORM
    formSectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textTertiary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 18,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 6,
    },
    dateInputRow: { flexDirection: "row", alignItems: "flex-end" },
    dateInputGroup: { flex: 1 },
    dateSeparator: { paddingHorizontal: 8, paddingBottom: 12 },
    dateInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.cardAlt,
      gap: 8,
    },
    dateInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    inputRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
    inputHalf: { flex: 1 },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.cardAlt,
    },
    inputPrefix: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.accent,
      marginRight: 4,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    meterInputRow: { flexDirection: "row", alignItems: "flex-end" },
    meterInputGroup: { flex: 1 },
    meterInputArrow: { paddingHorizontal: 8, paddingBottom: 12 },
    meterInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      backgroundColor: colors.cardAlt,
      gap: 6,
    },
    meterInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    meterUnit: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
    usagePreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.accentSurface,
      borderRadius: 8,
    },
    usagePreviewText: { fontSize: 12, fontWeight: "600", color: "#e65100" },

    // MODAL BUTTONS
    modalButtons: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
      marginBottom: 10,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontWeight: "600",
      fontSize: 14,
    },
    submitBtn: {
      flex: 1.5,
      flexDirection: "row",
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      gap: 6,
      shadowColor: "#b38604",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  });

export default AdminBillingCycleScreen;
