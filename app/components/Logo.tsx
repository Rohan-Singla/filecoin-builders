export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hexagon outline — references IPFS/content addressing */}
      <path
        d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
        stroke="white"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner fingerprint rings — references unique identity / CID */}
      <path
        d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M15.5 9C14.7 8.1 13.4 7.5 12 7.5"
        stroke="white"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}
