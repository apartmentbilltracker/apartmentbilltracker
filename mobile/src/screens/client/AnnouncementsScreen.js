import React, { useContext, useEffect, useState, useMemo} from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { announcementService, roomService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";

const REACTION_TYPES = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "haha", emoji: "😂", label: "Haha" },
  { type: "wow", emoji: "😮", label: "Wow" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😠", label: "Angry" },
];

const AnnouncementsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

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

  const userId = state?.user?.id || state?.user?._id;
  const userName = state?.user?.name || "User";
  const currentUser = state?.user;

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
              (m) =>
                String(m.user?.id || m.user?._id || m.user) === String(userId),
            );
            return isMember;
          });

          if (!isMounted) return;

          if (joined) {
            setUserJoinedRoom(joined);
            await fetchAnnouncements(joined.id || joined._id);
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
      const data = Array.isArray(response)
        ? response
        : response?.announcements || response?.data || [];
      setAnnouncements(data);

      for (const announcement of data) {
        try {
          await announcementService.markAsRead(
            announcement.id || announcement._id,
          );
        } catch (error) {
          console.error("Error marking as read:", error);
        }
      }

      const reactions = {};
      for (const announcement of data) {
        const userReaction = announcement.reactions?.find(
          (r) => String(r.user?.id || r.user?._id || r.user) === String(userId),
        );
        if (userReaction) {
          reactions[announcement.id || announcement._id] = userReaction.type;
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
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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
        userJoinedRoom.id || userJoinedRoom._id,
        title,
        content,
      );
      setTitle("");
      setContent("");
      setShowCreateModal(false);
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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
        selectedAnnouncement.id || selectedAnnouncement._id,
        commentText,
      );
      setCommentText("");
      setShowCommentModal(false);
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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
              await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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
            await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
      setShowReactionPicker({});
    } catch (error) {
      Alert.alert("Error", "Failed to add reaction");
    }
  };

  const handleRemoveReaction = async (announcementId) => {
    try {
      await announcementService.removeReaction(announcementId);
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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

      await announcementService.shareAnnouncement(
        announcement.id || announcement._id,
      );
      await fetchAnnouncements(userJoinedRoom.id || userJoinedRoom._id);
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

  const formatTimeAgo = (date) => {
    if (!date) return "";
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isAdmin =
    userJoinedRoom &&
    String(userJoinedRoom.created_by || userJoinedRoom.createdBy) ===
      String(userId);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading announcements…</Text>
      </View>
    );
  }

  // ── No room ──
  if (!userJoinedRoom) {
    return (
      <View style={styles.centered}>
        <Ionicons name="megaphone-outline" size={56} color={colors.skeleton} />
        <Text style={styles.emptyTitle}>No Room Yet</Text>
        <Text style={styles.emptySubtitle}>
          Join a room to see announcements
        </Text>
      </View>
    );
  }

  // ── Main ──
  return (
    <View style={styles.container}>
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

          const isOwner =
            String(item.created_by || item.createdBy) === String(userId);
          const commentCount = item.comments?.length || 0;
          const shareCount = item.shares?.length || 0;

          return (
            <View style={styles.card}>
              {/* ── Header ── */}
              <View style={styles.cardHeader}>
                {item.creator?.avatar?.url || item.createdBy?.avatar?.url ? (
                  <Image
                    source={{
                      uri:
                        item.creator?.avatar?.url ||
                        item.createdBy?.avatar?.url,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>
                      {(item.creator?.name ||
                        item.creatorName)?.[0]?.toUpperCase() || "A"}
                    </Text>
                  </View>
                )}

                <View style={styles.headerMeta}>
                  <Text style={styles.authorName}>
                    {item.creator?.name || item.creatorName}
                  </Text>
                  <View style={styles.timeBadgeRow}>
                    <Ionicons
                      name="time-outline"
                      size={11}
                      color={colors.textTertiary}
                      style={{ marginRight: 3 }}
                    />
                    <Text style={styles.timeText}>
                      {formatTimeAgo(item.created_at || item.createdAt)}
                    </Text>
                  </View>
                </View>

                {isOwner && (
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => handleDeleteAnnouncement(annId)}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Body ── */}
              <View style={styles.cardBody}>
                <Text style={styles.postTitle}>{item.title}</Text>
                <Text style={styles.postContent}>{item.content}</Text>
              </View>

              {/* ── Stats bar ── */}
              {(totalReactions > 0 || commentCount > 0 || shareCount > 0) && (
                <View style={styles.statsBar}>
                  {totalReactions > 0 && (
                    <View style={styles.statGroup}>
                      {Object.entries(reactionCounts)
                        .slice(0, 3)
                        .map(([type]) => {
                          const r = REACTION_TYPES.find(
                            (rt) => rt.type === type,
                          );
                          return (
                            <Text key={type} style={styles.statEmoji}>
                              {r?.emoji}
                            </Text>
                          );
                        })}
                      <Text style={styles.statText}>{totalReactions}</Text>
                    </View>
                  )}
                  <View style={styles.statGroup}>
                    {commentCount > 0 && (
                      <Text style={styles.statText}>
                        {commentCount} comment{commentCount > 1 ? "s" : ""}
                      </Text>
                    )}
                    {shareCount > 0 && (
                      <Text style={styles.statText}>
                        {" · "}
                        {shareCount} share{shareCount > 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* ── Action bar ── */}
              <View style={styles.actionBar}>
                {/* React */}
                <View style={{ flex: 1, position: "relative" }}>
                  <TouchableOpacity
                    style={styles.actionBtn}
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
                    <Text style={styles.actionEmoji}>
                      {userReaction
                        ? REACTION_TYPES.find((r) => r.type === userReaction)
                            ?.emoji || "👍"
                        : "👍"}
                    </Text>
                    <Text
                      style={[
                        styles.actionLabel,
                        userReaction && styles.actionLabelActive,
                      ]}
                    >
                      {userReaction ? "Liked" : "Like"}
                    </Text>
                  </TouchableOpacity>

                  {showReactionPicker[annId] && (
                    <View style={styles.reactionPicker}>
                      {REACTION_TYPES.map((reaction) => (
                        <TouchableOpacity
                          key={reaction.type}
                          style={styles.reactionPickerItem}
                          onPress={() =>
                            handleAddReaction(annId, reaction.type)
                          }
                        >
                          <Text style={styles.reactionPickerEmoji}>
                            {reaction.emoji}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Comment */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    setSelectedAnnouncement(item);
                    setShowCommentModal(true);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.actionLabel}>Comment</Text>
                </TouchableOpacity>

                {/* Share */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleShare(item)}
                >
                  <Ionicons
                    name="share-social-outline"
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.actionLabel}>Share</Text>
                </TouchableOpacity>
              </View>

              {/* ── Comments ── */}
              {commentCount > 0 && (
                <View style={styles.commentsSection}>
                  {!showComments && (
                    <TouchableOpacity
                      style={styles.viewCommentsBtn}
                      onPress={() => toggleComments(annId)}
                    >
                      <Ionicons
                        name="chatbubbles-outline"
                        size={14}
                        color={colors.accent}
                      />
                      <Text style={styles.viewCommentsText}>
                        View {commentCount} comment
                        {commentCount > 1 ? "s" : ""}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {showComments && (
                    <>
                      {item.comments.map((comment) => (
                        <View
                          key={comment.id || comment._id}
                          style={styles.commentRow}
                        >
                          {comment.user?.avatar?.url ? (
                            <Image
                              source={{ uri: comment.user.avatar.url }}
                              style={styles.commentAvatar}
                            />
                          ) : (
                            <View
                              style={[
                                styles.commentAvatar,
                                styles.commentAvatarFallback,
                              ]}
                            >
                              <Text style={styles.commentAvatarLetter}>
                                {(comment.user_name ||
                                  comment.userName)?.[0]?.toUpperCase() || "U"}
                              </Text>
                            </View>
                          )}

                          <View style={styles.commentBubble}>
                            <View style={styles.commentBubbleHeader}>
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
                                  hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                  }}
                                >
                                  <Ionicons
                                    name="close"
                                    size={13}
                                    color={colors.textTertiary}
                                  />
                                </TouchableOpacity>
                              )}
                            </View>
                            <Text style={styles.commentBody}>
                              {comment.text}
                            </Text>
                            <Text style={styles.commentTime}>
                              {formatTimeAgo(
                                comment.created_at || comment.createdAt,
                              )}
                            </Text>
                          </View>
                        </View>
                      ))}

                      {commentCount > 2 && (
                        <TouchableOpacity
                          style={styles.viewCommentsBtn}
                          onPress={() => toggleComments(annId)}
                        >
                          <Text style={styles.viewCommentsText}>
                            Hide comments
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* ── Write comment prompt ── */}
              <TouchableOpacity
                style={styles.writeCommentBar}
                onPress={() => {
                  setSelectedAnnouncement(item);
                  setShowCommentModal(true);
                }}
              >
                {currentUser?.avatar?.url ? (
                  <Image
                    source={{ uri: currentUser.avatar.url }}
                    style={styles.miniAvatar}
                  />
                ) : (
                  <View style={[styles.miniAvatar, styles.miniAvatarFallback]}>
                    <Text style={styles.miniAvatarLetter}>
                      {userName?.[0]?.toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
                <View style={styles.writeCommentPill}>
                  <Text style={styles.writeCommentPlaceholder}>
                    Write a comment…
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="megaphone-outline" size={52} color={colors.skeleton} />
            <Text style={styles.emptyTitle}>No Announcements</Text>
            <Text style={styles.emptySubtitle}>
              Nothing posted yet. Check back later!
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

      {/* ── Create Announcement Modal ── */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New Announcement</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Give it a title"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.inputLabel}>Content</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What do you want to announce?"
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={6}
                placeholderTextColor={colors.textTertiary}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreateAnnouncement}
              >
                <Ionicons
                  name="megaphone-outline"
                  size={18}
                  color={colors.textOnAccent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.submitBtnText}>Post Announcement</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Comment Modal ── */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheetSmall}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Comment</Text>
              <TouchableOpacity
                onPress={() => setShowCommentModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write your comment…"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddComment}
              >
                <Ionicons
                  name="send"
                  size={16}
                  color={colors.textOnAccent}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.submitBtnText}>Post Comment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ── Styles ── */
const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textTertiary,
  },
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },

  /* Card */
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },

  /* Header */
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  avatarFallback: {
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  headerMeta: {
    flex: 1,
    marginLeft: 10,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  timeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.errorBg,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Body */
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  postContent: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 21,
  },

  /* Stats */
  statsBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  statGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  statEmoji: {
    fontSize: 14,
    marginRight: -4,
  },
  statText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginLeft: 8,
  },

  /* Actions */
  actionBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingVertical: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 5,
  },
  actionEmoji: {
    fontSize: 16,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  actionLabelActive: {
    color: colors.accent,
  },

  /* Reaction Picker */
  reactionPicker: {
    position: "absolute",
    bottom: 46,
    left: 4,
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  reactionPickerItem: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionPickerEmoji: {
    fontSize: 24,
  },

  /* Comments */
  commentsSection: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  viewCommentsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 5,
  },
  viewCommentsText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: "600",
  },
  commentRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginTop: 2,
  },
  commentAvatarFallback: {
    backgroundColor: colors.skeleton,
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarLetter: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentBubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  commentBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  commentTime: {
    fontSize: 10,
    color: colors.textTertiary,
  },

  /* Write comment bar */
  writeCommentBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  miniAvatarFallback: {
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarLetter: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 11,
  },
  writeCommentPill: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  writeCommentPlaceholder: {
    fontSize: 13,
    color: colors.textTertiary,
  },

  /* Empty state */
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalSheetSmall: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "55%",
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.skeleton,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
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
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  textArea: {
    textAlignVertical: "top",
    minHeight: 100,
  },
  submitBtn: {
    flexDirection: "row",
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default AnnouncementsScreen;
