const config = await fetch('/config.json').then((response) => response.json());

export const WEB_SOCKET_URL = config.webSocketUrl;

export const WEB_SOCKET_STAGE = config.webSocketStage;

console.log('config', config);
