import "./styles/app.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RailwayDrawerMaxGraphApp } from "./components/RailwayDrawerMaxGraphApp";
import { AppProviders } from "./components/AppProviders";

console.log("🚀 Main.tsx loaded - starting app");

const root = document.getElementById("root");
console.log("📍 Root element:", root);

if (!root) {
  console.error("❌ Root element not found!");
  document.body.innerHTML = '<h1>ERROR: Root element not found</h1>';
} else {
  try {
    console.log("📦 Creating React root");
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <AppProviders>
          <RailwayDrawerMaxGraphApp />
        </AppProviders>
      </React.StrictMode>
    );
    console.log("✅ React app mounted successfully");
  } catch (error) {
    console.error("❌ Error mounting app:", error);
    document.body.innerHTML = `<h1>ERROR: ${error}</h1><pre>${error}</pre>`;
  }
}