import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { announcementService, roomService } from "../../services/apiService";

const AnnouncementsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");

  const userId = state?.user?._id;
  const userName = state?.user?.name || "User";

  // Fetch room and announcements when screen comes to focus
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;

      const fetchRoomAndAnnouncements = async () => {
        try {
          setLoading(true);
          // Get user's joined room
          const roomsResponse = await roomService.getClientRooms();

          let rooms = [];
          if (Array.isArray(roomsResponse)) {
            rooms = roomsResponse;
          } else if (roomsResponse?.data) {
            rooms = Array.isArray(roomsResponse.data)
              ? roomsResponse.data
              : [roomsResponse.data];
          } else if (roomsResponse?.rooms) {
            rooms = Array.isArray(roomsResponse.rooms)
              ? roomsResponse.rooms
              : [roomsResponse.rooms];
          }

          const joined = rooms.find((r) => {
            const isMember = r.members?.some(
              (m) => String(m.user?._id || m.user) === String(userId),
            );
            return isMember;
          });

          if (!isMounted) return;

          if (joined) {
            setUserJoinedRoom(joined);
            // Fetch announcements for this room
            const announcementsResponse =
              await announcementService.getRoomAnnouncements(joined._id);
            const announcements = Array.isArray(announcementsResponse)
              ? announcementsResponse
              : announcementsResponse?.data || [];
            if (isMounted) {
              setAnnouncements(announcements);
            }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchRoomAndAnnouncements();

      return () => {
        isMounted = false;
      };
    }, [userId]),
  );

  const fetchAnnouncements = async (roomId) => {
    try {
      const response = await announcementService.getRoomAnnouncements(roomId);
      const data = Array.isArray(response) ? response : response?.data || [];
      setAnnouncements(data);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      Alert.alert("Error", "Failed to load announcements");
    }
  };

  const onRefresh = async () => {
    if (userJoinedRoom) {
      setRefreshing(true);
      await fetchAnnouncements(userJoinedRoom._id);
      setRefreshing(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await announcementService.createAnnouncement(
        userJoinedRoom._id,
        title,
        content,
      );
      setTitle("");
      setContent("");
      setShowCreateModal(false);
      await fetchAnnouncements(userJoinedRoom._id);
      Alert.alert("Success", "Announcement created");
    } catch (error) {
      console.error("Error creating announcement:", error);
      Alert.alert("Error", "Failed to create announcement");
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert("Error", "Please enter a comment");
      return;
    }

    try {
      await announcementService.addComment(
        selectedAnnouncement._id,
        commentText,
      );
      setCommentText("");
      setShowCommentModal(false);
      await fetchAnnouncements(userJoinedRoom._id);
      Alert.alert("Success", "Comment added");
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    Alert.alert(
      "Delete",
      "Are you sure you want to delete this announcement?",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            try {
              await announcementService.deleteAnnouncement(announcementId);
              await fetchAnnouncements(userJoinedRoom._id);
              Alert.alert("Success", "Announcement deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete announcement");
            }
          },
        },
      ],
    );
  };

  const handleDeleteComment = async (announcementId, commentId) => {
    Alert.alert("Delete", "Are you sure you want to delete this comment?", [
      { text: "Cancel", onPress: () => {} },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await announcementService.deleteComment(announcementId, commentId);
            await fetchAnnouncements(userJoinedRoom._id);
          } catch (error) {
            Alert.alert("Error", "Failed to delete comment");
          }
        },
      },
    ]);
  };

  const isAdmin =
    userJoinedRoom && String(userJoinedRoom.createdBy) === String(userId);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#b38604" />
      </View>
    );
  }

  if (!userJoinedRoom) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>You haven't joined a room yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Room Announcements</Text>
        {isAdmin && (
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            style={styles.createButton}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.announcementCard}>
            <View style={styles.announcementHeader}>
              <View style={styles.creatorInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.creatorName?.[0]?.toUpperCase() || "A"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.creatorName}>{item.creatorName}</Text>
                  <Text style={styles.createdAt}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              {String(item.createdBy) === String(userId) && (
                <TouchableOpacity
                  onPress={() => handleDeleteAnnouncement(item._id)}
                >
                  <MaterialIcons name="delete" size={20} color="#e74c3c" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.content}>{item.content}</Text>

            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>
                Comments ({item.comments?.length || 0})
              </Text>

              {item.comments && item.comments.length > 0 ? (
                <View style={styles.commentsList}>
                  {item.comments.map((comment) => (
                    <View key={comment._id} style={styles.commentItem}>
                      <View style={styles.commentHeader}>
                        <View>
                          <Text style={styles.commentAuthor}>
                            {comment.userName}
                          </Text>
                          <Text style={styles.commentDate}>
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        {String(comment.user) === String(userId) && (
                          <TouchableOpacity
                            onPress={() =>
                              handleDeleteComment(item._id, comment._id)
                            }
                          >
                            <MaterialIcons
                              name="delete"
                              size={16}
                              color="#e74c3c"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.commentText}>{comment.text}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.noComments}>No comments yet</Text>
              )}

              <TouchableOpacity
                onPress={() => {
                  setSelectedAnnouncement(item);
                  setShowCommentModal(true);
                }}
                style={styles.addCommentButton}
              >
                <MaterialIcons name="comment" size={16} color="#b38604" />
                <Text style={styles.addCommentText}>Add Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="info-outline" size={48} color="#bbb" />
            <Text style={styles.emptyText}>No announcements yet</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Create Announcement Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Announcement</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Announcement Title"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#999"
              />
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Announcement Content"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateAnnouncement}
              >
                <Text style={styles.submitButtonText}>Create Announcement</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smallModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={4}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddComment}
              >
                <Text style={styles.submitButtonText}>Post Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#b38604",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 12,
  },
  announcementCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  announcementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#b38604",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  createdAt: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  commentsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  commentsList: {
    marginBottom: 10,
  },
  commentItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  commentDate: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  commentText: {
    fontSize: 12,
    color: "#555",
    lineHeight: 16,
  },
  noComments: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 10,
  },
  addCommentButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  addCommentText: {
    fontSize: 13,
    color: "#b38604",
    fontWeight: "500",
    marginLeft: 6,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: "80%",
  },
  smallModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginBottom: 12,
    backgroundColor: "#f8f9fa",
  },
  contentInput: {
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#b38604",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default AnnouncementsScreen;
