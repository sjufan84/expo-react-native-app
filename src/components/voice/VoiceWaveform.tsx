import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { cn } from '../../utils/cn';
import { VoiceWaveformProps } from '../../types/message.types';

interface WaveformBar {
  height: Animated.Value;
  opacity: Animated.Value;
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  audioLevel = 0,
  isActive = false,
  color = 'bg-primary',
  className,
}) => {
  const [bars, setBars] = useState<WaveformBar[]>([]);
  const barsCount = 7;

  useEffect(() => {
    setBars(
      Array(barsCount)
        .fill(null)
        .map(() => ({
          height: new Animated.Value(4),
          opacity: new Animated.Value(0.3),
        }))
    );
  }, []);

  useEffect(() => {
    if (bars.length === 0) return;

    if (!isActive) {
      // Animate to idle state
      bars.forEach((bar) => {
        Animated.parallel([
          Animated.timing(bar.height, { toValue: 4, duration: 200, useNativeDriver: false }),
          Animated.timing(bar.opacity, { toValue: 0.3, duration: 200, useNativeDriver: true }),
        ]).start();
      });
      return;
    }

    // Animate based on audio level
    const animations = bars.map((bar, index) => {
      const baseHeight = 4;
      const maxHeight = 28;
      const heightVariation = audioLevel * (maxHeight - baseHeight);
      const wavePattern = Math.sin((index / (barsCount - 1)) * Math.PI);
      const targetHeight = baseHeight + heightVariation * wavePattern;

      return Animated.parallel([
        Animated.timing(bar.height, {
          toValue: Math.max(baseHeight, targetHeight),
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(bar.opacity, {
          toValue: 0.5 + audioLevel * 0.5,
          duration: 100,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(50, animations).start();

  }, [audioLevel, isActive, bars]);

  return (
    <View className={cn('flex-row items-center justify-center h-10 gap-1', isActive ? 'opacity-100' : 'opacity-60', className)}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          className={cn('w-1 rounded-full', isActive ? color : 'bg-voiceInactive')}
          style={{
            height: bar.height,
            opacity: bar.opacity,
          }}
        />
      ))}
    </View>
  );
};

export default VoiceWaveform;