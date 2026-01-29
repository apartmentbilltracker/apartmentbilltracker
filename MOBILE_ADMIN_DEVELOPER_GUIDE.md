# Mobile Admin Screens - Developer Quick Reference

## Quick Start

### Screen Imports

```javascript
import AdminBillingScreen from "./AdminBillingScreen";
import AdminReportsScreen from "./AdminReportsScreen";
import AdminAttendanceScreen from "./AdminAttendanceScreen";
import AdminRoomManagementScreen from "./AdminRoomManagementScreen";
import AdminMembersScreen from "./AdminMembersScreen";
```

### Navigation Setup

```javascript
// Add to your navigation stack
<Stack.Screen name="AdminBilling" component={AdminBillingScreen} />
<Stack.Screen name="AdminReports" component={AdminReportsScreen} />
<Stack.Screen name="AdminAttendance" component={AdminAttendanceScreen} />
<Stack.Screen name="AdminRoomManagement" component={AdminRoomManagementScreen} />
<Stack.Screen name="AdminMembers" component={AdminMembersScreen} />
```

---

## API Service Integration

### Required API Methods

#### Room Service

```javascript
// Get all rooms
roomService.getRooms();
// Returns: { data: { rooms: [...] } }

// Get room details with members
roomService.getRoomDetails(roomId);
// Returns: { data: { room: {...} } }

// Create room
roomService.createRoom({ name, description, maxOccupancy });

// Update room
roomService.updateRoom(roomId, { name, description, maxOccupancy });

// Delete room
roomService.deleteRoom(roomId);
```

#### Member Service

```javascript
// Add member
memberService.addMember(roomId, { email });

// Delete member
memberService.deleteMember(roomId, memberId);
```

#### Billing Service

```javascript
// Save billing information
billingService.saveBilling(roomId, {
  start,
  end,
  rent,
  electricity,
  previousReading,
  currentReading,
});
```

---

## Key Features Reference

### Water Billing Calculation

```javascript
const WATER_RATE = 5; // ₱5 per day

const calculateWaterBill = (presenceDays) => {
  return (presenceDays || 0) * WATER_RATE;
};

const calculateTotalWaterBill = (members) => {
  return members.reduce((total, member) => {
    const presenceDays = member.presence ? member.presence.length : 0;
    return total + calculateWaterBill(presenceDays);
  }, 0);
};
```

### Attendance Percentage

```javascript
const getDaysInMonth = (yearMonth) => {
  const [year, month] = yearMonth.split("-");
  return new Date(year, month, 0).getDate();
};

const getAttendancePercentage = (presenceCount, totalDays) => {
  return totalDays > 0 ? ((presenceCount / totalDays) * 100).toFixed(1) : 0;
};
```

### Month Navigation

```javascript
const previousMonth = () => {
  const [year, month] = selectedMonth.split("-");
  const date = new Date(year, month - 2);
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  const newYear = date.getFullYear();
  setSelectedMonth(`${newYear}-${newMonth}`);
};

const nextMonth = () => {
  const [year, month] = selectedMonth.split("-");
  const date = new Date(year, month);
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  const newYear = date.getFullYear();
  setSelectedMonth(`${newYear}-${newMonth}`);
};
```

---

## Color Constants

```javascript
const COLORS = {
  PRIMARY_GOLD: "#bdb246",
  LINK_BLUE: "#0066cc",
  SUCCESS_GREEN: "#28a745",
  DANGER_RED: "#ff6b6b",
  LIGHT_GRAY: "#e0e0e0",
  DARK_GRAY: "#999",
  TEXT_PRIMARY: "#333",
  BG_LIGHT: "#f5f5f5",
  BG_WHITE: "#fff",
  BORDER: "#e0e0e0",
};
```

---

## Common Styles Pattern

```javascript
const styles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
  },

  // Text
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#bdb246",
  },

  // Buttons
  button: {
    flex: 1,
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
  },
  primaryButton: {
    backgroundColor: "#bdb246",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
```

---

## Form Handling Pattern

```javascript
// Form state
const [formData, setFormData] = useState({
  name: "",
  email: "",
  amount: "",
});
const [saving, setSaving] = useState(false);

// Submit handler
const handleSubmit = async () => {
  // Validation
  if (!formData.name.trim()) {
    Alert.alert("Error", "Name is required");
    return;
  }

  try {
    setSaving(true);
    // API call
    await apiService.save(formData);
    // Success
    Alert.alert("Success", "Data saved successfully");
    resetForm();
  } catch (error) {
    Alert.alert("Error", error.message);
  } finally {
    setSaving(false);
  }
};

// Reset form
const resetForm = () => {
  setFormData({ name: "", email: "", amount: "" });
};
```

---

## Common Patterns

### Room Selection

