"use client";

import { useEffect, useState } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number; // optional precision
}

export function AnimatedNumber({
  value,
  duration = 1,
  className = "",
  decimals = 2,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { duration: duration * 1000 });

  useEffect(() => {
    motionValue.set(value);
  }, [motionValue, value]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      const factor = Math.pow(10, decimals);
      setDisplayValue(Math.round(latest * factor) / factor);
    });
    return unsubscribe;
  }, [springValue, decimals]);

  return (
    <motion.span className={className}>
      {displayValue.toFixed(decimals)}
    </motion.span>
  );
}

interface SlotMachineNumberProps {
  value: number;
  duration?: number;
  className?: string;
  decimals?: number;
}

export function SlotMachineNumber({
  value,
  duration = 3,
  className = "",
  decimals = 3,
}: SlotMachineNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value === 0) return;

    setIsAnimating(true);

    const startTime = Date.now();
    let animationFrame: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // 使用easeOut缓动函数，让速度越来越慢
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

      const easedProgress = easeOut(progress);
      const currentValue = value * easedProgress;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        // 动画结束，确保显示精确的最终值
        setDisplayValue(value);
        setIsAnimating(false);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  const formatNumber = (num: number) => {
    return num.toFixed(decimals);
  };

  return (
    <motion.span
      className={className}
      animate={
        isAnimating
          ? {
              scale: [1, 1.02, 1],
              textShadow: [
                "0 0 0px rgba(255,255,255,0)",
                "0 0 4px rgba(255,255,255,0.3)",
                "0 0 0px rgba(255,255,255,0)",
              ],
            }
          : {
              scale: 1,
              textShadow: "0 0 0px rgba(255,255,255,0)",
            }
      }
      transition={{
        duration: 0.2,
        repeat: isAnimating ? Infinity : 0,
        repeatType: "reverse",
        ease: "easeInOut",
      }}
    >
      {formatNumber(displayValue)}
    </motion.span>
  );
}
