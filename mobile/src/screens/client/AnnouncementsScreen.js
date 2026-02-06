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
import { MaterialIcons } from "@expo/vector-icons";
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

const AnnouncementsScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
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
  const userName = state?.user?.name || "User";
  const currentUser = state?.user;

  // Fetch room and announcements when screen comes to focus
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;

      const fetchRoomAndAnnouncements = async () => {
        try {
          setLoading(true);
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
            await fetchAnnouncements(joined._id);
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

      // Mark all as read
      for (const announcement of data) {
        try {
          await announcementService.markAsRead(announcement._id);
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      }

      // Load user reactions
      const reactions = {};
      for (const announcement of data) {
        const userReaction = announcement.reactions?.find(
          (r) => String(r.user?._id || r.user) === String(userId),
        );
        if (userReaction) {
          reactions[announcement._id] = userReaction.type;
        }
      }
      setUserReactions(reactions);
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
        { text: "Cancel" },
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
    Alert.alert("Delete", "Delete this comment?", [
      { text: "Cancel" },
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

  const handleAddReaction = async (announcementId, reactionType) => {
    try {
      await announcementService.addReaction(announcementId, reactionType);
      await fetchAnnouncements(userJoinedRoom._id);
      setShowReactionPicker({});
    } catch (error) {
      Alert.alert("Error", "Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (announcementId) => {
    try {
      await announcementService.removeReaction(announcementId);
      await fetchAnnouncements(userJoinedRoom._id);
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
      await fetchAnnouncements(userJoinedRoom._id);
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
                            {userName?.[0]?.toUpperCase() || "U"}
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
    backgroundColor: "#f0f2f5",
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
    borderBottomColor: "#e4e6eb",
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
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
    padding: 8,
    paddingBottom: 20,
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e4e6eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    borderColor: "#e4e6eb",
    borderWidth: 1,
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
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  createdAt: {
    fontSize: 11,
    color: "#65676b",
    marginTop: 2,
  },
  postContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6,
  },
  content: {
    fontSize: 14,
    color: "#050505",
    lineHeight: 20,
  },
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e6eb",
  },
  reactionStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  reactionEmoji: {
    marginRight: -6,
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: "#65676b",
    marginLeft: 12,
  },
  shareCount: {
    fontSize: 12,
    color: "#65676b",
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  actionButtonGroup: {
    flex: 1,
    position: "relative",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButtonText: {
    fontSize: 13,
    color: "#65676b",
    fontWeight: "500",
  },
  reacted: {
    color: "#b38604",
    fontWeight: "600",
  },
  reactionPickerContainer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  reactionOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  reactionOptionEmoji: {
    fontSize: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "#e4e6eb",
  },
  commentsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewCommentsButton: {
    paddingVertical: 8,
  },
  viewCommentsText: {
    fontSize: 12,
    color: "#65676b",
    fontWeight: "500",
  },
  commentsList: {
    marginVertical: 8,
  },
  comment: {
    flexDirection: "row",
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e4e6eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 4,
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
    fontWeight: "600",
    color: "#65676b",
  },
  commentContent: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000",
  },
  commentText: {
    fontSize: 12,
    color: "#050505",
    lineHeight: 16,
    marginBottom: 4,
  },
  commentDate: {
    fontSize: 11,
    color: "#65676b",
  },
  addCommentPrompt: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: "#e4e6eb",
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#b38604",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  commentInputAvatarText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  commentInputPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: "#65676b",
    backgroundColor: "#f0f2f5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
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
