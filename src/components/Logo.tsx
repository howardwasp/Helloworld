export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#122033" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#8fbfd8" strokeWidth="1.6" />
      <circle cx="32" cy="32" r="10" fill="none" stroke="#8fbfd8" strokeWidth="1.2" opacity="0.7" />
      <path
        d="M16 34h8l3-8 5 16 4-10 3 6h9"
        fill="none"
        stroke="#3dd68c"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="38" r="2.2" fill="#3dd68c" />
    </svg>
  )
}
