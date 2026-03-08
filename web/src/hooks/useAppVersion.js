import { useState, useEffect } from "react";
import { settingsService } from "../services/apiService";

// Module-level cache so all consumers share one fetch
let _cached = null;

export function useAppVersion() {
  const [version, setVersion] = useState(_cached);

  useEffect(() => {
    if (_cached) return;
    settingsService
      .getVersionControl()
      .then((res) => {
        const v = res?.versionControl?.latestAppVersion;
        if (v) {
          _cached = v;
          setVersion(v);
        }
      })
      .catch(() => {});
  }, []);

  return version || "1.0.0";
}
