const fs = require('fs');
const path = require('path');

const modalCode = `      {/* ─── BIOMETRIC PASSWORD MODAL ─── */}
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
`;

// Process HostProfileScreen.js
const hostPath = './src/screens/host/HostProfileScreen.js';
let hostContent = fs.readFileSync(hostPath, 'utf-8');
const hostLines = hostContent.split('\n');

// Find the line number of the closing </Modal> tag (should be around line 630)
let hostInsertIndex = -1;
for (let i = 0; i < hostLines.length; i++) {
  if (hostLines[i].includes('</Modal>') && i > 600) {
    hostInsertIndex = i;
    break;
  }
}

if (hostInsertIndex !== -1) {
  hostLines.splice(hostInsertIndex + 1, 0, modalCode);
  fs.writeFileSync(hostPath, hostLines.join('\n'), 'utf-8');
  console.log('✓ HostProfileScreen.js updated');
} else {
  console.error('✗ Could not find insertion point in HostProfileScreen.js');
}

// Process AdminProfileScreen.js
const adminPath = './src/screens/admin/AdminProfileScreen.js';
let adminContent = fs.readFileSync(adminPath, 'utf-8');
const adminLines = adminContent.split('\n');

// Find the line number of the closing </Modal> tag (should be around line 795)
let adminInsertIndex = -1;
for (let i = 0; i < adminLines.length; i++) {
  if (adminLines[i].includes('</Modal>') && i > 750) {
    adminInsertIndex = i;
    break;
  }
}

if (adminInsertIndex !== -1) {
  adminLines.splice(adminInsertIndex + 1, 0, modalCode);
  fs.writeFileSync(adminPath, adminLines.join('\n'), 'utf-8');
  console.log('✓ AdminProfileScreen.js updated');
} else {
  console.error('✗ Could not find insertion point in AdminProfileScreen.js');
}
