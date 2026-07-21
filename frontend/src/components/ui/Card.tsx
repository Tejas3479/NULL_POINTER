import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  glow = false,
  className = '',
  children,
  ...props
}) => {
  const baseStyle = "bg-[var(--color-bg-secondary)] border border-[var(--color-text-muted)] rounded-md transition-all duration-300 p-4";
  const glowStyle = "hover:border-[var(--color-accent-primary)] hover:shadow-[0_0_15px_rgba(0,240,255,0.08)]";

  return (
    <div
      className={`${baseStyle} ${glow ? glowStyle : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
