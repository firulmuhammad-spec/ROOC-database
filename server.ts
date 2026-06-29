import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload size limit to support Base64 images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API route to proxy Gemini API scanning requests
  app.post("/api/scan", async (req, res) => {
    try {
      const { imageBase64, model, type } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 parameter" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server" });
      }

      // Default model if not specified
      const selectedModel = model || "gemini-2.5-flash";

      // Parse image base64 and mime-type
      let mimeType = "image/jpeg";
      let base64Data = imageBase64;
      if (imageBase64.includes(";base64,")) {
        const parts = imageBase64.split(";base64,");
        mimeType = parts[0].replace("data:", "");
        base64Data = parts[1];
      }

      // Define standard prompts based on scan type
      let promptText = "";
      if (type === "skill") {
        promptText = `
This is an image/screenshot from the game Ragnarok Origin Classic (ROOC).
Analyze this image and extract information about the skill. 
Translate or keep names and descriptions in Indonesian/English as found in ROOC.
You must return a valid JSON object with the following fields:
{
  "name": "Skill Name",
  "type": "PDMG" or "MDMG" or "Support" or "Passive",
  "percentage": "e.g., 250% or +15%",
  "cooldown": "e.g., 1.5s or None",
  "castTime": "e.g., Instant or 0.5s",
  "spCost": "e.g., 30 SP",
  "description": "Short explanation of skill effects, e.g., 'Memberikan physical damage ke musuh...'"
}
Do NOT include markdown wrapping (like \`\`\`json) or any explanation. Return strictly only the raw JSON.
`;
      } else {
        promptText = `
This is an image/screenshot from the game Ragnarok Origin Classic (ROOC).
Analyze this image and extract information about the card. 
Translate or keep details in Indonesian/English as found in ROOC.
You must return a valid JSON object with the following fields:
{
  "name": "Card Name (e.g., Poring Card)",
  "slot": "e.g., Weapon, Armor, Garment, Shoes, Accessory, Headwear",
  "effect": "Detailed stats or bonuses from the card (e.g., MaxHP +100, LUK +2)",
  "stats": "Short stat summary",
  "sourceMonster": "The monster that drops this card (e.g., Poring)"
}
Do NOT include markdown wrapping (like \`\`\`json) or any explanation. Return strictly only the raw JSON.
`;
      }

      // Build Gemini REST API request payload
      const requestPayload = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        return res.status(response.status).json({
          error: `Gemini API returned status ${response.status}`,
          details: errorData
        });
      }

      const data = await response.json();
      
      // Extract the generated text
      const candidates = data.candidates || [];
      if (candidates.length === 0) {
        return res.status(500).json({ error: "No completion candidates returned by Gemini" });
      }

      const text = candidates[0].content.parts[0].text;
      
      // Attempt to clean the text to ensure it's pure JSON
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.substring(7);
      }
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.substring(3);
      }
      if (cleanedText.endsWith("```")) {
        cleanedText = cleanedText.substring(0, cleanedText.length - 3);
      }
      cleanedText = cleanedText.trim();

      // Attempt parsing to make sure it is valid JSON
      try {
        const jsonResult = JSON.parse(cleanedText);
        return res.json(jsonResult);
      } catch (parseError) {
        console.error("Failed to parse JSON from response:", cleanedText);
        return res.status(500).json({
          error: "Failed to parse JSON response from Gemini",
          rawText: text
        });
      }

    } catch (error: any) {
      console.error("Scan error:", error);
      return res.status(500).json({ error: error.message || "Unknown error during scan" });
    }
  });

  // Vite middleware for development or Static serve for production
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
