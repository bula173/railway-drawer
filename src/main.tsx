import "./styles/app.css";
import React from "react";
import ReactDOM from "react-dom/client";
import RailwayDrawerApp from "./RailwayDrawerApp";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <RailwayDrawerApp />
    </ErrorBoundary>
  </React.StrictMode>
);