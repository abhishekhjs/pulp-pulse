export function createAlertWebSocket(onMessage, onOpen, onClose) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/alerts`;

  let socket = null;
  let reconnectTimer = null;
  let isClosedManually = false;

  function connect() {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('[WS] Connected to Alert Stream');
      if (onOpen) onOpen();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    socket.onclose = () => {
      if (onClose) onClose();
      if (!isClosedManually) {
        reconnectTimer = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    socket.onerror = (err) => {
      console.warn('[WS] Error:', err);
      socket.close();
    };
  }

  connect();

  return {
    send: (msg) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    },
    close: () => {
      isClosedManually = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    }
  };
}
