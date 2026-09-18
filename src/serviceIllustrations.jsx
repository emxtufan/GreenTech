import React from "react";

// Line-art stand-ins for the four service models, drawn in by scroll on
// mobile (see ServiceSvgIllustration). Every animated element declares where
// it sits on the 0..1 build timeline: `data-build="start duration"`. Strokes
// are traced through stroke-dashoffset (hence pathLength), fills fade in.
const PATH_LENGTH = 100;
const VIEW_BOX = "0 0 480 320";

const stroke = (start, duration = 0.08) => ({
  "data-build": `${start} ${duration}`,
  pathLength: PATH_LENGTH,
});
const fill = (start, duration = 0.06) => ({
  "data-build": `${start} ${duration}`,
  "data-mode": "fill",
});

/* ---------------------------------------------------------------- solar */

function SolarPanel({ x, y, w, h, skew, start, legs = true, className }) {
  const frame = `M${x} ${y} L${x + w} ${y} L${x + w + skew} ${y - h} L${x + skew} ${y - h} Z`;
  const step = 0.035;
  return (
    <g className={className}>
      {legs && (
        <>
          <line x1={x + w * 0.22} y1={y} x2={x + w * 0.22} y2={272} {...stroke(start, 0.05)} />
          <line x1={x + w * 0.78} y1={y} x2={x + w * 0.78} y2={272} {...stroke(start, 0.05)} />
          <line x1={x + w * 0.22} y1={y + 18} x2={x + w * 0.78} y2={y + 18} {...stroke(start + 0.02, 0.04)} className="faint" />
        </>
      )}
      <path d={frame} {...stroke(start + step, 0.09)} />
      {[1 / 3, 2 / 3].map((k) => (
        <line
          key={k}
          x1={x + w * k}
          y1={y}
          x2={x + skew + w * k}
          y2={y - h}
          {...stroke(start + step * 2, 0.06)}
          className="faint"
        />
      ))}
      <line
        x1={x + skew / 2}
        y1={y - h / 2}
        x2={x + w + skew / 2}
        y2={y - h / 2}
        {...stroke(start + step * 3, 0.06)}
        className="faint"
      />
      <path d={frame} {...fill(start + step * 4, 0.08)} className="fill-soft" />
    </g>
  );
}

function SolarIllustration() {
  const rays = Array.from({ length: 8 }, (_, index) => (index * Math.PI) / 4);
  return (
    <svg viewBox={VIEW_BOX}>
      <line x1="20" y1="272" x2="460" y2="272" {...stroke(0, 0.1)} />
      <line x1="60" y1="284" x2="300" y2="284" {...stroke(0.04, 0.08)} className="faint" />

      {[60, 150, 240, 330].map((x, index) => (
        <SolarPanel
          key={x}
          x={x}
          y={176}
          w={46}
          h={20}
          skew={8}
          start={0.08 + index * 0.03}
          legs={false}
          className="faint"
        />
      ))}

      {[30, 170, 310].map((x, index) => (
        <SolarPanel key={x} x={x} y={236} w={100} h={56} skew={22} start={0.18 + index * 0.13} />
      ))}

      <g className="solar-sun">
        <circle cx="404" cy="72" r="26" {...stroke(0.6, 0.1)} className="accent" />
        <circle cx="404" cy="72" r="20" {...fill(0.68, 0.08)} className="fill-soft" />
        {rays.map((angle, index) => (
          <line
            key={angle}
            x1={404 + Math.cos(angle) * 34}
            y1={72 + Math.sin(angle) * 34}
            x2={404 + Math.cos(angle) * 46}
            y2={72 + Math.sin(angle) * 46}
            {...stroke(0.72 + index * 0.015, 0.05)}
            className="accent solar-ray"
          />
        ))}
      </g>

      <rect x="430" y="232" width="34" height="40" rx="3" {...stroke(0.82, 0.06)} />
      <line x1="438" y1="244" x2="456" y2="244" {...stroke(0.86, 0.03)} className="faint" />
      <line x1="438" y1="252" x2="450" y2="252" {...stroke(0.88, 0.03)} className="faint" />
      <circle cx="456" cy="262" r="2.5" {...fill(0.9, 0.04)} className="fill-accent solar-led" />
      <path d="M430 262 H70" {...stroke(0.9, 0.1)} className="accent" />
    </svg>
  );
}

/* ----------------------------------------------------------- electrical */

