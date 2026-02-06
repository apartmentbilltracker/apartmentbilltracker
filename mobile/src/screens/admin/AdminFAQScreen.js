import React, { useState, useEffect } from "react";
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
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { supportService } from "../../services/apiService";

const AdminFAQScreen = () => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
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
        // Update FAQ
        await supportService.updateFAQ(editingFAQ._id, formData);
        setFaqs(
          faqs.map((f) =>
            f._id === editingFAQ._id ? { ...f, ...formData } : f,
          ),
        );
        Alert.alert("Success", "FAQ updated successfully");
      } else {
        // Create FAQ
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
            setFaqs(faqs.filter((f) => f._id !== faqId));
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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#27ae60" />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>FAQ Management</Text>
          <Text style={styles.headerSubtitle}>Create and manage FAQs</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
      >
        <TouchableOpacity
          style={[
            styles.filterTab,
            categoryFilter === "all" && styles.filterTabActive,
          ]}
          onPress={() => setCategoryFilter("all")}
        >
          <Text
            style={[
              styles.filterTabText,
              categoryFilter === "all" && styles.filterTabTextActive,
            ]}
          >
            All ({categoryStats.all})
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterTab,
              categoryFilter === category && styles.filterTabActive,
            ]}
            onPress={() => setCategoryFilter(category)}
          >
            <Text
              style={[
                styles.filterTabText,
                categoryFilter === category && styles.filterTabTextActive,
              ]}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)} (
              {categoryStats[category]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FAQs List */}
      <FlatList
        data={filteredFAQs}
        keyExtractor={(item) => item._id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.faqCard}>
            <View style={styles.faqHeader}>
              <View style={styles.faqTitleSection}>
                <Text style={styles.faqQuestion} numberOfLines={2}>
                  Q: {item.question}
                </Text>
                <Text style={styles.faqAnswer} numberOfLines={2}>
                  A: {item.answer}
                </Text>
              </View>
              <View style={styles.faqActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEditFAQ(item)}
                >
                  <MaterialIcons name="edit" size={18} color="#0a66c2" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteFAQ(item._id)}
                >
                  <MaterialIcons name="delete" size={18} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.faqMeta}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: getCategoryColor(item.category) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.categoryBadgeText,
                    { color: getCategoryColor(item.category) },
                  ]}
                >
                  {item.category.charAt(0).toUpperCase() +
                    item.category.slice(1)}
                </Text>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.stat}>
                  <MaterialIcons name="visibility" size={14} color="#666" />
                  <Text style={styles.statText}>{item.views || 0}</Text>
                </View>
                <View style={styles.stat}>
                  <MaterialIcons name="thumb-up" size={14} color="#27ae60" />
                  <Text style={styles.statText}>{item.helpful || 0}</Text>
                </View>
                <View style={styles.stat}>
                  <MaterialIcons name="thumb-down" size={14} color="#e74c3c" />
                  <Text style={styles.statText}>{item.notHelpful || 0}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No FAQs found</Text>}
      />

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFAQ ? "Edit FAQ" : "Create New FAQ"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={26} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Question Input */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Question *</Text>
                <TextInput
                  style={[styles.input, styles.questionInput]}
                  placeholder="Enter the question"
                  placeholderTextColor="#999"
                  value={formData.question}
                  onChangeText={(text) =>
                    setFormData({ ...formData, question: text })
                  }
                  editable={!submitting}
                />
              </View>

              {/* Answer Input */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Answer *</Text>
                <TextInput
                  style={[styles.input, styles.answerInput]}
                  placeholder="Enter the answer"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={5}
                  value={formData.answer}
                  onChangeText={(text) =>
                    setFormData({ ...formData, answer: text })
                  }
                  textAlignVertical="top"
                  editable={!submitting}
                />
              </View>

              {/* Category Select */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryPicker}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryOption,
                        formData.category === category &&
                          styles.categoryOptionActive,
                      ]}
                      onPress={() => setFormData({ ...formData, category })}
                    >
                      <Text
                        style={[
                          styles.categoryOptionText,
                          formData.category === category &&
                            styles.categoryOptionTextActive,
                        ]}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Order Input */}
              <View style={styles.formSection}>
                <Text style={styles.label}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={formData.order.toString()}
                  onChangeText={(text) =>
                    setFormData({ ...formData, order: parseInt(text) || 0 })
                  }
                  editable={!submitting}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  submitting && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveFAQ}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={18} color="#fff" />
                    <Text style={styles.saveButtonText}>
                      {editingFAQ ? "Update FAQ" : "Create FAQ"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Delete Button (if editing) */}
              {editingFAQ && (
                <TouchableOpacity
                  style={styles.deleteConfirmButton}
                  onPress={() => {
                    setModalVisible(false);
                    handleDeleteFAQ(editingFAQ._id);
                  }}
                >
                  <MaterialIcons name="delete" size={18} color="#fff" />
                  <Text style={styles.deleteConfirmButtonText}>Delete FAQ</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getCategoryColor = (category) => {
  switch (category) {
    case "billing":
      return "#0a66c2";
    case "payment":
      return "#27ae60";
    case "technical":
      return "#e74c3c";
    case "general":
      return "#f39c12";
    case "room":
      return "#9b59b6";
    default:
      return "#95a5a6";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#27ae60",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  createButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f8f9fa",
  },
  filterTabActive: {
    backgroundColor: "#27ae60",
    borderColor: "#27ae60",
  },
  filterTabText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  faqCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#27ae60",
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  faqTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a202c",
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  faqActions: {
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  faqMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
    fontSize: 14,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formSection: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#f8f9fa",
  },
  questionInput: {
    minHeight: 40,
  },
  answerInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  categoryPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f8f9fa",
  },
  categoryOptionActive: {
    backgroundColor: "#27ae60",
    borderColor: "#27ae60",
  },
  categoryOptionText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "600",
  },
  categoryOptionTextActive: {
    color: "#fff",
  },
  saveButton: {
    flexDirection: "row",
    backgroundColor: "#27ae60",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  deleteConfirmButton: {
    flexDirection: "row",
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  deleteConfirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default AdminFAQScreen;
