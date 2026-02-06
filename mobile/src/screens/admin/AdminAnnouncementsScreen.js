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
  Share,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { announcementService, roomService } from "../../services/apiService";

const REACTION_TYPES = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😠", label: "Angry" },
];

const AdminAnnouncementsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [adminRoom, setAdminRoom] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [userReactions, setUserReactions] = useState({});

  const userId = state?.user?._id;
  const userName = state?.user?.name || "Admin";
  const currentUser = state?.user;

  // Fetch room and announcements when screen comes to focus
  useFocusEffect(
    React.useCallback(() => {
      const fetchRoomAndAnnouncements = async () => {
        try {
          setLoading(true);
          // Get admin's rooms
          const roomsResponse = await roomService.getRooms();
          console.log("Raw roomsResponse:", roomsResponse);

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

          console.log("Parsed rooms:", rooms.length);
          console.log("Current userId:", userId);

          // Find the room created by this admin
          const adminRoom = rooms.find((r) => {
            const isCreatedByAdmin = String(r.createdBy) === String(userId);
            console.log(
              "Room:",
              r.name,
              "createdBy:",
              r.createdBy,
              "isAdmin:",
              isCreatedByAdmin,
            );
            return isCreatedByAdmin;
          });

          if (adminRoom) {
            console.log("Found admin room:", adminRoom.name);
            setAdminRoom(adminRoom);
            // Fetch announcements for this room
            const announcementsResponse =
              await announcementService.getRoomAnnouncements(adminRoom._id);
            const announcements = Array.isArray(announcementsResponse)
              ? announcementsResponse
              : announcementsResponse?.data || [];
            setAnnouncements(announcements);
            // Extract user reactions
            const reactions = {};
            announcements.forEach((ann) => {
              const userReaction = ann.reactions?.find(
                (r) => String(r.user) === String(userId),
              );
              if (userReaction) {
                reactions[ann._id] = userReaction.type;
              }
            });
            setUserReactions(reactions);
          } else {
            console.log("No admin room found");
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          Alert.alert("Error", "Failed to load announcements");
        } finally {
          setLoading(false);
        }
      };

      fetchRoomAndAnnouncements();
    }, [userId]),
  );

  const fetchAnnouncements = async (roomId) => {
    try {
      const response = await announcementService.getRoomAnnouncements(roomId);
      const data = Array.isArray(response) ? response : response?.data || [];
      setAnnouncements(data);
      // Extract user reactions
      const reactions = {};
      data.forEach((ann) => {
        const userReaction = ann.reactions?.find(
          (r) => String(r.user) === String(userId),
        );
        if (userReaction) {
          reactions[ann._id] = userReaction.type;
        }
      });
      setUserReactions(reactions);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      Alert.alert("Error", "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (adminRoom?._id) {
      setRefreshing(true);
      await fetchAnnouncements(adminRoom._id);
      setRefreshing(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!adminRoom?._id) {
      Alert.alert("Error", "Room not loaded yet. Please wait.");
      return;
    }

    try {
      await announcementService.createAnnouncement(
        adminRoom._id,
        title,
        content,
      );
      setTitle("");
      setContent("");
      setShowCreateModal(false);
      await fetchAnnouncements(adminRoom._id);
      Alert.alert("Success", "Announcement created");
    } catch (error) {
      console.error("Error creating announcement:", error);
      Alert.alert("Error", "Failed to create announcement");
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
              await fetchAnnouncements(adminRoom._id);
              Alert.alert("Success", "Announcement deleted");
            } catch (error) {
              Alert.alert("Error", "Failed to delete announcement");
            }
          },
        },
      ],
    );
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      Alert.alert("Error", "Please write a comment");
      return;
    }

    if (!selectedAnnouncement) {
      Alert.alert("Error", "Announcement not selected");
      return;
    }

    try {
      await announcementService.addComment(
        selectedAnnouncement._id,
        commentText,
      );
      setCommentText("");
      setShowCommentModal(false);
      await fetchAnnouncements(adminRoom._id);
      Alert.alert("Success", "Comment added");
    } catch (error) {
      Alert.alert("Error", "Failed to add comment");
    }
  };

  const handleDeleteComment = async (announcementId, commentId) => {
    Alert.alert("Delete", "Delete this comment?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            await announcementService.deleteComment(announcementId, commentId);
            await fetchAnnouncements(adminRoom._id);
          } catch (error) {
            Alert.alert("Error", "Failed to delete comment");
          }
        },
      },
    ]);
  };

  const handleAddReaction = async (announcementId, reactionType) => {
    try {
      await announcementService.addReaction(announcementId, reactionType);
      await fetchAnnouncements(adminRoom._id);
      setShowReactionPicker({});
    } catch (error) {
      Alert.alert("Error", "Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (announcementId) => {
    try {
      await announcementService.removeReaction(announcementId);
      await fetchAnnouncements(adminRoom._id);
    } catch (error) {
      Alert.alert("Error", "Failed to remove reaction");
    }
  };

  const handleShare = async (announcement) => {
    try {
      await Share.share({
        message: `${announcement.title}\n\n${announcement.content}`,
        title: announcement.title,
      });

      // Log share in backend
      await announcementService.shareAnnouncement(announcement._id);
      await fetchAnnouncements(adminRoom._id);
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const toggleComments = (announcementId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [announcementId]: !prev[announcementId],
    }));
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#b38604" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Room Announcements</Text>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.createButton}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const showComments = expandedComments[item._id];
          const userReaction = userReactions[item._id];
          const reactionCounts = {};
          const totalReactions = item.reactions?.length || 0;

          item.reactions?.forEach((reaction) => {
            reactionCounts[reaction.type] =
              (reactionCounts[reaction.type] || 0) + 1;
          });

          return (
            <View style={styles.postCard}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <View style={styles.creatorInfo}>
                  {item.createdBy?.avatar?.url ? (
                    <Image
                      source={{ uri: item.createdBy.avatar.url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.creatorName?.[0]?.toUpperCase() || "A"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.creatorDetails}>
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
                    <MaterialIcons name="more-vert" size={20} color="#666" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Post Title & Content */}
              <View style={styles.postContent}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.content}>{item.content}</Text>
              </View>

              {/* Reactions & Shares Summary */}
              {(totalReactions > 0 || (item.shares?.length || 0) > 0) && (
                <View style={styles.statsBar}>
                  {totalReactions > 0 && (
                    <View style={styles.reactionStats}>
                      {Object.entries(reactionCounts)
                        .slice(0, 3)
                        .map(([type]) => {
                          const reaction = REACTION_TYPES.find(
                            (r) => r.type === type,
                          );
                          return (
                            <Text key={type} style={styles.reactionEmoji}>
                              {reaction?.emoji}
                            </Text>
                          );
                        })}
                      <Text style={styles.reactionCount}>{totalReactions}</Text>
                    </View>
                  )}
                  {(item.shares?.length || 0) > 0 && (
                    <Text style={styles.shareCount}>
                      {item.shares.length} shares
                    </Text>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionBar}>
                {/* React Button */}
                <View style={styles.actionButtonGroup}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      if (userReaction) {
                        handleRemoveReaction(item._id);
                      } else {
                        setShowReactionPicker((prev) => ({
                          ...prev,
                          [item._id]: !prev[item._id],
                        }));
                      }
                    }}
                  >
                    <Text style={styles.actionButtonEmoji}>
                      {userReaction
                        ? REACTION_TYPES.find((r) => r.type === userReaction)
                            ?.emoji || "👍"
                        : "👍"}
                    </Text>
                    <Text
                      style={[
                        styles.actionButtonText,
                        userReaction && styles.reacted,
                      ]}
                    >
                      {userReaction ? "Unlike" : "Like"}
                    </Text>
                  </TouchableOpacity>

                  {/* Reaction Picker */}
                  {showReactionPicker[item._id] && (
                    <View style={styles.reactionPickerContainer}>
                      {REACTION_TYPES.map((reaction) => (
                        <TouchableOpacity
                          key={reaction.type}
                          style={styles.reactionOption}
                          onPress={() =>
                            handleAddReaction(item._id, reaction.type)
                          }
                        >
                          <Text style={styles.reactionOptionEmoji}>
                            {reaction.emoji}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Comment Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    setSelectedAnnouncement(item);
                    setShowCommentModal(true);
                  }}
                >
                  <MaterialIcons name="comment" size={18} color="#65676b" />
                  <Text style={styles.actionButtonText}>Comment</Text>
                </TouchableOpacity>

                {/* Share Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleShare(item)}
                >
                  <MaterialIcons name="share" size={18} color="#65676b" />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Comments Section */}
              {item.comments && item.comments.length > 0 && (
                <View style={styles.commentsContainer}>
                  {/* View Comments Toggle */}
                  {!showComments && item.comments.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewCommentsButton}
                      onPress={() => toggleComments(item._id)}
                    >
                      <Text style={styles.viewCommentsText}>
                        View {item.comments.length} comment
                        {item.comments.length > 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Show Comments */}
                  {showComments && (
                    <View style={styles.commentsList}>
                      {item.comments.map((comment) => (
                        <View key={comment._id} style={styles.comment}>
                          {comment.user?.avatar?.url ? (
                            <Image
                              source={{ uri: comment.user.avatar.url }}
                              style={styles.commentAvatar}
                            />
                          ) : (
                            <View style={styles.commentAvatar}>
                              <Text style={styles.commentAvatarText}>
                                {comment.userName?.[0]?.toUpperCase() || "U"}
                              </Text>
                            </View>
                          )}
                          <View style={styles.commentContent}>
                            <View style={styles.commentHeader}>
                              <Text style={styles.commentAuthor}>
                                {comment.userName}
                              </Text>
                              {String(comment.user) === String(userId) && (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleDeleteComment(item._id, comment._id)
                                  }
                                >
                                  <MaterialIcons
                                    name="close"
                                    size={14}
                                    color="#999"
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={styles.commentText}>
                              {comment.text}
                            </Text>
                            <Text style={styles.commentDate}>
                              {new Date(comment.createdAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Hide Comments Toggle */}
                  {showComments && item.comments.length > 2 && (
                    <TouchableOpacity
                      style={styles.viewCommentsButton}
                      onPress={() => toggleComments(item._id)}
                    >
                      <Text style={styles.viewCommentsText}>Hide comments</Text>
                    </TouchableOpacity>
                  )}

                  {/* Add Comment Button */}
                  <TouchableOpacity
                    style={styles.addCommentPrompt}
                    onPress={() => {
                      setSelectedAnnouncement(item);
                      setShowCommentModal(true);
                    }}
                  >
                    <View style={styles.commentInputAvatar}>
                      {currentUser?.avatar?.url ? (
                        <Image
                          source={{ uri: currentUser.avatar.url }}
                          style={styles.addCommentAvatar}
                        />
                      ) : (
                        <View style={styles.commentAvatar}>
                          <Text style={styles.commentAvatarText}>
                            {userName[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.commentInputPlaceholder}>
                      Write a comment...
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* No Comments yet - Show comment input */}
              {(!item.comments || item.comments.length === 0) && (
                <TouchableOpacity
                  style={styles.addCommentPrompt}
                  onPress={() => {
                    setSelectedAnnouncement(item);
                    setShowCommentModal(true);
                  }}
                >
                  <View style={styles.commentInputAvatar}>
                    {currentUser?.avatar?.url ? (
                      <Image
                        source={{ uri: currentUser.avatar.url }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>
                          {userName[0]?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.commentInputPlaceholder}>
                    Write a comment...
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bullhorn" size={48} color="#bbb" />
            <Text style={styles.emptyText}>No announcements yet</Text>
            <Text style={styles.emptySubtext}>Tap + to create one</Text>
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

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity onPress={() => setShowCommentModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={5}
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddComment}
              >
                <Text style={styles.submitButtonText}>Post Comment</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0a66c2",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  listContent: {
    paddingTop: 12,
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  postCard: {
    backgroundColor: "#fff",
    marginHorizontal: 8,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
    overflow: "hidden",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e4e6eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  creatorDetails: {
    flex: 1,
  },
  creatorName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    marginBottom: 2,
  },
  createdAt: {
    fontSize: 12,
    color: "#65676b",
  },
  postContent: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
    lineHeight: 20,
  },
  content: {
    fontSize: 14,
    color: "#050505",
    lineHeight: 20,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  reactionStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  reactionEmoji: {
    marginRight: -6,
    fontSize: 15,
  },
  reactionCount: {
    fontSize: 13,
    color: "#65676b",
    marginLeft: 4,
    fontWeight: "500",
  },
  shareCount: {
    fontSize: 13,
    color: "#65676b",
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: "space-around",
  },
  actionButtonGroup: {
    flex: 1,
    position: "relative",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionButtonEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 13,
    color: "#65676b",
    fontWeight: "600",
  },
  reacted: {
    color: "#0a66c2",
    fontWeight: "700",
  },
  reactionPickerContainer: {
    position: "absolute",
    bottom: 45,
    left: 0,
    backgroundColor: "#fff",
    flexDirection: "row",
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  reactionOption: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionOptionEmoji: {
    fontSize: 28,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
  },
  commentsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viewCommentsButton: {
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  viewCommentsText: {
    fontSize: 13,
    color: "#0a66c2",
    fontWeight: "600",
  },
  commentsList: {
    marginBottom: 12,
    marginTop: 8,
  },
  comment: {
    flexDirection: "row",
    marginBottom: 14,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e4e6eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 2,
  },
  addCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e4e6eb",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0a66c2",
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  commentText: {
    fontSize: 13,
    color: "#050505",
    backgroundColor: "#e4e6eb",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    lineHeight: 18,
  },
  commentDate: {
    fontSize: 12,
    color: "#65676b",
    marginTop: 6,
  },
  addCommentPrompt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginTop: 8,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0a66c2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  commentInputAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  commentInputPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: "#65676b",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f0f2f5",
    borderRadius: 18,
    fontWeight: "500",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#65676b",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#b0b1b5",
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
  },
  modalBody: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#000",
    marginBottom: 16,
    backgroundColor: "#f8f9f9",
  },
  contentInput: {
    textAlignVertical: "top",
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: "#0a66c2",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
    shadowColor: "#0a66c2",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default AdminAnnouncementsScreen;
