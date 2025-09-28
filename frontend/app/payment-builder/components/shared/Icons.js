// SVG Icons for Payment Types
// Professional icons matching MongoDB's design language

export const WireTransferIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="7" cy="7" r="2" fill="currentColor"/>
    <circle cx="17" cy="12" r="2" fill="currentColor"/>
    <circle cx="7" cy="17" r="2" fill="currentColor"/>
    <path d="M9 7h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export const CardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 9h20" stroke="currentColor" strokeWidth="2"/>
    <rect x="5" y="13" width="6" height="3" rx="0.5" fill="currentColor" opacity="0.5"/>
    <circle cx="17" cy="14.5" r="1.5" fill="currentColor" opacity="0.5"/>
  </svg>
);

export const BankIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21h18M4 21v-7M8 21v-7M12 21v-7M16 21v-7M20 21v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M12 3L3 9h18L12 3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </svg>
);

export const CurrencyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 6v12M9 9h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M7 7l10 10M17 7l-10 10" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
  </svg>
);

export const FastPaymentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
  </svg>
);

export const NetworkIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="5" cy="19" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 7v5M12 12l-7 5M12 12l7 5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>
);

export const CryptoIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 6v12M9 8.5h6M9 15.5h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M14.5 8.5c0-1.5-1.5-2-3-2-1.5 0-2.5.5-2.5 1.5s1 1.5 2.5 1.5c2 0 3 .5 3 2s-1 2-3 2c-1.5 0-3-.5-3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="7" cy="7" r="1.5" fill="currentColor" opacity="0.3"/>
    <circle cx="17" cy="7" r="1.5" fill="currentColor" opacity="0.3"/>
    <circle cx="7" cy="17" r="1.5" fill="currentColor" opacity="0.3"/>
    <circle cx="17" cy="17" r="1.5" fill="currentColor" opacity="0.3"/>
  </svg>
);

// Additional utility icons

export const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8h10M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const LoadingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="spin">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.2"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);