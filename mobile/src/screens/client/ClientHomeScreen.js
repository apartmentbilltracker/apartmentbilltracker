import React, { useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { roomService, memberService } from "../../services/apiService";

const ClientHomeScreen = ({ navigation }) => {
  const { state } = useContext(AuthContext);
  const [userJoinedRoom, setUserJoinedRoom] = useState(null);
  const [unjoinedRooms, setUnjoinedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState(null);

  const userId = state?.user?._id;
  const userName = state?.user?.name || "User";

  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await roomService.getRooms();
      console.log("getRooms response:", response);
      // Handle response structure from fetch API: response = { data, status }
      const data = response.data || response;
      const rooms = data.rooms || data || [];
      console.log("Rooms fetched:", rooms);

      const myRoom = rooms.find((room) =>
        room.members?.some(
          (m) => String(m.user?._id || m.user) === String(userId),
        ),
      );
      setUserJoinedRoom(myRoom || null);

      const notJoined = rooms.filter(
        (room) =>
          !room.members?.some(
            (m) => String(m.user?._id || m.user) === String(userId),
          ),
      );
      setUnjoinedRooms(notJoined);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const handleJoinRoom = async (roomId) => {
    // Show alert asking if user is a payer
    Alert.alert(
      "Join Room",
      "Will you be a payer for this room?",
      [
        {
          text: "No (Non-Payer)",
          onPress: async () => await joinRoomWithPayerStatus(roomId, false),
          style: "destructive",
        },
        {
          text: "Yes (Payer)",
          onPress: async () => await joinRoomWithPayerStatus(roomId, true),
          style: "default",
        },
      ],
      { cancelable: false },
    );
  };

  const joinRoomWithPayerStatus = async (roomId, isPayer) => {
    try {
      setJoiningRoomId(roomId);
      await memberService.addMember(roomId, { userId, isPayer });
      const payorStatus = isPayer ? "payor" : "non-payor";
      Alert.alert("Success", `You've joined the room as a ${payorStatus}!`);
      await fetchRooms();
    } catch (error) {
      console.error("Error joining room:", error);
      const message =
        error.data?.message || error.message || "Failed to join room";
      Alert.alert("Error", message);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleNavigateToRoom = () => {
    if (userJoinedRoom) {
      navigation.navigate("Presence", { roomId: userJoinedRoom._id });
    }
  };

  const RoomCard = ({ room, isJoined = false }) => (
    <View style={styles.roomCard}>
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="home" size={28} color="#bdb246" />
        </View>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>{room.name}</Text>
          <Text style={styles.roomMembers}>
            {room.members?.length || 0} Members
          </Text>
        </View>
      </View>

      {room.description && (
        <Text style={styles.roomDescription}>{room.description}</Text>
      )}

      {isJoined ? (
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() =>
            navigation.navigate("RoomDetails", { roomId: room._id })
          }
        >
          <Text style={styles.buttonText}>View Details</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => handleJoinRoom(room._id)}
          disabled={joiningRoomId === room._id}
        >
          {joiningRoomId === room._id ? (
            <ActivityIndicator color="#bdb246" size={16} />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={14} color="#bdb246" />
              <Text style={styles.joinButtonText}>Join Room</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getTimeBasedGreeting()}</Text>
        <Text style={styles.name}>{userName}! 👋</Text>
        <Text style={styles.subtitle}>Welcome to Apartment Bill Tracker</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#bdb246" />
        </View>
      ) : (
        <>
          {/* My Room Section */}
          {userJoinedRoom ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Room</Text>
              <RoomCard room={userJoinedRoom} isJoined={true} />

              {/* Quick Stats */}
              <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                  <MaterialIcons name="people" size={22} color="#bdb246" />
                  <Text style={styles.statValue}>
                    {userJoinedRoom.members?.length || 0}
                  </Text>
                  <Text style={styles.statLabel}>Members</Text>
                </View>

                {userJoinedRoom.billing && (
                  <View style={styles.statCard}>
                    <MaterialIcons
                      name="calendar-today"
                      size={22}
                      color="#bdb246"
                    />
                    <Text style={styles.statValue}>
                      {new Date(
                        userJoinedRoom.billing.start,
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text style={styles.statLabel}>Billing Start</Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No Room Joined Yet</Text>
                <Text style={styles.emptySubtext}>
                  Browse available rooms below to join one
                </Text>
              </View>
            </View>
          )}

          {/* Available Rooms Section */}
          {unjoinedRooms.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Available Rooms ({unjoinedRooms.length})
              </Text>
              {unjoinedRooms.map((room) => (
                <RoomCard key={room._id} room={room} isJoined={false} />
              ))}
            </View>
          )}

          {/* All Joined Message */}
          {unjoinedRooms.length === 0 && userJoinedRoom && (
            <View style={styles.section}>
              <View style={styles.emptyState}>
                <MaterialIcons name="check-circle" size={48} color="#bdb246" />
                <Text style={styles.emptyText}>All Rooms Joined</Text>
                <Text style={styles.emptySubtext}>
                  You've joined all available rooms
                </Text>
              </View>
            </View>
          )}
        </>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    marginTop: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  greeting: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    color: "#333",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginBottom: 14,
  },
  roomCard: {
    backgroundColor: "#fff",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    marginBottom: 11,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 9,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
    justifyContent: "center",
  },
  roomName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  roomMembers: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  roomDescription: {
    fontSize: 13,
    color: "#666",
    marginBottom: 11,
    lineHeight: 18,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#bdb246",
  },
  secondaryButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#bdb246",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginRight: 6,
  },
  joinButtonText: {
    color: "#bdb246",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 9,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 3,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 35,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
});

export default ClientHomeScreen;
