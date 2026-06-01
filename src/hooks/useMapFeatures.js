import {useState, useEffect, useRef} from "react";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Overlay from "ol/Overlay";
import {unByKey} from "ol/Observable";

// Owns the vector layer that renders `features` on the map, plus the hover popup
// overlay. Exposes hover state and imperative show/hide helpers so lists outside
// the map can highlight the matching feature.
export default function useMapFeatures(map, features) {
  const popupRef = useRef(null);
  const overlayRef = useRef(null);
  const [hoveredUid, setHoveredUid] = useState(null);

  const sourceRef = useRef(null);
  if (!sourceRef.current) sourceRef.current = new VectorSource({features: []});
  const layerRef = useRef(null);
  if (!layerRef.current) layerRef.current = new VectorLayer({source: sourceRef.current});

  // Attach/detach the vector layer.
  useEffect(() => {
    if (!map) return undefined;
    const layer = layerRef.current;
    map.addLayer(layer);
    return () => map.removeLayer(layer);
  }, [map]);

  // Keep the source in sync with the features array.
  useEffect(() => {
    const source = sourceRef.current;
    source.clear();
    source.addFeatures(features);
  }, [features]);

  // Hover popup overlay.
  useEffect(() => {
    if (!map || !popupRef.current) return undefined;
    const overlay = new Overlay({
      element: popupRef.current,
      positioning: "bottom-center",
      stopEvent: false,
      offset: [0, -12],
      // No autoPan: showing the popup on hover must not move the map (annoying).
      // Panning to a location happens explicitly on click instead.
      autoPan: false,
    });
    map.addOverlay(overlay);
    overlayRef.current = overlay;

    const showForFeature = (feature) => {
      const label = feature.get("label") || feature.get("name") || "";
      if (popupRef.current) popupRef.current.innerHTML = `<div class="popup-content">${label}</div>`;
      overlay.setPosition(feature.getGeometry().getCoordinates());
      setHoveredUid(feature.get("uid") || null);
    };

    const hide = () => {
      overlay.setPosition(undefined);
      setHoveredUid(null);
    };

    // Hover (desktop / mouse).
    const pointerKey = map.on("pointermove", (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      const mapEl = map.getTargetElement();
      if (feature) {
        showForFeature(feature);
        if (mapEl) mapEl.style.cursor = "pointer";
      } else {
        hide();
        if (mapEl) mapEl.style.cursor = "";
      }
    });

    // Tap (touch): show popup for a tapped feature, dismiss when tapping elsewhere.
    const clickKey = map.on("singleclick", (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) showForFeature(feature);
      else hide();
    });

    return () => {
      unByKey(pointerKey);
      unByKey(clickKey);
      map.removeOverlay(overlay);
    };
  }, [map]);

  const showFeatureByUid = (uid) => {
    if (!overlayRef.current) return;
    const feature = features.find((f) => f.get && f.get("uid") === uid);
    if (!feature) return;
    if (popupRef.current) popupRef.current.innerHTML = `<div class="popup-content">${feature.get("label") || ""}</div>`;
    overlayRef.current.setPosition(feature.getGeometry().getCoordinates());
  };

  const hideFeaturePopup = () => {
    if (overlayRef.current) overlayRef.current.setPosition(undefined);
  };

  return {popupRef, hoveredUid, setHoveredUid, showFeatureByUid, hideFeaturePopup};
}
