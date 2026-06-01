import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to handle BigInt values in json responses
function stringifyBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(stringifyBigInts);
  if (typeof obj === "object") {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = stringifyBigInts(obj[key]);
    }
    return res;
  }
  return obj;
}

// Helpers for chat peers
function parsePeerId(idStr: string): any {
  try {
    if (idStr.startsWith("-") || /^\d+$/.test(idStr)) {
      return BigInt(idStr);
    }
    return idStr;
  } catch {
    return idStr;
  }
}

// Memory storages
const pendingClients = new Map<string, { client: TelegramClient; phone: string; apiId: number; apiHash: string }>();

interface ForwardJob {
  id: string;
  status: 'idle' | 'running' | 'paused_flood' | 'stopped' | 'completed' | 'failed';
  total: number;
  current: number;
  success: number;
  failed: number;
  skipped: number;
  currentMessageId?: string;
  waitingUntil?: number;
  activeWaitSeconds: number;
  itemsState: Record<string, { status: 'pending' | 'success' | 'failed' | 'retrying'; error?: string }>;
  logs: string[];
}

const activeJobs = new Map<string, ForwardJob>();

// Background forwarding task
async function runForwardingLoop(
  jobId: string,
  params: {
    sessionString: string;
    apiId: number;
    apiHash: string;
    sourceChatId: string;
    targetChatId: string;
    messageIds: string[];
    minDelay: number;
    maxDelay: number;
    dropAuthor: boolean;
    batchSize?: number;
  }
) {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const client = new TelegramClient(new StringSession(params.sessionString), params.apiId, params.apiHash, {
    connectionRetries: 5,
  });

  try {
    job.logs.push(`[${new Date().toLocaleTimeString()}] Connecting to Telegram secure servers...`);
    await client.connect();
    job.logs.push(`[${new Date().toLocaleTimeString()}] Connected successfully.`);

    const sourcePeer = await client.getInputEntity(parsePeerId(params.sourceChatId));
    const targetPeer = await client.getInputEntity(parsePeerId(params.targetChatId));

    job.logs.push(`[${new Date().toLocaleTimeString()}] Confirmed access to both source and target chats.`);

    const batchSize = params.batchSize || 25;
    const minDelay = params.minDelay;
    const maxDelay = params.maxDelay;

    // Split messages into chunk batches for parallel transfer rates
    const chunks: string[][] = [];
    for (let i = 0; i < params.messageIds.length; i += batchSize) {
      chunks.push(params.messageIds.slice(i, i + batchSize));
    }

    for (let i = 0; i < chunks.length; i++) {
      if ((job.status as any) === "stopped") {
        job.logs.push(`[${new Date().toLocaleTimeString()}] Job cancelled by user.`);
        break;
      }

      const currentChunk = chunks[i];
      job.logs.push(`[${new Date().toLocaleTimeString()}] Batch ${i + 1}/${chunks.length}: processing ${currentChunk.length} video message(s)...`);

      // Cooldown interval between chunk dispatches
      if (i > 0 && maxDelay > 0) {
        const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        if (delay > 0) {
          job.logs.push(`[${new Date().toLocaleTimeString()}] Interval delay: sleeping ${delay} seconds to satisfy safe traffic patterns...`);
          const targetTime = Date.now() + delay * 1000;
          while (Date.now() < targetTime) {
            if ((job.status as any) === "stopped") {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          if ((job.status as any) === "stopped") {
            job.logs.push(`[${new Date().toLocaleTimeString()}] Job cancelled during sleep interval.`);
            break;
          }
        }
      }

      let batchCompleted = false;
      while (!batchCompleted) {
        if ((job.status as any) === "stopped") {
          break;
        }

        try {
          const numericIds = currentChunk.map(id => parseInt(id));
          
          await client.forwardMessages(targetPeer, {
            messages: numericIds,
            fromPeer: sourcePeer,
            dropAuthor: params.dropAuthor,
          });

          // All successfully forwarded in one swift Telegram RPC call
          for (const msgId of currentChunk) {
            job.itemsState[msgId] = { status: "success" };
            job.success++;
            job.current++;
          }
          job.logs.push(`[${new Date().toLocaleTimeString()}] Swift transitioned batch of ${currentChunk.length} messages.`);
          batchCompleted = true;
        } catch (error: any) {
          console.error(`Batch forward error:`, error);
          const errorMsg = error.message || String(error);
          const isFlood = error.className === "FloodWaitError" || errorMsg.includes("FLOOD_WAIT") || error.seconds;

          if (isFlood) {
            const waitSecs = error.seconds || 300;
            job.status = "paused_flood";
            job.logs.push(`[${new Date().toLocaleTimeString()}] FLOOD WAIT DETECTED: Pausing flow for ${waitSecs}s.`);
            
            job.waitingUntil = Date.now() + waitSecs * 1000;
            job.activeWaitSeconds = waitSecs;

            while (Date.now() < job.waitingUntil) {
              if ((job.status as any) === "stopped") {
                break;
              }
              job.activeWaitSeconds = Math.max(0, Math.ceil((job.waitingUntil - Date.now()) / 1000));
              await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if ((job.status as any) === "stopped") {
              break;
            }

            job.status = "running";
            job.activeWaitSeconds = 0;
            job.logs.push(`[${new Date().toLocaleTimeString()}] Cooldown finished. Resuming batch transits...`);
          } else {
            // Standard peer restriction or specific item problem: fallback processing
            job.logs.push(`[${new Date().toLocaleTimeString()}] Batch error: "${errorMsg}". Retrying as individual fallback to maximize payload delivery...`);
            
            for (const msgId of currentChunk) {
              if ((job.status as any) === "stopped") {
                break;
              }
              const numericMsgId = parseInt(msgId);
              try {
                await client.forwardMessages(targetPeer, {
                  messages: [numericMsgId],
                  fromPeer: sourcePeer,
                  dropAuthor: params.dropAuthor,
                });
                job.itemsState[msgId] = { status: "success" };
                job.success++;
                job.logs.push(`[${new Date().toLocaleTimeString()}] Single item ID ${msgId} forwarded.`);
              } catch (singleErr: any) {
                const singleErrM = singleErr.message || String(singleErr);
                job.itemsState[msgId] = { status: "failed", error: singleErrM };
                job.failed++;
                job.logs.push(`[${new Date().toLocaleTimeString()}] Single item ID ${msgId} failed: ${singleErrM}`);
              }
              job.current++;
            }
            batchCompleted = true;
          }
        }
      }
    }

    if ((job.status as any) === "running" || (job.status as any) === "paused_flood") {
      job.status = "completed";
      job.logs.push(`[${new Date().toLocaleTimeString()}] Fully completed. Processed ${job.success} items successfully.`);
    }
  } catch (error: any) {
    console.error("Critical forwarding worker error:", error);
    job.status = "failed";
    job.logs.push(`[${new Date().toLocaleTimeString()}] Process aborted abnormally: ${error.message || String(error)}`);
  } finally {
    try {
      await client.disconnect();
    } catch {}
    job.logs.push(`[${new Date().toLocaleTimeString()}] Session closed.`);
  }
}

// ---------------------------
// API ENDPOINTS
// ---------------------------

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Step 1: Request Code
app.post("/api/auth/send-code", async (req, res) => {
  const { apiId, apiHash, phone } = req.body;
  if (!apiId || !apiHash || !phone) {
    return res.status(400).json({ error: "Required fields missing (API ID, API Hash, or Phone)" });
  }

  const token = "login_" + Math.random().toString(36).substring(2, 10);
  try {
    const client = new TelegramClient(new StringSession(""), parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.connect();
    
    const codeResult = await client.sendCode(
      {
        apiId: parseInt(apiId),
        apiHash: apiHash,
      },
      phone
    );

    pendingClients.set(token, { client, phone, apiId: parseInt(apiId), apiHash });
    
    // Auto-timeout login attempt in 15 minutes to preserve resources
    setTimeout(() => {
      if (pendingClients.has(token)) {
        const item = pendingClients.get(token);
        item?.client.disconnect().catch(() => {});
        pendingClients.delete(token);
      }
    }, 15 * 60 * 1000);

    res.json({
      success: true,
      loginToken: token,
      phoneCodeHash: codeResult.phoneCodeHash,
    });
  } catch (error: any) {
    console.error("Send Code Failure:", error);
    res.status(500).json({ error: error.message || "Failed to trigger Telegram verification code" });
  }
});

// Step 2: Input Verification & Sign In (supports 2FA if active)
app.post("/api/auth/sign-in", async (req, res) => {
  const { loginToken, phoneCodeHash, phoneCode, password } = req.body;
  if (!loginToken || !phoneCodeHash || !phoneCode) {
    return res.status(400).json({ error: "Verification instructions incomplete." });
  }

  const item = pendingClients.get(loginToken);
  if (!item) {
    return res.status(400).json({ error: "The login session expired. Please re-enter credentials and retry." });
  }

  const { client, phone } = item;

  try {
    let user;
    try {
      user = await client.invoke(new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode,
      }));
    } catch (err: any) {
      const errName = err.className || err.message || "";
      if (errName === "SessionPasswordNeededError" || errName.includes("SESSION_PASSWORD_NEEDED")) {
        if (password) {
          user = await client.signInWithPassword(
            { apiId: item.apiId, apiHash: item.apiHash },
            {
              password: async () => password,
              onError: async (e) => { throw e; },
            }
          );
        } else {
          return res.json({ status: "password_required" });
        }
      } else {
        throw err;
      }
    }
    
    const me = await client.getMe();
    const sessionString = client.session.save();

    pendingClients.delete(loginToken);

    res.json({
      status: "success",
      sessionString,
      user: {
        id: me.id?.toString(),
        username: me.username || "",
        firstName: me.firstName || "",
        lastName: me.lastName || "",
      },
    });
  } catch (error: any) {
    console.error("Sign In failure:", error);
    const errName = error.className || error.message || "";
    if (errName === "SessionPasswordNeededError" || errName.includes("SESSION_PASSWORD_NEEDED") || errName.includes("password")) {
      return res.json({ status: "password_required" });
    }
    
    // Cleanup failed connection
    client.disconnect().catch(() => {});
    pendingClients.delete(loginToken);
    res.status(500).json({ status: "error", error: error.message || "Credential authentication failed" });
  }
});

// Fast Session validation for existing local storage logins
app.post("/api/session/validate", async (req, res) => {
  const { sessionString, apiId, apiHash } = req.body;
  if (!sessionString || !apiId || !apiHash) {
    return res.status(400).json({ error: "Payload parameters invalid" });
  }

  const client = new TelegramClient(new StringSession(sessionString), parseInt(apiId), apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
    const me = await client.getMe();
    await client.disconnect().catch(() => {});
    res.json({
      valid: true,
      user: {
        id: me.id?.toString(),
        username: me.username || "",
        firstName: me.firstName || "",
        lastName: me.lastName || "",
      },
    });
  } catch (error: any) {
    res.json({ valid: false, error: error.message || String(error) });
  }
});

// Fetch user chats/groups
app.post("/api/chats", async (req, res) => {
  const { sessionString, apiId, apiHash } = req.body;
  if (!sessionString || !apiId || !apiHash) {
    return res.status(401).json({ error: "Session missing" });
  }

  const client = new TelegramClient(new StringSession(sessionString), parseInt(apiId), apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
    // Retrieve groups and channels with pagination limits
    const dialogs = await client.getDialogs({ limit: 120 });
    const groups = dialogs
      .filter((d: any) => d.isGroup || d.isChannel)
      .map((d: any) => {
        let canSend = true;
        const entity = d.entity;
        if (entity) {
          const className = entity.className || entity.constructor?.name || "";
          if (className.includes("Forbidden")) {
            canSend = false;
          } else if (className === "Channel") {
            if (entity.left) {
              canSend = false;
            } else if (entity.broadcast) {
              // For broadcast channels, only administrators with posting rights (or creators) can post/forward
              canSend = !!(entity.creator || (entity.adminRights && entity.adminRights.postMessages));
            } else {
              // Megagroup / Supergroup: Can write unless banned explicitly or default banned
              if (entity.creator || entity.adminRights) {
                canSend = true;
              } else {
                if (entity.bannedRights && entity.bannedRights.sendMessages) {
                  canSend = false;
                } else if (entity.defaultBannedRights && entity.defaultBannedRights.sendMessages) {
                  canSend = false;
                }
              }
            }
          } else if (className === "Chat") {
            if (entity.left || entity.deactivated || entity.migratedTo) {
              canSend = false;
            }
          }
        }
        return {
          id: d.id.toString(),
          title: d.title || d.entity?.title || "Unnamed Chat",
          username: d.entity?.username || "",
          isGroup: d.isGroup || false,
          isChannel: d.isChannel || false,
          canSend: canSend,
          noForwards: !!(d.entity?.noforwards),
        };
      });

    await client.disconnect().catch(() => {});
    res.json(stringifyBigInts({ groups }));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve telegram dialogues" });
  }
});

// Scan chat messages to filter videos only
app.post("/api/chats/messages", async (req, res) => {
  const { sessionString, apiId, apiHash, chatId, scanCount = 100 } = req.body;
  if (!sessionString || !apiId || !apiHash || !chatId) {
    return res.status(400).json({ error: "Insufficient arguments to filter channels" });
  }

  const client = new TelegramClient(new StringSession(sessionString), parseInt(apiId), apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
    const entity = await client.getInputEntity(parsePeerId(chatId));
    
    const videoMessages: any[] = [];
    let offsetId = 0;
    const requestedLimit = typeof scanCount === "string" ? scanCount : String(scanCount);
    const isAll = requestedLimit === "all" || requestedLimit === "unlimited" || requestedLimit === "0";
    
    // Set a high ceiling if all is selected (e.g., 50,000 messages) to ensure we fetch as long as there are messages
    const targetToFetch = isAll ? 50000 : parseInt(requestedLimit) || 100;
    const batchLimit = 100;
    let totalFetched = 0;

    while (totalFetched < targetToFetch) {
      const currentLimit = Math.min(batchLimit, targetToFetch - totalFetched);
      const messages = await client.getMessages(entity, {
        limit: currentLimit,
        offsetId: offsetId,
      });

      if (!messages || messages.length === 0) {
        break;
      }

      for (const msg of messages as any[]) {
        if (msg.media && (msg.media.className === "MessageMediaDocument" || msg.media.document)) {
          const doc = msg.media.document;
          if (doc) {
            const isVideo = doc.mimeType && doc.mimeType.startsWith("video/");
            const hasVideoAttr = doc.attributes && doc.attributes.some((attr: any) => attr.className === "DocumentAttributeVideo" || attr.className === "DocumentAttributeVideoLocation" || attr.constructor.name === "DocumentAttributeVideo");
            
            if (isVideo || hasVideoAttr) {
              let duration = 0;
              let isRound = false;
              
              if (doc.attributes) {
                const videoAttr = doc.attributes.find((attr: any) => attr.className === "DocumentAttributeVideo" || attr.constructor.name === "DocumentAttributeVideo");
                if (videoAttr) {
                  duration = videoAttr.duration || 0;
                  isRound = !!videoAttr.roundMessage;
                }
              }

              videoMessages.push({
                id: msg.id.toString(),
                date: msg.date,
                size: doc.size ? parseInt(doc.size.toString()) : undefined,
                duration,
                isRound,
                text: msg.message || "",
              });
            }
          }
        }
      }

      offsetId = messages[messages.length - 1].id;
      totalFetched += messages.length;

      // If we received fewer messages than we asked for, it means we reached the oldest messages
      if (messages.length < currentLimit) {
        break;
      }
    }

    await client.disconnect().catch(() => {});
    res.json(stringifyBigInts({ messages: videoMessages }));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to scan chat logs" });
  }
});

// Start bulk forward
app.post("/api/forward/start", async (req, res) => {
  const {
    sessionString,
    apiId,
    apiHash,
    sourceChatId,
    targetChatId,
    messageIds,
    minDelay = 5,
    maxDelay = 15,
    dropAuthor = false,
    batchSize = 25,
  } = req.body;

  if (!sessionString || !apiId || !apiHash || !sourceChatId || !targetChatId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: "Invalid forwarding instructions" });
  }

  const jobId = "job_" + Date.now();
  
  const initialItemsState: any = {};
  messageIds.forEach((id: string) => {
    initialItemsState[id] = { status: "pending" };
  });

  const job: ForwardJob = {
    id: jobId,
    status: "running",
    total: messageIds.length,
    current: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    activeWaitSeconds: 0,
    itemsState: initialItemsState,
    logs: [`[${new Date().toLocaleTimeString()}] Bulk forwarding task initialized with ${messageIds.length} video notes.`],
  };

  activeJobs.set(jobId, job);

  // Spark off background thread autonomously
  runForwardingLoop(jobId, {
    sessionString,
    apiId: parseInt(apiId),
    apiHash,
    sourceChatId,
    targetChatId,
    messageIds,
    minDelay: parseInt(minDelay),
    maxDelay: parseInt(maxDelay),
    dropAuthor: !!dropAuthor,
    batchSize: parseInt(batchSize),
  }).catch((err) => {
    console.error(`Autonomous forward worker errored on starting job ${jobId}:`, err);
  });

  res.json({ success: true, jobId });
});

// Stop bulk forward
app.post("/api/forward/stop", (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: "Missing jobId" });
  }

  const job = activeJobs.get(jobId);
  if (job) {
    job.status = "stopped";
    job.logs.push(`[${new Date().toLocaleTimeString()}] Stop command logged. Cancelling immediately...`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Job sequence not indexable" });
  }
});

// Fetch current bulk status
app.get("/api/forward/status", (req, res) => {
  const { jobId } = req.query;
  if (!jobId || typeof jobId !== "string") {
    return res.status(400).json({ error: "Required param jobId missing" });
  }

  const job = activeJobs.get(jobId);
  if (job) {
    res.json({ jobState: job });
  } else {
    res.status(404).json({ error: "Job sequence not registered" });
  }
});


// ---------------------------
// VITE AND SERVING PIPELINE
// ---------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Telegram Bot Forwarding Server successfully bound to http://localhost:${PORT}`);
  });
}

startServer();
