import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface Props {
  option: any;
  style?: React.CSSProperties;
  height?: number;
  theme?: string;
}

export default function EChartsWrapper({ option, style, height = 280, theme }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current, theme);

    const observer = new ResizeObserver(() => {
      instanceRef.current?.resize();
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={chartRef} style={{ height, ...style }} />;
}
