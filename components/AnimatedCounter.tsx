"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
  className?: string;
}

export default function AnimatedCounter({
  value,
  duration = 1.25,
  formatFn,
  className = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on("change", (latest) => {
      if (ref.current) {
        const displayValue = formatFn ? formatFn(latest) : Math.floor(latest).toString();
        ref.current.textContent = displayValue;
      }
    });

    return () => unsubscribe();
  }, [springValue, formatFn]);

  return <span ref={ref} className={className}>0</span>;
}