function ElectricalIllustration() {
  const rails = [100, 150, 200];
  const slots = [170, 194, 218, 242, 266, 290];
  return (
    <svg viewBox={VIEW_BOX}>
      <rect x="140" y="40" width="200" height="232" rx="4" {...stroke(0, 0.14)} />
      <rect x="152" y="52" width="176" height="208" rx="2" {...stroke(0.1, 0.1)} className="faint" />

      {rails.map((y, row) => (
        <g key={y}>
          <line x1="168" y1={y} x2="312" y2={y} {...stroke(0.2 + row * 0.05, 0.06)} className="faint" />
          {slots.map((x, index) => {
            const order = row * slots.length + index;
            const on = (order * 7) % 5 !== 0;
            return (
              <g key={x}>
                <rect x={x} y={y - 13} width="18" height="26" rx="1.5" {...stroke(0.3 + order * 0.013, 0.05)} />
                <rect
                  x={x + 5}
                  y={y - 8}
                  width="8"
                  height="6"
                  rx="1"
                  {...fill(0.55 + order * 0.01, 0.04)}
                  className={on ? "fill-accent" : "fill-grey"}
                />
              </g>
            );
          })}
        </g>
      ))}

      <line x1="168" y1="72" x2="312" y2="72" {...stroke(0.62, 0.06)} className="accent" />
      {slots.map((x, index) => (
        <line key={x} x1={x + 9} y1="72" x2={x + 9} y2="87" {...stroke(0.67 + index * 0.015, 0.04)} className="accent" />
      ))}

      {[200, 280].map((cx, index) => (
        <g key={cx}>
          <circle cx={cx} cy="240" r="16" {...stroke(0.74 + index * 0.04, 0.08)} />
          <path d={`M${cx - 10} ${240 - 4} A11 11 0 0 1 ${cx + 10} ${240 - 4}`} {...stroke(0.79 + index * 0.04, 0.05)} className="faint" />
          <line x1={cx} y1="240" x2={cx + 9} y2="231" {...stroke(0.83 + index * 0.04, 0.04)} className="accent gauge-needle" />
        </g>
      ))}

      <polygon points="382,104 360,158 376,158 366,204 402,146 386,146 396,104" {...stroke(0.86, 0.08)} className="accent" />
      <polygon points="382,104 360,158 376,158 366,204 402,146 386,146 396,104" {...fill(0.92, 0.06)} className="fill-soft" />

      <g className="thermal-reticle">
        <circle cx="80" cy="150" r="28" {...stroke(0.86, 0.07)} />
        <line x1="80" y1="112" x2="80" y2="130" {...stroke(0.92, 0.04)} />
        <line x1="80" y1="170" x2="80" y2="188" {...stroke(0.92, 0.04)} />
        <line x1="42" y1="150" x2="60" y2="150" {...stroke(0.92, 0.04)} />
        <line x1="100" y1="150" x2="118" y2="150" {...stroke(0.92, 0.04)} />
        <circle cx="80" cy="150" r="3.5" {...fill(0.96, 0.04)} className="fill-accent thermal-dot" />
      </g>
    </svg>
  );
}

/* --------------------------------------------------------- construction */

