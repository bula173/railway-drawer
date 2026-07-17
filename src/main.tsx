import "./styles/app.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { RailwayDrawerMaxGraphApp } from "./components/RailwayDrawerMaxGraphApp";
import { AppProviders } from "./components/AppProviders";
import "./utils/loggerConsole"; // Initialize logger console debugging tools

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <RailwayDrawerMaxGraphApp />
    </AppProviders>
  </React.StrictMode>
);