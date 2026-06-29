/**
 * Helper to convert standard HTML5 File object to Base64 data string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as Base64 string"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}