function ConstructionIllustration() {
  const columns = [250, 320, 390];
  const floors = [276, 231, 186, 141, 96];
  return (
    <svg viewBox={VIEW_BOX}>
      <line x1="20" y1="276" x2="460" y2="276" {...stroke(0, 0.08)} />

      {floors.slice(1).map((top, level) => {
        const bottom = floors[level];
        const start = 0.08 + level * 0.1;
        return (
          <g key={top}>
            {columns.map((x) => (
              <line key={x} x1={x} y1={bottom} x2={x} y2={top} {...stroke(start, 0.06)} />
            ))}
            <line x1={columns[0]} y1={top} x2={columns[2]} y2={top} {...stroke(start + 0.06, 0.05)} />
            <line
              x1={columns[level % 2]}
              y1={bottom}
              x2={columns[(level % 2) + 1]}
              y2={top}
              {...stroke(start + 0.08, 0.04)}
              className="faint"
            />
          </g>
        );
      })}

      <rect x="60" y="266" width="60" height="10" {...stroke(0.5, 0.04)} />
      <line x1="84" y1="266" x2="84" y2="60" {...stroke(0.54, 0.1)} />
      <line x1="96" y1="266" x2="96" y2="60" {...stroke(0.54, 0.1)} />
      <polyline
        points="84,266 96,250 84,234 96,218 84,202 96,186 84,170 96,154 84,138 96,122 84,106 96,90 84,74 96,60"
        {...stroke(0.6, 0.1)}
        className="faint"
      />
      <line x1="52" y1="60" x2="430" y2="60" {...stroke(0.66, 0.08)} />
      <line x1="90" y1="28" x2="52" y2="60" {...stroke(0.72, 0.05)} className="faint" />
      <line x1="90" y1="28" x2="430" y2="60" {...stroke(0.72, 0.07)} className="faint" />
      <line x1="84" y1="60" x2="96" y2="28" {...stroke(0.72, 0.04)} />
      <rect x="52" y="60" width="26" height="14" {...stroke(0.76, 0.04)} />
      <polygon points="90,28 90,14 104,21" {...fill(0.94, 0.05)} className="fill-accent" />

      <g className="crane-load">
        <rect x="356" y="60" width="16" height="8" {...stroke(0.8, 0.04)} />
        <line x1="364" y1="68" x2="364" y2="116" {...stroke(0.84, 0.05)} className="accent" />
        <path d="M364 116 v8 c0 8 12 8 12 0" {...stroke(0.88, 0.04)} className="accent" />
        <rect x="346" y="128" width="36" height="6" {...stroke(0.9, 0.05)} />
        <rect x="346" y="128" width="36" height="6" {...fill(0.95, 0.05)} className="fill-soft" />
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------- data center */

function DataCenterIllustration() {
  const racks = [148, 212, 276];
  const units = [1, 2, 3, 4, 5, 6];
  return (
    <svg viewBox={VIEW_BOX}>
      <line x1="20" y1="276" x2="460" y2="276" {...stroke(0, 0.08)} />
      <line x1="60" y1="250" x2="420" y2="250" {...stroke(0.04, 0.08)} className="faint" />
      <line x1="90" y1="228" x2="390" y2="228" {...stroke(0.08, 0.08)} className="faint" />
      {[[20, 90], [130, 165], [240, 240], [350, 315], [460, 390]].map(([x1, x2]) => (
        <line key={x1} x1={x1} y1="276" x2={x2} y2="228" {...stroke(0.1, 0.06)} className="faint" />
      ))}

      {racks.map((x, rack) => (
        <g key={x}>
          <rect x={x} y="78" width="56" height="150" rx="2" {...stroke(0.16 + rack * 0.08, 0.08)} />
          {units.map((unit) => {
            const y = 78 + unit * 22;
            const order = rack * units.length + unit;
            return (
              <g key={unit}>
                <line x1={x} y1={y} x2={x + 56} y2={y} {...stroke(0.36 + order * 0.008, 0.04)} className="faint" />
                <circle cx={x + 8} cy={y - 11} r="2" {...fill(0.58 + order * 0.01, 0.04)} className="fill-accent rack-led" style={{ animationDelay: `${(order * 0.37) % 2.1}s` }} />
                <circle cx={x + 15} cy={y - 11} r="2" {...fill(0.58 + order * 0.01, 0.04)} className={order % 4 === 0 ? "fill-grey" : "fill-accent rack-led"} style={{ animationDelay: `${(order * 0.61) % 2.1}s` }} />
                <line x1={x + 24} y1={y - 11} x2={x + 48} y2={y - 11} {...stroke(0.4 + order * 0.008, 0.03)} className="faint" />
              </g>
            );
          })}
        </g>
      ))}

      <line x1="100" y1="56" x2="380" y2="56" {...stroke(0.7, 0.06)} className="accent" />
      {racks.map((x, index) => (
        <line key={x} x1={x + 28} y1="56" x2={x + 28} y2="78" {...stroke(0.76 + index * 0.02, 0.04)} className="accent" />
      ))}

      <rect x="372" y="150" width="52" height="78" rx="2" {...stroke(0.8, 0.06)} />
      <circle cx="398" cy="180" r="16" {...stroke(0.86, 0.05)} />
      <g className="cooling-fan">
        {[0, 120, 240].map((angle) => (
          <line
            key={angle}
            x1="398"
            y1="180"
            x2={398 + Math.cos((angle * Math.PI) / 180) * 13}
            y2={180 + Math.sin((angle * Math.PI) / 180) * 13}
            {...stroke(0.9, 0.04)}
            className="accent"
          />
        ))}
      </g>
      {[210, 216, 222].map((y) => (
        <line key={y} x1="380" y1={y} x2="416" y2={y} {...stroke(0.93, 0.03)} className="faint" />
      ))}

      <rect x="48" y="140" width="64" height="42" rx="2" {...stroke(0.84, 0.05)} />
      <line x1="80" y1="182" x2="80" y2="194" {...stroke(0.88, 0.03)} />
      <line x1="66" y1="194" x2="94" y2="194" {...stroke(0.9, 0.03)} />
      <polyline points="56,172 66,160 74,168 84,150 94,158 104,148" {...stroke(0.92, 0.06)} className="accent" />
    </svg>
  );
}

const serviceIllustrations = {
  solar: SolarIllustration,
  electrical: ElectricalIllustration,
  construction: ConstructionIllustration,
  "data-center": DataCenterIllustration,
};

export default serviceIllustrations;
