import React from "react";
import Image from "next/image";

interface LogoProps {
  src?: string;
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({
  src = "/images/logo.png",
  size = 32,
  showText = true,
  className = "",
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <div 
        className="relative shrink-0 overflow-hidden flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt="AimSync Logo"
          width={size}
          height={size}
          priority
          className="object-contain w-full h-full"
        />
      </div>

      {showText && (
        <span className="text-xl font-black tracking-wider uppercase text-white font-sans">
          AIM<span className="text-[#FF003C]">SYNC</span>
        </span>
      )}
    </div>
  );
}
