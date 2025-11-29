import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LiquidProgressBarProps {
  progress: number; // 0-100
  label?: string;
  color?: string;
}

export const LiquidProgressBar: React.FC<LiquidProgressBarProps> = ({
  progress,
  label = 'Loading...',
  color = '#3b82f6', // blue-500
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className="w-full max-w-md">
      {/* Progress Label */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-zinc-200">{label}</span>
        <span className="text-sm font-mono text-zinc-400">{Math.round(displayProgress)}%</span>
      </div>

      {/* Progress Bar Container */}
      <div className="relative h-3 bg-zinc-800/50 rounded-full overflow-hidden backdrop-blur-sm border border-zinc-700/50">
        {/* Background Glow */}
        <motion.div
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Main Progress Fill */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
          style={{
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            boxShadow: `0 0 20px ${color}80, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${displayProgress}%` }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {/* Liquid Wave Effect */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 400 20"
            preserveAspectRatio="none"
          >
            <motion.path
              d="M0,10 Q10,5 20,10 T40,10 T60,10 T80,10 T100,10 T120,10 T140,10 T160,10 T180,10 T200,10 T220,10 T240,10 T260,10 T280,10 T300,10 T320,10 T340,10 T360,10 T380,10 T400,10 L400,20 L0,20 Z"
              fill="rgba(255,255,255,0.15)"
              animate={{
                d: [
                  'M0,10 Q10,5 20,10 T40,10 T60,10 T80,10 T100,10 T120,10 T140,10 T160,10 T180,10 T200,10 T220,10 T240,10 T260,10 T280,10 T300,10 T320,10 T340,10 T360,10 T380,10 T400,10 L400,20 L0,20 Z',
                  'M0,10 Q10,15 20,10 T40,10 T60,10 T80,10 T100,10 T120,10 T140,10 T160,10 T180,10 T200,10 T220,10 T240,10 T260,10 T280,10 T300,10 T320,10 T340,10 T360,10 T380,10 T400,10 L400,20 L0,20 Z',
                  'M0,10 Q10,5 20,10 T40,10 T60,10 T80,10 T100,10 T120,10 T140,10 T160,10 T180,10 T200,10 T220,10 T240,10 T260,10 T280,10 T300,10 T320,10 T340,10 T360,10 T380,10 T400,10 L400,20 L0,20 Z',
                ],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </svg>

          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            }}
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>

        {/* Particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              backgroundColor: color,
              left: `${(displayProgress * (i + 1)) / 6}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              filter: 'blur(1px)',
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      {/* Status Message */}
      <motion.div
        className="mt-3 text-xs text-center text-zinc-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {displayProgress < 30 && 'Scanning files...'}
        {displayProgress >= 30 && displayProgress < 60 && 'Parsing dependencies...'}
        {displayProgress >= 60 && displayProgress < 90 && 'Building graph...'}
        {displayProgress >= 90 && displayProgress < 100 && 'Finalizing...'}
        {displayProgress === 100 && 'Complete!'}
      </motion.div>
    </div>
  );
};
