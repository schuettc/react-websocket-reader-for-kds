import React, { useEffect, useState, useCallback, useRef } from 'react';
import './WebSocketReader.css';
import { WEB_SOCKET_STAGE, WEB_SOCKET_URL } from './Config';

interface Message {
  [key: string]: any;
}

const AlwaysScrollToBottom = () => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (elementRef.current) {
      elementRef.current.scrollIntoView();
    }
  });

  return <div ref={elementRef} />;
};

const WebSocketReader: React.FC = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(WEB_SOCKET_URL + '/' + WEB_SOCKET_STAGE);

    ws.onopen = () => {
      console.log('Connected to WebSocket');
      setSocket(ws);
      setConnected(true);
    };

    ws.onmessage = (event) => {
      console.log('Received message:', event.data);
      const data: Message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, data]);
    };

    ws.onerror = (error: Event) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      setSocket(null);
      setConnected(false);
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  const formatMessage = useCallback((message: Message) => {
    let formattedMessage = '';

    for (const key in message) {
      const formattedKey = key
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const value =
        typeof message[key] === 'object'
          ? JSON.stringify(message[key], null, 2)
          : message[key];
      formattedMessage += `${formattedKey}: ${value}\n`;
    }

    return formattedMessage;
  }, []);

  const MessageItem = React.memo(({ message }: { message: Message }) => (
    <pre>{formatMessage(message)}</pre>
  ));

  return (
    <div className='header'>
      {connected ? (
        <div style={{ color: 'green' }}>WebSocket connected</div>
      ) : (
        <div style={{ color: 'red' }}>WebSocket disconnected</div>
      )}
      <button onClick={clearMessages}>Clear</button>
      <div className='messages'>
        <h2>Messages</h2>
        <ul className='message-list'>
          {messages.map((message, index) => (
            <li key={index} className='message'>
              <MessageItem message={message} />
            </li>
          ))}
        </ul>
        <AlwaysScrollToBottom />
      </div>
    </div>
  );
};

export default WebSocketReader;
