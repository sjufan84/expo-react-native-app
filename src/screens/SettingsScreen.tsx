import React from 'react';
import { View, Text, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

const SettingsScreen: React.FC = () => {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [settings, setSettings] = React.useState({
    darkMode: colorScheme === 'dark',
    history: true,
    typingIndicators: true,
    voiceMode: 'Push to Talk',
    audioQuality: 'High',
  });

  const handleToggle = (key: keyof typeof settings) => {
    if (key === 'darkMode') {
      toggleColorScheme();
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const SettingRow = ({ label, description, control }: { label: string; description?: string; control: React.ReactNode }) => (
    <View className="flex-row items-center justify-between py-4">
      <View className="flex-1 pr-4">
        <Text className="text-base font-semibold text-text dark:text-textDark">{label}</Text>
        {description && <Text className="text-sm text-textSecondary dark:text-textSecondaryDark mt-1">{description}</Text>}
      </View>
      {control}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-backgroundDark">
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-border dark:border-borderDark">
        <Button variant="ghost" size="icon">
          <Text className="text-2xl">←</Text>
        </Button>
        <Text className="text-xl font-bold text-text dark:text-textDark">Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Dark Mode"
              description="Reduce eye strain in low light"
              control={<Switch value={settings.darkMode} onValueChange={() => handleToggle('darkMode')} />}
            />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Voice & Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow
              label="Voice Mode"
              description="Push to talk or continuous"
              control={<Text className="text-base text-textSecondary dark:text-textSecondaryDark">{settings.voiceMode}</Text>}
            />
            <View className="h-px bg-border dark:bg-borderDark my-2" />
            <SettingRow
              label="Message History"
              description="Keep conversation history"
              control={<Switch value={settings.history} onValueChange={() => handleToggle('history')} />}
            />
            <View className="h-px bg-border dark:bg-borderDark my-2" />
            <SettingRow
              label="Typing Indicators"
              description="Show when BakeBot is typing"
              control={<Switch value={settings.typingIndicators} onValueChange={() => handleToggle('typingIndicators')} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingRow label="Version" control={<Text className="text-base text-textSecondary dark:text-textSecondaryDark">1.0.0</Text>} />
            <View className="h-px bg-border dark:bg-borderDark my-2" />
            <SettingRow label="Privacy Policy" control={<Text className="text-lg">→</Text>} />
             <View className="h-px bg-border dark:bg-borderDark my-2" />
            <SettingRow label="Terms of Service" control={<Text className="text-lg">→</Text>} />
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;