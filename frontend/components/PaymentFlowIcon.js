const PaymentFlowIcon = ({ size = 48, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Orbit path (subtle) */}
    <ellipse
      cx="40"
      cy="40"
      rx="36"
      ry="36"
      stroke="#13AA52"
      strokeWidth="1.5"
      strokeDasharray="4 4"
      fill="none"
      opacity="0.4"
    />

    {/* Left curly bracket */}
    <path
      d="M32 24c-4 0-6 2-6 5v6c0 3-2 5-5 5 3 0 5 2 5 5v6c0 3 2 5 6 5"
      stroke="#00684A"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* Right curly bracket */}
    <path
      d="M48 24c4 0 6 2 6 5v6c0 3 2 5 5 5-3 0-5 2-5 5v6c0 3-2 5-6 5"
      stroke="#00684A"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* MongoDB Leaf in center */}
    <path
      d="M40 30c-2 3.5-4 7-4 11 0 5 2.5 8.5 4 10.5 1.5-2 4-5.5 4-10.5 0-4-2-7.5-4-11z"
      fill="#13AA52"
    />
    <path
      d="M40 30c1 2.5 2 5 2 7.5 0 3-1.2 5.5-2 7"
      stroke="#00684A"
      strokeWidth="1"
      fill="none"
      opacity="0.3"
    />

    {/* Currency moons - on the orbit */}
    {/* Dollar - top */}
    <g transform="translate(32, -1)">
      <circle cx="8" cy="8" r="8" fill="#13AA52" />
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">$</text>
    </g>

    {/* Euro - right */}
    <g transform="translate(65, 32)">
      <circle cx="8" cy="8" r="8" fill="#13AA52" />
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">€</text>
    </g>

    {/* Yen - bottom */}
    <g transform="translate(32, 65)">
      <circle cx="8" cy="8" r="8" fill="#13AA52" />
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">¥</text>
    </g>

    {/* Pound - left */}
    <g transform="translate(-1, 32)">
      <circle cx="8" cy="8" r="8" fill="#13AA52" />
      <text x="8" y="12" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">£</text>
    </g>
  </svg>
);

export default PaymentFlowIcon;
