/**
 * SafeMapView – OpenStreetMap replacement for react-native-maps MapView.
 * No API key required.
 *
 * Non-interactive (default): renders static OSM tile images with a RN marker
 *   overlay — NO WebView, safe to use in lists / cards.
 * Interactive: renders Leaflet inside a single WebView — use only in modals.
 *
 * Props:
 *   latitude        – number (required)
 *   longitude       – number (required)
 *   title           – marker popup text (optional)
 *   interactive     – allow pan/zoom (default false – "lite mode")
 *   style           – ViewStyle for the outer container
 *   markerColor     – hex colour for the marker (default "#e74c3c")
 *   onPress         – callback when the map area is tapped (non-interactive only)
 */
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";

/* ───────── helpers ───────── */
const TILE_SIZE = 256;
const STATIC_ZOOM = 16;

/** CartoCDN tiles – free, no API key, no User-Agent enforcement. */
const TILE_URL = (z, x, y) =>
  `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}@2x.png`;

/** Convert lat/lng → fractional tile coordinates at a given zoom. */
function latLngToTileXY(lat, lng, z) {
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const x = ((lng + 180) / 360) * n;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/* ─── Static tile preview (no WebView) ─── */
const StaticMapPreview = ({ lat, lng, markerColor, containerStyle }) => {
  const [layout, setLayout] = useState(null);
  const { x, y } = latLngToTileXY(lat, lng, STATIC_ZOOM);
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  const fracX = x - tileX; // 0-1 position inside the tile
  const fracY = y - tileY;

  return (
    <View
      style={[styles.container, containerStyle]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!layout || layout.width !== width || layout.height !== height)
          setLayout({ width, height });
      }}
    >
      {layout && (
        <>
          {/* Render a grid of tiles so the marker is always centred */}
          {[-1, 0, 1].map((dy) =>
            [-1, 0, 1].map((dx) => {
              const left =
                layout.width / 2 - fracX * TILE_SIZE + dx * TILE_SIZE;
              const top =
                layout.height / 2 - fracY * TILE_SIZE + dy * TILE_SIZE;
              // Skip tiles completely outside the visible area
              if (
                left + TILE_SIZE < 0 ||
                left > layout.width ||
                top + TILE_SIZE < 0 ||
                top > layout.height
              )
                return null;
              return (
                <Image
                  key={`${dx}_${dy}`}
                  source={{
                    uri: TILE_URL(STATIC_ZOOM, tileX + dx, tileY + dy),
                  }}
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                  }}
                  resizeMode="cover"
                />
              );
            }),
          )}
          {/* Marker pin — centred */}
          <View
            style={{
              position: "absolute",
              left: layout.width / 2 - 11,
              top: layout.height / 2 - 26,
            }}
          >
            <View
              style={[styles.markerPin, { backgroundColor: markerColor }]}
            />
          </View>
        </>
      )}
    </View>
  );
};

/* ─── Main component ─── */
const SafeMapView = ({
  latitude,
  longitude,
  title = "",
  interactive = false,
  style: containerStyle,
  markerColor = "#e74c3c",
  onPress,
  hideOpenBtn = false,
  children, // ignored – kept for compat
}) => {
  const webRef = useRef(null);

  if (latitude == null || longitude == null) return null;
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  /* ── Non-interactive: lightweight Image-based preview ── */
  if (!interactive) {
    if (onPress) {
      return (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
          <StaticMapPreview
            lat={lat}
            lng={lng}
            markerColor={markerColor}
            containerStyle={containerStyle}
          />
        </TouchableOpacity>
      );
    }
    return (
      <StaticMapPreview
        lat={lat}
        lng={lng}
        markerColor={markerColor}
        containerStyle={containerStyle}
      />
    );
  }

  /* ── Interactive: WebView + Leaflet (use in modals only) ── */
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
    .leaflet-control-zoom { margin-top: 130px !important; margin-right: 14px !important; }
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
    var icon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${markerColor};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });
    var marker = L.marker([${lat}, ${lng}], { icon: icon }).addTo(map);
    ${title ? `marker.bindPopup("${title.replace(/"/g, '\\"')}");` : ""}
  </script>
</body>
</html>`;

  const openInMaps = () => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(title || "Location")})`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      );
    });
  };

  return (
    <View style={[styles.container, containerStyle]}>
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
      />
      {!hideOpenBtn && (
        <TouchableOpacity
          style={styles.openBtn}
          activeOpacity={0.8}
          onPress={openInMaps}
        >
          <Ionicons name="navigate-outline" size={16} color="#fff" />
          <Text style={styles.openBtnText}>Open in Maps</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#e8e8e8",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  markerPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderBottomLeftRadius: 0,
    transform: [{ rotate: "-45deg" }],
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  openBtn: {
    position: "absolute",
    bottom: 80,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  openBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default SafeMapView;
