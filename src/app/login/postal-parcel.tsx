export function PostalParcel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 240" aria-hidden="true" fill="none">
            <path d="M3 198h49l49-28m157 14h54l43-25M217 52h59l45-26" stroke="#b9d5ff" strokeOpacity=".45" strokeDasharray="4 7" />
            <path d="m180 29 91 49v89l-91 50-91-50V78z" fill="#174b91" stroke="#b9d5ff" strokeWidth="2" />
            <path d="m89 78 91 50 91-50m-91 50v89" stroke="#b9d5ff" strokeWidth="2" />
            <path d="m139 51 91 49v35l-19 10v-35l-91-49z" fill="#ffc400" />
            <path d="m106 112 52 29v42l-52-29z" fill="#f4f7fc" />
            <path d="m115 127 30 17m-30-7 30 17m-30-7 18 10" stroke="#0b3b83" strokeWidth="2" strokeLinecap="round" />
            <circle cx="321" cy="26" r="4" fill="#ffc400" />
            <circle cx="355" cy="159" r="3" fill="#b9d5ff" />
            <circle cx="3" cy="198" r="3" fill="#b9d5ff" />
          </svg>
  );
}
