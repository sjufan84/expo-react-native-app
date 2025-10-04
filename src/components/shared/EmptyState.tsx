import React from 'react';
import { View, Text } from 'react-native';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  prompts?: { text: string; action: () => void }[];
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  subtitle,
  prompts,
  className,
}) => {
  return (
    <View className={cn('flex-1 items-center justify-center p-8', className)}>
      <Text className="text-2xl font-bold text-center text-text dark:text-textDark">
        {title}
      </Text>
      <Text className="mt-2 mb-8 text-base text-center text-textSecondary dark:text-textSecondaryDark">
        {subtitle}
      </Text>
      {prompts && prompts.length > 0 && (
        <View className="w-full max-w-sm gap-3">
          {prompts.map((prompt, index) => (
            <Button
              key={index}
              variant="outline"
              onPress={prompt.action}
              className="py-6 bg-backgroundSecondary dark:bg-backgroundSecondaryDark"
            >
              <Text className="text-sm font-semibold text-text dark:text-textDark">
                "{prompt.text}"
              </Text>
            </Button>
          ))}
        </View>
      )}
    </View>
  );
};

export default EmptyState;