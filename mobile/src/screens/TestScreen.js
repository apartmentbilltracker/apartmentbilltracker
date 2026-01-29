import React, { useContext } from "react";
import { View, Text, StyleSheet } from "react-native";
import { AuthContext } from "../context/AuthContext";

export default function TestScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: "#333",
    marginBottom: 10,
    textAlign: "center",
  },
});
