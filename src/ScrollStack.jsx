import React, { useCallback, useLayoutEffect, useRef } from "react";
import "./ScrollStack.css";

export function ScrollStackItem({ children, itemClassName = "", stackOffset }) {
  return (
    <article
      className={`scroll-stack-card ${itemClassName}`.trim()}
      data-stack-offset={stackOffset}
    >
      {children}
    </article>
  );
}

export default function ScrollStack({
  children,
  className = "",
  itemDistance = 96,
  itemScale = 0.035,
  itemStackDistance = 24,
  stackPosition = "18%",
  scaleEndPosition = "8%",
  baseScale = 0.86,
  rotationAmount = 0.6,
  blurAmount = 0,
  onStackComplete,
}) {
  const scrollerRef = useRef(null);
  const cardsRef = useRef([]);
  const animationFrameRef = useRef(0);
  const stackCompletedRef = useRef(false);

  const parsePosition = useCallback((value, viewportHeight) => {
    if (typeof value === "string" && value.includes("%")) {
      return (Number.parseFloat(value) / 100) * viewportHeight;
    }

    return Number.parseFloat(value) || 0;
  }, []);

  const updateCards = useCallback(() => {
    const root = scrollerRef.current;
    const cards = cardsRef.current;
    const inner = root?.querySelector(".scroll-stack-inner");
    if (!root || !inner || !cards.length || root.offsetParent === null) return;

    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const stackPositionPx = parsePosition(stackPosition, viewportHeight);
    const scaleEndPositionPx = parsePosition(scaleEndPosition, viewportHeight);
    const rootTop = root.getBoundingClientRect().top + scrollTop;
    const innerStyles = window.getComputedStyle(inner);
    const innerTop = inner.offsetTop + (Number.parseFloat(innerStyles.paddingTop) || 0);
    let naturalOffset = innerTop;
    let lastPinStart = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const stickyTop = stackPositionPx;
      const customOffset = Number.parseFloat(card.dataset.stackOffset);
      const visualOffset = Number.isFinite(customOffset)
        ? customOffset
        : itemStackDistance * index;
      const naturalTop = rootTop + naturalOffset;
      const pinStart = naturalTop - stickyTop;
      const scaleEnd = Math.max(pinStart + 1, naturalTop - scaleEndPositionPx);
      const progress = Math.min(1, Math.max(0, (scrollTop - pinStart) / (scaleEnd - pinStart)));
      const isLastCard = index === cards.length - 1;
      const targetScale = isLastCard ? 1 : Math.min(1, baseScale + index * itemScale);
      const scale = 1 - progress * (1 - targetScale);
      const rotation = isLastCard ? 0 : index * rotationAmount * progress;

      let topCardIndex = 0;
      for (let cardIndex = 0, offset = innerTop; cardIndex < cards.length; cardIndex += 1) {
        const candidate = cards[cardIndex];
        const candidateTop = rootTop + offset;
        const candidatePinStart = candidateTop - stackPositionPx;
        if (scrollTop >= candidatePinStart) topCardIndex = cardIndex;
        offset += candidate.offsetHeight + (cardIndex < cards.length - 1 ? itemDistance : 0);
      }

      const blur = index < topCardIndex ? (topCardIndex - index) * blurAmount : 0;

      card.style.top = `${Math.round(stickyTop * 100) / 100}px`;
      card.style.zIndex = String(index + 1);
      card.style.transform = `translate3d(0px, ${visualOffset}px, 0px) scale(${Math.round(scale * 1000) / 1000}) rotate(${Math.round(rotation * 100) / 100}deg)`;
      card.style.filter = blur > 0 ? `blur(${Math.round(blur * 100) / 100}px)` : "";

      naturalOffset += card.offsetHeight + (index < cards.length - 1 ? itemDistance : 0);
      if (index === cards.length - 1) lastPinStart = pinStart;
    });

    const stackIsComplete = scrollTop >= lastPinStart;

    if (stackIsComplete && !stackCompletedRef.current) {
      stackCompletedRef.current = true;
      onStackComplete?.({ scrollStart: lastPinStart });
    } else if (!stackIsComplete) {
      stackCompletedRef.current = false;
    }
  }, [
    baseScale,
    blurAmount,
    itemDistance,
    itemScale,
    itemStackDistance,
    onStackComplete,
    parsePosition,
    rotationAmount,
    scaleEndPosition,
    stackPosition,
  ]);

  useLayoutEffect(() => {
    const root = scrollerRef.current;
    if (!root) return undefined;

    const cards = Array.from(root.querySelectorAll(".scroll-stack-card"));
    cardsRef.current = cards;

    cards.forEach((card) => {
      card.style.marginBottom = "0px";
      card.style.willChange = "transform, filter";
      card.style.transformOrigin = "top center";
      card.style.backfaceVisibility = "hidden";
    });

    const scheduleUpdate = () => {
      if (animationFrameRef.current) return;
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = 0;
        updateCards();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(root);
    cards.forEach((card) => resizeObserver.observe(card));

    updateCards();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(animationFrameRef.current);
      resizeObserver.disconnect();
      cardsRef.current = [];
      stackCompletedRef.current = false;
    };
  }, [itemDistance, updateCards]);

  const stackItems = React.Children.toArray(children);

  return (
    <div className={`scroll-stack-scroller ${className}`.trim()} ref={scrollerRef}>
      <div className="scroll-stack-inner">
        {stackItems.map((item, index) => (
          <React.Fragment key={item.key ?? index}>
            {item}
            {index < stackItems.length - 1 && (
              <div
                className="scroll-stack-gap"
                style={{ height: `${itemDistance}px` }}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        ))}
        <div className="scroll-stack-end" aria-hidden="true" />
      </div>
    </div>
  );
}
