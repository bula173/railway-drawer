import React from "react";

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...props }) => {
  // If custom className is provided, use it entirely; otherwise use base classes
  const finalClassName = className || "px-3 py-1.5 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white border-none rounded inline-flex items-center gap-1 text-sm font-medium transition-colors duration-200 shadow-sm hover:shadow-md";
  
  return (
    <button
      {...props}
      className={finalClassName}
      style={props.style}
    >
      {props.children}
    </button>
  );
};

export default Button;