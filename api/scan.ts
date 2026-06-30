import type { IncomingMessage, ServerResponse } from "http";

interface VercelRequest extends IncomingMessage {
  query: { [key: string]: string | string[] };
  cookies: { [key: string]: string };
  body: any;
}

interface VercelResponse extends ServerResponse {
  send: (body: any) => VercelResponse;
  json: (jsonBody: any) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { imageBase64, model, type } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 parameter" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the Vercel server environment" });
    }

    // Default model if not specified
    const selectedModel = model || "gemini-3.5-flash";

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
This is an image/screenshot of a skill card from the game Ragnarok Origin Classic (ROOC).
Analyze this image and extract information about the skill carefully. 
Translate or keep names and descriptions in Indonesian/English as found in ROOC.

IMPORTANT INSTRUCTIONS FOR SKILL TITLE & LEVEL SEPARATION:
- The skill title in the image has the format "Name Lv.X" (e.g., "Amp Lv.5", "Gypsy's Kiss Lv.10", "Lullaby Lv.1", "Blitz Beat Lv.10").
- You MUST separate this into two fields:
  1. "name": The clean skill name ONLY, without the level suffix (e.g., "Amp", "Gypsy's Kiss", "Lullaby", "Blitz Beat").
  2. "level": The skill level string exactly as shown (e.g., "Lv.5", "Lv.10", "Lv.1").

IMPORTANT INSTRUCTIONS FOR ALTERNATIVE DESCRIPTIONS:
- Look at the main description block. Some skills have a main description (usually in dark blue/black font) followed by an alternative/additional description text (which is smaller, colored in lighter grey/muted grey font, e.g., "This skill costs 2 SP per sec...", "Commands the falcon to...", "MATK carries 4 times refined...").
- Extract this grey, smaller-font, muted secondary description text into the "alternativeDescription" field.
- Keep the primary description text (darker text, active/passive formula details) in the "description" field.
- If there is no such grey secondary description text, leave "alternativeDescription" as an empty string "".

You must return a valid JSON object with the following fields:
{
  "name": "Clean Skill Name (without Lv.X suffix)",
  "level": "e.g., Lv.5 or Lv.10",
  "type": "PDMG" or "MDMG" or "Support" or "Passive",
  "percentage": "e.g., 250% or +15%",
  "cooldown": "e.g., 1.5s or None",
  "castTime": "e.g., Instant or 0.5s",
  "spCost": "e.g., 30 SP",
  "description": "Primary explanation of skill effects (usually dark text)",
  "alternativeDescription": "Secondary greyed-out smaller text explanation of alternative mechanics, or empty string if not present"
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
      return res.status(200).json(jsonResult);
    } catch (parseError) {
      console.error("Failed to parse JSON from response:", cleanedText);
      return res.status(500).json({
        error: "Failed to parse JSON response from Gemini",
        rawText: text
      });
    }

  } catch (error: any) {
    console.error("Scan error in serverless function:", error);
    return res.status(500).json({ error: error.message || "Unknown error during scan" });
  }
}
