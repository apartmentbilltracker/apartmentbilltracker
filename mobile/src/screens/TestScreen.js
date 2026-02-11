import React, { useContext, useMemo} from "react";
import { View, Text, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeContext";

export default function TestScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const authContext = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TEST SCREEN</Text>
      <Text style={styles.text}>App is rendering!</Text>
      <Text style={styles.text}>
        IsLoading: {String(authContext?.isLoading)}
      </Text>
      <Text style={styles.text}>
        UserToken: {String(authContext?.state?.userToken)}
      </Text>
      <Text style={styles.text}>
        User Role: {String(authContext?.state?.user?.role)}
      </Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.error,
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 10,
    textAlign: "center",
  },
});
