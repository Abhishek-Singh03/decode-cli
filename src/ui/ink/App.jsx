import React, { useState, useCallback } from 'react';
import { Box, useApp } from 'ink';
import WelcomeBanner from './WelcomeBanner.jsx';
import MessageLog from './MessageLog.jsx';
import PromptLine from './PromptLine.jsx';
import StatusBar from './StatusBar.jsx';
import { dispatchCommand } from '../../session/session.js';

export default function App({ config }) {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [showBanner, setShowBanner] = useState(true);
  const cwd = process.cwd();

  const handleSubmit = useCallback(async (raw) => {
    if (!raw.trim()) return;

    setShowBanner(false);

    // Capture console output from command handlers
    const captured = [];
    const origLog = console.log;
    const origErr = console.error;
    console.log = (...args) => captured.push(args.join(' '));
    console.error = (...args) => captured.push(args.join(' '));

    let result;
    try {
      result = await dispatchCommand(raw.trim(), config);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    if (captured.length) {
      setMessages((prev) => [...prev, ...captured]);
    }

    if (result?.type === 'exit') {
      exit();
    }
  }, [config, exit]);

  return (
    <Box flexDirection="column">
      {showBanner && <WelcomeBanner config={config} cwd={cwd} />}
      <MessageLog messages={messages} />
      <PromptLine onSubmit={handleSubmit} />
      <StatusBar cwd={cwd} />
    </Box>
  );
}
