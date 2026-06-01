import React from "react";

// Simple app header. Logo reuses the site icon (public/pin.png, the <head> favicon).
function Header() {
  return (
    <header className="app-header">
      <h1 className="app-title">
        <img
          src={`${process.env.PUBLIC_URL}/pin.png`}
          alt=""
          className="app-logo"
        />
        Find Middle Point
      </h1>
      <p className="app-subtitle">Pick a few locations and find the fairest meeting spot.</p>
    </header>
  );
}

export default Header;
