import React from 'react';
import figlet from 'figlet';
import { Box, Text } from 'ink';

export const TIPS = [
  '/help   list all commands',
  '/exit   quit the session',
];

export const WHATS_NEW = [
  '• Interactive session UI',
];

export default function WelcomeBanner({ config, cwd }) {
  const isFirstRun = config.llm?.provider === null || config.llm?.provider === undefined;
  const provider = config.llm?.provider ?? '—';
  const promptArt = figlet.textSync('/><', { font: 'ansi_shadow' });

  return (
    <Box borderStyle="round" flexDirection="row" paddingX={1}>
      {/* Left column */}
      <Box flexDirection="column" marginRight={2} minWidth={24}>
        <Text>{promptArt}</Text>
        <Text bold>DeCode</Text>
        <Text dimColor>Your Project, Decoded.</Text>
        <Text> </Text>
        <Text>{isFirstRun ? 'Welcome!' : 'Welcome back!'}</Text>
        <Text dimColor>{cwd}</Text>
        <Text dimColor>Provider: {provider}</Text>
      </Box>

      {/* Divider */}
      <Box borderStyle="classic" borderLeft borderRight={false} borderTop={false} borderBottom={false} marginRight={2} />

      {/* Right column */}
      <Box flexDirection="column" minWidth={28}>
        <Text bold>Tips for getting started</Text>
        {TIPS.map((tip) => (
          <Text key={tip} dimColor>{tip}</Text>
        ))}
        <Text> </Text>
        <Text bold>What&apos;s new</Text>
        {WHATS_NEW.map((item) => (
          <Text key={item} dimColor>{item}</Text>
        ))}
      </Box>
    </Box>
  );
}
