import React, { useEffect, useState } from 'react';

function App() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [botIdInput, setBotIdInput] = useState('');
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchBots();
  }, []);

  async function fetchBots() {
    setLoading(true);
    const res = await fetch('/api/bots');
    const json = await res.json();
    setBots(json.bots || []);
    setLoading(false);
  }

  async function manageBot() {
    if (!botIdInput) return alert('Enter botId');
    const ownerUserId = 'demo-user'; // in a real app, derive from auth
    const res = await fetch('/api/manage-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId: botIdInput, ownerUserId, containerName: `ctr-${botIdInput}` })
    });
    const json = await res.json();
    alert('Manage result: ' + JSON.stringify(json));
    fetchBots();
  }

  async function stopBot(id) {
    const res = await fetch('/api/stop-bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ botId: id })});
    const json = await res.json();
    alert('Stop result: ' + JSON.stringify(json));
    fetchBots();
  }

  async function sendMessage() {
    if (!channelId || !message) return alert('channelId and message required');
    const res = await fetch('/api/send-message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, content: message })
    });
    const json = await res.json();
    alert('Send result: ' + JSON.stringify(json));
  }

  return (
    <div style={{padding:20,fontFamily:'Arial'}}>
      <h1>Bot Dashboard (demo)</h1>

      <section style={{marginBottom:20}}>
        <h2>Manage a Bot (simulate provisioning)</h2>
        <input placeholder="botId" value={botIdInput} onChange={e => setBotIdInput(e.target.value)} />
        <button onClick={manageBot} style={{marginLeft:10}}>Manage</button>
      </section>

      <section style={{marginBottom:20}}>
        <h2>Active Bots</h2>
        {loading ? <div>Loading…</div> : (
          <ul>
            {bots.map(b => (
              <li key={b.id}>
                <strong>{b.id}</strong> — status: {b.status || 'unknown'} — container: {b.container_name || 'n/a'}
                <button style={{marginLeft:10}} onClick={() => stopBot(b.id)}>Stop</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{marginBottom:20}}>
        <h2>Send message via bot</h2>
        <input placeholder="channelId" value={channelId} onChange={e => setChannelId(e.target.value)} />
        <input placeholder="message" value={message} onChange={e => setMessage(e.target.value)} style={{marginLeft:10}} />
        <button onClick={sendMessage} style={{marginLeft:10}}>Send</button>
      </section>
    </div>
  );
}

export default App;
