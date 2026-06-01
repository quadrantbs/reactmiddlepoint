import React from "react";

// Radius input + action buttons. Stateless — all behavior comes via props.
function Controls({
  middleRadius,
  onRadiusChange,
  onGoToMiddle,
  isFetchingPlaces,
  hasAddresses,
  glow,
  canOpenInMaps,
  onOpenInMaps,
  onClear,
}) {
  return (
    <div className="flex justify-center gap-2 mb-5">
      <label className="text-sm text-dark p-2">
        Radius (m):
        <input
          type="number"
          min={1}
          value={middleRadius}
          onChange={(e) => onRadiusChange(Math.max(1, Number(e.target.value || 0)))}
          className="p-2 px-4 ml-2"
          style={{width: 120}}
        />
      </label>
      <button
        className={`btn bg-blue hover:bg-blue-dark text-white text-base cursor-pointer ${glow ? "btn-glow" : ""}`}
        onClick={onGoToMiddle}
        disabled={isFetchingPlaces || !hasAddresses}
        title={hasAddresses ? undefined : "Add at least one location first"}
      >
        {isFetchingPlaces ? "Loading..." : "Go To Middle Point"}
      </button>
      {canOpenInMaps && (
        <button
          className="btn bg-green hover:bg-green-dark text-white text-base cursor-pointer"
          onClick={onOpenInMaps}
        >
          Open In Google Maps
        </button>
      )}
      <button
        className="btn bg-red hover:bg-red-dark text-white text-base cursor-pointer"
        onClick={onClear}
      >
        Clear Addresses
      </button>
    </div>
  );
}

export default Controls;
