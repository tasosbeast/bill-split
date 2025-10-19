import { useState } from "react";
import "./index.css";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">Bill Split</div>
        <span className="badge">React + Vite</span>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Friends</h2>
          <p className="kicker">Add and pick who you’re splitting with.</p>
        </section>

        <section className="panel">
          <h2>Split a bill</h2>
          <p className="kicker">Choose a friend to unlock the split form.</p>
        </section>
      </div>
    </div>
  );
}
