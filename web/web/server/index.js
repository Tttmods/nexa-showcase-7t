import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // serve client build if deployed

// Supabase server-side client (use anon for auth flows; service key for admin ops)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase env vars missing (SUPABASE_URL / SUPABASE_ANON_KEY)');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bot control API config
const BOT_CONTROL_API_URL = process.env.BOT_CONTROL_API_URL || 'http://localhost:3001';
const BOT_CONTROL_API_KEY = process.env.BOT_CONTROL_API_KEY || 'change_me_bot_api_key';

// Simple API: get list of bots from Supabase
app.get('/api/bots', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bots').select('*').order('created_at', {ascending:false});
    if (error) return res.status(500).json({ error: error.message });
    res.json({ bots: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Trigger bot provisioning via bot control API (calls /manage-bot on bot)
app.post('/api/manage-bot', async (req, res) => {
  const body = req.body; // expects { botId, ownerUserId, containerName? }
  try {
    const r = await fetch(`${BOT_CONTROL_API_URL}/manage-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-api-key': BOT_CONTROL_API_KEY
      },
      body: JSON.stringify(body)
    });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Stop bot
app.post('/api/stop-bot', async (req, res) => {
  const body = req.body; // { botId }
  try {
    const r = await fetch(`${BOT_CONTROL_API_URL}/stop-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-api-key': BOT_CONTROL_API_KEY
      },
      body: JSON.stringify(body)
    });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Simple endpoint to send a message through bot (for testing)
app.post('/api/send-message', async (req, res) => {
  const body = req.body; // { channelId, content }
  try {
    const r = await fetch(`${BOT_CONTROL_API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bot-api-key': BOT_CONTROL_API_KEY
      },
      body: JSON.stringify(body)
    });
    const json = await r.json();
    if (!r.ok) return res.status(r.status).json(json);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Web server listening on http://localhost:${PORT}`);
});
