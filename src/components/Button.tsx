import React from "react";

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
  <button
    {...props}
    style={{
      padding: "6px 12px",
      cursor: "pointer",
      backgroundColor: "#007bff",
      color: "white",
      border: "none",
      borderRadius: "4px",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontSize: "14px",
      ...(props.style || {}),
    }}
  >
    {props.children}
  </button>
);

export default Button;