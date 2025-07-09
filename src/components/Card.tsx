import React from "react";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, ...props }) => (
  <div
    {...props}
    style={{
      border: "1px solid #ccc",
      borderRadius: "6px",
      padding: "8px",
      marginBottom: "8px",
      backgroundColor: "white",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      ...(props.style || {}),
    }}
  >
    {children}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: "14px" }}>{children}</div>
);