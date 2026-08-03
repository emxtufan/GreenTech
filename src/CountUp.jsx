import React, { useCallback, useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = "",
  onStart,
  onEnd,
}) {
  const ref = useRef(null);
  const motionValue = useMotionValue(direction === "down" ? to : from);
  const safeDuration = Math.max(0.1, Number(duration) || 2);
  const springValue = useSpring(motionValue, {
    damping: 20 + 40 * (1 / safeDuration),
    stiffness: 100 * (1 / safeDuration),
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const getDecimalPlaces = (number) => {
    const value = number.toString();
    if (!value.includes(".")) return 0;

    const decimals = value.split(".")[1];
    return Number.parseInt(decimals, 10) === 0 ? 0 : decimals.length;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback((latest) => {
    const options = {
      useGrouping: Boolean(separator),
      minimumFractionDigits: maxDecimals,
      maximumFractionDigits: maxDecimals,
    };
    const formatted = Intl.NumberFormat("en-US", options).format(latest);
    return separator ? formatted.replace(/,/g, separator) : formatted;
  }, [maxDecimals, separator]);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === "down" ? to : from);
    }
  }, [direction, formatValue, from, to]);

  useEffect(() => {
    if (!isInView || !startWhen) return undefined;

    onStart?.();
    const startTimer = window.setTimeout(() => {
      motionValue.set(direction === "down" ? from : to);
    }, delay * 1000);
    const endTimer = window.setTimeout(() => {
      onEnd?.();
    }, delay * 1000 + safeDuration * 1000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
    };
  }, [delay, direction, from, isInView, motionValue, onEnd, onStart, safeDuration, startWhen, to]);

  useEffect(() => springValue.on("change", (latest) => {
    if (ref.current) ref.current.textContent = formatValue(latest);
  }), [formatValue, springValue]);

  return <span className={className} ref={ref} />;
}
