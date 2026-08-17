import React from 'react';
import { Box, Text } from 'ink';

export default function MessageLog({ messages }) {
  if (!messages.length) return null;

  return (
    <Box flexDirection="column">
      {messages.map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  );
}
