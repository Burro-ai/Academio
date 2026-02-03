import { useEffect, useState } from 'react';

/**
 * DynamicBackground - Animated gradient mesh background
 * Provides the colorful backdrop for the liquid glass design system
 */
export function DynamicBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`fixed inset-0 -z-10 transition-opacity duration-1000 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

      {/* Animated gradient mesh */}
      <div
        className="absolute inset-0 animate-gradient-shift"
        style={{
          backgroundSize: '400% 400%',
          backgroundImage: `
            radial-gradient(at 40% 20%, hsla(199, 100%, 74%, 0.35) 0px, transparent 50%),
            radial-gradient(at 80% 0%, hsla(189, 100%, 56%, 0.25) 0px, transparent 50%),
            radial-gradient(at 0% 50%, hsla(355, 100%, 93%, 0.25) 0px, transparent 50%),
            radial-gradient(at 80% 50%, hsla(340, 100%, 76%, 0.2) 0px, transparent 50%),
            radial-gradient(at 0% 100%, hsla(22, 100%, 77%, 0.25) 0px, transparent 50%),
            radial-gradient(at 80% 100%, hsla(242, 100%, 70%, 0.2) 0px, transparent 50%),
            radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.15) 0px, transparent 50%)
          `,
        }}
      />

      {/* Floating orbs for depth */}
      <div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, hsla(199, 100%, 74%, 0.4) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float 20s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-25"
        style={{
          background: 'radial-gradient(circle, hsla(340, 100%, 76%, 0.4) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float 25s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, hsla(242, 100%, 70%, 0.4) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'float 30s ease-in-out infinite',
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* CSS for float animation */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -30px) scale(1.05);
          }
          50% {
            transform: translate(-20px, 20px) scale(0.95);
          }
          75% {
            transform: translate(20px, 30px) scale(1.02);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          @keyframes float {
            0%, 100% {
              transform: none;
            }
          }
        }
      `}</style>
    </div>
  );
}
