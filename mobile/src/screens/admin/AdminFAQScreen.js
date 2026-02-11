import React, { useState, useEffect, useMemo} from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const GOLD = "#b38604";
const BG = "#f5f6fa";
const TEXT = "#1a1a2e";
const CARD = "#fff";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

const getCategoryColor = (category) => {
  switch (category) {
    case "billing": return "#3b82f6";
    case "payment": return "#10b981";
    case "technical": return "#ef4444";
    case "general": return "#f59e0b";
    case "room": return "#8b5cf6";
    default: return "#6b7280";
  }
};

const getCategoryIcon = (category) => {
  switch (category) {
    case "billing": return "receipt-outline";
    case "payment": return "card-outline";
    case "technical": return "construct-outline";
    case "general": return "information-circle-outline";
    case "room": return "bed-outline";
    default: return "help-circle-outline";
  }
};

const AdminFAQScreen = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "general",
    order: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = ["billing", "payment", "technical", "general", "room"];

  useEffect(() => {
    fetchAllFAQs();
  }, []);

  const fetchAllFAQs = async () => {
    setLoading(true);
    try {
      const response = await supportService.getAdminFAQs();
      setFaqs(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      Alert.alert("Error", "Failed to load FAQs");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await supportService.getAdminFAQs();
      setFaqs(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateNew = () => {
    setEditingFAQ(null);
    setFormData({
      question: "",
      answer: "",
      category: "general",
      order: faqs.length,
    });
    setModalVisible(true);
  };

  const handleEditFAQ = (faq) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      order: faq.order || 0,
    });
    setModalVisible(true);
  };

  const handleSaveFAQ = async () => {
    if (!formData.question.trim() || !formData.answer.trim()) {
      Alert.alert("Validation", "Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      if (editingFAQ) {
        await supportService.updateFAQ(editingFAQ.id || editingFAQ._id, formData);
        setFaqs(
          faqs.map((f) =>
            (f.id || f._id) === (editingFAQ.id || editingFAQ._id)
              ? { ...f, ...formData }
              : f,
          ),
        );
        Alert.alert("Success", "FAQ updated successfully");
      } else {
        const newFAQ = await supportService.createFAQ(formData);
        setFaqs([...faqs, newFAQ?.data || newFAQ]);
        Alert.alert("Success", "FAQ created successfully");
      }
      setModalVisible(false);
    } catch (error) {
      console.error("Error saving FAQ:", error);
      Alert.alert("Error", "Failed to save FAQ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFAQ = (faqId) => {
    Alert.alert("Delete FAQ", "Are you sure you want to delete this FAQ?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await supportService.deleteFAQ(faqId);
            setFaqs(faqs.filter((f) => (f.id || f._id) !== faqId));
            Alert.alert("Success", "FAQ deleted successfully");
          } catch (error) {
            Alert.alert("Error", "Failed to delete FAQ");
          }
        },
      },
    ]);
  };

  const filteredFAQs =
    categoryFilter === "all"
      ? faqs
      : faqs.filter((f) => f.category === categoryFilter);

  const categoryStats = {
    all: faqs.length,
    ...categories.reduce((acc, cat) => {
      acc[cat] = faqs.filter((f) => f.category === cat).length;
      return acc;
    }, {}),
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <View style={styles.loadingIconWrap}>
          <Ionicons name="help-circle-outline" size={32} color={GOLD} />
        </View>
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{faqs.length}</Text>
          <Text style={styles.summaryLabel}>Total FAQs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{categories.length}</Text>
          <Text style={styles.summaryLabel}>Categories</Text>
        </View>
        <View style={styles.summaryDivider} />
        <TouchableOpacity style={styles.createBtn} onPress={handleCreateNew} activeOpacity={0.8}>
          <View style={styles.createBtnIcon}>
            <Ionicons name="add" size={20} color={colors.textOnAccent} />
          </View>
          <Text style={styles.createBtnText}>New FAQ</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.filterChip, categoryFilter === "all" && styles.filterChipActive]}
          onPress={() => setCategoryFilter("all")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="grid-outline"
            size={13}
            color={categoryFilter === "all" ? "#fff" : MUTED}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.filterChipText, categoryFilter === "all" && styles.filterChipTextActive]}>
            All ({categoryStats.all})
          </Text>
        </TouchableOpacity>

        {categories.map((category) => {
          const active = categoryFilter === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setCategoryFilter(category)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={getCategoryIcon(category)}
                size={13}
                color={active ? "#fff" : MUTED}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {category.charAt(0).toUpperCase() + category.slice(1)} ({categoryStats[category]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FAQ List */}
      <FlatList
        data={filteredFAQs}
        keyExtractor={(item) => item.id || item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD]} tintColor={GOLD} />
        }
        renderItem={({ item }) => {
          const catColor = getCategoryColor(item.category);
          return (
            <View style={styles.faqCard}>
              {/* Category accent */}
              <View style={[styles.cardAccent, { backgroundColor: catColor }]} />

              <View style={styles.cardBody}>
                {/* Question & Answer */}
                <View style={styles.faqContent}>
                  <View style={styles.qRow}>
                    <View style={[styles.qIcon, { backgroundColor: GOLD + "15" }]}>
                      <Ionicons name="help" size={14} color={GOLD} />
                    </View>
                    <Text style={styles.faqQuestion} numberOfLines={2}>{item.question}</Text>
                  </View>
                  <View style={styles.aRow}>
                    <View style={[styles.qIcon, { backgroundColor: "#10b981" + "15" }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={13} color="#10b981" />
                    </View>
                    <Text style={styles.faqAnswer} numberOfLines={2}>{item.answer}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.faqActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleEditFAQ(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={18} color={GOLD} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteActionBtn]}
                    onPress={() => handleDeleteFAQ(item.id || item._id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardSeparator} />

                {/* Meta Row */}
                <View style={styles.cardMetaRow}>
                  <View style={[styles.categoryChip, { backgroundColor: catColor + "15" }]}>
                    <Ionicons name={getCategoryIcon(item.category)} size={12} color={catColor} />
                    <Text style={[styles.categoryChipText, { color: catColor }]}>
                      {item.category?.charAt(0).toUpperCase() + item.category?.slice(1)}
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Ionicons name="eye-outline" size={13} color={MUTED} />
                      <Text style={styles.statText}>{item.views || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="thumbs-up-outline" size={13} color="#10b981" />
                      <Text style={[styles.statText, { color: "#10b981" }]}>{item.helpful || 0}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="thumbs-down-outline" size={13} color="#ef4444" />
                      <Text style={[styles.statText, { color: "#ef4444" }]}>{item.notHelpful || 0}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="help-circle-outline" size={40} color={GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No FAQs Found</Text>
            <Text style={styles.emptySub}>Create one using the button above</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name={editingFAQ ? "create-outline" : "add-circle-outline"}
                  size={22}
                  color={GOLD}
                />
              </View>
              <Text style={styles.modalTitle}>
                {editingFAQ ? "Edit FAQ" : "Create New FAQ"}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={22} color={MUTED} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {/* Question */}
              <View style={styles.formSection}>
                <View style={styles.formLabelRow}>
                  <View style={styles.formLabelIcon}>
                    <Ionicons name="help-circle-outline" size={14} color={GOLD} />
                  </View>
                  <Text style={styles.formLabel}>Question *</Text>
                </View>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter the question"
                  placeholderTextColor={colors.placeholder}
                  value={formData.question}
                  onChangeText={(text) => setFormData({ ...formData, question: text })}
                  editable={!submitting}
                />
              </View>

              {/* Answer */}
              <View style={styles.formSection}>
                <View style={styles.formLabelRow}>
                  <View style={styles.formLabelIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={GOLD} />
                  </View>
                  <Text style={styles.formLabel}>Answer *</Text>
                </View>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  placeholder="Enter the answer"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={5}
                  value={formData.answer}
                  onChangeText={(text) => setFormData({ ...formData, answer: text })}
                  textAlignVertical="top"
                  editable={!submitting}
                />
              </View>

              {/* Category */}
              <View style={styles.formSection}>
                <View style={styles.formLabelRow}>
                  <View style={styles.formLabelIcon}>
                    <Ionicons name="folder-outline" size={14} color={GOLD} />
                  </View>
                  <Text style={styles.formLabel}>Category</Text>
                </View>
                <View style={styles.categoryPicker}>
                  {categories.map((category) => {
                    const active = formData.category === category;
                    const catCol = getCategoryColor(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.categoryPickerItem,
                          active && { backgroundColor: catCol, borderColor: catCol },
                        ]}
                        onPress={() => setFormData({ ...formData, category })}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={getCategoryIcon(category)}
                          size={14}
                          color={active ? "#fff" : catCol}
                        />
                        <Text style={[styles.categoryPickerText, active && { color: colors.textOnAccent }]}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Display Order */}
              <View style={styles.formSection}>
                <View style={styles.formLabelRow}>
                  <View style={styles.formLabelIcon}>
                    <Ionicons name="reorder-three-outline" size={14} color={GOLD} />
                  </View>
                  <Text style={styles.formLabel}>Display Order</Text>
                </View>
                <TextInput
                  style={[styles.formInput, { width: 80 }]}
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={formData.order.toString()}
                  onChangeText={(text) => setFormData({ ...formData, order: parseInt(text) || 0 })}
                  editable={!submitting}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSaveFAQ}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnAccent} size="small" />
                ) : (
                  <>
                    <Ionicons name={editingFAQ ? "checkmark-circle" : "add-circle"} size={20} color={colors.textOnAccent} />
                    <Text style={styles.saveBtnText}>
                      {editingFAQ ? "Update FAQ" : "Create FAQ"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Delete Button (if editing) */}
              {editingFAQ && (
                <TouchableOpacity
                  style={styles.deleteBtnModal}
                  onPress={() => {
                    setModalVisible(false);
                    handleDeleteFAQ(editingFAQ.id || editingFAQ._id);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  <Text style={styles.deleteBtnText}>Delete This FAQ</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  loadingIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: GOLD + "15", justifyContent: "center", alignItems: "center",
  },
  loadingText: { marginTop: 12, color: MUTED, fontSize: 14 },

  /* Summary */
  summaryStrip: {
    flexDirection: "row", backgroundColor: CARD, marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, fontWeight: "800", color: GOLD },
  summaryLabel: { fontSize: 11, color: MUTED, marginTop: 2, fontWeight: "500" },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: BORDER },
  createBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  createBtnIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: GOLD, justifyContent: "center", alignItems: "center",
  },
  createBtnText: { fontSize: 13, fontWeight: "700", color: GOLD },

  /* Filters */
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  filterChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  filterChipText: { fontSize: 12, color: MUTED, fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },

  /* FAQ Cards */
  faqCard: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 10, borderRadius: 14,
    backgroundColor: CARD, overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  faqContent: { flex: 1, marginBottom: 4 },
  qRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  aRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  qIcon: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 1,
  },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: "700", color: TEXT, lineHeight: 20 },
  faqAnswer: { flex: 1, fontSize: 13, color: MUTED, lineHeight: 18 },
  faqActions: {
    position: "absolute", top: 10, right: 10, flexDirection: "row", gap: 4,
  },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: GOLD + "12", justifyContent: "center", alignItems: "center",
  },
  deleteActionBtn: {
    backgroundColor: "#ef4444" + "12",
  },
  cardSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginVertical: 10 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categoryChip: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, gap: 4,
  },
  categoryChipText: { fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 11, color: MUTED, fontWeight: "600" },

  /* Empty */
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: GOLD + "15", justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  emptySub: { fontSize: 13, color: MUTED, marginTop: 4 },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", padding: 16,
  },
  modalCard: {
    width: "100%", maxHeight: "90%", backgroundColor: CARD, borderRadius: 18, overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
  },
  modalIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: GOLD + "15", justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: TEXT },
  modalClose: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.background, justifyContent: "center", alignItems: "center",
  },
  modalBody: { paddingHorizontal: 16, paddingTop: 14 },

  /* Form */
  formSection: { marginBottom: 18 },
  formLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
  formLabelIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: GOLD + "15", justifyContent: "center", alignItems: "center",
  },
  formLabel: { fontSize: 13, fontWeight: "700", color: TEXT },
  formInput: {
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: TEXT, backgroundColor: colors.background,
  },
  formTextarea: { minHeight: 100, textAlignVertical: "top" },
  categoryPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryPickerItem: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: colors.background, gap: 6,
  },
  categoryPickerText: { fontSize: 12, color: MUTED, fontWeight: "600" },

  /* Save Button */
  saveBtn: {
    flexDirection: "row", backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  deleteBtnModal: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 12, borderWidth: 1.5,
    borderColor: colors.error, marginTop: 12, gap: 8,
  },
  deleteBtnText: { color: colors.error, fontSize: 14, fontWeight: "700" },
});

export default AdminFAQScreen;
