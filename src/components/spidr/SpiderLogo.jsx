import React from 'react';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698bbf4e09bd37d0bd1c3b99/589df1dbc_MainLogo.png";
const LOGO_WITH_BG_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698bbf4e09bd37d0bd1c3b99/5e9b3f6aa_LogowBackground.png";

export default function SpiderLogo({ size = 40, className = "", withBackground = false }) {
  return (
    <img 
      src={withBackground ? LOGO_WITH_BG_URL : LOGO_URL}
      alt="Spidr"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}

export { LOGO_URL, LOGO_WITH_BG_URL };