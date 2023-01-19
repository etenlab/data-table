import React, { ReactElement, useEffect, useRef } from 'react';

export const HeightWatcher = (props: {
  intervalMs: number;
  onHeightChanged: (valuePx: number) => void;
  children: ReactElement | ReactElement[];
}) => {
  const ref =
    useRef<HTMLDivElement>() as React.MutableRefObject<HTMLInputElement>;

  useEffect(() => {
    let lastHeight = -1;
    const interval = setInterval(() => {
      const offsetHeight = ref.current?.offsetHeight || 0;

      if (offsetHeight !== lastHeight) {
        props.onHeightChanged(offsetHeight);
      }

      lastHeight = offsetHeight;
    }, props.intervalMs);

    return () => clearInterval(interval);
  });

  return <div ref={ref}>{props.children}</div>;
};
