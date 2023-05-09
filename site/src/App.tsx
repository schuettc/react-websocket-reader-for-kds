import React from 'react';
import './App.css';
import WebSocketReader from './WebSocketReader';

const App: React.FC = () => {
  return (
    <div className='App'>
      <header className='App-header'>
        <h1>React WebSocket Example</h1>
      </header>
      <main>
        <WebSocketReader />
      </main>
    </div>
  );
};

export default App;
