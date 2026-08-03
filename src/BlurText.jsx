import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap(s => Object.keys(s))]);

  const keyframes = {};
  keys.forEach(k => {
    keyframes[k] = [from[k], ...steps.map(s => s[k])];
  });
  return keyframes;
};

const BlurText = ({
  text = '',
  as: Component = 'p',
  play = true,
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = t => t,
  onAnimationComplete,
  stepDuration = 0.35,
  style,
  ...componentProps
}) => {
  const elements = animateBy === 'words' ? text.split(' ') : text.split('');
  const letterWords = animateBy === 'words' ? [] : text.trim().split(/\s+/);
  const animatedElementCount = animateBy === 'words'
    ? elements.length
    : letterWords.reduce((total, word) => total + Array.from(word).length, 0);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!play) {
      setInView(false);
      return undefined;
    }

    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(ref.current);
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [play, threshold, rootMargin]);

  const defaultFrom = useMemo(
    () =>
      direction === 'top' ? { filter: 'blur(10px)', opacity: 0, y: -50 } : { filter: 'blur(10px)', opacity: 0, y: 50 },
    [direction]
  );

  const defaultTo = useMemo(
    () => [
      {
        filter: 'blur(5px)',
        opacity: 0.5,
        y: direction === 'top' ? 5 : -5
      },
      { filter: 'blur(0px)', opacity: 1, y: 0 }
    ],
    [direction]
  );

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshots = animationTo ?? defaultTo;

  const stepCount = toSnapshots.length + 1;
  const totalDuration = stepDuration * (stepCount - 1);
  const times = Array.from({ length: stepCount }, (_, i) => (stepCount === 1 ? 0 : i / (stepCount - 1)));
  const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshots);

  const renderSegment = (segment, index) => {
    const spanTransition = {
      duration: totalDuration,
      times,
      delay: (index * delay) / 1000,
      ease: easing
    };

    return (
      <motion.span
        className="inline-block will-change-[transform,filter,opacity]"
        key={`${segment}-${index}`}
        initial={fromSnapshot}
        animate={inView ? animateKeyframes : fromSnapshot}
        transition={spanTransition}
        onAnimationComplete={index === animatedElementCount - 1 ? onAnimationComplete : undefined}
      >
        {segment}
      </motion.span>
    );
  };

  let letterIndex = 0;

  return (
    <Component
      {...componentProps}
      ref={ref}
      className={className}
      aria-label={componentProps['aria-label'] ?? (animateBy === 'words' ? undefined : text)}
      style={{ display: 'flex', flexWrap: 'wrap', ...style }}
    >
      {animateBy === 'words'
        ? elements.map((segment, index) => (
          <React.Fragment key={`${segment}-${index}`}>
            {renderSegment(segment, index)}
            {index < elements.length - 1 && '\u00A0'}
          </React.Fragment>
        ))
        : letterWords.map((word, wordIndex) => (
          <span
            key={`${word}-${wordIndex}`}
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              flexShrink: 0,
              marginRight: wordIndex < letterWords.length - 1 ? '0.25em' : 0
            }}
          >
            {Array.from(word).map(letter => renderSegment(letter, letterIndex++))}
          </span>
        ))}
    </Component>
  );
};

export default BlurText;
