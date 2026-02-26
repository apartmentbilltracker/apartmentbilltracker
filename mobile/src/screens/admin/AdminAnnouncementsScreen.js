import React, { useContext, useEffect, useState, useMemo } from "react";
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
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { announcementService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const REACTION_TYPES = [
  { type: "like", emoji: "\uD83D\uDC4D", label: "Like" },
  { type: "love", emoji: "\u2764\uFE0F", label: "Love" },
  { type: "haha", emoji: "\uD83D\uDE02", label: "Haha" },
  { type: "wow", emoji: "\uD83D\uDE2E", label: "Wow" },
  { type: "sad", emoji: "\uD83D\uDE22", label: "Sad" },
  { type: "angry", emoji: "\uD83D\uDE20", label: "Angry" },
];

const AdminAnnouncementsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

  const userId = state?.user?.id || state?.user?._id;
  const userName = state?.user?.name || "Admin";
  const currentUser = state?.user;

  useFocusEffect(
    React.useCallback(() => {
      const fetchRoomAndAnnouncements = async () => {
        try {
          setLoading(true);
          const roomsResponse = await roomService.getRooms();

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

          const foundRoom = rooms.find((r) => {
            const roomCreator = r.created_by || r.createdBy;
            return String(roomCreator) === String(userId);
          });

          if (foundRoom) {
            setAdminRoom(foundRoom);
            const announcementsResponse =
              await announcementService.getRoomAnnouncements(
                foundRoom.id || foundRoom._id,
              );
            const annList = Array.isArray(announcementsResponse)
              ? announcementsResponse
              : announcementsResponse?.announcements ||
                announcementsResponse?.data ||
                [];
            setAnnouncements(annList);
            const reactions = {};
            annList.forEach((ann) => {
              const userReaction = ann.reactions?.find(
                (r) => String(r.user) === String(userId),
              );
              if (userReaction) {
                reactions[ann.id || ann._id] = userReaction.type;
              }
            });
            setUserReactions(reactions);
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
      const data = Array.isArray(response)
        ? response
        : response?.announcements || response?.data || [];
      setAnnouncements(data);
      const reactions = {};
      data.forEach((ann) => {
        const userReaction = ann.reactions?.find(
          (r) => String(r.user) === String(userId),
        );
        if (userReaction) {
          reactions[ann.id || ann._id] = userReaction.type;
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
    if (adminRoom?.id || adminRoom?._id) {
      setRefreshing(true);
      await fetchAnnouncements(adminRoom.id || adminRoom._id);
      setRefreshing(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!adminRoom?.id && !adminRoom?._id) {
      Alert.alert("Error", "Room not loaded yet. Please wait.");
      return;
    }
    const roomId = adminRoom.id || adminRoom._id;
    try {
      await announcementService.createAnnouncement(roomId, title, content);
      setTitle("");
      setContent("");
      setShowCreateModal(false);
      await fetchAnnouncements(roomId);
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
          style: "destructive",
          onPress: async () => {
            try {
              await announcementService.deleteAnnouncement(announcementId);
              await fetchAnnouncements(adminRoom.id || adminRoom._id);
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
        selectedAnnouncement.id || selectedAnnouncement._id,
        commentText,
      );
      setCommentText("");
      setShowCommentModal(false);
      await fetchAnnouncements(adminRoom.id || adminRoom._id);
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
        style: "destructive",
        onPress: async () => {
          try {
            await announcementService.deleteComment(announcementId, commentId);
            await fetchAnnouncements(adminRoom.id || adminRoom._id);
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
      await fetchAnnouncements(adminRoom.id || adminRoom._id);
      setShowReactionPicker({});
    } catch (error) {
      Alert.alert("Error", "Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (announcementId) => {
    try {
      await announcementService.removeReaction(announcementId);
      await fetchAnnouncements(adminRoom.id || adminRoom._id);
    } catch (error) {
      Alert.alert("Error", "Failed to remove reaction");
    }
  };

  const handleShare = async (announcement) => {
    try {
      await Share.share({
        message: announcement.title + "\n\n" + announcement.content,
        title: announcement.title,
      });
      await announcementService.shareAnnouncement(
        announcement.id || announcement._id,
      );
      await fetchAnnouncements(adminRoom.id || adminRoom._id);
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Ionicons
              name="megaphone-outline"
              size={20}
              color={colors.accent}
            />
          </View>
          <View>
            <Text style={styles.headerTitle}>Announcements</Text>
            {adminRoom && (
              <Text style={styles.headerSubtitle}>{adminRoom.name}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={styles.createButton}
        >
          <Ionicons name="add" size={22} color={colors.textOnAccent} />
        </TouchableOpacity>
      </View>

      {/* Summary Strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Ionicons
            name="document-text-outline"
            size={16}
            color={colors.accent}
          />
          <Text style={styles.summaryValue}>{announcements.length}</Text>
          <Text style={styles.summaryLabel}>Posts</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.accent} />
          <Text style={styles.summaryValue}>
            {announcements.reduce(
              (sum, a) => sum + (a.comments?.length || 0),
              0,
            )}
          </Text>
          <Text style={styles.summaryLabel}>Comments</Text>
        </View>
        <View style={styles.summarySep} />
        <View style={styles.summaryItem}>
          <Ionicons name="heart-outline" size={16} color={colors.accent} />
          <Text style={styles.summaryValue}>
            {announcements.reduce(
              (sum, a) => sum + (a.reactions?.length || 0),
              0,
            )}
          </Text>
          <Text style={styles.summaryLabel}>Reactions</Text>
        </View>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id || item._id}
        renderItem={({ item }) => {
          const annId = item.id || item._id;
          const showComments = expandedComments[annId];
          const userReaction = userReactions[annId];
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
                  {item.creator?.avatar?.url || item.createdBy?.avatar?.url ? (
                    <Image
                      source={{
                        uri:
                          item.creator?.avatar?.url ||
                          item.createdBy?.avatar?.url,
                      }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.creator?.name ||
                          item.creatorName)?.[0]?.toUpperCase() || "A"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.creatorDetails}>
                    <Text style={styles.creatorName}>
                      {item.creator?.name || item.creatorName}
                    </Text>
                    <Text style={styles.createdAt}>
                      {new Date(
                        item.created_at || item.createdAt,
                      ).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                {String(item.created_by || item.createdBy) ===
                  String(userId) && (
                  <TouchableOpacity
                    onPress={() => handleDeleteAnnouncement(annId)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                )}
              </View>

              {/* Post Title & Content */}
              <View style={styles.postContent}>
                <Text style={styles.postTitle}>{item.title}</Text>
                <Text style={styles.postText}>{item.content}</Text>
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
                        handleRemoveReaction(annId);
                      } else {
                        setShowReactionPicker((prev) => ({
                          ...prev,
                          [annId]: !prev[annId],
                        }));
                      }
                    }}
                  >
                    <Text style={styles.actionButtonEmoji}>
                      {userReaction
                        ? REACTION_TYPES.find((r) => r.type === userReaction)
                            ?.emoji || "\uD83D\uDC4D"
                        : "\uD83D\uDC4D"}
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

                  {showReactionPicker[annId] && (
                    <View style={styles.reactionPickerContainer}>
                      {REACTION_TYPES.map((reaction) => (
                        <TouchableOpacity
                          key={reaction.type}
                          style={styles.reactionOption}
                          onPress={() =>
                            handleAddReaction(annId, reaction.type)
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
                  <Ionicons
                    name="chatbubble-outline"
                    size={17}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.actionButtonText}>Comment</Text>
                </TouchableOpacity>

                {/* Share Button */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleShare(item)}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={17}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* Comments Section */}
              {item.comments && item.comments.length > 0 && (
                <View style={styles.commentsContainer}>
                  {!showComments && item.comments.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewCommentsButton}
                      onPress={() => toggleComments(annId)}
                    >
                      <Text style={styles.viewCommentsText}>
                        View {item.comments.length} comment
                        {item.comments.length > 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {showComments && (
                    <View style={styles.commentsList}>
                      {item.comments.map((comment) => (
                        <View
                          key={comment.id || comment._id}
                          style={styles.comment}
                        >
                          {comment.user?.avatar?.url ? (
                            <Image
                              source={{ uri: comment.user.avatar.url }}
                              style={styles.commentAvatarImg}
                            />
                          ) : (
                            <View style={styles.commentAvatar}>
                              <Text style={styles.commentAvatarText}>
                                {(comment.user_name ||
                                  comment.userName)?.[0]?.toUpperCase() || "U"}
                              </Text>
                            </View>
                          )}
                          <View style={styles.commentBody}>
                            <View style={styles.commentHeader}>
                              <Text style={styles.commentAuthor}>
                                {comment.user_name || comment.userName}
                              </Text>
                              {String(comment.user) === String(userId) && (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleDeleteComment(
                                      annId,
                                      comment.id || comment._id,
                                    )
                                  }
                                >
                                  <Ionicons
                                    name="close"
                                    size={14}
                                    color={colors.textTertiary}
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                            <View style={styles.commentBubble}>
                              <Text style={styles.commentText}>
                                {comment.text}
                              </Text>
                            </View>
                            <Text style={styles.commentDate}>
                              {new Date(
                                comment.created_at || comment.createdAt,
                              ).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {showComments && item.comments.length > 2 && (
                    <TouchableOpacity
                      style={styles.viewCommentsButton}
                      onPress={() => toggleComments(annId)}
                    >
                      <Text style={styles.viewCommentsText}>Hide comments</Text>
                    </TouchableOpacity>
                  )}

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
                          style={styles.commentAvatarImg}
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

              {(!item.comments || item.comments.length === 0) && (
                <View style={styles.commentsContainer}>
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
                          style={styles.commentAvatarImg}
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
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons
                name="megaphone-outline"
                size={40}
                color={colors.accent}
              />
            </View>
            <Text style={styles.emptyText}>No announcements yet</Text>
            <Text style={styles.emptySubtext}>
              Tap + to create your first announcement
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#b38604"]}
            tintcolor={colors.accent}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Create Announcement Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name="create-outline"
                  size={24}
                  color={colors.accent}
                />
              </View>
            </View>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Create Announcement</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Announcement Title"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={colors.placeholder}
              />
              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your announcement..."
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.placeholder}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateAnnouncement}
              >
                <Ionicons name="send" size={18} color={colors.textOnAccent} />
                <Text style={styles.submitButtonText}>Create Announcement</Text>
              </TouchableOpacity>
              <ModalBottomSpacer />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color={colors.accent}
                />
              </View>
            </View>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => setShowCommentModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Your Comment</Text>
              <TextInput
                style={[styles.input, styles.contentInput]}
                placeholder="Write your comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={5}
                placeholderTextColor={colors.placeholder}
              />

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleAddComment}
              >
                <Ionicons name="send" size={18} color={colors.textOnAccent} />
                <Text style={styles.submitButtonText}>Post Comment</Text>
              </TouchableOpacity>
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

    /* Header */
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
        },
        android: { elevation: 2 },
      }),
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(179,134,4,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 1,
    },
    createButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: "#b38604",
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 6,
        },
        android: { elevation: 4 },
      }),
    },

    /* Summary Strip */
    summaryStrip: {
      flexDirection: "row",
      backgroundColor: colors.card,
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 4,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    summaryItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    summaryValue: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    summarySep: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.skeleton,
      marginVertical: 2,
    },

    /* Post List */
    listContent: {
      paddingTop: 8,
      paddingBottom: 24,
    },
    postCard: {
      backgroundColor: colors.card,
      marginHorizontal: 12,
      marginBottom: 12,
      borderRadius: 14,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
      overflow: "hidden",
    },
    postHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
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
      backgroundColor: colors.accent,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    avatarImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
      backgroundColor: colors.inputBg,
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
      color: colors.text,
      marginBottom: 2,
    },
    createdAt: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    deleteBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: "rgba(231,76,60,0.08)",
      justifyContent: "center",
      alignItems: "center",
    },

    /* Post Content */
    postContent: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    postTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 6,
      lineHeight: 20,
    },
    postText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },

    /* Stats Bar */
    statsBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
    },
    reactionStats: {
      flexDirection: "row",
      alignItems: "center",
    },
    reactionEmoji: {
      marginRight: -5,
      fontSize: 15,
    },
    reactionCount: {
      fontSize: 13,
      color: colors.textTertiary,
      marginLeft: 6,
      fontWeight: "500",
    },
    shareCount: {
      fontSize: 13,
      color: colors.textTertiary,
      fontWeight: "500",
    },

    /* Action Bar */
    actionBar: {
      flexDirection: "row",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
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
      gap: 5,
    },
    actionButtonEmoji: {
      fontSize: 18,
    },
    actionButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    reacted: {
      color: colors.accent,
      fontWeight: "700",
    },
    reactionPickerContainer: {
      position: "absolute",
      bottom: 45,
      left: 0,
      backgroundColor: colors.card,
      flexDirection: "row",
      borderRadius: 24,
      paddingHorizontal: 6,
      paddingVertical: 6,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        android: { elevation: 10 },
      }),
      zIndex: 100,
    },
    reactionOption: {
      width: 42,
      height: 42,
      justifyContent: "center",
      alignItems: "center",
    },
    reactionOptionEmoji: {
      fontSize: 26,
    },

    /* Comments */
    commentsContainer: {
      paddingHorizontal: 14,
      paddingBottom: 10,
    },
    viewCommentsButton: {
      paddingVertical: 8,
    },
    viewCommentsText: {
      fontSize: 13,
      color: colors.accent,
      fontWeight: "600",
    },
    commentsList: {
      marginBottom: 8,
      marginTop: 6,
    },
    comment: {
      flexDirection: "row",
      marginBottom: 14,
    },
    commentAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "rgba(179,134,4,0.15)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
      marginTop: 2,
    },
    commentAvatarImg: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 10,
      marginTop: 2,
      backgroundColor: colors.inputBg,
    },
    commentAvatarText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.accent,
    },
    commentBody: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    commentAuthor: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.text,
    },
    commentBubble: {
      backgroundColor: colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
    },
    commentText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
    commentDate: {
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 5,
      marginLeft: 4,
    },
    addCommentPrompt: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderLight,
      marginTop: 4,
    },
    commentInputAvatar: {
      marginRight: 10,
    },
    commentInputPlaceholder: {
      flex: 1,
      fontSize: 13,
      color: colors.textTertiary,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.background,
      borderRadius: 18,
      fontWeight: "500",
    },

    /* Empty State */
    emptyContainer: {
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 80,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: "rgba(179,134,4,0.10)",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textTertiary,
      marginTop: 6,
    },

    /* Modals */
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalContent: {
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingBottom: 20,
      maxHeight: "85%",
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 20,
        },
        android: { elevation: 12 },
      }),
    },
    modalIconHeader: {
      alignItems: "center",
      marginTop: 20,
      marginBottom: 4,
    },
    modalIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(179,134,4,0.12)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      marginBottom: 14,
      marginTop: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalBody: {
      paddingHorizontal: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      marginBottom: 14,
      backgroundColor: colors.cardAlt,
    },
    contentInput: {
      textAlignVertical: "top",
      minHeight: 100,
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 6,
      marginBottom: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#b38604",
          shadowOpacity: 0.25,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 6,
        },
        android: { elevation: 3 },
      }),
    },
    submitButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default AdminAnnouncementsScreen;
