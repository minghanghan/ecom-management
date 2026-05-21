import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface Props {
  option: any;
  style?: React.CSSProperties;
  height?: number;
}

export default function EChartsWrapper({ option, style, height = 280 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={chartRef} style={{ height, ...style }} />;
}
