export default function LogoMark({ size = 32 }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#emeraldGrad)" />
            <rect x="1" y="1" width="30" height="30" rx="8" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            <path d="M9 11.5h14l-12 9h12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
                <linearGradient id="emeraldGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#059669" />
                    <stop offset="1" stopColor="#0891B2" />
                </linearGradient>
            </defs>
        </svg>
    )
}
