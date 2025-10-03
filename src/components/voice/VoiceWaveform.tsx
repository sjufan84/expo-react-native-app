import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { VoiceWaveformProps } from '../../types/message.types';

interface WaveformBar {
  height: Animated.Value;
  opacity: Animated.Value;
}

const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  audioLevel = 0,
  isActive = false,
  color,
}) => {
  const { theme } = useTheme();
  const [bars, setBars] = useState<WaveformBar[]>([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const barsCount = 7; // Number of waveform bars

  // Initialize bars
  useEffect(() => {
    const newBars: WaveformBar[] = [];
    for (let i = 0; i < barsCount; i++) {
      newBars.push({
        height: new Animated.Value(4),
        opacity: new Animated.Value(0.3),
      });
    }
    setBars(newBars);
  }, []);

  // Animate bars based on audio level
  useEffect(() => {
    if (!isActive || bars.length === 0) {
      // Reset to idle state
      bars.forEach((bar, index) => {
        Animated.parallel([
          Animated.timing(bar.height, {
            toValue: 4,
            duration: 200,
            useNativeDriver: false,
          }),
          Animated.timing(bar.opacity, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      });
      return;
    }

    // Cancel previous animation
    if (animationRef.current) {
      animationRef.current.stop();
    }

    // Create animation based on audio level
    const animations = bars.map((bar, index) => {
      // Create a wave effect with different heights for each bar
      const delay = index * 50;
      const baseHeight = 8;
      const maxHeight = 32;
      const heightVariation = audioLevel * (maxHeight - baseHeight);

      // Create a more natural wave pattern
      const wavePattern = Math.sin((index / bars.length) * Math.PI * 2);
      const targetHeight = baseHeight + (heightVariation * (0.5 + wavePattern * 0.5));

      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(bar.height, {
            toValue: targetHeight,
            duration: 100,
            useNativeDriver: false,
          }),
          Animated.timing(bar.opacity, {
            toValue: 0.8 + audioLevel * 0.2,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    // Start the animation
    animationRef.current = Animated.parallel(animations);
    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [audioLevel, isActive, bars]);

  // Continuous animation when active
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      // Random micro-variations for more natural effect
      bars.forEach((bar, index) => {
        const randomVariation = Math.random() * 4;
        // Use addListener to get current value safely
        let currentHeight = 4;
        bar.height.addListener(({ value }) => {
          currentHeight = value;
        });
        const newHeight = Math.max(4, Math.min(32, currentHeight + randomVariation - 2));

        Animated.timing(bar.height, {
          toValue: newHeight,
          duration: 150,
          useNativeDriver: false,
        }).start();
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isActive, bars]);

  const colors = theme.colors as any;
  const barColor = color || (isActive ? colors.voiceActive || '#22c55e' : colors.voiceInactive || '#64748b');

  return (
    <View style={[styles.container, { opacity: isActive ? 1 : 0.6 }]}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: bar.height,
              opacity: bar.opacity,
              backgroundColor: barColor,
              marginHorizontal: 2,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 8,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 4,
  },
});

export default VoiceWaveform;