```javascript
<FlatList
  data={rooms}
  keyExtractor={(item) => item._id}
  scrollEnabled={false}
  renderItem={({ item }) => (
    <TouchableOpacity
      style={[
        styles.roomOption,
        selectedRoom?._id === item._id && styles.roomOptionActive,
      ]}
      onPress={() => setSelectedRoom(item)}
    >
      <Text style={styles.roomOptionText}>{item.name}</Text>
    </TouchableOpacity>
  )}
/>
```

### Search Filter

```javascript
const filteredItems = items.filter((item) =>
  (item.name || item.email || "")
    .toLowerCase()
    .includes(searchTerm.toLowerCase()),
);
```

### Loading State

```javascript
if (loading) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#bdb246" />
    </View>
  );
}
```

### Empty State

```javascript
{items.length === 0 ? (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>No items found</Text>
    <TouchableOpacity style={styles.emptyButton}>
      <Text style={styles.emptyButtonText}>Add First Item</Text>
    </TouchableOpacity>
  </View>
) : (
  // Content
)}
```

---

## Debugging Tips

### Check API Responses

```javascript
const fetchData = async () => {
  try {
    const response = await apiService.getData();
    console.log("API Response:", response);
    console.log("Data:", response.data);
  } catch (error) {
    console.error("API Error:", error);
    console.error("Error Response:", error.response?.data);
  }
};
```

### Monitor State Changes

```javascript
useEffect(() => {
  console.log("Selected room changed:", selectedRoom);
}, [selectedRoom]);

useEffect(() => {
  console.log("Members updated:", members);
}, [members]);
```

### Form Debugging

```javascript
useEffect(() => {
  console.log("Form data:", formData);
}, [formData]);
```

---

## Common Issues & Solutions

### Issue: Members not updating

**Solution**: Ensure you're fetching room details after member operations

```javascript
await memberService.addMember(roomId, data);
await fetchRooms(); // Refresh all data
```

### Issue: Form not resetting

**Solution**: Call resetForm explicitly after successful operations

```javascript
setFormData({ name: "", email: "" });
setShowForm(false);
```

### Issue: Loading spinner stuck

**Solution**: Always set loading state to false in finally block

```javascript
finally {
  setLoading(false);
}
```

### Issue: Search not working

**Solution**: Ensure correct field matching

```javascript
(item.name || item.email || "")
  .toLowerCase()
  .includes(searchTerm.toLowerCase());
```

---

## Performance Optimization

### Use FlatList for Long Lists

```javascript
// Good - for many items
<FlatList
  data={members}
  renderItem={({ item }) => <MemberCard member={item} />}
  keyExtractor={(item) => item._id}
  scrollEnabled={false}
/>;

// Avoid - for many items
{
  members.map((member) => <MemberCard key={member._id} member={member} />);
}
```

### Memoize Expensive Calculations

```javascript
const calculateTotals = useCallback(() => {
  return members.reduce((sum, m) => sum + m.amount, 0);
}, [members]);
```

### Avoid Inline Functions in Renders

```javascript
// Good
<TouchableOpacity onPress={handleDelete}>

// Avoid
<TouchableOpacity onPress={() => handleDelete(id)}>
```

---

## Testing Guidelines

### Test Room Selection

- [ ] Select different rooms
- [ ] Data updates correctly for each room
- [ ] Styling reflects selected state

### Test Forms

- [ ] Validation works (required fields)
- [ ] Submit button disabled while saving
- [ ] Success alert shown
- [ ] Form resets after submit
- [ ] Error alerts shown on failure

### Test Search

- [ ] Results filter correctly
- [ ] Case-insensitive matching
- [ ] Clears when search term removed

### Test Calculations

- [ ] Water bill: presence days × ₱5
- [ ] Total billing: rent + electricity + water
- [ ] Attendance %: (present / total) × 100

### Test Navigation

- [ ] Month navigation works
- [ ] Calendar displays correctly
- [ ] All buttons accessible

---

## Deployment Checklist

- [ ] All screens tested on device
- [ ] No console errors or warnings
- [ ] API endpoints verified
- [ ] Loading states work properly
- [ ] Error handling tested
- [ ] Forms validate correctly
- [ ] Data persists after refresh
- [ ] Navigation flows work
- [ ] Images/icons display correctly
- [ ] Touch targets are adequate size

---

## Version History

### v1.0 - Initial Release

- 5 admin screens created/enhanced
- Water billing system implemented
- Attendance tracking with calendar
- Reports with statistics
- Room and member management
- Full CRUD operations
- Search and filter functionality

---

## Support & Maintenance

For issues or enhancements:

1. Check this documentation
2. Review code comments in screen files
3. Check console for error messages
4. Verify API service methods
5. Test API endpoints separately

---

**Last Updated**: 2024
**Maintained By**: Development Team
**Status**: Production Ready
