import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export default function PromptLine({ onSubmit }) {
  const [value, setValue] = useState('');

  function handleSubmit(submitted) {
    setValue('');
    onSubmit(submitted);
  }

  return (
    <Box>
      <Text>decode&gt; </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
