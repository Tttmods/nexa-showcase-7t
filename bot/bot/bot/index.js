import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import { Client, GatewayIntentBits } from 'discord.js';
import { createClient } from '@supabase/supabase-js';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const BOT_API_KEY = process.env.BOT_API_KEY;
const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Basic safety checks
if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN missing in .env');
  process.exit(1);
}
if (!BOT_API_KEY) {
  console.error('BOT_API_KEY missing in .env');
  process.exit(1);
}

// Supabase client (optional)
let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// In-memory map of "managed bots" statuses (demo). In a real system this
// would be persisted and reflect actual container/VM state.
const managedBots = new Map(); // botId -> { status, containerName, ownerUserId }

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
  console.log(`Discord bot logged in as ${client.user.tag}`);
});

// Minimal commands: !ping and !status
client.on('messageCreate', async (msg) => {
  if (msg.author.bot) return;

  const text = msg.content.trim();
  if (text === '!ping') {
    await msg.reply('🏓 Pong!');
    return;
  }
  if (text.startsWith('!status')) {
    const s = Array.from(managedBots.entries()).map(([id, info]) => `${id}: ${info.status}`).join('\n') || 'No managed bots';
    await msg.reply(`Managed bots:\n${s}`);
    return;
  }

  // Optionally log to Supabase logs table if configured
  if (supabase) {
    try {
      await supabase.from('logs').insert({
        message: text,
        level: 'info',
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Supabase insert failed:', err.message || err);
    }
  }
});

// Start Discord login
client.login(DISCORD_TOKEN).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});

// --- Express control API ---
const app = express();
app.use(bodyParser.json());

// Simple middleware to require BOT_API_KEY
app.use((req, res, next) => {
  const key = req.headers['x-bot-api-key'] || req.query.api_key;
  if (!key || key !== BOT_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', discord_logged_in: !!client.user });
});

// List managed bots (demo)
app.get('/managed-bots', (req, res) => {
  const arr = Array.from(managedBots.entries()).map(([id, v]) => ({ id, ...v }));
  res.json({ bots: arr });
});

// Add or update a managed bot (this is a simulated action).
// In production you would provision containers or VMs here.
app.post('/manage-bot', async (req, res) => {
  const { botId, ownerUserId, containerName } = req.body;
  if (!botId || !ownerUserId) return res.status(400).json({ error: 'botId and ownerUserId required' });

  managedBots.set(botId, { status: 'running', containerName: containerName || `container-${botId}`, ownerUserId, updated_at: new Date().toISOString() });

  // Optionally write to Supabase `vms` and `bots` tables (if available)
  if (supabase) {
    try {
      await supabase.from('bots').upsert({
        id: botId,
        user_id: ownerUserId,
        container_name: containerName || `container-${botId}`,
        status: 'running',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (err) {
      console.warn('Supabase upsert failed:', err.message || err);
    }
  }

  res.json({ ok: true, botId, status: 'running' });
});

// Stop a managed bot
app.post('/stop-bot', async (req, res) => {
  const { botId } = req.body;
  if (!botId) return res.status(400).json({ error: 'botId required' });

  const exist = managedBots.get(botId);
  if (!exist) return res.status(404).json({ error: 'unknown botId' });

  managedBots.set(botId, { ...exist, status: 'stopped', updated_at: new Date().toISOString() });

  if (supabase) {
    try {
      await supabase.from('bots').update({ status: 'stopped', updated_at: new Date().toISOString() }).eq('id', botId);
    } catch (err) {
      console.warn('Supabase update failed:', err.message || err);
    }
  }

  res.json({ ok: true, botId, status: 'stopped' });
});

// Simple endpoint to send a message to a channel (useful for dashboard tests)
app.post('/send-message', async (req, res) => {
  const { channelId, content } = req.body;
  if (!channelId || !content) return res.status(400).json({ error: 'channelId and content required'});

  try {
    const chan = await client.channels.fetch(channelId);
    if (!chan) return res.status(404).json({ error: 'channel not found' });
    await chan.send(String(content));
    res.json({ ok: true });
  } catch (err) {
    console.error('send-message error:', err);
    res.status(500).json({ error: 'failed', details: err.message || err });
  }
});

app.listen(PORT, () => {
  console.log(`Bot control API listening on http://localhost:${PORT} (protected by BOT_API_KEY)`);
});
