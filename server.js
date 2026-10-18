import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const NORMALIZED_EMAIL = '24f1001595@ds.study.iitm.ac.in'.trim().toLowerCase();

// Handle standard MCP JSON-RPC requests over HTTP POST
app.post('/', (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};

  // Standard MCP Initialize handshake
  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'exam-challenge-server',
          version: '1.0.0'
        }
      }
    });
  }

  // MCP Initialized notification (no response body needed for notifications)
  if (method === 'notifications/initialized') {
    return res.status(204).end();
  }

  // MCP Tools List: must expose exactly solve_challenge
  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'solve_challenge',
            description: 'Solves the live exam challenge header verification',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ]
      }
    });
  }

  // MCP Tools Call
  if (method === 'tools/call') {
    const toolName = params?.name;

    if (toolName === 'solve_challenge') {
      // Extract header: case-insensitive in Express
      const challenge = req.headers['x-exam-challenge'];

      if (!challenge) {
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Missing X-Exam-Challenge header'
          }
        });
      }

      // Compute first 16 lowercase hex characters of SHA-256("${challenge}:${normalizedEmail}")
      const rawPayload = `${challenge}:${NORMALIZED_EMAIL}`;
      const hash = crypto.createHash('sha256').update(rawPayload).digest('hex').toLowerCase();
      const outputText = hash.substring(0, 16);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: outputText
            }
          ]
        }
      });
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unknown tool: ${toolName}`
      }
    });
  }

  // Ping / health check fallback
  if (method === 'ping') {
    return res.json({ jsonrpc: '2.0', id, result: {} });
  }

  return res.json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method not found: ${method}`
    }
  });
});

// GET / health route for hosting platforms
app.get('/', (req, res) => {
  res.send('MCP challenge server is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP server listening on port ${PORT}`);
});