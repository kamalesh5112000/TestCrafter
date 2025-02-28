import React from "react";

const Button = ({ onClick, text }) => {
  return (
    <button 
      onClick={onClick} 
      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded w-full"
    >
      {text}
    </button>
  );
};

export default Button;
