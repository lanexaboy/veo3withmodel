import React from 'react';

// FIX: Update Card component to accept and forward standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-blue-950/20 text-white backdrop-blur-2xl border border-blue-400/20 rounded-2xl shadow-xl shadow-black/20 transition-all duration-300 ease-in-out hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-500/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
