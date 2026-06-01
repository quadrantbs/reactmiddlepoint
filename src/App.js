import React, {useState, useMemo} from "react";
import useMap from "./hooks/useMap";
import useGeocoder from "./hooks/useGeocoder";
import useRecommendations from "./hooks/useRecommendations";
import useMapFeatures from "./hooks/useMapFeatures";
import Header from "./components/Header";
import MapView from "./components/MapView";
import Controls from "./components/Controls";
import AddressSearch from "./components/AddressSearch";
import FeatureList from "./components/FeatureList";
import Legend from "./components/Legend";
import {fromLonLat} from "ol/proj";
import {GOOGLE_MAPS_SEARCH_URL} from "./constants";
import {haversineMeters, formatDistance} from "./utils";

function App() {
  const [middleRadius, setMiddleRadius] = useState(500);

  const geocoder = useGeocoder();
  const map = useMap([107.6186, -6.9039], 12, geocoder.handleMapClick);
  const recommendations = useRecommendations(map, geocoder.addressFeatures, middleRadius, setMiddleRadius);

  // All features rendered on the map (addresses + recommendations + middle circle).
  const features = useMemo(
    () => [...geocoder.addressFeatures, ...recommendations.recommendationFeatures],
    [geocoder.addressFeatures, recommendations.recommendationFeatures],
  );

  const {popupRef, hoveredUid, setHoveredUid, showFeatureByUid, hideFeaturePopup} =
    useMapFeatures(map, features);

  const error = geocoder.error || recommendations.error;
  const addressCount = geocoder.addresses.length;
  const hasAddresses = addressCount > 0;
  const canOpenInMaps = recommendations.centerCoordInv !== null;

  // Make the action button pulse once it's genuinely ready (>=2 locations,
  // not yet computed) to guide first-time users to the next step.
  const buttonGlows = addressCount >= 2 && !canOpenInMaps && !recommendations.isFetchingPlaces;

  // Step-by-step guidance that adapts to the current state.
  const guidance =
    addressCount === 0
      ? "👋 Add at least 2 locations — click the map, search an address, or use 📍 My location."
      : addressCount === 1
        ? "One more! Add another location, then press Find Middle Point."
        : !canOpenInMaps
          ? "✅ Ready — press Find Middle Point to see the fairest meeting spot."
          : "Tip: hover a place to highlight it on the map, or open it in Google Maps with ↗.";

  const handleHover = (uid) => {
    setHoveredUid(uid);
    showFeatureByUid(uid);
  };

  const handleUnhover = () => {
    setHoveredUid(null);
    hideFeaturePopup();
  };

  // Clicking a location pans the map to it — but only before the middle point is
  // computed, so we don't yank the view away once recommendations are shown.
  const handleAddressClick = (item) => {
    if (recommendations.recommendedPlaces.length > 0 || !map) return;
    const addr = geocoder.addresses.find((a) => a.uid === item.uid);
    if (addr) {
      const zoom = Math.max(map.getView().getZoom() || 0, 15);
      map.getView().animate({center: addr.coord, zoom});
    }
  };

  const clearAll = () => {
    geocoder.clear();
    recommendations.clear();
  };

  const openInMaps = () =>
    window.open(
      `${GOOGLE_MAPS_SEARCH_URL}?api=1&query=${recommendations.centerCoordInv}&zoom=14`,
    );

  const openPlaceInMaps = (item) =>
    window.open(`${GOOGLE_MAPS_SEARCH_URL}?api=1&query=${item.lat},${item.lon}`);

  // Add a chosen search suggestion and pan/zoom the map to it for confirmation.
  const handleSelectPlace = (place) => {
    geocoder.addPlace(place);
    if (map) map.getView().animate({center: fromLonLat([place.lon, place.lat]), zoom: 15});
  };

  // Normalize list data to {uid, label, ...} so both lists share one component.
  // Addresses use a short label (first segment) for compact chips; the full text
  // stays as the chip tooltip and in the map popup.
  const shortLabel = (s) => s.split(",")[0].trim() || s;
  const addressItems = geocoder.addresses.map((a) => ({
    uid: a.uid,
    label: shortLabel(a.label),
    title: a.label,
  }));

  const center = recommendations.centerCoordInv; // [lat, lon]
  const recommendationItems = recommendations.recommendedPlaces.map((place, index) => {
    const feat = features.find(
      (f) => f.get && f.get("label") === place.name && f.get("type") === "recommendation",
    );
    return {
      uid: feat ? feat.get("uid") : `rec-${index}`,
      label: place.name,
      lat: place.lat,
      lon: place.lon,
      subLabel: center ? formatDistance(haversineMeters(center, [place.lat, place.lon])) : undefined,
    };
  });

  return (
    <div className="app-container">
      <Header />
      <MapView popupRef={popupRef} />

      <div className="controls-region">
        <Legend />
        <AddressSearch
          onFetchSuggestions={geocoder.fetchSuggestions}
          onSelect={handleSelectPlace}
          onUseMyLocation={geocoder.addCurrentLocation}
        />
        <Controls
          middleRadius={middleRadius}
          onRadiusChange={setMiddleRadius}
          onGoToMiddle={recommendations.getMiddlePoint}
          isFetchingPlaces={recommendations.isFetchingPlaces}
          hasAddresses={hasAddresses}
          glow={buttonGlows}
          canOpenInMaps={canOpenInMaps}
          onOpenInMaps={openInMaps}
          onClear={clearAll}
        />
        {guidance && !geocoder.isGeocoding && <div className="guidance">{guidance}</div>}
        {geocoder.isGeocoding && <div className="text-sm text-gray">Loading address...</div>}
        {error && <div className="text-sm text-red">{error}</div>}
      </div>

      <div className="lists-region">
        <FeatureList
          title={addressItems.length > 0 ? "Your locations:" : undefined}
          items={addressItems}
          hoveredUid={hoveredUid}
          onHover={handleHover}
          onUnhover={handleUnhover}
          onItemClick={handleAddressClick}
          renderActions={(item) => (
            <button
              type="button"
              className="icon-btn"
              title="Remove"
              aria-label={`Remove ${item.label}`}
              onClick={(e) => { e.stopPropagation(); geocoder.removeAddress(item.uid); }}
            >
              ×
            </button>
          )}
        />

        {recommendations.noResults && (
          <div className="text-sm text-gray mt-4">
            No places found within {middleRadius} m — try a larger radius.
          </div>
        )}

        <FeatureList
          title="Recommended Places:"
          items={recommendationItems}
          hoveredUid={hoveredUid}
          onHover={handleHover}
          onUnhover={handleUnhover}
          containerClassName="mt-4"
          renderActions={(item) => (
            <button
              type="button"
              className="icon-btn"
              title="Open in Google Maps"
              aria-label={`Open ${item.label} in Google Maps`}
              onClick={(e) => { e.stopPropagation(); openPlaceInMaps(item); }}
            >
              ↗
            </button>
          )}
        />

        {recommendations.recommendedPlaces.length > 0 && recommendations.canLoadMore && (
          <div className="more-row">
            <button
              type="button"
              className="btn-more"
              onClick={recommendations.loadMore}
              disabled={recommendations.isLoadingMore}
            >
              {recommendations.isLoadingMore ? "Loading…" : "＋ Show more places"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
