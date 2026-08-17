import React from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';

export default function StatusBar({ cwd }) {
  const basename = path.basename(cwd);

  return (
    <Box paddingX={1}>
      <Text dimColor>● session   ? for shortcuts   {basename}</Text>
    </Box>
  );
}
