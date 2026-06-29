export interface ScanResult {
  data?: any;
  success: boolean;
  error?: string;
}

/**
 * Executes a scanning process with a series of fallback models.
 * Reports changes in model-status back to the UI in real-time.
 */
export async function runAIScan(
  imageBase64: string,
  type: "skill" | "card",
  onStatusUpdate: (status: string) => void
): Promise<ScanResult> {
  const models = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash"
  ];

  for (let i = 0; i < models.length; i++) {
    const currentModel = models[i];
    try {
      // 1. Inform UI which model we are currently scanning with
      onStatusUpdate(`Scanning with ${currentModel}...`);

      // 2. Fetch from the local full-stack server proxy
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageBase64,
          model: currentModel,
          type
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const parsedJSON = await response.json();
      
      // Verification of extracted structure
      if (!parsedJSON || typeof parsedJSON !== "object") {
        throw new Error("Invalid or empty JSON format returned");
      }

      onStatusUpdate(`Success! Fully extracted information using ${currentModel}.`);
      return { data: parsedJSON, success: true };

    } catch (error: any) {
      console.warn(`Attempt with ${currentModel} failed:`, error.message);
      
      const nextModel = models[i + 1];
      if (nextModel) {
        // Report the exact model failure and transition to the next model as requested
        onStatusUpdate(`Scanning with ${currentModel} failed, trying ${nextModel}...`);
        
        // Wait brief delay before retrying for visual feedback consistency
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        onStatusUpdate("All scanning models failed. Please fill details manually or retry.");
        return {
          success: false,
          error: `All models in fallback loop failed. Last error: ${error.message}`
        };
      }
    }
  }

  return { success: false, error: "Scanning flow exhausted without outcome." };
}
