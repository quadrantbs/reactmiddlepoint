import React, {useState, useEffect, useRef} from "react";

// Address autocomplete. As the user types (debounced), onFetchSuggestions returns
// candidate matches shown in a dropdown; picking one calls onSelect so the parent
// can add it and pan the map there — the user sees exactly which place they chose.
function AddressSearch({onFetchSuggestions, onSelect, onUseMyLocation}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const reqId = useRef(0);
  const blurTimer = useRef(null);

  // Debounced lookup; stale responses (superseded by newer typing) are ignored.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return undefined;
    }
    const id = ++reqId.current;
    setLoading(true);
    setOpen(true);
    const timer = setTimeout(async () => {
      const results = await onFetchSuggestions(q);
      if (reqId.current === id) {
        setSuggestions(results);
        setActiveIndex(-1);
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [query, onFetchSuggestions]);

  const choose = (place) => {
    onSelect(place);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(suggestions[activeIndex >= 0 ? activeIndex : 0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && query.trim().length >= 3;

  return (
    <div className="flex justify-center gap-2 address-search">
      <div className="search-field">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Search an address…"
          aria-label="Search an address"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="address-suggestions"
          className="p-2 px-4 search-input"
        />
        {showDropdown && (
          <ul className="suggestions" id="address-suggestions" role="listbox">
            {loading && <li className="suggestion-empty">Searching…</li>}
            {!loading && suggestions.length === 0 && (
              <li className="suggestion-empty">No matches found.</li>
            )}
            {!loading &&
              suggestions.map((s, i) => (
                <li
                  key={`${s.lat},${s.lon}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`suggestion ${i === activeIndex ? "active" : ""}`}
                  // onMouseDown (not onClick) fires before the input's onBlur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    choose(s);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {s.label}
                </li>
              ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="btn bg-green hover:bg-green-dark text-white text-base cursor-pointer"
        onClick={onUseMyLocation}
        title="Add your current location"
      >
        📍 My location
      </button>
    </div>
  );
}

export default AddressSearch;
