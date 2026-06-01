import React from "react";

// Explains what the marker colors on the map mean.
const ITEMS = [
  {color: "#28a745", label: "Your locations"},
  {color: "#dc3545", label: "Recommended places"},
  {color: "rgba(0,123,255,0.9)", label: "Search area"},
];

function Legend() {
  return (
    <div className="flex justify-center gap-2 legend">
      {ITEMS.map((item) => (
        <span key={item.label} className="legend-item text-sm text-gray">
          <span className="legend-swatch" style={{backgroundColor: item.color}} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default Legend;
