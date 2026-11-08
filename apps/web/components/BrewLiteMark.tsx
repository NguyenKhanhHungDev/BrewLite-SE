import React from "react";

export default function BrewLiteMark({ className = "" }: { className?: string }) {
  return (
    <span className={`bl-brand-mark ${className}`} aria-hidden="true">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M19 8H18V5C18 3.89543 17.1046 3 16 3H5C3.89543 3 3 3.89543 3 5V13C3 16.3137 5.68629 19 9 19H12C15.3137 19 18 16.3137 18 13V11H19C20.6569 11 22 9.65685 22 8C22 6.34315 20.6569 8 19 8ZM16 5V9H5V5H16ZM18 13C18 15.2091 16.2091 17 14 17H9C6.79086 17 5 15.2091 5 13V11H16V13H18ZM18 9.5V9.5C18.5523 9.5 19 9.05228 19 8.5C19 7.94772 18.5523 7.5 18 7.5H18V9.5ZM3 21H18C18.5523 21 19 21.4477 19 22C19 22.5523 18.5523 23 18 23H3C2.44772 23 2 22.5523 2 22C2 21.4477 2.44772 21 3 21Z" />
      </svg>
    </span>
  );
}
