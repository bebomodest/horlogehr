import React from 'react';

// Reusable clock SVG ornament
const ClockOrnament = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="13" stroke="#d4a04a" strokeWidth="1.5"/>
    <circle cx="16" cy="16" r="2" fill="#d4a04a"/>
    {/* 12 hour markers */}
    <line x1="16" y1="4" x2="16" y2="7.5" stroke="#d4a04a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="16" y1="24.5" x2="16" y2="28" stroke="#d4a04a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="4" y1="16" x2="7.5" y2="16" stroke="#d4a04a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="24.5" y1="16" x2="28" y2="16" stroke="#d4a04a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="22.8" y1="9.2" x2="20.7" y2="11.3" stroke="#d4a04a" strokeWidth="1" strokeLinecap="round"/>
    <line x1="9.2" y1="9.2" x2="11.3" y2="11.3" stroke="#d4a04a" strokeWidth="1" strokeLinecap="round"/>
    <line x1="22.8" y1="22.8" x2="20.7" y2="20.7" stroke="#d4a04a" strokeWidth="1" strokeLinecap="round"/>
    <line x1="9.2" y1="22.8" x2="11.3" y2="20.7" stroke="#d4a04a" strokeWidth="1" strokeLinecap="round"/>
    {/* Hands */}
    <line x1="16" y1="16" x2="16" y2="8" stroke="#d4a04a" strokeWidth="2" strokeLinecap="round"/>
    <line x1="16" y1="16" x2="21" y2="16" stroke="#d4a04a" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// Gear SVG ornament
const GearOrnament = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" stroke="#d4a04a" strokeWidth="1.4"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="#d4a04a" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

// Divider line with diamond
const DiamondDivider = () => (
  <svg width="80" height="12" viewBox="0 0 80 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="6" x2="30" y2="6" stroke="#d4a04a" strokeWidth="1"/>
    <rect x="35" y="2" width="10" height="8" rx="1" transform="rotate(45 40 6)" stroke="#d4a04a" strokeWidth="1" fill="none"/>
    <line x1="50" y1="6" x2="80" y2="6" stroke="#d4a04a" strokeWidth="1"/>
  </svg>
);

export const Footer: React.FC = () => {
  return (
    <footer
      className="w-full text-center z-20 relative print:hidden mt-auto border-t-2 border-[#76151e]/60 bg-[#3a2a1f]"
      style={{ flexShrink: 0 }}
    >
      {/* Copyright text */}
      <div className="py-5 px-4">
        <p dir="ltr" className="text-white font-black text-base tracking-wide">
          Copyright © 2026, Horloge HR
        </p>
        <p dir="ltr" className="text-white/60 font-bold text-xs mt-1 tracking-widest uppercase">
          POWERED BY NOBA AI TECHNOLOGY
        </p>
      </div>
    </footer>
  );
};

// ─── Header ornament strip (to be used INSIDE the header) ───────────────────
export const HeaderOrnaments: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none overflow-hidden" style={{zIndex: 0}}>
    {/* LEFT side ornaments */}
    <div className="flex items-center gap-2 opacity-25 select-none">
      <ClockOrnament size={36} />
      <DiamondDivider />
      <GearOrnament size={22} />
      <DiamondDivider />
      <ClockOrnament size={26} />
    </div>

    {/* RIGHT side ornaments */}
    <div className="flex items-center gap-2 opacity-25 select-none flex-row-reverse">
      <ClockOrnament size={36} />
      <DiamondDivider />
      <GearOrnament size={22} />
      <DiamondDivider />
      <ClockOrnament size={26} />
    </div>
  </div>
);
