/**
 * MapPickerView – interactive OpenStreetMap in a WebView for picking a location.
 *
 * Props:
 *   latitude        – initial marker latitude (optional, defaults to 10.3157)
 *   longitude       – initial marker longitude (optional, defaults to 123.8854)
 *   onLocationSelect – callback({ latitude, longitude }) when map is tapped
 *   style           – ViewStyle for the outer container
 */
import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

const MapPickerView = forwardRef(
  ({ latitude, longitude, onLocationSelect, style }, ref) => {
    const webRef = useRef(null);

    const lat = parseFloat(latitude) || 10.3157;
    const lng = parseFloat(longitude) || 123.8854;
    const hasMarker = latitude != null && longitude != null;

    useImperativeHandle(ref, () => ({
      animateToRegion: ({ latitude: newLat, longitude: newLng }) => {
        webRef.current?.injectJavaScript(`
          map.setView([${newLat}, ${newLng}], 16);
          if (window.currentMarker) map.removeLayer(window.currentMarker);
          window.currentMarker = L.marker([${newLat}, ${newLng}], { icon: pinIcon }).addTo(map);
          true;
        `);
      },
    }));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-control-zoom { margin-top: 60px !important; margin-right: 12px !important; }
    .leaflet-control-zoom a { width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 20px !important; border-radius: 10px !important; }
    .leaflet-control-zoom a:first-child { border-radius: 10px 10px 0 0 !important; }
    .leaflet-control-zoom a:last-child { border-radius: 0 0 10px 10px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);
    var pinIcon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#e74c3c;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });
    window.currentMarker = ${hasMarker ? `L.marker([${lat}, ${lng}], { icon: pinIcon }).addTo(map)` : "null"};
    map.on('click', function(e) {
      var lat = e.latlng.lat;
      var lng = e.latlng.lng;
      if (window.currentMarker) map.removeLayer(window.currentMarker);
      window.currentMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'locationSelect',
        nativeEvent: { coordinate: { latitude: lat, longitude: lng } }
      }));
    });
  </script>
</body>
</html>`;

    const onMessage = (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "locationSelect" && onLocationSelect) {
          onLocationSelect(data);
        }
      } catch (e) {
        // ignore
      }
    };

    return (
      <View style={[styles.container, style]}>
        <WebView
          ref={webRef}
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          scrollEnabled
          nestedScrollEnabled
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          onMessage={onMessage}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#e8e8e8",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default MapPickerView;
