import React from 'react';
import { ActivityIndicator, ActivityIndicatorProps, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

type SpinnerProps = ActivityIndicatorProps & {
  colorKey?: keyof typeof Colors;
};

const Spinner: React.FC<SpinnerProps> = ({ colorKey = 'primary', ...props }) => {
  return (
    <ActivityIndicator
      color={Colors[colorKey]}
      {...props}
    />
  );
};

export { Spinner };