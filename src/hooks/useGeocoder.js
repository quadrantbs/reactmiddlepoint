import {useState, useRef, useCallback, useMemo, useEffect} from "react";
import axios from "axios";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import {Style, Circle as CircleStyle, Stroke, Fill} from "ol/style";
import {fromLonLat} from "ol/proj";
import {makeUid} from "../utils";
import {NOMINATIM_REVERSE_URL, NOMINATIM_SEARCH_URL, ADDRESSES_STORAGE_KEY} from "../constants";

// Nominatim usage policy: max 1 request/second. Space queued requests slightly above that.
const NOMINATIM_MIN_INTERVAL = 1100;

const createAddressFeature = (coord, uid, label) => {
  const feature = new Feature({geometry: new Point(coord)});
  feature.set("uid", uid);
  feature.set("type", "address");
  feature.set("label", label);
  feature.setStyle(
    new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({color: "#28a745"}),
        stroke: new Stroke({color: "#fff", width: 2}),
      }),
    }),
  );
  return feature;
};

const loadStoredAddresses = () => {
  try {
    const raw = localStorage.getItem(ADDRESSES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

// Owns the address list (with coordinates, so features derive and persist).
// Reverse/forward geocoding via Nominatim is throttled to <=1 req/sec through a
// shared serial queue.
export default function useGeocoder() {
  const [addresses, setAddresses] = useState(loadStoredAddresses);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState(null);

  const queueRef = useRef(Promise.resolve());
  const lastRequestAtRef = useRef(0);
  const pendingRef = useRef(0);

  // Map features are derived from the stored addresses (single source of truth).
  const addressFeatures = useMemo(
    () => addresses.map((a) => createAddressFeature(a.coord, a.uid, a.label)),
    [addresses],
  );

  // Persist across reloads.
  useEffect(() => {
    try {
      localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(addresses));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [addresses]);

  const addAddress = useCallback((coord, label) => {
    setAddresses((prev) => [...prev, {uid: makeUid("addr"), label, coord}]);
  }, []);

  const reportError = useCallback((err) => {
    console.error("Geocoding error:", err);
    setError(
      err?.response?.status === 429
        ? "Too many requests — please wait a moment and try again."
        : "Error fetching address. Please try again.",
    );
  }, []);

  // Low-level: run a task on the serial queue, spaced >=1s apart (Nominatim policy).
  const enqueue = useCallback((task) => {
    queueRef.current = queueRef.current
      .then(async () => {
        const wait = lastRequestAtRef.current + NOMINATIM_MIN_INTERVAL - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        lastRequestAtRef.current = Date.now();
        await task();
      })
      .catch(() => {
        /* keep the chain alive even if a task throws unexpectedly */
      });
  }, []);

  // Queue a user-facing request that should toggle the "Loading address" state.
  const runQueued = useCallback(
    (task) => {
      pendingRef.current += 1;
      setIsGeocoding(true);
      setError(null);
      enqueue(async () => {
        try {
          await task();
        } finally {
          pendingRef.current -= 1;
          if (pendingRef.current === 0) setIsGeocoding(false);
        }
      });
    },
    [enqueue],
  );

  // Reverse-geocode a map click (coordinates already in EPSG:3857 / lon-lat).
  const handleMapClick = useCallback(
    (clickedCoord, transformedCoord) => {
      runQueued(async () => {
        try {
          const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${transformedCoord[1]}&lon=${transformedCoord[0]}`;
          const {data} = await axios.get(url);
          addAddress(clickedCoord, data.display_name);
        } catch (err) {
          reportError(err);
        }
      });
    },
    [runQueued, addAddress, reportError],
  );

  // Forward-geocode a typed query and return up to 5 candidate matches (for the
  // autocomplete dropdown). Throttled, but does not toggle the global loading
  // state or surface errors per keystroke — it just resolves to [] on failure.
  const fetchSuggestions = useCallback(
    (query) =>
      new Promise((resolve) => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
          resolve([]);
          return;
        }
        enqueue(async () => {
          try {
            const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=5&q=${encodeURIComponent(trimmed)}`;
            const {data} = await axios.get(url);
            resolve(
              (data || []).map((d) => ({
                label: d.display_name,
                lat: Number(d.lat),
                lon: Number(d.lon),
              })),
            );
          } catch (err) {
            console.error("Suggestion lookup error:", err);
            resolve([]);
          }
        });
      }),
    [enqueue],
  );

  // Add a chosen suggestion (already geocoded — no network call).
  const addPlace = useCallback(
    (place) => {
      addAddress(fromLonLat([place.lon, place.lat]), place.label);
    },
    [addAddress],
  );

  // Add the user's current device location as a point.
  const addCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        const {latitude, longitude} = coords;
        runQueued(async () => {
          try {
            const url = `${NOMINATIM_REVERSE_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}`;
            const {data} = await axios.get(url);
            addAddress(fromLonLat([longitude, latitude]), data.display_name);
          } catch (err) {
            reportError(err);
          }
        });
      },
      (err) => {
        console.error("Geolocation error:", err);
        setError("Couldn't get your location.");
      },
    );
  }, [runQueued, addAddress, reportError]);

  const removeAddress = useCallback((uid) => {
    setAddresses((prev) => prev.filter((a) => a.uid !== uid));
  }, []);

  const clear = useCallback(() => {
    setAddresses([]);
    setError(null);
  }, []);

  return {
    addresses,
    addressFeatures,
    isGeocoding,
    error,
    handleMapClick,
    fetchSuggestions,
    addPlace,
    addCurrentLocation,
    removeAddress,
    clear,
  };
}
