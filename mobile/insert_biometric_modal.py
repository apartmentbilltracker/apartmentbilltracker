#!/usr/bin/env python3

# Read the modal code
modal_code = """      {/* ─── BIOMETRIC PASSWORD MODAL ─── */}
      <Modal
        animationType="fade"
        transparent
        visible={biometricPasswordModalVisible}
        onRequestClose={() => !enablingBiometric && setBiometricPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "60%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enable Biometric Login</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => !enablingBiometric && setBiometricPasswordModalVisible(false)}
                disabled={enablingBiometric}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={[styles.formLabel, { marginBottom: 8 }]}>
                Enter your password to enable biometric login
              </Text>
              <TextInput
                style={[styles.formInput, { marginBottom: 16 }]}
                placeholder="Password"
                secureTextEntry
                value={biometricPassword}
                onChangeText={setBiometricPassword}
                editable={!enablingBiometric}
                placeholderTextColor={colors.textTertiary}
              />

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (enablingBiometric || !biometricPassword.trim()) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={handleEnableBiometric}
                disabled={enablingBiometric || !biometricPassword.trim()}
              >
                {enablingBiometric ? (
                  <ActivityIndicator color={colors.textOnAccent} />
                ) : (
                  <>
                    <Ionicons
                      name="finger-print"
                      size={18}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.saveBtnText}>Enable Biometric</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <ModalBottomSpacer />
          </View>
        </View>
      </Modal>
"""

# Process HostProfileScreen.js
with open('./src/screens/host/HostProfileScreen.js', 'r') as f:
    lines = f.readlines()

# Find the closing </Modal> tag at line 630 (index 629)
insert_line = 629  # 0-indexed, so line 630 is index 629
lines.insert(insert_line + 1, modal_code + '\n')

with open('./src/screens/host/HostProfileScreen.js', 'w') as f:
    f.writelines(lines)

print("✓ HostProfileScreen.js updated")

# Process AdminProfileScreen.js
with open('./src/screens/admin/AdminProfileScreen.js', 'r') as f:
    lines = f.readlines()

# Find the closing </Modal> tag at line 795 (index 794)
insert_line = 794  # 0-indexed, so line 795 is index 794
lines.insert(insert_line + 1, modal_code + '\n')

with open('./src/screens/admin/AdminProfileScreen.js', 'w') as f:
    f.writelines(lines)

print("✓ AdminProfileScreen.js updated")
