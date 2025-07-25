import "./styles/app.css";
import ReactDOM from "react-dom/client";
import RailwayDrawerApp from "./RailwayDrawerApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  // Temporarily disable StrictMode to prevent double-rendering during development
  // <React.StrictMode>
    <RailwayDrawerApp />
  // </React.StrictMode>
);