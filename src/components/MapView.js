import React from "react";

// Renders the map target element and the hover popup container.
// `popupRef` is owned by App (the OpenLayers overlay attaches to it).
function MapView({popupRef}) {
  return (
    <>
      <div id="map" style={{width: "100%", height: "70vh"}} />
      <div id="popup" ref={popupRef} className="ol-popup" />
    </>
  );
}

export default MapView;
