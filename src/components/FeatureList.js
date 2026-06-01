import React from "react";

// Reusable hover/focus-highlight list rendered as wrapping chips (compact).
// `items` is an array of {uid, label, subLabel?}. Hovering or focusing a chip
// triggers the popup/highlight in the parent via onHover/onUnhover.
// `renderActions(item)` optionally renders a per-item control (remove / open).
function FeatureList({
  items,
  hoveredUid,
  onHover,
  onUnhover,
  onItemClick,
  title,
  containerClassName,
  renderActions,
}) {
  if (items.length === 0) return null;

  return (
    <div className={containerClassName}>
      {title && <h3 className="list-title">{title}</h3>}
      <ul className="chip-list">
        {items.map((item) => (
          <li
            key={item.uid}
            tabIndex={0}
            title={item.title || item.label}
            className={`chip ${hoveredUid === item.uid ? "highlight" : ""}`}
            onMouseEnter={() => onHover(item.uid)}
            onMouseLeave={onUnhover}
            onFocus={() => onHover(item.uid)}
            onBlur={onUnhover}
            onClick={() => onItemClick && onItemClick(item)}
          >
            <span className="chip-label">{item.label}</span>
            {item.subLabel && <span className="chip-sub">{item.subLabel}</span>}
            {renderActions && <span className="chip-action">{renderActions(item)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FeatureList;
